from datetime import datetime, timedelta, time, date
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, and_, or_, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.bed import Bed, BedStatus
from app.models.admission import Admission
from app.models.billing import Billing, BillingStatus
from app.models.staff import Staff
from app.models.alert import Alert, AlertSeverity
from app.models.hr import Attendance, AttendanceStatus

router = APIRouter(prefix="/api", tags=["overview"])


@router.get("/hospital-overview")
async def get_hospital_overview(
    date_param: Optional[date] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Aggregate key hospital metrics for the Admin 'Hospital Overview' dashboard.
    """
    try:
        # ---- Time boundaries ----
        now = datetime.utcnow()
        base_date = date_param or now.date()
        day_start = datetime.combine(base_date, time.min)
        day_end = datetime.combine(base_date, time.max)
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

        # ---- todays_revenue ----
        todays_revenue_result = await db.execute(
            select(func.coalesce(func.sum(Billing.amount), 0.0)).where(
                and_(
                    Billing.status == BillingStatus.paid,
                    Billing.date >= day_start,
                    Billing.date <= day_end,
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
        if doctors_on_duty == 0 and base_date == now.date():
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
        bed_occupancy_trend = []
        icu_occupancy_trend = []
        revenue_trend = []
        
        for i in range(7):
            d = seven_days_ago + timedelta(days=i)
            d_start = datetime.combine(d, time.min)
            d_end = datetime.combine(d, time.max)
            
            # Active admissions on day d
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
            
            # Bed occupancy on day d
            occ_d_result = await db.execute(
                select(func.count(func.distinct(Bed.id)))
                .select_from(Bed)
                .join(active_d_subq, Bed.id == active_d_subq.c.bed_id)
                .where(Bed.status == BedStatus.occupied)
            )
            occ_d = occ_d_result.scalar_one() or 0
            bed_pct = (float(occ_d) / float(total_beds) * 100.0) if total_beds > 0 else 0.0
            bed_occupancy_trend.append(bed_pct)
            
            # ICU occupancy on day d
            icu_occ_d_result = await db.execute(
                select(func.count(func.distinct(Bed.id)))
                .select_from(Bed)
                .join(active_d_subq, Bed.id == active_d_subq.c.bed_id)
                .where(Bed.ward == "ICU")
            )
            icu_occ_d = icu_occ_d_result.scalar_one() or 0
            icu_pct = (float(icu_occ_d) / float(icu_total) * 100.0) if icu_total > 0 else 0.0
            icu_occupancy_trend.append(icu_pct)
            
            # Revenue on day d
            rev_d_result = await db.execute(
                select(func.coalesce(func.sum(Billing.amount), 0.0)).where(
                    and_(
                        Billing.status == BillingStatus.paid,
                        Billing.date >= d_start,
                        Billing.date <= d_end,
                    )
                )
            )
            rev_d = float(rev_d_result.scalar_one() or 0.0)
            revenue_trend.append(rev_d)
            
        bed_occupancy_7d_avg = sum(bed_occupancy_trend) / len(bed_occupancy_trend) if bed_occupancy_trend else 0.0
        icu_occupancy_7d_avg = sum(icu_occupancy_trend) / len(icu_occupancy_trend) if icu_occupancy_trend else 0.0
        revenue_7d_avg = sum(revenue_trend) / len(revenue_trend) if revenue_trend else 0.0

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
        }

    except Exception as exc:
        # Basic error handling – log in real app; here we just return 500
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load hospital overview: {exc}",
        )

