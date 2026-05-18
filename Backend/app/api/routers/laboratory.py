from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.laboratory import LaboratoryResult
from app.models.laboratory_extra import LabCategory, LabRequest
from app.models.patient import Patient
from app.models.staff import Staff
from app.services.lab_workload_model import (
    predict_abnormal_risk_samples,
    predict_next_7_days_lab_backlog,
)

router = APIRouter(prefix="/api", tags=["laboratory"])

# Must match laboratorian: category stored in test_name as "CategoryName | TestName"
LAB_ENTRY_DELIMITER = " | "


def _fmt_lab_datetime(dt: Optional[datetime]) -> str:
    if not dt:
        return "—"
    return dt.strftime("%Y-%m-%d %H:%M")


async def _fetch_pending_tests_roster(
    db: AsyncSession,
    *,
    base_date: date,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    """All pending lab work (requests + non-completed results) through selected date."""
    day_end = datetime.combine(base_date, time.max)
    roster: List[Dict[str, Any]] = []

    pending_req = await db.execute(
        select(LabRequest, Patient, LabCategory)
        .join(Patient, Patient.id == LabRequest.patient_id)
        .join(LabCategory, LabCategory.id == LabRequest.lab_category_id)
        .where(
            and_(
                LabRequest.status == "pending",
                LabRequest.request_date <= day_end,
            )
        )
        .order_by(LabRequest.request_date.desc())
        .limit(limit)
    )
    for req, patient, cat in pending_req.all():
        cat_name = (cat.name if cat else "Other") or "Other"
        roster.append(
            {
                "patient_name": (patient.name or "").strip() or f"Patient #{patient.id}",
                "category": cat_name,
                "test_name": cat_name,
                "requested": _fmt_lab_datetime(req.request_date),
                "source": "request",
            }
        )

    if len(roster) < limit:
        pending_results = await db.execute(
            select(LaboratoryResult, Patient)
            .join(Patient, Patient.id == LaboratoryResult.patient_id)
            .where(
                and_(
                    LaboratoryResult.status != "completed",
                    cast(LaboratoryResult.collected_at, Date) <= base_date,
                )
            )
            .order_by(LaboratoryResult.collected_at.desc())
            .limit(max(0, limit - len(roster)))
        )
        for result, patient in pending_results.all():
            test_name = (result.test_name or "").strip() or "Unknown"
            if LAB_ENTRY_DELIMITER in test_name:
                cat_name, test_only = test_name.split(LAB_ENTRY_DELIMITER, 1)
                cat_name = cat_name.strip() or "Other"
                test_name = test_only.strip() or test_name
            else:
                cat_name = "Other"
            roster.append(
                {
                    "patient_name": (patient.name or "").strip() or f"Patient #{patient.id}",
                    "category": cat_name,
                    "test_name": test_name,
                    "requested": _fmt_lab_datetime(result.collected_at),
                    "source": "result",
                }
            )

    return roster


@router.get("/laboratory-overview")
async def get_laboratory_overview(
    date_param: Optional[date] = Query(None, alias="date"),
    summary_only: bool = Query(False, alias="summary_only"),
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

        # ----- Active technicians (lab department / laboratorian role) -----
        lab_staff_filter = or_(
            Staff.department.ilike("%lab%"),
            Staff.department.ilike("%laboratory%"),
            Staff.role.ilike("%laborator%"),
            Staff.role.ilike("%technician%"),
        )
        active_techs_result = await db.execute(
            select(func.count(Staff.id)).where(lab_staff_filter)
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
        # Two sources: (1) LabRequest-based (legacy), (2) LaboratoryResult only (laboratorian entries)
        # Laboratorian stores category in test_name as "CategoryName | TestName"

        # Category names from LabCategory
        categories_result = await db.execute(
            select(LabCategory.id, LabCategory.name)
        )
        categories = {row.id: row.name for row in categories_result}

        # (1) Completed on selected date per category via LabRequest join
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
        completed_by_cat: Dict[str, int] = {
            categories.get(row.lab_category_id, "Other"): row.count
            for row in completed_by_cat_result
        }

        # (2) Pending on selected date per category from LabRequest
        pending_by_cat_result = await db.execute(
            select(
                LabRequest.lab_category_id,
                func.count(LabRequest.id),
            )
            .where(
                and_(
                    LabRequest.status == "pending",
                    cast(LabRequest.request_date, Date) <= base_date,
                )
            )
            .group_by(LabRequest.lab_category_id)
        )
        pending_by_cat: Dict[str, int] = {
            categories.get(row.lab_category_id, "Other"): row.count
            for row in pending_by_cat_result
        }

        # (3) Include laboratorian-added results (LaboratoryResult only, no LabRequest)
        # Category is stored in test_name as "CategoryName | TestName"
        laboratorian_results = await db.execute(
            select(LaboratoryResult.test_name, LaboratoryResult.status).where(
                cast(LaboratoryResult.collected_at, Date) == base_date
            )
        )
        for row in laboratorian_results.all():
            test_name = row.test_name or ""
            if LAB_ENTRY_DELIMITER in test_name:
                cat_name = test_name.split(LAB_ENTRY_DELIMITER, 1)[0].strip() or "Other"
            else:
                cat_name = "Other"
            if row.status == "completed":
                completed_by_cat[cat_name] = completed_by_cat.get(cat_name, 0) + 1
            else:
                pending_by_cat[cat_name] = pending_by_cat.get(cat_name, 0) + 1

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

        # If no lab staff rows exist but lab work is active, estimate from category load.
        if active_technicians == 0 and (pending_tests > 0 or completed_today > 0):
            active_technicians = max(
                1,
                len(
                    [
                        n
                        for n in all_category_names
                        if pending_by_cat.get(n, 0) > 0 or completed_by_cat.get(n, 0) > 0
                    ]
                ),
            )

        roster_limit = 8 if summary_only else 500
        pending_tests_roster = await _fetch_pending_tests_roster(
            db, base_date=base_date, limit=roster_limit
        )

        result: Dict[str, Any] = {
            "pending_tests": int(pending_tests),
            "completed_today": int(completed_today),
            "active_technicians": int(active_technicians),
            "critical_results": int(critical_results),
            "daily_test_volume_by_category": daily_test_volume_by_category,
            "weekly_result_trends": weekly_result_trends,
            "selected_date": base_date.isoformat(),
            "pending_tests_roster": pending_tests_roster,
        }

        if summary_only:
            result["weekly_result_trends"] = []

        try:
            ml_points, ml_summary = await predict_next_7_days_lab_backlog(
                db, base_date=base_date
            )
            result["ml_next_7_days_forecast"] = [
                {
                    "date": p.date,
                    "backlog_risk": p.backlog_risk,
                    "risk_probability": round(p.risk_probability, 3),
                    "day_name": p.day_name,
                }
                for p in ml_points
            ]
            result["ml_backlog_risk"] = ml_summary
            at_risk_limit = 5 if summary_only else 12
            ml_at_risk = await predict_abnormal_risk_samples(
                db, base_date=base_date, limit=at_risk_limit
            )
            result["ml_abnormal_at_risk"] = ml_at_risk
            result["critical_alert_count"] = int(critical_results) + len(ml_at_risk)
            result["ml_available"] = bool(ml_summary.get("ml_available"))
        except Exception as ml_exc:
            result["ml_next_7_days_forecast"] = []
            result["ml_backlog_risk"] = {
                "risk_prob": 0.0,
                "risk_pct": 0,
                "risk_label": "Low",
                "ml_available": False,
            }
            result["ml_abnormal_at_risk"] = []
            result["critical_alert_count"] = int(critical_results)
            result["ml_available"] = False
            result["ml_error"] = str(ml_exc)

        return result

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load laboratory overview: {exc}",
        )

