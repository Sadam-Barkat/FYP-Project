from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.laboratory import LaboratoryResult
from app.models.laboratory_extra import LabCategory, LabRequest
from app.models.staff import Staff

router = APIRouter(prefix="/api", tags=["laboratory"])


@router.get("/laboratory-overview")
async def get_laboratory_overview(
    date_param: Optional[date] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Backend for the Admin 'Laboratory Overview' page.

    Metrics:
    - Pending tests, completed today, active technicians, critical results
    - Daily test volume by category (Completed vs Pending)
    - Weekly result trends (Normal vs Abnormal) for last 7 days ending on selected date
    """
    try:
        # ----- Resolve date window -----
        now = datetime.utcnow()
        base_date = date_param or now.date()
        day_start = datetime.combine(base_date, time.min)
        day_end = datetime.combine(base_date, time.max)
        seven_days_ago = base_date - timedelta(days=6)

        # ----- Pending tests (LabRequest.status = 'pending' on selected date) -----
        pending_tests_result = await db.execute(
            select(func.count(LabRequest.id)).where(
                and_(
                    LabRequest.status == "pending",
                    cast(LabRequest.request_date, Date) <= base_date,
                )
            )
        )
        pending_tests = pending_tests_result.scalar_one() or 0

        # ----- Completed today (LaboratoryResult.status = 'completed' collected on selected date) -----
        completed_today_result = await db.execute(
            select(func.count(LaboratoryResult.id)).where(
                and_(
                    LaboratoryResult.status == "completed",
                    cast(LaboratoryResult.collected_at, Date) == base_date,
                )
            )
        )
        completed_today = completed_today_result.scalar_one() or 0

        # ----- Active technicians (Staff.role = 'technician', simple count) -----
        # Our Staff model doesn't distinguish technicians explicitly; approximate by department.
        active_techs_result = await db.execute(
            select(func.count(Staff.id)).where(
                Staff.department.ilike("%lab%")
            )
        )
        active_technicians = active_techs_result.scalar_one() or 0

        # ----- Critical results (LaboratoryResult.result_value or status containing 'critical') -----
        critical_results_result = await db.execute(
            select(func.count(LaboratoryResult.id)).where(
                and_(
                    cast(LaboratoryResult.collected_at, Date) == base_date,
                    func.lower(LaboratoryResult.result_value).like("%critical%"),
                )
            )
        )
        critical_results = critical_results_result.scalar_one() or 0

        # ----- Daily test volume by category (Completed vs Pending) -----
        # Map LabRequest.lab_category_id -> category name
        # Completed count: LaboratoryResult grouped by category name; Pending: LabRequest.status='pending'

        # Category names
        categories_result = await db.execute(
            select(LabCategory.id, LabCategory.name)
        )
        categories = {row.id: row.name for row in categories_result}

        # Completed tests on selected date per category (join via LabRequest)
        completed_by_cat_result = await db.execute(
            select(
                LabRequest.lab_category_id,
                func.count(LaboratoryResult.id),
            )
            .join(
                LaboratoryResult,
                LaboratoryResult.patient_id == LabRequest.patient_id,
            )
            .where(
                and_(
                    LaboratoryResult.status == "completed",
                    cast(LaboratoryResult.collected_at, Date) == base_date,
                )
            )
            .group_by(LabRequest.lab_category_id)
        )
        completed_by_cat = {
            categories.get(row.lab_category_id, "Other"): row.count
            for row in completed_by_cat_result
        }

        # Pending tests on selected date per category
        pending_by_cat_result = await db.execute(
            select(
                LabRequest.lab_category_id,
                func.count(LabRequest.id),
            )
            .where(
                and_(
                    LabRequest.status == "pending",
                    cast(LabRequest.request_date, Date) == base_date,
                )
            )
            .group_by(LabRequest.lab_category_id)
        )
        pending_by_cat = {
            categories.get(row.lab_category_id, "Other"): row.count
            for row in pending_by_cat_result
        }

        # Merge into list
        all_category_names = set(completed_by_cat.keys()) | set(pending_by_cat.keys())
        daily_test_volume_by_category: List[Dict[str, Any]] = []
        for name in all_category_names:
            daily_test_volume_by_category.append(
                {
                    "category": name,
                    "completed": int(completed_by_cat.get(name, 0)),
                    "pending": int(pending_by_cat.get(name, 0)),
                }
            )

        # ----- Weekly result trends (Normal vs Abnormal) -----
        # Normal: result_value contains 'normal' (case-insensitive)
        # Abnormal: otherwise
        weekly_results_result = await db.execute(
            select(
                cast(LaboratoryResult.collected_at, Date).label("day"),
                func.count(
                    func.nullif(
                        func.lower(LaboratoryResult.result_value).like("%normal%"),
                        False,
                    )
                ).label("normal_count"),
                func.count(
                    func.nullif(
                        func.lower(LaboratoryResult.result_value).like("%normal%"),
                        True,
                    )
                ).label("abnormal_count"),
            )
            .where(
                and_(
                    cast(LaboratoryResult.collected_at, Date) >= seven_days_ago,
                    cast(LaboratoryResult.collected_at, Date) <= base_date,
                )
            )
            .group_by("day")
            .order_by("day")
        )

        normal_by_day: Dict[date, int] = {}
        abnormal_by_day: Dict[date, int] = {}
        for row in weekly_results_result:
            normal_by_day[row.day] = int(row.normal_count or 0)
            abnormal_by_day[row.day] = int(row.abnormal_count or 0)

        weekly_result_trends: List[Dict[str, Any]] = []
        for i in range(7):
            day = seven_days_ago + timedelta(days=i)
            label = day.strftime("%m/%d")
            weekly_result_trends.append(
                {
                    "day": label,
                    "normal": int(normal_by_day.get(day, 0)),
                    "abnormal": int(abnormal_by_day.get(day, 0)),
                }
            )

        return {
            "pending_tests": int(pending_tests),
            "completed_today": int(completed_today),
            "active_technicians": int(active_technicians),
            "critical_results": int(critical_results),
            "daily_test_volume_by_category": daily_test_volume_by_category,
            "weekly_result_trends": weekly_result_trends,
            "selected_date": base_date.isoformat(),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load laboratory overview: {exc}",
        )

