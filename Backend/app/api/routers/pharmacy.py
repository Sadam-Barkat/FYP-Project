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

    Aggregates stock metrics, stock by category, expiry trend,
    and low stock medicines list for the selected date.
    """
    try:
        # ---- Resolve date and windows ----
        today = datetime.utcnow().date()
        base_date = date_param or today
        # 30‑day window for "expiring soon"
        expiring_until = base_date + timedelta(days=30)

        # We'll treat expiry_date (stored as string) as ISO date 'YYYY-MM-DD'
        expiry_as_date = func.to_date(PharmacyStock.expiry_date, "YYYY-MM-DD")

        # ---- total_medicines ----
        total_meds_result = await db.execute(
            select(func.count(PharmacyStock.id))
        )
        total_medicines = total_meds_result.scalar_one() or 0

        # ---- low_stock_items ----
        low_stock_items_result = await db.execute(
            select(func.count(PharmacyStock.id)).where(
                PharmacyStock.quantity <= PharmacyStock.low_stock_threshold
            )
        )
        low_stock_items = low_stock_items_result.scalar_one() or 0

        # ---- expiring_soon (within 30 days from selected date) ----
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
        # Our current schema has no explicit category on PharmacyStock,
        # so we treat all as a single 'Uncategorized' group.
        stock_by_category_result = await db.execute(
            select(
                literal("Uncategorized").label("category"),
                func.coalesce(
                    func.sum(PharmacyStock.quantity * PharmacyStock.unit_price),
                    0.0,
                ).label("stock_value"),
            )
        )
        rows = stock_by_category_result.all()
        stock_level_by_category: List[Dict[str, Any]] = []
        for row in rows:
            category = row.category
            value = float(row.stock_value or 0.0)
            percentage = (
                (value / total_stock_value * 100.0)
                if total_stock_value > 0
                else 0.0
            )
            stock_level_by_category.append(
                {
                    "category": category,
                    "stock_value": value,
                    "percentage": percentage,
                }
            )

        # ---- expiry_trend (last 6 months ending on selected date) ----
        # We group by month of expiry_date and count expiring medicines.
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

        # Generate a continuous list of months (6‑month window)
        expiry_trend: List[Dict[str, Any]] = []
        # Normalize to first day of current month
        current_month_start = base_date.replace(day=1)
        months: List[date] = []
        for i in range(5, -1, -1):
            # naive month step: subtract i months by going back ~30*i days
            month_candidate = current_month_start - timedelta(days=30 * i)
            month_start = month_candidate.replace(day=1)
            months.append(month_start)

        for month_start in months:
            label = month_start.strftime("%b")  # Jan, Feb, ...
            expiring_count = int(counts_by_month.get(month_start, 0))
            expiry_trend.append(
                {
                    "month": label,
                    "expiring_count": expiring_count,
                }
            )

        # ---- low_stock_medicines table (top 10) ----
        low_stock_list_result = await db.execute(
            select(
                PharmacyStock.medicine_name,
                PharmacyStock.quantity,
                PharmacyStock.expiry_date,
            )
            .where(PharmacyStock.quantity <= PharmacyStock.low_stock_threshold)
            .order_by(PharmacyStock.quantity.asc())
            .limit(10)
        )
        low_stock_rows = low_stock_list_result.all()
        low_stock_medicines: List[Dict[str, Any]] = []
        for row in low_stock_rows:
            expiry_str: Optional[str] = row.expiry_date
            # Normalize expiry to YYYY-MM-DD if possible
            normalized_expiry: Optional[str] = None
            if expiry_str:
                try:
                    normalized_expiry = datetime.strptime(
                        expiry_str, "%Y-%m-%d"
                    ).date().isoformat()
                except ValueError:
                    # keep as-is if format unexpected
                    normalized_expiry = expiry_str

            low_stock_medicines.append(
                {
                    "medicine_name": row.medicine_name,
                    "category": "Uncategorized",
                    "current_stock": int(row.quantity or 0),
                    "expiry_date": normalized_expiry,
                }
            )

        return {
            "total_medicines": int(total_medicines),
            "low_stock_items": int(low_stock_items),
            "expiring_soon": int(expiring_soon),
            "total_stock_value": total_stock_value,
            "stock_level_by_category": stock_level_by_category,
            "expiry_trend": expiry_trend,
            "low_stock_medicines": low_stock_medicines,
            "selected_date": base_date.isoformat(),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load pharmacy overview: {exc}",
        )

