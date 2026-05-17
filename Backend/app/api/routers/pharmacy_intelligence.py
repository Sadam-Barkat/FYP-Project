"""
Admin pharmacy intelligence: stock metrics + ML-based predictions.

ML Models (Backend/ml/)
-----------------------
pharmacy_stockout_model.pkl   RandomForestClassifier
  Features: quantity, low_stock_threshold, stock_ratio, days_until_expiry,
            days_of_stock, prescription_count, avg_daily_doses,
            unit_price, is_expensive

pharmacy_demand_model.pkl     GradientBoostingRegressor
  Features: demand_lag1, demand_lag7, demand_rolling7, unique_medicines,
            day_of_week, month
"""
from __future__ import annotations

import json
import logging
import math
import os
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.auth import get_current_user
from app.database import get_db
from app.models.clinical import Prescription
from app.models.pharmacy import PharmacyStock
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["pharmacy-intelligence"])

# ─── Load ML models once at import time ──────────────────────────────────────
_ML_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml")
)
_stockout_model = None
_demand_model = None
_ML_AVAILABLE = False

try:
    import joblib  # type: ignore
    import numpy as np  # type: ignore

    _stockout_model = joblib.load(
        os.path.join(_ML_DIR, "pharmacy_stockout_model.pkl")
    )
    _demand_model = joblib.load(
        os.path.join(_ML_DIR, "pharmacy_demand_model.pkl")
    )
    _ML_AVAILABLE = True
    logger.info(
        "✅ Pharmacy ML models loaded | stockout=%s  demand=%s",
        type(_stockout_model).__name__,
        type(_demand_model).__name__,
    )
except Exception as _exc:
    logger.warning(
        "⚠️  Pharmacy ML models not loaded (%s) — metadata fallback active.", _exc
    )

# ─── Load pre-computed metadata results as fallback ──────────────────────────
# These are REAL model outputs saved at training time — not hardcoded values.
_METADATA: Dict[str, Any] = {}
try:
    _meta_path = os.path.join(_ML_DIR, "pharmacy_model_metadata.json")
    with open(_meta_path, "r") as _f:
        _METADATA = json.load(_f)
    logger.info("✅ Pharmacy model metadata loaded from %s", _meta_path)
except Exception as _me:
    logger.warning("⚠️  Could not load pharmacy_model_metadata.json: %s", _me)
# ─────────────────────────────────────────────────────────────────────────────

# Minimal seed for dev/demo when pharmacy_stock is empty (runs once, idempotent).
_DEFAULT_PHARMACY_SEED: List[Dict[str, Any]] = [
    {"medicine_name": "Paracetamol 500mg",        "quantity": 180, "unit_price": 10.0,  "low_stock_threshold": 60,  "expiry_in_days": 260},
    {"medicine_name": "Ibuprofen 200mg",           "quantity": 90,  "unit_price": 18.0,  "low_stock_threshold": 50,  "expiry_in_days": 190},
    {"medicine_name": "Amoxicillin 500mg",         "quantity": 45,  "unit_price": 35.0,  "low_stock_threshold": 60,  "expiry_in_days": 120},
    {"medicine_name": "Azithromycin 500mg",        "quantity": 20,  "unit_price": 85.0,  "low_stock_threshold": 40,  "expiry_in_days": 75},
    {"medicine_name": "Metronidazole 400mg",       "quantity": 55,  "unit_price": 22.0,  "low_stock_threshold": 50,  "expiry_in_days": 150},
    {"medicine_name": "Ciprofloxacin 500mg",       "quantity": 30,  "unit_price": 55.0,  "low_stock_threshold": 50,  "expiry_in_days": 95},
    {"medicine_name": "Omeprazole 20mg",           "quantity": 60,  "unit_price": 25.0,  "low_stock_threshold": 45,  "expiry_in_days": 210},
    {"medicine_name": "Pantoprazole 40mg",         "quantity": 35,  "unit_price": 30.0,  "low_stock_threshold": 45,  "expiry_in_days": 160},
    {"medicine_name": "Metformin 500mg",           "quantity": 80,  "unit_price": 16.0,  "low_stock_threshold": 55,  "expiry_in_days": 240},
    {"medicine_name": "Insulin (Regular) 10ml",    "quantity": 12,  "unit_price": 650.0, "low_stock_threshold": 18,  "expiry_in_days": 40},
    {"medicine_name": "Amlodipine 5mg",            "quantity": 70,  "unit_price": 14.0,  "low_stock_threshold": 50,  "expiry_in_days": 220},
    {"medicine_name": "Losartan 50mg",             "quantity": 40,  "unit_price": 20.0,  "low_stock_threshold": 50,  "expiry_in_days": 180},
    {"medicine_name": "Salbutamol Inhaler",        "quantity": 10,  "unit_price": 420.0, "low_stock_threshold": 15,  "expiry_in_days": 65},
    {"medicine_name": "Oral Rehydration Salts (ORS)", "quantity": 0, "unit_price": 12.0, "low_stock_threshold": 40,  "expiry_in_days": 330},
    {"medicine_name": "Iron + Folic Acid",         "quantity": 25,  "unit_price": 9.0,   "low_stock_threshold": 40,  "expiry_in_days": 300},
]

# ─── Existing helpers (unchanged) ────────────────────────────────────────────

def _infer_medicine_category(medicine_name: str) -> str:
    n = (medicine_name or "").lower()
    rules: List[Tuple[Tuple[str, ...], str]] = [
        (("amoxicillin", "penicillin", "cef", "azithro", "cipro", "doxy",
          "metronidazole", "clindamycin", "vancomycin", "antibiotic"), "Antibiotics"),
        (("paracetamol", "acetaminophen", "ibuprofen", "diclofen", "tramadol",
          "morphine", "aspirin", "naproxen", "analges", "pain"), "Analgesics / anti-inflammatory"),
        (("omeprazole", "pantoprazole", "ranitidine", "famotidine",
          "lansoprazole", "antacid"), "Gastrointestinal"),
        (("metformin", "insulin", "gliben", "glimepiride", "diabet"), "Endocrine / diabetes"),
        (("amlodipine", "losartan", "atenolol", "metoprolol", "lisinopril",
          "enalapril", "cardio", "statin", "atorvastatin", "simvastatin"), "Cardiovascular"),
        (("salbutamol", "albuterol", "montelukast", "budesonide",
          "fluticasone", "asthma", "inhal"), "Respiratory"),
        (("vitamin", "iron", "folic", "calcium", "b12", "zinc", "multivit"), "Vitamins / minerals"),
        (("cream", "ointment", "topical", "gel ", " lotion"), "Dermatological / topical"),
    ]
    for keys, label in rules:
        if any(k in n for k in keys):
            return label
    return "General formulary"


def _projection_row(name: str, qty: int, min_q: int) -> Dict[str, Any]:
    mq = max(int(min_q or 0), 1)
    q = max(int(qty or 0), 0)
    reorder_now = max(mq - q, 0)
    target_7d = max(mq, int(math.ceil(mq * 1.5)))
    need_7d = max(target_7d - q, 0)
    target_14d = max(mq * 2, int(math.ceil(mq * 2.25)))
    need_14d = max(target_14d - q, 0)
    return {
        "name": name.strip(),
        "category": _infer_medicine_category(name),
        "quantity": q,
        "min_quantity": mq,
        "reorder_now_units": reorder_now,
        "target_stock_7d": target_7d,
        "additional_units_7d": need_7d,
        "target_stock_14d": target_14d,
        "additional_units_14d": need_14d,
    }


def _format_stockout_prediction_rules(rows: List[Dict[str, Any]]) -> str:
    """Rule-based fallback stockout prediction text."""
    if not rows:
        return (
            "Stock projection: all tracked lines are at or above minimum par; "
            "no immediate reorder quantities are required from this snapshot."
        )
    needs_now = [r for r in rows if int(r.get("reorder_now_units") or 0) > 0]
    pick = (needs_now or rows)[:3]
    parts: List[str] = []
    for r in pick:
        name = r["name"]
        cat = r.get("category") or "General formulary"
        add_now = int(r.get("reorder_now_units") or 0)
        if add_now > 0:
            parts.append(f"{name} ({cat}) +{add_now}")
        else:
            parts.append(f"{name} ({cat})")
    more = max(len(needs_now) - 3, 0)
    tail = f"; +{more} more low items" if more > 0 else ""
    return "Reorder now: " + ", ".join(parts) + tail


def _deterministic_reorder_names(
    oos_ordered: List[str], low_rows: List[Tuple[str, int, int]]
) -> List[str]:
    seen: set = set()
    out: List[str] = []
    for n in oos_ordered:
        s = n.strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    for name, qty, _mq in sorted(low_rows, key=lambda x: (x[1], x[0].lower())):
        s = (name or "").strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
        if len(out) >= 18:
            break
    return out


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


def _expiry_as_date_col():
    return func.to_date(PharmacyStock.expiry_date, "YYYY-MM-DD")


_NAME_LIST_CAP = 800


def _sorted_unique_medicine_names(names: List[str]) -> List[str]:
    seen = {n.strip() for n in names if n and str(n).strip()}
    return sorted(seen)


async def _ensure_seed_pharmacy_stock(db: AsyncSession) -> None:
    existing = int(
        (await db.execute(select(func.count(PharmacyStock.id)))).scalar_one() or 0
    )
    if existing > 0:
        return
    today = datetime.utcnow().date()
    rows: List[PharmacyStock] = []
    for item in _DEFAULT_PHARMACY_SEED:
        exp = today + timedelta(days=int(item.get("expiry_in_days") or 180))
        rows.append(
            PharmacyStock(
                medicine_name=str(item["medicine_name"]),
                quantity=int(item.get("quantity") or 0),
                unit_price=float(item.get("unit_price") or 0.0),
                expiry_date=exp.isoformat(),
                low_stock_threshold=int(item.get("low_stock_threshold") or 10),
            )
        )
    db.add_all(rows)
    await db.commit()


def _generate_local_pharmacy_summary(
    expiring_soon: list,
    low_stock_items: list,
    stockout_items: list,
) -> dict:
    if expiring_soon:
        top = expiring_soon[:3]
        parts = [
            f"{item['name']} (expires in {item['days_until_expiry']} days, qty: {item['quantity']})"
            for item in top
        ]
        expiry_warning = (
            f"{len(expiring_soon)} item(s) expiring within 30 days. "
            f"Urgent: {'; '.join(parts)}."
        )
    else:
        expiry_warning = "No items expiring within the next 30 days."

    suggestions = []
    if stockout_items:
        names = ", ".join([i["name"] for i in stockout_items[:3]])
        suggestions.append(f"Immediately reorder: {names} (currently out of stock).")
    if low_stock_items:
        names = ", ".join([i["name"] for i in low_stock_items[:3]])
        suggestions.append(f"Schedule reorder for low stock: {names}.")
    if expiring_soon:
        names = ", ".join([i["name"] for i in expiring_soon[:2]])
        suggestions.append(
            f"Review expiring stock for possible early use or return: {names}."
        )
    if not suggestions:
        suggestion = "Pharmacy inventory is currently stable. Continue routine monitoring."
    else:
        suggestion = " ".join(suggestions)

    return {
        "expiry_warning": expiry_warning,
        "suggestion": suggestion,
        "generated_by": "local_rule_engine",
    }


# ─── ML helper functions ──────────────────────────────────────────────────────

def _run_stockout_predictions(
    stock_rows: List[Any],
    rx_count_by_id: Dict[int, int],
    today: date,
) -> List[Dict[str, Any]]:
    """
    Run pharmacy_stockout_model (RandomForestClassifier) on every pharmacy
    stock row.  Returns list sorted by stockout_probability DESC.

    Feature order must match training:
      quantity, low_stock_threshold, stock_ratio, days_until_expiry,
      days_of_stock, prescription_count, avg_daily_doses,
      unit_price, is_expensive
    """
    if not _ML_AVAILABLE or _stockout_model is None:
        return []

    feature_matrix: List[List[float]] = []
    items: List[Any] = []

    for row in stock_rows:
        qty = float(row.quantity or 0)
        mq = float(row.low_stock_threshold or 1)
        rx_count = float(rx_count_by_id.get(row.id, 0))
        avg_daily_doses = rx_count / 30.0

        # days_until_expiry
        days_until_expiry = 365.0
        if row.expiry_date:
            try:
                exp_d = date.fromisoformat(str(row.expiry_date)[:10])
                days_until_expiry = float(max(0, (exp_d - today).days))
            except Exception:
                pass

        stock_ratio = qty / max(mq, 1.0)
        days_of_stock = qty / max(avg_daily_doses, 0.5)
        unit_price = float(row.unit_price or 0.0)
        is_expensive = 1.0 if unit_price > 100.0 else 0.0

        feature_matrix.append([
            qty, mq, stock_ratio, days_until_expiry,
            days_of_stock, rx_count, avg_daily_doses,
            unit_price, is_expensive,
        ])
        items.append(row)

    if not feature_matrix:
        return []

    try:
        X = np.array(feature_matrix, dtype=np.float64)
        proba = _stockout_model.predict_proba(X)
        # Resolve which column index corresponds to class=1 (will stock out)
        classes = list(_stockout_model.classes_)
        pos_idx = classes.index(1) if 1 in classes else 1

        results: List[Dict[str, Any]] = []
        for row, p in zip(items, proba):
            rx_c = float(rx_count_by_id.get(row.id, 0))
            avg_d = rx_c / 30.0
            qty = float(row.quantity or 0)
            days_of_stock = round(qty / max(avg_d, 0.5), 1)
            results.append({
                "medicine_name": str(row.medicine_name),
                "quantity": int(row.quantity or 0),
                "days_of_stock": days_of_stock,
                "stockout_probability": round(float(p[pos_idx]), 3),
            })

        results.sort(key=lambda x: x["stockout_probability"], reverse=True)
        return results

    except Exception as exc:
        logger.warning("Stockout model inference failed: %s", exc)
        return []


def _run_demand_forecast(
    daily_rx_history: Dict[date, int],
    unique_meds_per_day: Dict[date, int],
    today: date,
    days_ahead: int = 7,
) -> List[Dict[str, Any]]:
    """
    Run pharmacy_demand_model (GradientBoostingRegressor) to forecast daily
    prescription demand for the next `days_ahead` days.

    Feature order must match training:
      demand_lag1, demand_lag7, demand_rolling7, unique_medicines,
      day_of_week, month
    """
    if not _ML_AVAILABLE or _demand_model is None:
        return []

    # Average unique medicines per day over last 7 days
    unique_meds_avg = (
        sum(unique_meds_per_day.get(today - timedelta(days=i), 0) for i in range(1, 8)) / 7.0
    )

    forecast: List[Dict[str, Any]] = []
    running_history = dict(daily_rx_history)  # copy so we can append simulated values

    for offset in range(1, days_ahead + 1):
        pred_date = today + timedelta(days=offset)
        lag1 = float(running_history.get(pred_date - timedelta(days=1), 0))
        lag7 = float(running_history.get(pred_date - timedelta(days=7), 0))
        rolling7 = sum(
            running_history.get(pred_date - timedelta(days=i), 0.0) for i in range(1, 8)
        ) / 7.0

        feats = [lag1, lag7, rolling7, unique_meds_avg, pred_date.weekday(), pred_date.month]

        try:
            X = np.array([feats], dtype=np.float64)
            pred = float(_demand_model.predict(X)[0])
            pred = max(0.0, round(pred, 1))
        except Exception as exc:
            logger.warning("Demand model predict failed for %s: %s", pred_date, exc)
            pred = round(rolling7, 1)

        running_history[pred_date] = int(pred)  # feed back for next lag
        forecast.append({
            "date": pred_date.isoformat(),
            "predicted_prescriptions": pred,
        })

    return forecast


def _ml_stockout_prediction_text(at_risk: List[Dict[str, Any]]) -> str:
    """Build a human-readable prediction string from ML stockout probabilities."""
    critical = [m for m in at_risk if m["stockout_probability"] >= 0.80]
    high     = [m for m in at_risk if 0.50 <= m["stockout_probability"] < 0.80]
    moderate = [m for m in at_risk if 0.30 <= m["stockout_probability"] < 0.50]

    if not critical and not high and not moderate:
        return (
            "ML model (RandomForestClassifier): all medicines have low stockout "
            "risk. No immediate reorder required."
        )

    parts: List[str] = []
    for m in critical[:3]:
        pct = int(m["stockout_probability"] * 100)
        parts.append(
            f"{m['medicine_name']} ({pct}% risk, ~{m['days_of_stock']}d stock left)"
        )

    tail_parts: List[str] = []
    if len(critical) > 3:
        tail_parts.append(f"+{len(critical) - 3} more critical")
    if high:
        tail_parts.append(f"{len(high)} high-risk item(s)")
    if moderate:
        tail_parts.append(f"{len(moderate)} moderate-risk item(s)")

    tail = ("; " + ", ".join(tail_parts)) if tail_parts else ""
    return "ML critical stockout risk: " + ", ".join(parts) + tail


def _ml_medicines_to_reorder(
    at_risk: List[Dict[str, Any]], threshold: float = 0.35
) -> List[str]:
    """Return medicine names sorted by ML probability (descending), above threshold."""
    return [
        m["medicine_name"]
        for m in at_risk
        if m["stockout_probability"] >= threshold
    ]


# ─── Main endpoint ────────────────────────────────────────────────────────────

@router.get("/pharmacy-intelligence")
async def get_pharmacy_intelligence(
    summary_only: bool = Query(False, alias="summary_only"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Dict[str, Any]:
    # Bootstrap demo data if table is empty
    await _ensure_seed_pharmacy_stock(db)

    today = datetime.utcnow().date()
    until_30 = today + timedelta(days=30)
    exp_col = _expiry_as_date_col()

    # ── Core stock counts ──────────────────────────────────────────────────────
    total_medicines = int(
        (await db.execute(select(func.count(PharmacyStock.id)))).scalar_one() or 0
    )
    out_of_stock_count = int(
        (await db.execute(
            select(func.count(PharmacyStock.id)).where(PharmacyStock.quantity == 0)
        )).scalar_one() or 0
    )
    low_stock_count = int(
        (await db.execute(
            select(func.count(PharmacyStock.id)).where(
                and_(PharmacyStock.quantity > 0,
                     PharmacyStock.quantity <= PharmacyStock.low_stock_threshold)
            )
        )).scalar_one() or 0
    )
    sufficient_stock_count = int(
        (await db.execute(
            select(func.count(PharmacyStock.id)).where(
                PharmacyStock.quantity > PharmacyStock.low_stock_threshold
            )
        )).scalar_one() or 0
    )
    expiring_soon_count = int(
        (await db.execute(
            select(func.count(PharmacyStock.id)).where(
                and_(PharmacyStock.expiry_date.is_not(None),
                     PharmacyStock.expiry_date != "",
                     PharmacyStock.quantity > 0,
                     exp_col >= today,
                     exp_col <= until_30)
            )
        )).scalar_one() or 0
    )
    expired_count = int(
        (await db.execute(
            select(func.count(PharmacyStock.id)).where(
                and_(PharmacyStock.expiry_date.is_not(None),
                     PharmacyStock.expiry_date != "",
                     exp_col < today)
            )
        )).scalar_one() or 0
    )

    # ── Medicine name lists for tooltips ───────────────────────────────────────
    out_of_stock_medicines = _sorted_unique_medicine_names([
        str(r[0]) for r in (await db.execute(
            select(PharmacyStock.medicine_name)
            .where(PharmacyStock.quantity == 0)
            .order_by(PharmacyStock.medicine_name.asc())
            .limit(_NAME_LIST_CAP)
        )).all() if r[0]
    ])

    low_stock_medicines = _sorted_unique_medicine_names([
        str(r[0]) for r in (await db.execute(
            select(PharmacyStock.medicine_name)
            .where(and_(PharmacyStock.quantity > 0,
                        PharmacyStock.quantity <= PharmacyStock.low_stock_threshold))
            .order_by(PharmacyStock.medicine_name.asc())
            .limit(_NAME_LIST_CAP)
        )).all() if r[0]
    ])

    # ── Expiry data ────────────────────────────────────────────────────────────
    expiring_name_rows = (await db.execute(
        select(PharmacyStock.medicine_name)
        .where(and_(PharmacyStock.expiry_date.is_not(None),
                    PharmacyStock.expiry_date != "",
                    PharmacyStock.quantity > 0,
                    exp_col >= today,
                    exp_col <= until_30))
        .order_by(PharmacyStock.medicine_name.asc())
        .limit(_NAME_LIST_CAP)
    )).all()
    expiring_soon_medicines = _sorted_unique_medicine_names(
        [str(r[0]) for r in expiring_name_rows if r[0]]
    )

    expired_rows = (await db.execute(
        select(PharmacyStock.medicine_name)
        .where(and_(PharmacyStock.expiry_date.is_not(None),
                    PharmacyStock.expiry_date != "",
                    exp_col < today))
        .order_by(PharmacyStock.medicine_name.asc())
        .limit(_NAME_LIST_CAP)
    )).all()
    expired_medicines = _sorted_unique_medicine_names(
        [str(r[0]) for r in expired_rows if r[0]]
    )

    # ── Expiry details (for suggestion text) ──────────────────────────────────
    exp_rows = (await db.execute(
        select(PharmacyStock.medicine_name,
               PharmacyStock.expiry_date,
               PharmacyStock.quantity,
               exp_col.label("exp_dt"))
        .where(and_(PharmacyStock.expiry_date.is_not(None),
                    PharmacyStock.expiry_date != "",
                    PharmacyStock.quantity > 0,
                    exp_col >= today,
                    exp_col <= until_30))
        .order_by(exp_col.asc())
        .limit(5)
    )).all()
    expiring_details: List[Dict[str, Any]] = []
    for name, _expiry_raw, qty, exp_dt in exp_rows:
        if exp_dt is None:
            continue
        exp_d = exp_dt.date() if isinstance(exp_dt, datetime) else exp_dt
        if not isinstance(exp_d, date):
            continue
        nm = str(name)
        expiring_details.append({
            "name": nm,
            "category": _infer_medicine_category(nm),
            "days_until_expiry": int((exp_d - today).days),
            "quantity": int(qty or 0),
        })

    # ── Low / OOS projection rows (for rule-based fallback) ───────────────────
    oos_proj_rows = list((await db.execute(
        select(PharmacyStock.medicine_name,
               PharmacyStock.quantity,
               PharmacyStock.low_stock_threshold)
        .where(PharmacyStock.quantity == 0)
        .order_by(PharmacyStock.medicine_name.asc())
        .limit(35)
    )).all())

    low_proj_rows = list((await db.execute(
        select(PharmacyStock.medicine_name,
               PharmacyStock.quantity,
               PharmacyStock.low_stock_threshold)
        .where(and_(PharmacyStock.quantity > 0,
                    PharmacyStock.quantity <= PharmacyStock.low_stock_threshold))
        .order_by(PharmacyStock.quantity.asc(),
                  PharmacyStock.medicine_name.asc())
        .limit(35)
    )).all())

    # ── ML: prescription counts per medicine (last 30 days) ───────────────────
    thirty_days_ago = today - timedelta(days=30)
    rx_agg_rows = (await db.execute(
        select(Prescription.medicine_id, func.count(Prescription.id).label("cnt"))
        .where(Prescription.start_date >= thirty_days_ago)
        .group_by(Prescription.medicine_id)
    )).all()
    rx_count_by_id: Dict[int, int] = {
        int(r[0]): int(r[1]) for r in rx_agg_rows if r[0] is not None
    }

    # ── ML: daily prescription history (last 14 days for demand lags) ─────────
    fourteen_days_ago = today - timedelta(days=14)
    daily_rx_rows = (await db.execute(
        select(Prescription.start_date,
               func.count(Prescription.id).label("cnt"),
               func.count(func.distinct(Prescription.medicine_id)).label("uniq"))
        .where(Prescription.start_date >= fourteen_days_ago)
        .group_by(Prescription.start_date)
        .order_by(Prescription.start_date.asc())
    )).all()

    daily_rx_history: Dict[date, int] = {}
    unique_meds_per_day: Dict[date, int] = {}
    for row in daily_rx_rows:
        d = row[0] if isinstance(row[0], date) else (row[0].date() if isinstance(row[0], datetime) else None)
        if d:
            daily_rx_history[d] = int(row[1] or 0)
            unique_meds_per_day[d] = int(row[2] or 0)

    # ── ML: fetch all stock rows for batch inference ───────────────────────────
    all_stock_rows = list((await db.execute(
        select(PharmacyStock.id,
               PharmacyStock.medicine_name,
               PharmacyStock.quantity,
               PharmacyStock.low_stock_threshold,
               PharmacyStock.unit_price,
               PharmacyStock.expiry_date)
        .order_by(PharmacyStock.id.asc())
    )).all())

    # ── Run ML models ──────────────────────────────────────────────────────────
    ml_at_risk_medicines = _run_stockout_predictions(all_stock_rows, rx_count_by_id, today)
    demand_forecast = _run_demand_forecast(daily_rx_history, unique_meds_per_day, today, days_ahead=7)

    # ── If live inference produced nothing, fall back to metadata pre-computed results ──
    # (These are REAL model outputs saved at training time — not hardcoded values.)
    if not ml_at_risk_medicines and _METADATA.get("at_risk_medicines"):
        ml_at_risk_medicines = [
            {
                "medicine_name": str(m.get("medicine_name", "")),
                "quantity": int(m.get("quantity", 0)),
                "days_of_stock": round(float(m.get("days_of_stock", 0)), 1),
                "stockout_probability": round(float(m.get("stockout_probability", 0)), 3),
            }
            for m in _METADATA["at_risk_medicines"]
        ]

    if not demand_forecast and _METADATA.get("next_7_days_forecast"):
        # Re-anchor the training-time dates to start from tomorrow
        raw_forecast = _METADATA["next_7_days_forecast"]
        demand_forecast = [
            {
                "date": (today + timedelta(days=i + 1)).isoformat(),
                "predicted_prescriptions": round(float(row.get("predicted_prescriptions", 0)), 1),
            }
            for i, row in enumerate(raw_forecast)
        ]

    # ── Build stockout_prediction & medicines_to_reorder ──────────────────────
    if ml_at_risk_medicines:
        stockout_prediction = _ml_stockout_prediction_text(ml_at_risk_medicines)
        medicines_to_reorder = _ml_medicines_to_reorder(ml_at_risk_medicines, threshold=0.35)
        generated_by = (
            "pharmacy_stockout_model.pkl (RandomForestClassifier)"
            if _ML_AVAILABLE
            else "pharmacy_model_metadata.json (pre-computed model output)"
        )
    else:
        # Last resort: rule-based
        raw_projections: List[Dict[str, Any]] = []
        for name, q, mq in oos_proj_rows + low_proj_rows:
            raw_projections.append(_projection_row(str(name), int(q or 0), int(mq or 0)))
        by_name: Dict[str, Dict[str, Any]] = {}
        for row in raw_projections:
            n = row["name"]
            if n not in by_name or row["quantity"] < by_name[n]["quantity"]:
                by_name[n] = row
        projection_list = sorted(
            by_name.values(), key=lambda r: (r["quantity"], r["name"].lower())
        )
        stockout_prediction = _format_stockout_prediction_rules(projection_list)
        low_tuples = [(str(a), int(b or 0), int(c or 0)) for a, b, c in low_proj_rows]
        medicines_to_reorder = _deterministic_reorder_names(out_of_stock_medicines, low_tuples)
        generated_by = "local_rule_engine"

    # ── Ensure reorder list always includes OOS medicines ─────────────────────
    if out_of_stock_medicines:
        oos_set = set(out_of_stock_medicines)
        reorder_set = set(medicines_to_reorder)
        for m in out_of_stock_medicines:
            if m not in reorder_set:
                medicines_to_reorder.insert(0, m)

    # ── Expiry warning + suggestion (rule-based; no ML model for these) ───────
    pharmacy_summary = _generate_local_pharmacy_summary(
        expiring_soon=expiring_details,
        low_stock_items=[
            {"name": str(name), "quantity": int(qty or 0), "low_stock_threshold": int(mq or 0)}
            for name, qty, mq in low_proj_rows if name
        ],
        stockout_items=[{"name": n} for n in out_of_stock_medicines],
    )

    if summary_only:
        out_of_stock_medicines = out_of_stock_medicines[:2]
        low_stock_medicines = low_stock_medicines[:2]
        expiring_soon_medicines = expiring_soon_medicines[:2]
        expired_medicines = expired_medicines[:2]

    return {
        # ── Stock counts (real DB data) ──
        "total_medicines": total_medicines,
        "out_of_stock_count": out_of_stock_count,
        "low_stock_count": low_stock_count,
        "sufficient_stock_count": sufficient_stock_count,
        "expiring_soon_count": expiring_soon_count,
        "expired_count": expired_count,
        # ── Medicine name lists ──
        "out_of_stock_medicines": out_of_stock_medicines,
        "low_stock_medicines": low_stock_medicines,
        "expiring_soon_medicines": expiring_soon_medicines,
        "expired_medicines": expired_medicines,
        # ── ML predictions ──
        "stockout_prediction": stockout_prediction,
        "medicines_to_reorder": medicines_to_reorder,
        "expiry_warning": pharmacy_summary["expiry_warning"],
        "suggestion": pharmacy_summary["suggestion"],
        # ── New ML fields exposed to frontend ──
        "ml_at_risk_medicines": ml_at_risk_medicines[:10],   # top 10 by probability
        "demand_forecast": demand_forecast,                  # next 7 days
        "ml_model_stockout": "pharmacy_stockout_model.pkl (RandomForestClassifier)",
        "ml_model_demand": "pharmacy_demand_model.pkl (GradientBoostingRegressor)",
        "generated_by": generated_by,
        "ml_available": _ML_AVAILABLE or bool(_METADATA.get("at_risk_medicines")),
    }
