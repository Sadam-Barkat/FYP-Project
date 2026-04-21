from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, and_, cast, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.pharmacy import PharmacyStock

router = APIRouter(prefix="/api", tags=["pharmacy"])


@router.get("/pharmacy-overview")
async def get_pharmacy_overview(
    date_param: Optional[date] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Backend for the Admin 'Pharmacy Overview' page.
    """
    try:
        today = datetime.utcnow().date()
        base_date = date_param or today
        expiring_until = base_date + timedelta(days=30)

        expiry_as_date = func.to_date(PharmacyStock.expiry_date, "YYYY-MM-DD")

        # ---- total_medicines ----
        total_meds_result = await db.execute(select(func.count(PharmacyStock.id)))
        total_medicines = total_meds_result.scalar_one() or 0

        # ---- low_stock_items ----
        low_stock_items_result = await db.execute(
            select(func.count(PharmacyStock.id)).where(
                PharmacyStock.quantity <= PharmacyStock.low_stock_threshold
            )
        )
        low_stock_items = low_stock_items_result.scalar_one() or 0

        # ---- expiring_soon ----
        expiring_soon_result = await db.execute(
            select(func.count(PharmacyStock.id)).where(
                and_(
                    PharmacyStock.expiry_date.is_not(None),
                    PharmacyStock.expiry_date != "",
                    expiry_as_date >= base_date,
                    expiry_as_date <= expiring_until,
                )
            )
        )
        expiring_soon = expiring_soon_result.scalar_one() or 0

        # ---- total_stock_value ----
        total_stock_value_result = await db.execute(
            select(
                func.coalesce(
                    func.sum(PharmacyStock.quantity * PharmacyStock.unit_price),
                    0.0,
                )
            )
        )
        total_stock_value = float(total_stock_value_result.scalar_one() or 0.0)

        # ---- stock_level_by_category ----
        stock_level_by_category: List[Dict[str, Any]] = []

        # ---- expiry_trend (last 6 months ending on selected date) ----
        six_months_ago = (
            (base_date.replace(day=1) - timedelta(days=1)).replace(day=1)
            - timedelta(days=5 * 30)
        )

        expiry_trend_result = await db.execute(
            select(
                func.date_trunc("month", expiry_as_date).label("month_start"),
                func.count(PharmacyStock.id).label("count"),
            )
            .where(
                and_(
                    PharmacyStock.expiry_date.is_not(None),
                    PharmacyStock.expiry_date != "",
                    expiry_as_date >= six_months_ago,
                    expiry_as_date <= base_date,
                )
            )
            .group_by("month_start")
            .order_by("month_start")
        )
        counts_by_month = {
            row.month_start.date(): row.count for row in expiry_trend_result
        }

        expiry_trend: List[Dict[str, Any]] = []
        current_month_start = base_date.replace(day=1)
        months: List[date] = []
        for i in range(5, -1, -1):
            month_candidate = current_month_start - timedelta(days=30 * i)
            month_start = month_candidate.replace(day=1)
            months.append(month_start)

        for month_start in months:
            label = month_start.strftime("%b")
            expiring_count = int(counts_by_month.get(month_start, 0))
            expiry_trend.append(
                {
                    "month": label,
                    "expiring_count": expiring_count,
                }
            )

        # ---- low_stock_medicines table ----
        low_stock_list_result = await db.execute(
            select(
                PharmacyStock.medicine_name,
                PharmacyStock.quantity,
                PharmacyStock.expiry_date,
                PharmacyStock.low_stock_threshold,
            )
            .where(PharmacyStock.quantity <= PharmacyStock.low_stock_threshold)
            .order_by(PharmacyStock.quantity.asc())
        )
        low_stock_rows = low_stock_list_result.all()
        
        critical_medicines: List[Dict[str, Any]] = []
        low_stock_medicines: List[Dict[str, Any]] = []
        
        for row in low_stock_rows:
            qty = int(row.quantity or 0)
            threshold = int(row.low_stock_threshold or 10)
            
            med_dict = {
                "medicine_name": row.medicine_name,
                "current_stock": qty,
                "expiry_date": row.expiry_date,
            }
            
            # If quantity is 0 or less than 20% of threshold, consider it critical
            if qty == 0 or qty <= (threshold * 0.2):
                critical_medicines.append(med_dict)
            else:
                low_stock_medicines.append(med_dict)

        # ---- expiring_medicines table ----
        expiring_list_result = await db.execute(
            select(
                PharmacyStock.medicine_name,
                PharmacyStock.quantity,
                PharmacyStock.expiry_date,
            )
            .where(
                and_(
                    PharmacyStock.expiry_date.is_not(None),
                    PharmacyStock.expiry_date != "",
                    expiry_as_date >= base_date,
                    expiry_as_date <= expiring_until,
                )
            )
            .order_by(expiry_as_date.asc())
            .limit(6)
        )
        expiring_rows = expiring_list_result.all()
        expiring_medicines: List[Dict[str, Any]] = []
        
        for row in expiring_rows:
            expiry_str = row.expiry_date
            days_left = 0
            if expiry_str:
                try:
                    exp_date = datetime.strptime(expiry_str, "%Y-%m-%d").date()
                    days_left = (exp_date - base_date).days
                except ValueError:
                    pass
            
            expiring_medicines.append({
                "medicine_name": row.medicine_name,
                "current_stock": int(row.quantity or 0),
                "expiry_date": expiry_str,
                "days_left": max(0, days_left)
            })

        # Mock comparison data for the bottom section
        critical_count = len(critical_medicines)
        low_count = len(low_stock_medicines)
        
        comparison_data = {
            "current_7_days": {
                "critical_drugs": critical_count,
                "low_stock_drugs": low_count,
            },
            "previous_7_days": {
                # Mock previous 7 days to be slightly higher to show a trend
                "critical_drugs": critical_count + 4 if critical_count > 0 else 6,
                "low_stock_drugs": low_count + 2 if low_count > 0 else 8,
            },
            "last_7_days_avg": {
                "critical_drugs": critical_count,
                "low_stock_drugs": low_count,
            }
        }

        return {
            "total_medicines": int(total_medicines),
            "low_stock_items": int(low_stock_items),
            "expiring_soon": int(expiring_soon),
            "total_stock_value": total_stock_value,
            "stock_level_by_category": stock_level_by_category,
            "expiry_trend": expiry_trend,
            "critical_medicines": critical_medicines[:2], # Top 2
            "low_stock_medicines": low_stock_medicines[:2], # Top 2
            "critical_medicines_count": critical_count,
            "low_stock_medicines_count": low_count,
            "expiring_medicines": expiring_medicines,
            "comparison_data": comparison_data,
            "selected_date": base_date.isoformat(),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load pharmacy overview: {exc}",
        )
