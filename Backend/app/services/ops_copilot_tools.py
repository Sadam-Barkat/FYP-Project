"""
Tool-style data collectors for the Ops Copilot agent.
Each function returns a JSON-serializable dict for the LLM context and audit snapshot.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List

from sqlalchemy import Date, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admission import Admission
from app.models.alert import Alert, AlertSeverity
from app.models.bed import Bed, BedStatus
from app.models.billing import Billing, BillingStatus
from app.models.vital import Vital


async def get_occupancy_by_ward(db: AsyncSession, base_date: date | None = None) -> Dict[str, Any]:
    base = base_date or datetime.utcnow().date()
    day_start = datetime.combine(base, time.min)
    day_end = datetime.combine(base, time.max)

    tb = await db.execute(select(Bed.ward, func.count(Bed.id)).group_by(Bed.ward))
    ward_totals: Dict[str, int] = {(w or "Unknown"): int(c) for w, c in tb.all()}

    occ_q = (
        select(Bed.ward, func.count(Admission.id))
        .select_from(Admission)
        .join(Bed, Bed.id == Admission.bed_id)
        .where(
            and_(
                Admission.admission_date <= day_end,
                or_(Admission.discharge_date.is_(None), Admission.discharge_date >= day_start),
            )
        )
        .group_by(Bed.ward)
    )
    occ_r = await db.execute(occ_q)
    ward_occ: Dict[str, int] = {(w or "Unknown"): int(c) for w, c in occ_r.all()}

    wards: List[Dict[str, Any]] = []
    total_beds = 0
    total_occ = 0
    for w, b in ward_totals.items():
        o = ward_occ.get(w, 0)
        total_beds += b
        total_occ += o
        pct = round(100.0 * o / b, 1) if b else 0.0
        wards.append({"ward": w, "occupied": o, "total_beds": b, "occupancy_pct": pct})
    overall = round(100.0 * total_occ / total_beds, 1) if total_beds else 0.0
    icu_row = next((x for x in wards if (x["ward"] or "").upper() == "ICU"), None)
    icu_pct = float(icu_row["occupancy_pct"]) if icu_row else 0.0
    return {
        "date": base.isoformat(),
        "overall_occupancy_pct": overall,
        "icu_occupancy_pct": icu_pct,
        "by_ward": sorted(wards, key=lambda x: -x["occupancy_pct"]),
    }


async def get_admission_trend(db: AsyncSession, days: int = 7) -> Dict[str, Any]:
    today = datetime.utcnow().date()
    start = today - timedelta(days=days - 1)
    r = await db.execute(
        select(cast(Admission.admission_date, Date).label("d"), func.count(Admission.id))
        .where(and_(cast(Admission.admission_date, Date) >= start, cast(Admission.admission_date, Date) <= today))
        .group_by(cast(Admission.admission_date, Date))
        .order_by(cast(Admission.admission_date, Date))
    )
    by_day = {row.d: int(row[1]) for row in r.all()}
    series = [{"date": (start + timedelta(i)).isoformat(), "count": by_day.get(start + timedelta(i), 0)} for i in range(days)]
    last7 = sum(p["count"] for p in series)
    prev_start = start - timedelta(days=days)
    prev_end = start - timedelta(days=1)
    r2 = await db.execute(
        select(func.count(Admission.id)).where(
            and_(
                cast(Admission.admission_date, Date) >= prev_start,
                cast(Admission.admission_date, Date) <= prev_end,
            )
        )
    )
    prior7 = int(r2.scalar_one() or 0)
    wow = None if prior7 == 0 else round(100.0 * (last7 - prior7) / prior7, 1)
    return {"daily": series, "sum_last_7d": last7, "sum_prior_7d": prior7, "wow_change_pct": wow}


async def get_alert_backlog(db: AsyncSession) -> Dict[str, Any]:
    crit = await db.execute(
        select(func.count(Alert.id)).where(and_(Alert.severity == AlertSeverity.critical, Alert.is_resolved.is_(False)))
    )
    high_med = await db.execute(
        select(func.count(Alert.id)).where(
            and_(Alert.severity.in_([AlertSeverity.high, AlertSeverity.medium]), Alert.is_resolved.is_(False))
        )
    )
    today = datetime.utcnow().date()
    day_start = datetime.combine(today, time.min)
    day_end = datetime.combine(today, time.max)
    last24 = datetime.utcnow() - timedelta(hours=24)
    new_24h = await db.execute(select(func.count(Alert.id)).where(Alert.created_at >= last24))
    today_created = await db.execute(
        select(func.count(Alert.id)).where(and_(Alert.created_at >= day_start, Alert.created_at <= day_end))
    )
    return {
        "unresolved_critical": int(crit.scalar_one() or 0),
        "unresolved_warning": int(high_med.scalar_one() or 0),
        "alerts_created_last_24h": int(new_24h.scalar_one() or 0),
        "alerts_created_today": int(today_created.scalar_one() or 0),
    }


async def get_patient_acuity_mix(db: AsyncSession) -> Dict[str, Any]:
    r = await db.execute(
        select(Vital.condition_level, func.count(Vital.id)).where(Vital.condition_level.isnot(None)).group_by(Vital.condition_level)
    )
    m = {row[0]: int(row[1]) for row in r.all()}
    n = m.get("Normal", 0) + m.get("normal", 0)
    c = m.get("Critical", 0) + m.get("critical", 0)
    e = m.get("Emergency", 0) + m.get("emergency", 0)
    t = max(1, n + c + e)
    return {
        "normal": n,
        "critical": c,
        "emergency": e,
        "high_acuity_pct": round(100.0 * (c + e) / t, 1),
    }


async def get_revenue_trend(db: AsyncSession, days: int = 7) -> Dict[str, Any]:
    today = datetime.utcnow().date()
    start = today - timedelta(days=days - 1)
    series: List[Dict[str, Any]] = []
    total_last = 0.0
    for i in range(days):
        d = start + timedelta(days=i)
        ds = datetime.combine(d, time.min)
        de = datetime.combine(d, time.max)
        val = await db.execute(
            select(func.coalesce(func.sum(Billing.amount), 0.0)).where(
                and_(Billing.status == BillingStatus.paid, Billing.date >= ds, Billing.date <= de)
            )
        )
        v = float(val.scalar_one() or 0.0)
        total_last += v
        series.append({"date": d.isoformat(), "paid_pkr": round(v, 2)})
    prev_total = 0.0
    for j in range(days):
        d = start - timedelta(days=days) + timedelta(days=j)
        ds = datetime.combine(d, time.min)
        de = datetime.combine(d, time.max)
        val = await db.execute(
            select(func.coalesce(func.sum(Billing.amount), 0.0)).where(
                and_(Billing.status == BillingStatus.paid, Billing.date >= ds, Billing.date <= de)
            )
        )
        prev_total += float(val.scalar_one() or 0.0)
    wow = None if prev_total == 0 else round(100.0 * (total_last - prev_total) / prev_total, 1)
    return {"daily_paid_pkr": series, "sum_last_7d_pkr": round(total_last, 2), "sum_prior_7d_pkr": round(prev_total, 2), "wow_change_pct": wow}


async def collect_all_signals(db: AsyncSession) -> Dict[str, Any]:
    """Aggregate all tool outputs for the agent (single snapshot)."""
    occ = await get_occupancy_by_ward(db)
    adm = await get_admission_trend(db)
    alerts = await get_alert_backlog(db)
    acuity = await get_patient_acuity_mix(db)
    rev = await get_revenue_trend(db)
    beds_total = await db.execute(select(func.count(Bed.id)))
    available = await db.execute(select(func.count(Bed.id)).where(Bed.status == BedStatus.available))
    return {
        "collected_at_utc": datetime.utcnow().isoformat() + "Z",
        "bed_inventory": {
            "total_beds": int(beds_total.scalar_one() or 0),
            "available_beds": int(available.scalar_one() or 0),
        },
        "occupancy": occ,
        "admissions": adm,
        "alerts": alerts,
        "vitals_acuity": acuity,
        "revenue": rev,
    }
