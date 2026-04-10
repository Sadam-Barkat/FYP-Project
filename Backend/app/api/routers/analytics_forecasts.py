"""
Analytics & Forecasts API — operational intelligence layer on top of hospital data.

Combines:
- Historical series from the database (admissions, revenue, occupancy, alerts, vitals).
- Short-horizon forecasts using damped trend extrapolation (blended with trailing mean),
  with optional overrides from the `forecasts` table when populated.
- Rule-based insights (capacity, acuity mix, revenue/admission momentum, alert load).
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import Date, and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.admission import Admission
from app.models.alert import Alert, AlertSeverity
from app.models.billing import Billing, BillingStatus
from app.models.bed import Bed
from app.models.vital import Vital
from app.models.analytics import Forecast

router = APIRouter(prefix="/api", tags=["analytics_forecasts"])

HISTORY_DAYS = 14
FORECAST_DAYS = 7
ROLLING_DAYS = 7
CAPACITY_STRESS_PCT = 85.0
CAPACITY_ELEVATED_PCT = 75.0
CI_MARGIN_ADMISSIONS = 0.16
CI_MARGIN_REVENUE = 0.12
CI_MARGIN_OCC_PTS = 7.0  # absolute percentage points


def _moving_avg_prediction(series: List[float], next_n: int) -> List[float]:
    if not series:
        return [0.0] * next_n
    window = series[-ROLLING_DAYS:] if len(series) >= ROLLING_DAYS else series
    avg = sum(window) / len(window)
    return [round(avg, 2) for _ in range(next_n)]


def _trend_damped_forecast(
    series: List[float],
    next_n: int,
    *,
    lo: Optional[float] = None,
    hi: Optional[float] = None,
) -> List[float]:
    """
    Damped local trend + reversion to trailing mean. No extra dependencies.
    Suitable for short operational horizons (7 days), not clinical prediction.
    """
    if not series:
        return [0.0] * next_n
    n = len(series)
    mean_all = sum(series) / n
    last = series[-1]

    if n >= 6:
        recent = sum(series[-5:]) / 5
        older = sum(series[-10:-5]) / 5 if n >= 10 else sum(series[:5]) / min(5, n)
        per_day_drift = (recent - older) / 5.0
    elif n >= 2:
        per_day_drift = (series[-1] - series[0]) / max(n - 1, 1)
    else:
        per_day_drift = 0.0

    out: List[float] = []
    for h in range(1, next_n + 1):
        damping = 0.88**h
        trend_part = last + per_day_drift * h * damping
        blended = 0.58 * trend_part + 0.42 * mean_all
        v = blended
        if lo is not None:
            v = max(lo, v)
        if hi is not None:
            v = min(hi, v)
        out.append(round(v, 2))
    return out


def _pick_forecast_values(
    series: List[float],
    next_n: int,
    *,
    lo: Optional[float] = None,
    hi: Optional[float] = None,
) -> Tuple[List[float], str]:
    """Return (values, method_key)."""
    if not series or all(x == 0 for x in series):
        return _moving_avg_prediction(series, next_n), "seven_day_moving_average"
    if len(series) < 3:
        return _moving_avg_prediction(series, next_n), "seven_day_moving_average"
    return _trend_damped_forecast(series, next_n, lo=lo, hi=hi), "damped_trend_with_mean_reversion"


def _attach_uncertainty_bands(
    points: List[Dict[str, Any]],
    value_key: str,
    low_key: str,
    high_key: str,
    margin_mode: str,
) -> None:
    for p in points:
        v = float(p[value_key])
        if margin_mode == "admissions":
            m = max(0.8, abs(v) * CI_MARGIN_ADMISSIONS)
        elif margin_mode == "revenue":
            m = max(500.0, abs(v) * CI_MARGIN_REVENUE)
        else:
            m = CI_MARGIN_OCC_PTS
        p[low_key] = round(max(0.0, v - m), 2)
        p[high_key] = round(v + m, 2)


async def _get_forecast_values(
    db: AsyncSession, metric_name: str, forecast_dates: List[date]
) -> Optional[List[float]]:
    if not forecast_dates:
        return None
    day_start = datetime.combine(forecast_dates[0], time.min)
    day_end = datetime.combine(forecast_dates[-1], time.max)
    stmt = select(cast(Forecast.forecast_date, Date).label("day"), Forecast.value).where(
        and_(
            Forecast.metric_name == metric_name,
            Forecast.forecast_date >= day_start,
            Forecast.forecast_date <= day_end,
        )
    )
    result = await db.execute(stmt)
    rows = {row.day: row.value for row in result.all()}
    values = [float(rows.get(d, 0)) for d in forecast_dates]
    if not any(v != 0 for v in values):
        return None
    return values


def _pct_change(current: float, previous: float) -> Optional[float]:
    if previous == 0:
        return None if current == 0 else 100.0
    return round(100.0 * (current - previous) / previous, 1)


def _build_insights(
    *,
    occupancy_now: float,
    occ_forecast_avg: float,
    admissions_wow: Optional[float],
    revenue_wow: Optional[float],
    high_acuity_pct: Optional[float],
    alerts_last7: int,
    alerts_prior7: int,
    ward_top: Optional[Tuple[str, int]],
) -> List[Dict[str, Any]]:
    insights: List[Dict[str, Any]] = []

    if occupancy_now >= CAPACITY_STRESS_PCT:
        insights.append(
            {
                "severity": "critical",
                "title": "Bed capacity under stress",
                "detail": f"Current occupancy is {occupancy_now:.1f}% (≥{CAPACITY_STRESS_PCT:.0f}%). "
                "Consider surge staffing, transfers, or elective deferral.",
                "metric": "bed_occupancy",
            }
        )
    elif occupancy_now >= CAPACITY_ELEVATED_PCT:
        insights.append(
            {
                "severity": "warning",
                "title": "Elevated occupancy",
                "detail": f"Occupancy {occupancy_now:.1f}% is above the {CAPACITY_ELEVATED_PCT:.0f}% watch threshold. "
                f"7-day average forecast sits near {occ_forecast_avg:.1f}%.",
                "metric": "bed_occupancy",
            }
        )

    if admissions_wow is not None:
        if admissions_wow >= 18:
            insights.append(
                {
                    "severity": "warning",
                    "title": "Admission intake accelerating",
                    "detail": f"Trailing 7-day admissions are up ~{admissions_wow:.0f}% vs the prior week. "
                    "Align bed flow and intake staffing with the trend.",
                    "metric": "admissions",
                }
            )
        elif admissions_wow <= -18:
            insights.append(
                {
                    "severity": "info",
                    "title": "Admission volume softening",
                    "detail": f"Trailing admissions are down ~{abs(admissions_wow):.0f}% week-over-week. "
                    "Use spare capacity for backlog procedures or training.",
                    "metric": "admissions",
                }
            )

    if revenue_wow is not None:
        if revenue_wow <= -15:
            insights.append(
                {
                    "severity": "warning",
                    "title": "Paid revenue downtrend",
                    "detail": f"Paid collections in the last 7 days are ~{abs(revenue_wow):.0f}% below the prior week. "
                    "Review pending bills, insurance holds, and discharge billing completeness.",
                    "metric": "revenue",
                }
            )
        elif revenue_wow >= 15:
            insights.append(
                {
                    "severity": "info",
                    "title": "Strong revenue week",
                    "detail": f"Paid revenue is up ~{revenue_wow:.0f}% vs the previous 7 days.",
                    "metric": "revenue",
                }
            )

    if high_acuity_pct is not None and high_acuity_pct >= 35:
        insights.append(
            {
                "severity": "critical",
                "title": "High acuity vitals mix",
                "detail": f"~{high_acuity_pct:.0f}% of classified vitals are Critical or Emergency. "
                "Escalate nurse ratios and physician coverage in hot wards.",
                "metric": "vitals_acuity",
            }
        )
    elif high_acuity_pct is not None and high_acuity_pct >= 20:
        insights.append(
            {
                "severity": "warning",
                "title": "Raised acuity footprint",
                "detail": f"Critical/Emergency vitals represent ~{high_acuity_pct:.0f}% of readings. "
                "Monitor closely for further deterioration.",
                "metric": "vitals_acuity",
            }
        )

    if alerts_prior7 > 0 and alerts_last7 > alerts_prior7 * 1.45:
        insights.append(
            {
                "severity": "warning",
                "title": "Alert load spike",
                "detail": f"{alerts_last7} alerts in the last 7 days vs {alerts_prior7} in the week before. "
                "Triage unresolved critical items and check device/integration noise.",
                "metric": "alerts",
            }
        )

    if ward_top and ward_top[1] >= 3:
        insights.append(
            {
                "severity": "info",
                "title": "Ward demand concentration",
                "detail": f"Highest admission count in the last 7 days: {ward_top[0]} ({ward_top[1]} admissions). "
                "Use this for staffing and supply positioning.",
                "metric": "ward_mix",
            }
        )

    if not insights:
        insights.append(
            {
                "severity": "info",
                "title": "Operations within typical bands",
                "detail": "No major rule-based exceptions fired on capacity, acuity, revenue, or alerts. "
                "Continue monitoring forecasts as new admissions and vitals arrive.",
                "metric": "general",
            }
        )

    return insights[:10]


def _capacity_risk_score(
    occupancy_now: float,
    high_acuity_pct: Optional[float],
    alerts_last7: int,
) -> Tuple[int, str]:
    occ_score = min(55, max(0, occupancy_now * 0.55))
    acuity_score = min(30, (high_acuity_pct or 0) * 0.65)
    alert_score = min(25, alerts_last7 * 1.2)
    raw = int(occ_score + acuity_score + alert_score)
    score = max(0, min(100, raw))
    if score >= 72:
        label = "High"
    elif score >= 45:
        label = "Moderate"
    else:
        label = "Low"
    return score, label


@router.get("/analytics-forecasts")
async def get_analytics_forecasts(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Operational analytics: historical KPIs, short forecasts, uncertainty bands, and narrative insights.
    Forecasts are for planning visibility only—not clinical decision support.
    """
    try:
        today = date.today()
        history_start = today - timedelta(days=HISTORY_DAYS - 1)
        day_list = [history_start + timedelta(days=i) for i in range(HISTORY_DAYS)]

        # ---- Admissions ----
        admission_counts: Dict[date, int] = {d: 0 for d in day_list}
        adm_stmt = (
            select(cast(Admission.admission_date, Date).label("day"), func.count(Admission.id).label("cnt"))
            .where(
                and_(
                    cast(Admission.admission_date, Date) >= history_start,
                    cast(Admission.admission_date, Date) <= today,
                )
            )
            .group_by(cast(Admission.admission_date, Date))
        )
        adm_result = await db.execute(adm_stmt)
        for row in adm_result.all():
            admission_counts[row.day] = row.cnt
        admission_trend = [{"date": d.isoformat(), "count": admission_counts[d]} for d in day_list]
        admission_series = [float(admission_counts[d]) for d in day_list]

        forecast_dates = [today + timedelta(days=i) for i in range(1, FORECAST_DAYS + 1)]
        forecast_adm = await _get_forecast_values(db, "admissions", forecast_dates)
        adm_method = "stored_forecast_rows"
        if forecast_adm is None:
            forecast_adm, adm_method = _pick_forecast_values(admission_series, FORECAST_DAYS, lo=0.0, hi=None)
        admission_forecast = [
            {"date": d.isoformat(), "predicted_count": round(forecast_adm[i], 2)} for i, d in enumerate(forecast_dates)
        ]
        _attach_uncertainty_bands(admission_forecast, "predicted_count", "band_low", "band_high", "admissions")

        # ---- Revenue ----
        revenue_trend: List[Dict[str, Any]] = []
        revenue_series: List[float] = []
        for d in day_list:
            day_start = datetime.combine(d, time.min)
            day_end = datetime.combine(d, time.max)
            rev_stmt = select(func.coalesce(func.sum(Billing.amount), 0.0)).where(
                and_(
                    Billing.status == BillingStatus.paid,
                    Billing.date >= day_start,
                    Billing.date <= day_end,
                )
            )
            rev_result = await db.execute(rev_stmt)
            val = float(rev_result.scalar_one() or 0.0)
            revenue_trend.append({"date": d.isoformat(), "revenue": round(val, 2)})
            revenue_series.append(val)

        revenue_forecast_vals = await _get_forecast_values(db, "revenue", forecast_dates)
        rev_method = "stored_forecast_rows"
        if revenue_forecast_vals is None:
            revenue_forecast_vals, rev_method = _pick_forecast_values(revenue_series, FORECAST_DAYS, lo=0.0, hi=None)
        revenue_forecast = [
            {"date": d.isoformat(), "predicted_revenue": round(revenue_forecast_vals[i], 2)}
            for i, d in enumerate(forecast_dates)
        ]
        _attach_uncertainty_bands(revenue_forecast, "predicted_revenue", "band_low", "band_high", "revenue")

        # ---- Bed occupancy ----
        total_beds_result = await db.execute(select(func.count(Bed.id)))
        total_beds = int(total_beds_result.scalar_one() or 1)
        occupancy_series: List[float] = []
        for d in day_list:
            day_end = datetime.combine(d, time.max)
            occ_stmt = select(func.count(Admission.id)).where(
                and_(
                    Admission.admission_date <= day_end,
                    Admission.discharge_date.is_(None),
                )
            )
            occ_result = await db.execute(occ_stmt)
            occupied = occ_result.scalar_one() or 0
            pct = round(100.0 * occupied / total_beds, 1) if total_beds else 0.0
            occupancy_series.append(pct)
        bed_occupancy_trend = [
            {"date": day_list[i].isoformat(), "occupancy_pct": occupancy_series[i]} for i in range(len(day_list))
        ]

        occ_forecast = await _get_forecast_values(db, "bed_occupancy_pct", forecast_dates)
        occ_method = "stored_forecast_rows"
        if occ_forecast is None:
            occ_forecast, occ_method = _pick_forecast_values(
                occupancy_series, FORECAST_DAYS, lo=0.0, hi=100.0
            )
        bed_occupancy_forecast = [
            {"date": d.isoformat(), "predicted_occupancy_pct": round(occ_forecast[i], 2)}
            for i, d in enumerate(forecast_dates)
        ]
        _attach_uncertainty_bands(
            bed_occupancy_forecast, "predicted_occupancy_pct", "band_low", "band_high", "occupancy"
        )

        # ---- Alerts ----
        alert_days_14 = [today - timedelta(days=i) for i in range(13, -1, -1)]
        alert_daily: List[Tuple[date, int, int]] = []
        for d in alert_days_14:
            day_start = datetime.combine(d, time.min)
            day_end = datetime.combine(d, time.max)
            crit_stmt = select(func.count(Alert.id)).where(
                and_(
                    Alert.severity == AlertSeverity.critical,
                    Alert.created_at >= day_start,
                    Alert.created_at <= day_end,
                )
            )
            high_stmt = select(func.count(Alert.id)).where(
                and_(
                    Alert.severity.in_([AlertSeverity.high, AlertSeverity.medium]),
                    Alert.created_at >= day_start,
                    Alert.created_at <= day_end,
                )
            )
            c = (await db.execute(crit_stmt)).scalar_one() or 0
            h = (await db.execute(high_stmt)).scalar_one() or 0
            alert_daily.append((d, int(c), int(h)))

        alert_trend = [
            {"date": d.isoformat(), "critical": c, "warning": h, "total": c + h}
            for d, c, h in alert_daily[-7:]
        ]

        alerts_last7 = sum(x[2] for x in alert_daily[-7:])
        alerts_prior7 = sum(x[2] for x in alert_daily[-14:-7])

        # ---- Vitals condition distribution ----
        cond_stmt = select(Vital.condition_level, func.count(Vital.id)).where(
            Vital.condition_level.isnot(None)
        ).group_by(Vital.condition_level)
        cond_result = await db.execute(cond_stmt)
        cond_map = {row[0]: row[1] for row in cond_result.all()}
        normal_n = int(cond_map.get("Normal", 0) + cond_map.get("normal", 0))
        crit_n = int(cond_map.get("Critical", 0) + cond_map.get("critical", 0))
        emerg_n = int(cond_map.get("Emergency", 0) + cond_map.get("emergency", 0))
        condition_distribution = {
            "normal": normal_n,
            "critical": crit_n,
            "emergency": emerg_n,
        }
        vitals_total = max(1, normal_n + crit_n + emerg_n)
        high_acuity_pct = round(100.0 * (crit_n + emerg_n) / vitals_total, 1)

        # ---- Ward mix (admissions last 7d) ----
        ward_start = today - timedelta(days=6)
        ward_stmt = (
            select(Bed.ward, func.count(Admission.id))
            .join(Admission, Admission.bed_id == Bed.id)
            .where(cast(Admission.admission_date, Date) >= ward_start)
            .group_by(Bed.ward)
            .order_by(func.count(Admission.id).desc())
        )
        ward_result = await db.execute(ward_stmt)
        ward_rows = ward_result.all()
        ward_admissions_7d = [{"ward": w or "Unknown", "count": int(c)} for w, c in ward_rows[:8]]
        ward_top: Optional[Tuple[str, int]] = None
        if ward_rows:
            ward_top = (str(ward_rows[0][0] or "Unknown"), int(ward_rows[0][1]))

        # ---- KPIs (week-over-week) ----
        adm_last7 = sum(admission_series[-7:])
        adm_prior7 = sum(admission_series[-14:-7]) if len(admission_series) >= 14 else 0
        rev_last7 = sum(revenue_series[-7:])
        rev_prior7 = sum(revenue_series[-14:-7]) if len(revenue_series) >= 14 else 0
        occ_now = occupancy_series[-1] if occupancy_series else 0.0
        occ_forecast_avg = round(sum(occ_forecast) / len(occ_forecast), 1) if occ_forecast else 0.0
        adm_forecast_sum = round(sum(forecast_adm), 1)
        rev_forecast_sum = round(sum(revenue_forecast_vals), 2)

        risk_score, risk_label = _capacity_risk_score(occ_now, high_acuity_pct, alerts_last7)

        insights = _build_insights(
            occupancy_now=occ_now,
            occ_forecast_avg=occ_forecast_avg,
            admissions_wow=_pct_change(adm_last7, adm_prior7),
            revenue_wow=_pct_change(rev_last7, rev_prior7),
            high_acuity_pct=high_acuity_pct,
            alerts_last7=alerts_last7,
            alerts_prior7=alerts_prior7,
            ward_top=ward_top,
        )

        forecast_engine = {
            "horizon_days": FORECAST_DAYS,
            "history_days": HISTORY_DAYS,
            "methods": {
                "admissions": adm_method,
                "revenue": rev_method,
                "bed_occupancy_pct": occ_method,
            },
            "uncertainty": "Bands are heuristic ±ranges around point forecasts for scenario visibility; they are not statistical confidence intervals.",
        }

        kpi = {
            "admissions_trailing_7d": int(adm_last7),
            "admissions_prior_7d": int(adm_prior7),
            "admissions_wow_change_pct": _pct_change(adm_last7, adm_prior7),
            "admissions_forecast_7d_sum": adm_forecast_sum,
            "revenue_trailing_7d_pkr": round(rev_last7, 2),
            "revenue_prior_7d_pkr": round(rev_prior7, 2),
            "revenue_wow_change_pct": _pct_change(rev_last7, rev_prior7),
            "revenue_forecast_7d_sum_pkr": rev_forecast_sum,
            "bed_occupancy_now_pct": occ_now,
            "bed_occupancy_avg_7d_pct": round(sum(occupancy_series[-7:]) / min(7, len(occupancy_series)), 1)
            if occupancy_series
            else 0.0,
            "bed_occupancy_forecast_avg_7d_pct": occ_forecast_avg,
            "vitals_high_acuity_pct": high_acuity_pct,
            "alerts_7d_total": alerts_last7,
            "alerts_prior_7d_total": alerts_prior7,
            "capacity_risk_score_0_100": risk_score,
            "capacity_risk_label": risk_label,
        }

        return {
            "admission_trend": admission_trend,
            "admission_forecast": admission_forecast,
            "revenue_trend": revenue_trend,
            "revenue_forecast": revenue_forecast,
            "bed_occupancy_trend": bed_occupancy_trend,
            "bed_occupancy_forecast": bed_occupancy_forecast,
            "alert_trend": alert_trend,
            "condition_distribution": condition_distribution,
            "total_beds": total_beds,
            "ward_admissions_7d": ward_admissions_7d,
            "kpi": kpi,
            "insights": insights,
            "forecast_engine": forecast_engine,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load analytics and forecasts: {exc}",
        )
