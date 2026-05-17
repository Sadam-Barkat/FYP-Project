from datetime import datetime, timedelta, time, date
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, and_, or_, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_bounds import (
    calendar_today_for_app,
    day_bounds_utc_naive,
    get_app_timezone,
    utc_naive_now,
)
from app.database import get_db
from app.models.billing_extra import Transaction
from app.models.patient import Patient
from app.models.bed import Bed, BedStatus
from app.models.admission import Admission
from app.models.billing import Billing, BillingStatus
from app.models.staff import Staff
from app.models.alert import Alert, AlertSeverity
from app.models.hr import Attendance, AttendanceStatus
from app.models.user import User, UserRole
from app.models.vital import Vital

router = APIRouter(prefix="/api", tags=["overview"])


def _format_kpi_trend_pct(today: float, yesterday: float) -> str:
    """Percentage change today vs yesterday; 'N/A' when comparison is undefined."""
    try:
        t = float(today)
        y = float(yesterday)
    except (TypeError, ValueError):
        return "N/A"
    if y == 0 and t == 0:
        return "0%"
    if y == 0:
        return "N/A"
    pct = (t - y) / y * 100.0
    rounded = int(round(pct))
    if rounded == 0:
        return "0%"
    sign = "+" if rounded > 0 else ""
    return f"{sign}{rounded}%"


async def _compute_admin_kpi_snapshot(db: AsyncSession, base_date: date) -> Dict[str, Any]:
    """
    Admin dashboard KPI snapshot for a single calendar day in APP_TIMEZONE
    (bounds converted to naive UTC for DB comparison).
    """
    tz = get_app_timezone()
    day_start, day_end = day_bounds_utc_naive(base_date, tz)

    # Distinct patients still admitted as of end of this calendar day (census),
    # not "admitted today only" — matches "patients currently in hospital" for the KPI.
    import asyncio
    
    latest_vitals = _latest_vital_per_patient_subquery()

    (
        total_patients_result,
        active_admissions_result,
        available_beds_result,
        critical_patients_result,
        staff_on_duty_result,
        revenue_today_result,
    ) = await asyncio.gather(
        db.execute(
            select(func.count(func.distinct(Admission.patient_id))).where(
                and_(
                    Admission.admission_date <= day_end,
                    or_(
                        Admission.discharge_date.is_(None),
                        Admission.discharge_date > day_end,
                    ),
                )
            )
        ),
        db.execute(
            select(func.count())
            .select_from(Admission)
            .where(Admission.discharge_date.is_(None))
        ),
        db.execute(
            select(func.count())
            .select_from(Bed)
            .where(Bed.status == BedStatus.available)
        ),
        db.execute(
            select(func.count())
            .select_from(latest_vitals)
            .where(
                latest_vitals.c.rn == 1,
                func.lower(latest_vitals.c.condition_level).in_(("critical", "emergency")),
            )
        ),
        db.execute(
            select(func.count())
            .select_from(User)
            .where(
                and_(
                    User.role.in_((UserRole.doctor, UserRole.nurse)),
                    User.is_active.is_(True),
                )
            )
        ),
        db.execute(
            select(func.coalesce(func.sum(Transaction.amount_paid), 0.0)).where(
                and_(
                    Transaction.transaction_date >= day_start,
                    Transaction.transaction_date <= day_end,
                )
            )
        )
    )

    total_patients = int(total_patients_result.scalar_one() or 0)
    active_admissions = int(active_admissions_result.scalar_one() or 0)
    available_beds = int(available_beds_result.scalar_one() or 0)
    critical_patients = int(critical_patients_result.scalar_one() or 0)
    staff_on_duty = int(staff_on_duty_result.scalar_one() or 0)
    revenue_today = float(revenue_today_result.scalar_one() or 0.0)

    return {
        "total_patients": total_patients,
        "active_admissions": active_admissions,
        "available_beds": available_beds,
        "critical_patients": critical_patients,
        "staff_on_duty": staff_on_duty,
        "revenue_today": revenue_today,
    }


def _latest_vital_per_patient_subquery():
    return (
        select(
            Vital.patient_id,
            Vital.condition_level,
            func.row_number()
            .over(
                partition_by=Vital.patient_id,
                order_by=Vital.recorded_at.desc(),
            )
            .label("rn"),
        ).subquery()
    )


def _classify_latest_condition(condition_level: Optional[str]) -> str:
    """Bucket latest vital condition for critical-patients breakdown."""
    s = (condition_level or "").lower().strip()
    if s == "emergency":
        return "emergency"
    if s == "critical":
        return "critical"
    if "observation" in s:
        return "under_observation"
    if s in ("stable", "normal") or s == "":
        return "stable"
    return "stable"


async def _compute_admin_kpi_breakdowns(db: AsyncSession, base_date: date) -> Dict[str, Any]:
    """Detailed KPI breakdowns for admin dashboard tooltips (defaults to 0 when empty)."""
    tz = get_app_timezone()
    day_start, day_end = day_bounds_utc_naive(base_date, tz)

    import asyncio

    latest_sq = _latest_vital_per_patient_subquery()
    admitted_today_patients = (
        select(Admission.patient_id)
        .where(
            and_(
                Admission.admission_date >= day_start,
                Admission.admission_date <= day_end,
            )
        )
        .distinct()
        .subquery()
    )

    (
        admitted_today_r,
        discharged_today_r,
        under_obs_r,
        male_r,
        female_r,
        children_r,
        elderly_r,
    ) = await asyncio.gather(
        db.execute(
            select(func.count(func.distinct(Admission.patient_id))).where(
                and_(
                    Admission.admission_date >= day_start,
                    Admission.admission_date <= day_end,
                )
            )
        ),
        db.execute(
            select(func.count(func.distinct(Admission.patient_id))).where(
                and_(
                    Admission.discharge_date.is_not(None),
                    Admission.discharge_date >= day_start,
                    Admission.discharge_date <= day_end,
                )
            )
        ),
        db.execute(
            select(func.count(func.distinct(latest_sq.c.patient_id)))
            .select_from(latest_sq)
            .join(
                admitted_today_patients,
                admitted_today_patients.c.patient_id == latest_sq.c.patient_id,
            )
            .where(
                latest_sq.c.rn == 1,
                func.lower(func.coalesce(latest_sq.c.condition_level, "")).like("%observation%"),
            )
        ),
        db.execute(
            select(func.count())
            .select_from(Admission)
            .join(Patient, Patient.id == Admission.patient_id)
            .where(
                Admission.discharge_date.is_(None),
                func.lower(Patient.gender).in_(("m", "male")),
            )
        ),
        db.execute(
            select(func.count())
            .select_from(Admission)
            .join(Patient, Patient.id == Admission.patient_id)
            .where(
                Admission.discharge_date.is_(None),
                func.lower(Patient.gender).in_(("f", "female")),
            )
        ),
        db.execute(
            select(func.count())
            .select_from(Admission)
            .join(Patient, Patient.id == Admission.patient_id)
            .where(Admission.discharge_date.is_(None), Patient.age < 18)
        ),
        db.execute(
            select(func.count())
            .select_from(Admission)
            .join(Patient, Patient.id == Admission.patient_id)
            .where(Admission.discharge_date.is_(None), Patient.age >= 60)
        )
    )

    admitted_today = int(admitted_today_r.scalar_one() or 0)
    discharged_today = int(discharged_today_r.scalar_one() or 0)
    under_observation_patients = int(under_obs_r.scalar_one() or 0)

    total_patients_breakdown = {
        "admitted_today": admitted_today,
        "discharged_today": discharged_today,
        "under_observation": under_observation_patients,
        "outpatient": 0,
    }

    active_admissions_breakdown = {
        "male": int(male_r.scalar_one() or 0),
        "female": int(female_r.scalar_one() or 0),
        "children": int(children_r.scalar_one() or 0),
        "elderly": int(elderly_r.scalar_one() or 0),
    }

    lv_sq = _latest_vital_per_patient_subquery()

    (
        total_beds_br,
        occupied_br,
        available_br,
        maint_br,
        lv_rows,
        role_counts_r,
        paid_amt_r,
        pending_amt_r,
        tx_r,
        largest_r,
    ) = await asyncio.gather(
        db.execute(select(func.count()).select_from(Bed)),
        db.execute(select(func.count()).select_from(Bed).where(Bed.status == BedStatus.occupied)),
        db.execute(select(func.count()).select_from(Bed).where(Bed.status == BedStatus.available)),
        db.execute(select(func.count()).select_from(Bed).where(Bed.status == BedStatus.maintenance)),
        db.execute(select(lv_sq.c.condition_level).where(lv_sq.c.rn == 1)),
        db.execute(select(User.role, func.count(User.id)).where(User.is_active.is_(True)).group_by(User.role)),
        db.execute(
            select(func.coalesce(func.sum(Transaction.amount_paid), 0.0)).where(
                and_(
                    Transaction.transaction_date >= day_start,
                    Transaction.transaction_date <= day_end,
                )
            )
        ),
        db.execute(
            select(func.coalesce(func.sum(Billing.amount), 0.0)).where(
                and_(
                    Billing.status == BillingStatus.pending,
                    Billing.date >= day_start,
                    Billing.date <= day_end,
                )
            )
        ),
        db.execute(
            select(func.count())
            .select_from(Billing)
            .where(and_(Billing.date >= day_start, Billing.date <= day_end))
        ),
        db.execute(
            select(func.coalesce(func.max(Billing.amount), 0.0)).where(
                and_(Billing.date >= day_start, Billing.date <= day_end)
            )
        )
    )

    available_beds_breakdown = {
        "total_beds": int(total_beds_br.scalar_one() or 0),
        "occupied": int(occupied_br.scalar_one() or 0),
        "available": int(available_br.scalar_one() or 0),
        "under_maintenance": int(maint_br.scalar_one() or 0),
    }

    crit_b = {"critical": 0, "emergency": 0, "stable": 0, "under_observation": 0}
    for (cl,) in lv_rows.all():
        bucket = _classify_latest_condition(cl)
        if bucket in crit_b:
            crit_b[bucket] += 1
        else:
            crit_b["stable"] += 1
    critical_patients_breakdown = {
        "critical": int(crit_b["critical"]),
        "emergency": int(crit_b["emergency"]),
        "stable": int(crit_b["stable"]),
        "under_observation": int(crit_b["under_observation"]),
    }

    by_role = {row[0]: int(row[1]) for row in role_counts_r.all()}
    staff_on_duty_breakdown = {
        "doctors": int(by_role.get(UserRole.doctor, 0)),
        "nurses": int(by_role.get(UserRole.nurse, 0)),
        "admin": int(by_role.get(UserRole.admin, 0)),
        "finance": int(by_role.get(UserRole.finance, 0)),
        "laboratorians": 0,
        "receptionists": 0,
    }

    revenue_today_breakdown = {
        "paid": float(paid_amt_r.scalar_one() or 0.0),
        "pending": float(pending_amt_r.scalar_one() or 0.0),
        "total_transactions": int(tx_r.scalar_one() or 0),
        "largest_bill": float(largest_r.scalar_one() or 0.0),
    }

    return {
        "total_patients_breakdown": total_patients_breakdown,
        "active_admissions_breakdown": active_admissions_breakdown,
        "available_beds_breakdown": available_beds_breakdown,
        "critical_patients_breakdown": critical_patients_breakdown,
        "staff_on_duty_breakdown": staff_on_duty_breakdown,
        "revenue_today_breakdown": revenue_today_breakdown,
    }


@router.get("/hospital-overview")
async def get_hospital_overview(
    date_param: Optional[date] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Aggregate key hospital metrics for the Admin 'Hospital Overview' dashboard.
    """
    try:
        # ---- Time boundaries (calendar day in APP_TIMEZONE) ----
        now = utc_naive_now()
        tz = get_app_timezone()
        base_date = date_param or calendar_today_for_app(now)
        day_start, day_end = day_bounds_utc_naive(base_date, tz)
        seven_days_ago = base_date - timedelta(days=6)  # inclusive range [seven_days_ago..base_date]

        # ---- total_beds ----
        total_beds_result = await db.execute(select(func.count()).select_from(Bed))
        total_beds = total_beds_result.scalar_one() or 0

        # ---- Active admissions and bed joins ----
        # Admissions that overlap the selected date (not yet discharged before the day starts)
        active_admissions_subq = (
            select(Admission.id, Admission.bed_id)
            .where(
                and_(
                    Admission.admission_date <= day_end,
                    or_(Admission.discharge_date.is_(None), Admission.discharge_date >= day_start),
                )
            )
            .subquery()
        )

        # active_patients.total
        active_total_result = await db.execute(
            select(func.count(active_admissions_subq.c.id))
        )
        active_total = active_total_result.scalar_one() or 0

        # active_patients by ward/department (ICU, Emergency, General, Cardiology, etc.)
        ward_counts_result = await db.execute(
            select(Bed.ward, func.count(active_admissions_subq.c.id))
            .join(active_admissions_subq, Bed.id == active_admissions_subq.c.bed_id)
            .group_by(Bed.ward)
        )
        ward_counts = {ward: count for ward, count in ward_counts_result.all()}

        active_patients = {
            "total": active_total,
            "icu": int(ward_counts.get("ICU", 0)),
            "emergency": int(ward_counts.get("Emergency", 0)),
            "general_ward": int(ward_counts.get("General", 0)),
            "cardiology": int(ward_counts.get("Cardiology", 0)),
        }

        # ---- todays_revenue (payments captured today via transactions) ----
        todays_revenue_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount_paid), 0.0)).where(
                and_(
                    Transaction.transaction_date >= day_start,
                    Transaction.transaction_date <= day_end,
                )
            )
        )
        todays_revenue = float(todays_revenue_result.scalar_one() or 0.0)

        # ---- doctors_on_duty ----
        # Prefer date-based attendance when available so the date filter changes this value.
        # Staff.role in this project is often a job title (e.g. "Cardiologist"), so we treat doctors as:
        # - name starts with "Dr" OR role contains "doctor" (case-insensitive).
        doctors_on_duty: int = 0
        doctors_attendance_result = await db.execute(
            select(func.count(func.distinct(Staff.id)))
            .select_from(Staff)
            .join(Attendance, Attendance.staff_id == Staff.id)
            .where(
                and_(
                    Attendance.date == base_date,
                    Attendance.status == AttendanceStatus.present,
                    or_(
                        func.lower(Staff.name).like("dr.%"),
                        func.lower(Staff.name).like("dr %"),
                        func.lower(Staff.role).like("%doctor%"),
                    ),
                )
            )
        )
        doctors_on_duty = int(doctors_attendance_result.scalar_one() or 0)

        # Fallback: if there is no attendance data for the selected date, use shift window against "now"
        # (keeps production behavior for today's live view).
        if doctors_on_duty == 0 and base_date == calendar_today_for_app(now):
            current_time_str = now.strftime("%H:%M")
            doctors_on_duty_result = await db.execute(
                select(func.count())
                .select_from(Staff)
                .where(
                    and_(
                        or_(
                            func.lower(Staff.name).like("dr.%"),
                            func.lower(Staff.name).like("dr %"),
                            func.lower(Staff.role).like("%doctor%"),
                            func.lower(Staff.role) == "doctor",
                        ),
                        Staff.shift_start.is_not(None),
                        Staff.shift_end.is_not(None),
                        Staff.shift_start <= current_time_str,
                        Staff.shift_end >= current_time_str,
                    )
                )
            )
            doctors_on_duty = int(doctors_on_duty_result.scalar_one() or 0)

        # ---- emergency_cases (critical-severity alerts on selected date) ----
        emergency_cases_result = await db.execute(
            select(func.count())
            .select_from(Alert)
            .where(
                and_(
                    Alert.severity == AlertSeverity.critical,
                    Alert.created_at >= day_start,
                    Alert.created_at <= day_end,
                )
            )
        )
        emergency_cases = emergency_cases_result.scalar_one() or 0

        # ---- critical_condition_cases (high-severity alerts on selected date) ----
        critical_condition_result = await db.execute(
            select(func.count())
            .select_from(Alert)
            .where(
                and_(
                    Alert.severity == AlertSeverity.high,
                    Alert.created_at >= day_start,
                    Alert.created_at <= day_end,
                )
            )
        )
        critical_condition_cases = critical_condition_result.scalar_one() or 0

        # ---- icu_occupancy ----
        icu_total_result = await db.execute(
            select(func.count()).select_from(Bed).where(Bed.ward == "ICU")
        )
        icu_total = icu_total_result.scalar_one() or 0

        icu_occupied_result = await db.execute(
            select(func.count())
            .select_from(Bed)
            .join(active_admissions_subq, Bed.id == active_admissions_subq.c.bed_id)
            .where(Bed.ward == "ICU")
        )
        icu_occupied = icu_occupied_result.scalar_one() or 0

        icu_occupancy = (
            float(icu_occupied) / float(icu_total) * 100.0 if icu_total > 0 else 0.0
        )

        # ---- admission_trend (7-day window ending on selected date) ----
        admissions_trend_result = await db.execute(
            select(
                cast(Admission.admission_date, Date).label("day"),
                func.count().label("count"),
            )
            .where(
                and_(
                    cast(Admission.admission_date, Date) >= seven_days_ago,
                    cast(Admission.admission_date, Date) <= base_date,
                )
            )
            .group_by("day")
            .order_by("day")
        )
        admissions_by_day = {row.day: row.count for row in admissions_trend_result}

        admission_trend: List[Dict[str, Any]] = []
        for i in range(7):
            day = seven_days_ago + timedelta(days=i)
            admission_trend.append(
                {
                    "date": day.isoformat(),
                    "admissions": int(admissions_by_day.get(day, 0)),
                }
            )

        # ---- bed_occupancy_by_department ----
        # Total beds per ward
        total_by_ward_result = await db.execute(
            select(Bed.ward, func.count(Bed.id))
            .group_by(Bed.ward)
        )
        total_by_ward = {ward: total for ward, total in total_by_ward_result.all()}

        # Occupied beds per ward (using active admissions)
        occupied_by_ward_result = await db.execute(
            select(Bed.ward, func.count(active_admissions_subq.c.id))
            .join(active_admissions_subq, Bed.id == active_admissions_subq.c.bed_id)
            .group_by(Bed.ward)
        )
        occupied_by_ward = {
            ward: occupied for ward, occupied in occupied_by_ward_result.all()
        }

        bed_occupancy_by_department: List[Dict[str, Any]] = []
        for ward, total in total_by_ward.items():
            occupied = int(occupied_by_ward.get(ward, 0))
            bed_occupancy_by_department.append(
                {
                    "department": ward,
                    "occupied": occupied,
                    "total": int(total),
                }
            )


        # ---- 7-Day Trends (for mini charts and averages) ----
        import asyncio
        
        async def fetch_day_trend(i: int):
            d = seven_days_ago + timedelta(days=i)
            d_start, d_end = day_bounds_utc_naive(d, tz)
            
            active_d_subq = (
                select(Admission.id, Admission.bed_id)
                .where(
                    and_(
                        Admission.admission_date <= d_end,
                        or_(Admission.discharge_date.is_(None), Admission.discharge_date >= d_start),
                    )
                )
                .subquery()
            )
            
            occ_d_result, icu_occ_d_result, rev_d_result = await asyncio.gather(
                db.execute(
                    select(func.count(func.distinct(Bed.id)))
                    .select_from(Bed)
                    .join(active_d_subq, Bed.id == active_d_subq.c.bed_id)
                    .where(Bed.status == BedStatus.occupied)
                ),
                db.execute(
                    select(func.count(func.distinct(Bed.id)))
                    .select_from(Bed)
                    .join(active_d_subq, Bed.id == active_d_subq.c.bed_id)
                    .where(Bed.ward == "ICU")
                ),
                db.execute(
                    select(func.coalesce(func.sum(Transaction.amount_paid), 0.0)).where(
                        and_(
                            Transaction.transaction_date >= d_start,
                            Transaction.transaction_date <= d_end,
                        )
                    )
                )
            )
            
            occ_d = occ_d_result.scalar_one() or 0
            icu_occ_d = icu_occ_d_result.scalar_one() or 0
            rev_d = float(rev_d_result.scalar_one() or 0.0)
            
            bed_pct = (float(occ_d) / float(total_beds) * 100.0) if total_beds > 0 else 0.0
            icu_pct = (float(icu_occ_d) / float(icu_total) * 100.0) if icu_total > 0 else 0.0
            
            return bed_pct, icu_pct, rev_d

        trend_results = await asyncio.gather(*(fetch_day_trend(i) for i in range(7)))
        
        bed_occupancy_trend = [r[0] for r in trend_results]
        icu_occupancy_trend = [r[1] for r in trend_results]
        revenue_trend = [r[2] for r in trend_results]
            
        bed_occupancy_7d_avg = sum(bed_occupancy_trend) / len(bed_occupancy_trend) if bed_occupancy_trend else 0.0
        icu_occupancy_7d_avg = sum(icu_occupancy_trend) / len(icu_occupancy_trend) if icu_occupancy_trend else 0.0
        revenue_7d_avg = sum(revenue_trend) / len(revenue_trend) if revenue_trend else 0.0

        yesterday_date = base_date - timedelta(days=1)
        
        today_kpis, yesterday_kpis, kpi_breakdowns = await asyncio.gather(
            _compute_admin_kpi_snapshot(db, base_date),
            _compute_admin_kpi_snapshot(db, yesterday_date),
            _compute_admin_kpi_breakdowns(db, base_date)
        )
        
        tpb = kpi_breakdowns.get("total_patients_breakdown")
        if isinstance(tpb, dict):
            tpb["in_hospital"] = int(today_kpis["total_patients"])
            tpb["in_hospital_yesterday"] = int(yesterday_kpis["total_patients"])

        admin_dashboard_kpis = {
            "total_patients": int(today_kpis["total_patients"]),
            "active_admissions": int(today_kpis["active_admissions"]),
            "available_beds": int(today_kpis["available_beds"]),
            "critical_patients": int(today_kpis["critical_patients"]),
            "staff_on_duty": int(today_kpis["staff_on_duty"]),
            "revenue_today": float(today_kpis["revenue_today"]),
            "total_patients_trend": _format_kpi_trend_pct(
                today_kpis["total_patients"], yesterday_kpis["total_patients"]
            ),
            "active_admissions_trend": _format_kpi_trend_pct(
                today_kpis["active_admissions"], yesterday_kpis["active_admissions"]
            ),
            "available_beds_trend": _format_kpi_trend_pct(
                today_kpis["available_beds"], yesterday_kpis["available_beds"]
            ),
            "critical_patients_trend": _format_kpi_trend_pct(
                today_kpis["critical_patients"], yesterday_kpis["critical_patients"]
            ),
            "staff_on_duty_trend": _format_kpi_trend_pct(
                today_kpis["staff_on_duty"], yesterday_kpis["staff_on_duty"]
            ),
            "revenue_today_trend": _format_kpi_trend_pct(
                today_kpis["revenue_today"], yesterday_kpis["revenue_today"]
            ),
            **kpi_breakdowns,
        }

        return {

            "total_beds": int(total_beds),
            "active_patients": active_patients,
            "todays_revenue": todays_revenue,
            "doctors_on_duty": int(doctors_on_duty),
            "emergency_cases": int(emergency_cases),
            "critical_condition_cases": int(critical_condition_cases),
            "icu_occupancy": icu_occupancy,
            "admission_trend": admission_trend,
            "bed_occupancy_by_department": bed_occupancy_by_department,
            "bed_occupancy_trend": bed_occupancy_trend,
            "bed_occupancy_7d_avg": bed_occupancy_7d_avg,
            "icu_occupancy_trend": icu_occupancy_trend,
            "icu_occupancy_7d_avg": icu_occupancy_7d_avg,
            "revenue_trend": revenue_trend,
            "revenue_7d_avg": revenue_7d_avg,
            **admin_dashboard_kpis,
        }

    except Exception as exc:
        # Basic error handling – log in real app; here we just return 500
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load hospital overview: {exc}",
        )

