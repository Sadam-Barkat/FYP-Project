from datetime import datetime, timedelta, time, date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.bed import Bed, BedStatus
from app.models.admission import Admission
from app.models.alert import Alert, AlertSeverity

router = APIRouter(prefix="/api", tags=["patients_beds"])


@router.get("/patients-beds-overview")
async def get_patients_beds_overview(
    date_param: Optional[date] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Backend for the Admin 'Patients & Beds Overview' page.

    Returns capacity/occupancy cards, bed occupancy by department, and
    admissions vs discharges trend for the 7-day window ending on selected date.
    """
    try:
        # ----- Resolve date window -----
        now = datetime.utcnow()
        base_date = date_param or now.date()
        day_start = datetime.combine(base_date, time.min)
        day_end = datetime.combine(base_date, time.max)
        seven_days_ago = base_date - timedelta(days=6)

        # ----- Active admissions snapshot for selected date -----
        # Admissions that overlap the selected date
        active_admissions_subq = (
            select(Admission.id, Admission.bed_id)
            .where(
                and_(
                    Admission.admission_date <= day_end,
                    or_(
                        Admission.discharge_date.is_(None),
                        Admission.discharge_date >= day_start,
                    ),
                )
            )
            .subquery()
        )

        # ----- Total capacity (all beds) -----
        total_capacity_result = await db.execute(
            select(func.count(Bed.id)).select_from(Bed)
        )
        total_capacity = total_capacity_result.scalar_one() or 0

        # ----- Occupied beds on selected date -----
        # Beds that are marked occupied AND have an active admission that day
        occupied_beds_result = await db.execute(
            select(func.count(func.distinct(Bed.id)))
            .select_from(Bed)
            .join(
                active_admissions_subq,
                Bed.id == active_admissions_subq.c.bed_id,
            )
            .where(Bed.status == BedStatus.occupied)
        )
        occupied_beds = occupied_beds_result.scalar_one() or 0

        available_beds = max(int(total_capacity) - int(occupied_beds), 0)
        occupancy_percentage = (
            float(occupied_beds) / float(total_capacity) * 100.0
            if total_capacity > 0
            else 0.0
        )

        # ----- Emergency cases on selected date -----
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

        # ----- Bed occupancy by department on selected date -----
        # Total beds per ward
        total_by_ward_result = await db.execute(
            select(Bed.ward, func.count(Bed.id))
            .group_by(Bed.ward)
        )
        total_by_ward = {ward: total for ward, total in total_by_ward_result.all()}

        # Occupied beds per ward (active admissions snapshot)
        occupied_by_ward_result = await db.execute(
            select(Bed.ward, func.count(func.distinct(Bed.id)))
            .join(
                active_admissions_subq,
                Bed.id == active_admissions_subq.c.bed_id,
            )
            .where(Bed.status == BedStatus.occupied)
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

        # ----- Admissions & discharges trend (past week ending on selected date) -----
        # Admissions grouped by calendar date
        admissions_result = await db.execute(
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
        )
        admissions_by_day = {
            row.day: row.count for row in admissions_result
        }

        # Discharges grouped by calendar date
        discharges_result = await db.execute(
            select(
                cast(Admission.discharge_date, Date).label("day"),
                func.count().label("count"),
            )
            .where(
                and_(
                    Admission.discharge_date.is_not(None),
                    cast(Admission.discharge_date, Date) >= seven_days_ago,
                    cast(Admission.discharge_date, Date) <= base_date,
                )
            )
            .group_by("day")
        )
        discharges_by_day = {
            row.day: row.count for row in discharges_result
        }

        admissions_discharges_trend: List[Dict[str, Any]] = []
        for i in range(7):
            day = seven_days_ago + timedelta(days=i)
            weekday_label = day.strftime("%a")  # Mon, Tue, ...
            admissions_count = int(admissions_by_day.get(day, 0))
            discharges_count = int(discharges_by_day.get(day, 0))
            admissions_discharges_trend.append(
                {
                    "day": weekday_label,
                    "admissions": admissions_count,
                    "discharges": discharges_count,
                }
            )

        return {
            "total_capacity": int(total_capacity),
            "occupied_beds": int(occupied_beds),
            "occupancy_percentage": occupancy_percentage,
            "available_beds": int(available_beds),
            "emergency_cases": int(emergency_cases),
            "bed_occupancy_by_department": bed_occupancy_by_department,
            "admissions_discharges_trend": admissions_discharges_trend,
            "selected_date": base_date.isoformat(),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load patients & beds overview: {exc}",
        )

