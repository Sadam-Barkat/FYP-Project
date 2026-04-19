from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, and_, cast, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.auth import get_current_user
from app.core.websocket_manager import broadcast_admin_data_changed
from app.database import get_db
from app.models.billing import Billing, BillingStatus
from app.models.billing_extra import Transaction
from app.models.billing_signal import BillingServiceSignal
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.finance_ops import BillingChargeCreate, BillingMarkPaidBody

router = APIRouter(prefix="/api", tags=["billing_finance"])


def require_finance_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.admin, UserRole.finance):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Finance role required.",
        )
    return current_user


async def compute_billing_finance_overview(
    db: AsyncSession,
    date_param: Optional[date],
) -> Dict[str, Any]:
    """
    Core metrics for Billing & Finance (used by HTTP route and PDF export).
    Revenue uses only rows with status=paid (finance-confirmed).
    """
    now = datetime.utcnow()
    base_date = date_param or now.date()
    day_start = datetime.combine(base_date, time.min)
    day_end = datetime.combine(base_date, time.max)
    seven_days_ago = base_date - timedelta(days=6)

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

    outstanding_result = await db.execute(
        select(func.coalesce(func.sum(Billing.amount), 0.0)).where(
            and_(Billing.status == BillingStatus.pending, Billing.date <= day_end)
        )
    )
    outstanding_balance = float(outstanding_result.scalar_one() or 0.0)

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

    todays_expenses = todays_revenue * 0.3

    recent_invoices_result = await db.execute(
        select(
            Billing.id,
            Billing.date,
            Billing.amount,
            Billing.status,
            Billing.description,
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
        day_label = (
            "Today"
            if billing_date.date() == base_date
            else (
                "Yesterday"
                if billing_date.date() == base_date - timedelta(days=1)
                else billing_date.date().isoformat()
            )
        )
        recent_invoices.append(
            {
                "invoice_id": f"INV-{row.id:05d}",
                "patient": row.patient_name,
                "date": day_label,
                "amount": float(row.amount),
                "status": row.status.value if isinstance(row.status, BillingStatus) else str(row.status),
                "description": (row.description or "").strip(),
            }
        )

    revenue_trend_result = await db.execute(
        select(cast(Billing.date, Date).label("day"), func.coalesce(func.sum(Billing.amount), 0.0).label("revenue"))
        .where(
            and_(
                Billing.status == BillingStatus.paid,
                cast(Billing.date, Date) >= seven_days_ago,
                cast(Billing.date, Date) <= base_date,
            )
        )
        .group_by("day")
    )
    revenue_by_day = {row.day: float(row.revenue or 0.0) for row in revenue_trend_result}

    revenue_vs_expenses: List[Dict[str, Any]] = []
    for i in range(7):
        day = seven_days_ago + timedelta(days=i)
        label = day.strftime("%a")
        day_revenue = float(revenue_by_day.get(day, 0.0))
        revenue_vs_expenses.append(
            {"day": label, "revenue": day_revenue, "expenses": day_revenue * 0.3}
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


@router.get("/billing-finance-overview")
async def get_billing_finance_overview(
    date_param: Optional[date] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_or_admin),
) -> Dict[str, Any]:
    try:
        return await compute_billing_finance_overview(db, date_param)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load billing & finance overview: {exc}",
        )


@router.get("/billing-service-signals")
async def list_billing_service_signals(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_or_admin),
) -> List[Dict[str, Any]]:
    """Unresolved clinical triggers for finance (lab completed, discharge, consultation)."""
    stmt = (
        select(
            BillingServiceSignal.id,
            BillingServiceSignal.patient_id,
            Patient.name.label("patient_name"),
            BillingServiceSignal.signal_type,
            BillingServiceSignal.reference_id,
            BillingServiceSignal.detail,
            BillingServiceSignal.created_at,
        )
        .join(Patient, Patient.id == BillingServiceSignal.patient_id)
        .where(BillingServiceSignal.resolved_at.is_(None))
        .order_by(BillingServiceSignal.created_at.desc())
        .limit(100)
    )
    r = await db.execute(stmt)
    out: List[Dict[str, Any]] = []
    for row in r:
        out.append(
            {
                "id": row.id,
                "patient_id": row.patient_id,
                "patient_name": row.patient_name,
                "signal_type": row.signal_type,
                "reference_id": row.reference_id,
                "detail": row.detail,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return out


@router.get("/billing-pending-charges")
async def list_pending_billing_charges(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_or_admin),
    limit: int = Query(50, ge=1, le=200),
) -> List[Dict[str, Any]]:
    """Pending charge rows awaiting payment confirmation."""
    stmt = (
        select(
            Billing.id,
            Billing.patient_id,
            Patient.name.label("patient_name"),
            Billing.amount,
            Billing.description,
            Billing.date,
        )
        .join(Patient, Patient.id == Billing.patient_id)
        .where(Billing.status == BillingStatus.pending)
        .order_by(Billing.date.desc())
        .limit(limit)
    )
    r = await db.execute(stmt)
    rows = []
    for row in r:
        rows.append(
            {
                "id": row.id,
                "patient_id": row.patient_id,
                "patient_name": row.patient_name,
                "amount": float(row.amount),
                "description": (row.description or "").strip(),
                "date": row.date.isoformat() if row.date else None,
            }
        )
    return rows


@router.post("/billing-charges", status_code=status.HTTP_201_CREATED)
async def create_billing_charge(
    body: BillingChargeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_or_admin),
) -> Dict[str, Any]:
    """Finance-only: add a pending charge line (revenue dashboards update only after mark-paid)."""
    p = await db.execute(select(Patient.id).where(Patient.id == body.patient_id))
    if p.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    row = Billing(
        patient_id=body.patient_id,
        amount=float(body.amount),
        description=body.description.strip(),
        status=BillingStatus.pending,
        date=datetime.utcnow(),
    )
    db.add(row)
    await db.flush()

    if body.signal_ids:
        await db.execute(
            update(BillingServiceSignal)
            .where(
                BillingServiceSignal.id.in_(body.signal_ids),
                BillingServiceSignal.resolved_at.is_(None),
            )
            .values(resolved_at=datetime.utcnow())
        )

    await db.commit()
    await db.refresh(row)
    await broadcast_admin_data_changed("billing_finance")
    return {
        "id": row.id,
        "patient_id": row.patient_id,
        "amount": row.amount,
        "description": row.description,
        "status": row.status.value,
    }


@router.post("/billing-charges/{billing_id}/mark-paid", status_code=status.HTTP_200_OK)
async def mark_billing_charge_paid(
    billing_id: int,
    body: BillingMarkPaidBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_or_admin),
) -> Dict[str, Any]:
    """Finance confirms cash received; revenue metrics count paid rows only."""
    r = await db.execute(select(Billing).where(Billing.id == billing_id))
    b = r.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Billing row not found")
    if b.status == BillingStatus.paid:
        return {"id": b.id, "status": "paid", "message": "Already marked paid"}

    b.status = BillingStatus.paid
    b.date = datetime.utcnow()
    db.add(
        Transaction(
            billing_id=b.id,
            payment_method=(body.payment_method or "cash").strip() or "cash",
            amount_paid=float(b.amount),
            transaction_date=datetime.utcnow(),
        )
    )
    await db.commit()
    await broadcast_admin_data_changed("billing_finance")
    return {"id": b.id, "status": "paid"}
