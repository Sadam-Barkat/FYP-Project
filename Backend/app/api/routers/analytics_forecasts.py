"""
Analytics & Forecasts API — predictive trends from current data.
Uses historical series and simple moving-average prediction (no extra deps).
"""
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List

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
ROLLING_DAYS = 7  # for prediction: avg of last N days


def _moving_avg_prediction(series: List[float], next_n: int) -> List[float]:
    """Next `next_n` values as moving average of last ROLLING_DAYS (or all if fewer)."""
    if not series:
        return [0.0] * next_n
    window = series[-ROLLING_DAYS:] if len(series) >= ROLLING_DAYS else series
    avg = sum(window) / len(window)
    return [round(avg, 2) for _ in range(next_n)]


async def _get_forecast_values(
    db: AsyncSession, metric_name: str, forecast_dates: List[date]
) -> List[float] | None:
    """Return list of forecast values for the given metric and dates, or None if no rows."""
    if not forecast_dates:
        return None
    day_start = datetime.combine(forecast_dates[0], time.min)
    day_end = datetime.combine(forecast_dates[-1], time.max)
    stmt = (
        select(cast(Forecast.forecast_date, Date).label("day"), Forecast.value)
        .where(
            and_(
                Forecast.metric_name == metric_name,
                Forecast.forecast_date >= day_start,
                Forecast.forecast_date <= day_end,
            )
        )
    )
    result = await db.execute(stmt)
    rows = {row.day: row.value for row in result.all()}
    values = [float(rows.get(d, 0)) for d in forecast_dates]
    if not any(v != 0 for v in values):
        return None
    return values


@router.get("/analytics-forecasts")
async def get_analytics_forecasts(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Predictive trends and analytics for the Analytics & Forecasts page.
    Historical series from DB; forecasts via simple moving average of last 7 days.
    """
    try:
        today = date.today()
        history_start = today - timedelta(days=HISTORY_DAYS - 1)
        day_list = [history_start + timedelta(days=i) for i in range(HISTORY_DAYS)]

        # ---- Admissions: daily count (by admission_date) ----
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
        admission_series = [admission_counts[d] for d in day_list]
        forecast_dates = [today + timedelta(days=i) for i in range(1, FORECAST_DAYS + 1)]
        # Use Forecast table if populated, else moving average
        forecast_adm = await _get_forecast_values(db, "admissions", forecast_dates)
        if forecast_adm is None:
            forecast_adm = _moving_avg_prediction(admission_series, FORECAST_DAYS)
        admission_forecast = [{"date": d.isoformat(), "predicted_count": round(forecast_adm[i], 2)} for i, d in enumerate(forecast_dates)]

        # ---- Revenue: daily paid amount ----
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
        if revenue_forecast_vals is None:
            revenue_forecast_vals = _moving_avg_prediction(revenue_series, FORECAST_DAYS)
        revenue_forecast = [{"date": d.isoformat(), "predicted_revenue": round(revenue_forecast_vals[i], 2)} for i, d in enumerate(forecast_dates)]

        # ---- Bed occupancy: daily % (occupied/total) ----
        total_beds_result = await db.execute(select(func.count(Bed.id)))
        total_beds = total_beds_result.scalar_one() or 1
        occupancy_series: List[float] = []
        for d in day_list:
            day_end = datetime.combine(d, time.max)
            occ_stmt = (
                select(func.count(Admission.id))
                .where(
                    and_(
                        Admission.admission_date <= day_end,
                        Admission.discharge_date.is_(None),
                    )
                )
            )
            occ_result = await db.execute(occ_stmt)
            occupied = occ_result.scalar_one() or 0
            pct = round(100.0 * occupied / total_beds, 1) if total_beds else 0.0
            occupancy_series.append(pct)
        bed_occupancy_trend = [{"date": day_list[i].isoformat(), "occupancy_pct": occupancy_series[i]} for i in range(len(day_list))]
        occ_forecast = await _get_forecast_values(db, "bed_occupancy_pct", forecast_dates)
        if occ_forecast is None:
            occ_forecast = _moving_avg_prediction(occupancy_series, FORECAST_DAYS)
        bed_occupancy_forecast = [{"date": d.isoformat(), "predicted_occupancy_pct": round(occ_forecast[i], 2)} for i, d in enumerate(forecast_dates)]

        # ---- Alerts: daily count by severity (last 7 days for trend) ----
        alert_days = [today - timedelta(days=i) for i in range(6, -1, -1)]
        alert_trend: List[Dict[str, Any]] = []
        for d in alert_days:
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
            alert_trend.append({
                "date": d.isoformat(),
                "critical": c,
                "warning": h,
                "total": c + h,
            })

        # ---- Condition distribution (from vitals: condition_level) ----
        cond_stmt = (
            select(Vital.condition_level, func.count(Vital.id))
            .where(Vital.condition_level.isnot(None))
            .group_by(Vital.condition_level)
        )
        cond_result = await db.execute(cond_stmt)
        cond_map = {row[0]: row[1] for row in cond_result.all()}
        condition_distribution = {
            "normal": int(cond_map.get("Normal", 0) + cond_map.get("normal", 0)),
            "critical": int(cond_map.get("Critical", 0) + cond_map.get("critical", 0)),
            "emergency": int(cond_map.get("Emergency", 0) + cond_map.get("emergency", 0)),
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
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load analytics and forecasts: {exc}",
        )
