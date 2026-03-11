from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.billing import Billing, BillingStatus
from app.models.billing_extra import Transaction
from app.models.patient import Patient

router = APIRouter(prefix="/api", tags=["billing_finance"])


@router.get("/billing-finance-overview")
async def get_billing_finance_overview(
    date_param: Optional[date] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Backend for the Admin 'Billing & Finance Overview' page.

    Metrics:
    - Today's revenue (sum of paid billings on selected date)
    - Outstanding balance (sum of pending billings up to selected date)
    - Insurance claims (count of transactions via insurance, approximated)
    - Today's expenses (operational costs, approximated as 30% of revenue)
    - Recent invoices list
    - Revenue vs Expenses trend for last 7 days ending on selected date
    """
    try:
        now = datetime.utcnow()
        base_date = date_param or now.date()
        day_start = datetime.combine(base_date, time.min)
        day_end = datetime.combine(base_date, time.max)
        seven_days_ago = base_date - timedelta(days=6)

        # ---- Today's revenue: sum of paid billings on selected date ----
        todays_revenue_result = await db.execute(
            select(
                func.coalesce(func.sum(Billing.amount), 0.0)
            ).where(
                and_(
                    Billing.status == BillingStatus.paid,
                    Billing.date >= day_start,
                    Billing.date <= day_end,
                )
            )
        )
        todays_revenue = float(todays_revenue_result.scalar_one() or 0.0)

        # ---- Outstanding balance: sum of pending billings up to selected date ----
        outstanding_result = await db.execute(
            select(
                func.coalesce(func.sum(Billing.amount), 0.0)
            ).where(
                and_(
                    Billing.status == BillingStatus.pending,
                    Billing.date <= day_end,
                )
            )
        )
        outstanding_balance = float(outstanding_result.scalar_one() or 0.0)

        # ---- Insurance claims: count of insurance transactions on selected date ----
        insurance_claims_result = await db.execute(
            select(func.count(Transaction.id)).where(
                and_(
                    func.lower(Transaction.payment_method).like("%insurance%"),
                    Transaction.transaction_date >= day_start,
                    Transaction.transaction_date <= day_end,
                )
            )
        )
        insurance_claims = insurance_claims_result.scalar_one() or 0

        # ---- Today's expenses (simple approximation as 30% of revenue) ----
        todays_expenses = todays_revenue * 0.3

        # ---- Recent invoices (latest 5 billings within 7-day window ending on selected date) ----
        recent_invoices_result = await db.execute(
            select(
                Billing.id,
                Billing.date,
                Billing.amount,
                Billing.status,
                Patient.name.label("patient_name"),
            )
            .join(Patient, Patient.id == Billing.patient_id)
            .where(
                and_(
                    Billing.date >= datetime.combine(seven_days_ago, time.min),
                    Billing.date <= day_end,
                )
            )
            .order_by(Billing.date.desc())
            .limit(5)
        )

        recent_invoices: List[Dict[str, Any]] = []
        for row in recent_invoices_result:
            billing_date: datetime = row.date
            day_label = "Today" if billing_date.date() == base_date else (
                "Yesterday" if billing_date.date() == base_date - timedelta(days=1) else billing_date.date().isoformat()
            )
            recent_invoices.append(
                {
                    "invoice_id": f"INV-{row.id:05d}",
                    "patient": row.patient_name,
                    "date": day_label,
                    "amount": float(row.amount),
                    "status": row.status.value if isinstance(row.status, BillingStatus) else str(row.status),
                }
            )

        # ---- Revenue vs Expenses trend for last 7 days ----
        # Revenue: sum of paid billings grouped by date
        revenue_trend_result = await db.execute(
            select(
                cast(Billing.date, Date).label("day"),
                func.coalesce(func.sum(Billing.amount), 0.0).label("revenue"),
            )
            .where(
                and_(
                    Billing.status == BillingStatus.paid,
                    cast(Billing.date, Date) >= seven_days_ago,
                    cast(Billing.date, Date) <= base_date,
                )
            )
            .group_by("day")
        )
        revenue_by_day = {
            row.day: float(row.revenue or 0.0) for row in revenue_trend_result
        }

        # Expenses: simple 30% of revenue for each day
        revenue_vs_expenses: List[Dict[str, Any]] = []
        for i in range(7):
            day = seven_days_ago + timedelta(days=i)
            label = day.strftime("%a")  # Mon, Tue, ...
            day_revenue = float(revenue_by_day.get(day, 0.0))
            day_expenses = day_revenue * 0.3
            revenue_vs_expenses.append(
                {
                    "day": label,
                    "revenue": day_revenue,
                    "expenses": day_expenses,
                }
            )

        return {
            "todays_revenue": todays_revenue,
            "outstanding_balance": outstanding_balance,
            "insurance_claims": int(insurance_claims),
            "todays_expenses": todays_expenses,
            "recent_invoices": recent_invoices,
            "revenue_vs_expenses": revenue_vs_expenses,
            "selected_date": base_date.isoformat(),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load billing & finance overview: {exc}",
        )

