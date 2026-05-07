from __future__ import annotations

import json
import os
import pickle
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_bounds import day_bounds_utc_naive, get_app_timezone
from app.models.billing import Billing, BillingStatus
from app.models.billing_extra import BillItem, Transaction


@dataclass(frozen=True)
class RevenueForecastPoint:
    date: str  # ISO date (calendar day in APP_TIMEZONE)
    predicted_revenue: float


@dataclass(frozen=True)
class DefaultRiskResult:
    risk_prob: float  # 0..1
    risk_pct: int  # 0..100
    risk_label: str  # Low/Moderate/High/Critical


def _ml_dir() -> str:
    # Backend/app/services -> Backend/ml
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", "..", "ml"))


def _load_metadata() -> Dict[str, Any]:
    meta_path = os.path.join(_ml_dir(), "finance_model_metadata.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_revenue_model() -> Any:
    model_path = os.path.join(_ml_dir(), "finance_revenue_model.pkl")
    # Prefer joblib when available; fallback to pickle.
    try:
        import joblib  # type: ignore

        return joblib.load(model_path)
    except Exception:
        with open(model_path, "rb") as f:
            return pickle.load(f)


@lru_cache(maxsize=1)
def get_revenue_model_bundle() -> Tuple[Any, List[str]]:
    meta = _load_metadata()
    rm = meta.get("revenue_model") or {}
    features = list(rm.get("features") or [])
    model = _load_revenue_model()
    return model, features


def _load_default_model() -> Any:
    model_path = os.path.join(_ml_dir(), "finance_default_model.pkl")
    try:
        import joblib  # type: ignore

        return joblib.load(model_path)
    except Exception:
        with open(model_path, "rb") as f:
            return pickle.load(f)


@lru_cache(maxsize=1)
def get_default_model_bundle() -> Tuple[Any, List[str]]:
    meta = _load_metadata()
    dm = meta.get("default_model") or {}
    features = list(dm.get("features") or [])
    model = _load_default_model()
    return model, features


async def _daily_revenue(
    db: AsyncSession, day: date, tz: Any
) -> float:
    d0, d1 = day_bounds_utc_naive(day, tz)
    r = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount_paid), 0.0)).where(
            and_(Transaction.transaction_date >= d0, Transaction.transaction_date <= d1)
        )
    )
    return float(r.scalar_one() or 0.0)


async def _daily_totals(
    db: AsyncSession, day: date, tz: Any
) -> Tuple[int, float, float]:
    """
    Returns (total_bills, paid_amount, total_amount) for the calendar day.
    paid_amount uses transactions; totals use billings.
    """
    d0, d1 = day_bounds_utc_naive(day, tz)
    total_bills_r = await db.execute(
        select(func.count()).select_from(Billing).where(and_(Billing.date >= d0, Billing.date <= d1))
    )
    total_bills = int(total_bills_r.scalar_one() or 0)

    paid_amt_r = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount_paid), 0.0)).where(
            and_(Transaction.transaction_date >= d0, Transaction.transaction_date <= d1)
        )
    )
    paid_amount = float(paid_amt_r.scalar_one() or 0.0)

    total_amt_r = await db.execute(
        select(func.coalesce(func.sum(Billing.amount), 0.0)).where(and_(Billing.date >= d0, Billing.date <= d1))
    )
    total_amount = float(total_amt_r.scalar_one() or 0.0)

    return total_bills, paid_amount, total_amount


def _mean(xs: List[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def _label_from_prob(prob: float) -> str:
    if prob >= 0.9:
        return "Critical"
    if prob >= 0.75:
        return "High"
    if prob >= 0.5:
        return "Moderate"
    return "Low"


def _payment_method_encoded(method: Optional[str]) -> float:
    m = (method or "").strip().lower()
    if "card" in m:
        return 1.0
    if "bank" in m:
        return 2.0
    if "insur" in m:
        return 3.0
    return 0.0  # cash/unknown


async def predict_collection_default_risk(
    db: AsyncSession,
    base_date: date,
    lookback_days: int = 7,
) -> DefaultRiskResult:
    """
    Uses finance_default_model to estimate a single aggregated default/collection-risk
    probability from recent pending bills (no identities returned).
    """
    model, features = get_default_model_bundle()
    tz = get_app_timezone()

    start_day = base_date - timedelta(days=max(1, lookback_days) - 1)
    d0, _ = day_bounds_utc_naive(start_day, tz)
    _, d1 = day_bounds_utc_naive(base_date, tz)

    pending_r = await db.execute(
        select(Billing.id, Billing.amount, Billing.date)
        .where(
            and_(
                Billing.status == BillingStatus.pending,
                Billing.date >= d0,
                Billing.date <= d1,
            )
        )
        .order_by(Billing.date.desc())
        .limit(300)
    )
    pending_rows = pending_r.all()
    if not pending_rows:
        return DefaultRiskResult(risk_prob=0.0, risk_pct=0, risk_label="Low")

    billing_ids = [int(r.id) for r in pending_rows]
    items_r = await db.execute(
        select(
            BillItem.billing_id,
            func.count(BillItem.id),
            func.coalesce(func.sum(BillItem.amount), 0.0),
        )
        .where(BillItem.billing_id.in_(billing_ids))
        .group_by(BillItem.billing_id)
    )
    by_bid: Dict[int, Dict[str, float]] = {}
    for bid, cnt, total_amt in items_r.all():
        by_bid[int(bid)] = {"cnt": float(cnt or 0), "sum": float(total_amt or 0.0)}

    probs: List[float] = []
    for row in pending_rows:
        amt = float(row.amount or 0.0)
        it = by_bid.get(int(row.id), {"cnt": 0.0, "sum": 0.0})
        bill_items_count = float(it["cnt"])
        total_items_amount = float(it["sum"])
        has_items = 1.0 if bill_items_count > 0 else 0.0
        is_large_bill = 1.0 if amt >= 25000 else 0.0

        feats = {
            "amount": amt,
            "bill_items_count": bill_items_count,
            "total_items_amount": total_items_amount,
            "is_large_bill": is_large_bill,
            "has_items": has_items,
            "payment_method_encoded": _payment_method_encoded(None),
            "day_of_week": float(base_date.weekday()),
            "month": float(base_date.month),
            "hour_of_day": 12.0,
        }
        x = [float(feats.get(f, 0.0)) for f in features]
        try:
            proba = model.predict_proba([x])  # type: ignore[attr-defined]
            probs.append(float(proba[0][1]))
        except Exception:
            continue

    if not probs:
        return DefaultRiskResult(risk_prob=0.0, risk_pct=0, risk_label="Low")

    p = float(max(0.0, min(1.0, _mean(probs))))
    pct = int(round(p * 100))
    return DefaultRiskResult(risk_prob=p, risk_pct=pct, risk_label=_label_from_prob(p))


async def predict_next_7_days_revenue(
    db: AsyncSession,
    base_date: date,
) -> List[RevenueForecastPoint]:
    """
    Produces a 7-day forward revenue forecast using the bundled sklearn regressor.
    Features are computed from the last 7 calendar days of transaction revenue and
    current-day billing/collection stats.
    """
    model, features = get_revenue_model_bundle()
    tz = get_app_timezone()

    # Pull last 7 days revenue (calendar days) ending yesterday (lags).
    history_days = [base_date - timedelta(days=i) for i in range(1, 8)]
    hist_rev = [await _daily_revenue(db, d, tz) for d in reversed(history_days)]

    # Current-day contextual features.
    total_bills, paid_amount, total_amount = await _daily_totals(db, base_date, tz)
    collection_rate = float(paid_amount / max(1.0, (paid_amount + max(0.0, total_amount - paid_amount))))

    def row_for(target_day: date, series: List[float]) -> Dict[str, float]:
        r1 = float(series[-1] if len(series) >= 1 else 0.0)
        r2 = float(series[-2] if len(series) >= 2 else r1)
        r3 = float(series[-3] if len(series) >= 3 else r2)
        r7 = float(series[-7] if len(series) >= 7 else r3)
        rolling3 = _mean(series[-3:]) if len(series) >= 3 else _mean(series)
        rolling7 = _mean(series[-7:]) if len(series) >= 7 else _mean(series)
        dow = int(target_day.weekday())  # 0=Mon
        return {
            "revenue_lag1": r1,
            "revenue_lag2": r2,
            "revenue_lag3": r3,
            "revenue_lag7": r7,
            "revenue_rolling3": float(rolling3),
            "revenue_rolling7": float(rolling7),
            "total_bills": float(total_bills),
            "collection_rate": float(collection_rate),
            "day_of_week": float(dow),
            "month": float(target_day.month),
            "day_of_month": float(target_day.day),
        }

    out: List[RevenueForecastPoint] = []
    series = list(hist_rev)
    for i in range(7):
        target_day = base_date + timedelta(days=i)
        feats = row_for(target_day, series)

        x = []
        for f in features:
            x.append(float(feats.get(f, 0.0)))

        pred = 0.0
        try:
            pred = float(model.predict([x])[0])  # type: ignore[attr-defined]
        except Exception:
            pred = 0.0

        pred = float(max(0.0, pred))
        out.append(RevenueForecastPoint(date=target_day.isoformat(), predicted_revenue=pred))
        series.append(pred)  # autoregressive forward fill

    return out


def revenue_forecast_risk_label(
    forecast: List[RevenueForecastPoint],
    today_revenue: float,
) -> str:
    """
    Simple risk label based on next-7 avg vs today's revenue.
    """
    avg7 = _mean([p.predicted_revenue for p in forecast]) if forecast else 0.0
    base = float(today_revenue)
    if base <= 0:
        return "High" if avg7 > 0 else "Low"
    ratio = avg7 / base
    if ratio < 0.75:
        return "High"
    if ratio < 0.9:
        return "Moderate"
    if ratio <= 1.1:
        return "Low"
    return "Low"

