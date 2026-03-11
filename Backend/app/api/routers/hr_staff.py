from datetime import date as date_type, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.staff import Staff
from app.models.hr import Attendance, AttendanceStatus

router = APIRouter(prefix="/api", tags=["hr_staff"])


@router.get("/hr-staff-overview")
async def get_hr_staff_overview(
    date_param: Optional[date_type] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Backend for the Admin 'HR & Staff Overview' page.

    Metrics:
    - staff_on_duty: count of staff marked present on the selected date
    - active_shifts: count of attendance records on the selected date (proxy for active shifts)
    - absent_today: count of staff absent on the selected date
    - on_leave: count of staff on leave on the selected date
    - live_staff_status: list of staff with their status for the selected date
    - attendance_trend: last 5 days of present/absent/leave counts
    """
    try:
        now = datetime.utcnow()
        base_date = date_param or now.date()
        day_start = datetime.combine(base_date, time.min)
        day_end = datetime.combine(base_date, time.max)
        five_days_ago = base_date - timedelta(days=4)

        # --- Core counts for selected date from attendance table ---
        counts_stmt = (
            select(
                Attendance.status,
                func.count(Attendance.id).label("count"),
            )
            .where(
                and_(
                    Attendance.date >= base_date,
                    Attendance.date <= base_date,
                )
            )
            .group_by(Attendance.status)
        )
        counts_result = await db.execute(counts_stmt)
        status_counts: Dict[AttendanceStatus, int] = {}
        for row in counts_result.mappings():
            att_status: AttendanceStatus = row["status"]
            count_val: int = row["count"]
            status_counts[att_status] = count_val

        staff_on_duty = status_counts.get(AttendanceStatus.present, 0)
        absent_today = status_counts.get(AttendanceStatus.absent, 0)
        on_leave = status_counts.get(AttendanceStatus.leave, 0)

        # For this dashboard, treat any recorded attendance for the day as an "active shift"
        active_shifts_stmt = (
            select(func.count(Attendance.id))
            .where(
                and_(
                    Attendance.date >= base_date,
                    Attendance.date <= base_date,
                )
            )
        )
        active_shifts_result = await db.execute(active_shifts_stmt)
        active_shifts = active_shifts_result.scalar_one() or 0

        # --- Live staff status table ---
        # Left join staff with attendance record for selected date.
        staff_with_attendance_stmt = (
            select(
                Staff.name,
                Staff.role,
                Staff.department,
                Attendance.status.label("attendance_status"),
            )
            .select_from(Staff)
            .join(
                Attendance,
                and_(
                    Attendance.staff_id == Staff.id,
                    Attendance.date == base_date,
                ),
                isouter=True,
            )
            .order_by(Staff.name)
        )
        staff_rows = await db.execute(staff_with_attendance_stmt)

        live_staff_status: List[Dict[str, Any]] = []
        for row in staff_rows.mappings():
            attendance_status: Optional[AttendanceStatus] = row["attendance_status"]
            if attendance_status == AttendanceStatus.present:
                status_label = "On Duty"
            elif attendance_status == AttendanceStatus.leave:
                status_label = "On Leave"
            elif attendance_status == AttendanceStatus.absent:
                status_label = "Absent"
            else:
                status_label = "Off Duty"

            live_staff_status.append(
                {
                    "name": row["name"],
                    "role": row["role"],
                    "department": row["department"],
                    "status": status_label,
                }
            )

        # --- Attendance trend for past 5 days (including selected date) ---
        trend_stmt = (
            select(
                cast(Attendance.date, Date).label("day"),
                Attendance.status,
                func.count(Attendance.id).label("count"),
            )
            .where(
                and_(
                    Attendance.date >= five_days_ago,
                    Attendance.date <= base_date,
                )
            )
            .group_by("day", Attendance.status)
        )
        trend_result = await db.execute(trend_stmt)

        # Build mapping: {day: {status: count}}
        trend_map: Dict[date_type, Dict[str, int]] = {}
        for row in trend_result.mappings():
            day = row["day"]
            att_status = row["status"]
            count = row["count"]
            if day not in trend_map:
                trend_map[day] = {"present": 0, "absent": 0, "leave": 0}
            if att_status == AttendanceStatus.present:
                trend_map[day]["present"] += count
            elif att_status == AttendanceStatus.absent:
                trend_map[day]["absent"] += count
            elif att_status == AttendanceStatus.leave:
                trend_map[day]["leave"] += count

        attendance_trend: List[Dict[str, Any]] = []
        for i in range(5):
            day = five_days_ago + timedelta(days=i)
            day_counts = trend_map.get(day, {"present": 0, "absent": 0, "leave": 0})
            attendance_trend.append(
                {
                    "date": day.isoformat(),
                    "present": day_counts["present"],
                    "absent": day_counts["absent"],
                    "leave": day_counts["leave"],
                }
            )

        return {
            "staff_on_duty": staff_on_duty,
            "active_shifts": int(active_shifts),
            "absent_today": absent_today,
            "on_leave": on_leave,
            "live_staff_status": live_staff_status,
            "attendance_trend": attendance_trend,
            "selected_date": base_date.isoformat(),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load HR & Staff overview: {exc}",
        )

