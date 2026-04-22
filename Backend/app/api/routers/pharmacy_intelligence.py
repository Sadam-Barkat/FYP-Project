"""
Admin pharmacy intelligence: stock metrics + OpenAI JSON insights.
"""
from __future__ import annotations

import asyncio
import json
import math
import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.auth import get_current_user
from app.core.ops_openai_settings import resolve_openai_api_key
from app.database import get_db
from app.models.pharmacy import PharmacyStock
from app.models.user import User, UserRole

router = APIRouter(prefix="/api", tags=["pharmacy-intelligence"])

OPENAI_SYSTEM = (
    "You are a hospital pharmacy AI assistant. "
    "Be extremely concise and to the point. "
    "No calculations. No unit breakdowns. No formulas. "
    "Just short, clear, actionable sentences. "
    "Respond in JSON format only, no markdown, no extra text."
)

FALLBACK_AI: Dict[str, Any] = {
    "stockout_prediction": "Prediction unavailable.",
    "medicines_to_reorder": [],
    "expiry_warning": "Expiry data unavailable.",
    "suggestion": "Please check pharmacy stock manually.",
}

FALLBACK_EXPIRY: Dict[str, str] = {
    "expiry_warning": FALLBACK_AI["expiry_warning"],
    "suggestion": FALLBACK_AI["suggestion"],
}

# Minimal seed set for dev/demo when `pharmacy_stock` is empty.
# This is rule-based (pre-LLM) and runs only once per DB (idempotent).
_DEFAULT_PHARMACY_SEED: List[Dict[str, Any]] = [
    {"medicine_name": "Paracetamol 500mg", "quantity": 180, "unit_price": 10.0, "low_stock_threshold": 60, "expiry_in_days": 260},
    {"medicine_name": "Ibuprofen 200mg", "quantity": 90, "unit_price": 18.0, "low_stock_threshold": 50, "expiry_in_days": 190},
    {"medicine_name": "Amoxicillin 500mg", "quantity": 45, "unit_price": 35.0, "low_stock_threshold": 60, "expiry_in_days": 120},
    {"medicine_name": "Azithromycin 500mg", "quantity": 20, "unit_price": 85.0, "low_stock_threshold": 40, "expiry_in_days": 75},
    {"medicine_name": "Metronidazole 400mg", "quantity": 55, "unit_price": 22.0, "low_stock_threshold": 50, "expiry_in_days": 150},
    {"medicine_name": "Ciprofloxacin 500mg", "quantity": 30, "unit_price": 55.0, "low_stock_threshold": 50, "expiry_in_days": 95},
    {"medicine_name": "Omeprazole 20mg", "quantity": 60, "unit_price": 25.0, "low_stock_threshold": 45, "expiry_in_days": 210},
    {"medicine_name": "Pantoprazole 40mg", "quantity": 35, "unit_price": 30.0, "low_stock_threshold": 45, "expiry_in_days": 160},
    {"medicine_name": "Metformin 500mg", "quantity": 80, "unit_price": 16.0, "low_stock_threshold": 55, "expiry_in_days": 240},
    {"medicine_name": "Insulin (Regular) 10ml", "quantity": 12, "unit_price": 650.0, "low_stock_threshold": 18, "expiry_in_days": 40},
    {"medicine_name": "Amlodipine 5mg", "quantity": 70, "unit_price": 14.0, "low_stock_threshold": 50, "expiry_in_days": 220},
    {"medicine_name": "Losartan 50mg", "quantity": 40, "unit_price": 20.0, "low_stock_threshold": 50, "expiry_in_days": 180},
    {"medicine_name": "Salbutamol Inhaler", "quantity": 10, "unit_price": 420.0, "low_stock_threshold": 15, "expiry_in_days": 65},
    {"medicine_name": "Oral Rehydration Salts (ORS)", "quantity": 0, "unit_price": 12.0, "low_stock_threshold": 40, "expiry_in_days": 330},
    {"medicine_name": "Iron + Folic Acid", "quantity": 25, "unit_price": 9.0, "low_stock_threshold": 40, "expiry_in_days": 300},
]


def _infer_medicine_category(medicine_name: str) -> str:
    """
    pharmacy_stock has no category FK; infer a broad therapeutic class from the name.
    """
    n = (medicine_name or "").lower()
    rules: List[Tuple[Tuple[str, ...], str]] = [
        (
            (
                "amoxicillin",
                "penicillin",
                "cef",
                "azithro",
                "cipro",
                "doxy",
                "metronidazole",
                "clindamycin",
                "vancomycin",
                "antibiotic",
            ),
            "Antibiotics",
        ),
        (
            (
                "paracetamol",
                "acetaminophen",
                "ibuprofen",
                "diclofen",
                "tramadol",
                "morphine",
                "aspirin",
                "naproxen",
                "analges",
                "pain",
            ),
            "Analgesics / anti-inflammatory",
        ),
        (
            (
                "omeprazole",
                "pantoprazole",
                "ranitidine",
                "famotidine",
                "lansoprazole",
                "antacid",
            ),
            "Gastrointestinal",
        ),
        (
            (
                "metformin",
                "insulin",
                "gliben",
                "glimepiride",
                "diabet",
            ),
            "Endocrine / diabetes",
        ),
        (
            (
                "amlodipine",
                "losartan",
                "atenolol",
                "metoprolol",
                "lisinopril",
                "enalapril",
                "cardio",
                "statin",
                "atorvastatin",
                "simvastatin",
            ),
            "Cardiovascular",
        ),
        (
            (
                "salbutamol",
                "albuterol",
                "montelukast",
                "budesonide",
                "fluticasone",
                "asthma",
                "inhal",
            ),
            "Respiratory",
        ),
        (
            ("vitamin", "iron", "folic", "calcium", "b12", "zinc", "multivit"),
            "Vitamins / minerals",
        ),
        (
            ("cream", "ointment", "topical", "gel ", " lotion"),
            "Dermatological / topical",
        ),
    ]
    for keys, label in rules:
        if any(k in n for k in keys):
            return label
    return "General formulary"


def _projection_row(
    name: str, qty: int, min_q: int
) -> Dict[str, Any]:
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


def _format_stockout_prediction(rows: List[Dict[str, Any]]) -> str:
    if not rows:
        return (
            "Stock projection: all tracked lines are at or above minimum par; "
            "no immediate reorder quantities are required from this snapshot."
        )
    chunks: List[str] = []
    for r in rows[:10]:
        chunks.append(
            f"{r['name']} ({r['category']}): on hand {r['quantity']} units; "
            f"order {r['reorder_now_units']} units now to reach minimum par of {r['min_quantity']}; "
            f"for the next 7 days plan {r['target_stock_7d']} units on shelf "
            f"(add {r['additional_units_7d']} vs today); over 14 days plan {r['target_stock_14d']} units "
            f"(add {r['additional_units_14d']} vs today)."
        )
    more = len(rows) - 10
    tail = f" {more} additional SKU(s) also need review." if more > 0 else ""
    return " ".join(chunks) + tail


def _deterministic_reorder_names(
    oos_ordered: List[str], low_rows: List[Tuple[str, int, int]]
) -> List[str]:
    seen: set[str] = set()
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
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )
    return user


def _expiry_as_date_col():
    return func.to_date(PharmacyStock.expiry_date, "YYYY-MM-DD")


# Cap rows fetched for tooltip lists (avoids huge payloads).
_NAME_LIST_CAP = 800


def _sorted_unique_medicine_names(names: List[str]) -> List[str]:
    seen = {n.strip() for n in names if n and str(n).strip()}
    return sorted(seen)


async def _ensure_seed_pharmacy_stock(db: AsyncSession) -> None:
    """
    If the table is empty, insert a small, realistic demo dataset so the dashboard
    shows meaningful pharmacy intelligence without manual data entry.
    """
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


def _parse_expiry_suggestion_json(raw: str) -> Dict[str, str]:
    text = (raw or "").strip()
    if not text:
        return dict(FALLBACK_EXPIRY)
    fence = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", text, re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return dict(FALLBACK_EXPIRY)
    if not isinstance(data, dict):
        return dict(FALLBACK_EXPIRY)
    out = dict(FALLBACK_EXPIRY)
    for k in FALLBACK_EXPIRY:
        if k in data and data[k] is not None:
            out[k] = str(data[k]).strip()
    return out


def _openai_expiry_suggestion_sync(
    total_medicines: int,
    out_of_stock_count: int,
    low_stock_count: int,
    expiring_soon_count: int,
    expired_count: int,
    expiring_details: List[Dict[str, Any]],
    expired_sample_names: List[str],
) -> Dict[str, str]:
    from openai import OpenAI

    api_key = (resolve_openai_api_key() or "").strip()
    if not api_key:
        return dict(FALLBACK_EXPIRY)

    user_prompt = f"""
Hospital pharmacy status:
- Out of stock medicines: {"None" if out_of_stock_count == 0 else "(not provided)"}
- Low stock medicines: {"None" if low_stock_count == 0 else "(not provided)"}
- Expiring soon (within 30 days): {[m.get("name") for m in expiring_details] if expiring_details else "None"}
- Expired medicines: {expired_count}

Return ONLY this JSON, keep every value
under 15 words, no calculations, no unit details:
{{
  "stockout_prediction": "short sentence,
    which medicines at risk of running out soon",

  "medicines_to_reorder": ["only", "medicine", "names"],

  "expiry_warning": "short sentence,
    which medicines expiring and roughly when",

  "suggestion": "one short action for staff"
}}

Example of good response:
{{
  "stockout_prediction": "Paracetamol and Aspirin
    are critically low and may run out within 2 days.",
  "medicines_to_reorder": ["Paracetamol", "Aspirin"],
  "expiry_warning": "Red Syrup expires in 1 day,
    Brother tablets in 7 days — remove immediately.",
  "suggestion": "Reorder Paracetamol urgently
    and dispose expired Red Syrup today."
}}

Return ONLY the JSON. No extra text.
"""

    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=200,
        temperature=0.2,
        messages=[
            {"role": "system", "content": OPENAI_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
    )
    msg = resp.choices[0].message.content
    return _parse_expiry_suggestion_json(msg or "")


async def _fetch_ai_expiry_suggestion(
    total_medicines: int,
    out_of_stock_count: int,
    low_stock_count: int,
    expiring_soon_count: int,
    expired_count: int,
    expiring_details: List[Dict[str, Any]],
    expired_sample_names: List[str],
) -> Dict[str, str]:
    return await asyncio.to_thread(
        _openai_expiry_suggestion_sync,
        total_medicines,
        out_of_stock_count,
        low_stock_count,
        expiring_soon_count,
        expired_count,
        expiring_details,
        expired_sample_names,
    )


@router.get("/pharmacy-intelligence")
async def get_pharmacy_intelligence(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Dict[str, Any]:
    # Rule-based dataset bootstrap (only when empty) so LLM has real-looking inputs.
    await _ensure_seed_pharmacy_stock(db)

    today = datetime.utcnow().date()
    until_30 = today + timedelta(days=30)
    exp_col = _expiry_as_date_col()

    total_medicines = int(
        (await db.execute(select(func.count(PharmacyStock.id)))).scalar_one() or 0
    )

    out_of_stock_count = int(
        (
            await db.execute(
                select(func.count(PharmacyStock.id)).where(
                    PharmacyStock.quantity == 0
                )
            )
        ).scalar_one()
        or 0
    )

    low_stock_count = int(
        (
            await db.execute(
                select(func.count(PharmacyStock.id)).where(
                    and_(
                        PharmacyStock.quantity > 0,
                        PharmacyStock.quantity <= PharmacyStock.low_stock_threshold,
                    )
                )
            )
        ).scalar_one()
        or 0
    )

    sufficient_stock_count = int(
        (
            await db.execute(
                select(func.count(PharmacyStock.id)).where(
                    PharmacyStock.quantity > PharmacyStock.low_stock_threshold
                )
            )
        ).scalar_one()
        or 0
    )

    expiring_soon_count = int(
        (
            await db.execute(
                select(func.count(PharmacyStock.id)).where(
                    and_(
                        PharmacyStock.expiry_date.is_not(None),
                        PharmacyStock.expiry_date != "",
                        PharmacyStock.quantity > 0,
                        exp_col >= today,
                        exp_col <= until_30,
                    )
                )
            )
        ).scalar_one()
        or 0
    )

    expired_count = int(
        (
            await db.execute(
                select(func.count(PharmacyStock.id)).where(
                    and_(
                        PharmacyStock.expiry_date.is_not(None),
                        PharmacyStock.expiry_date != "",
                        exp_col < today,
                    )
                )
            )
        ).scalar_one()
        or 0
    )

    oos_all = (
        await db.execute(
            select(PharmacyStock.medicine_name)
            .where(PharmacyStock.quantity == 0)
            .order_by(PharmacyStock.medicine_name.asc())
            .limit(_NAME_LIST_CAP)
        )
    ).all()
    out_of_stock_medicines = _sorted_unique_medicine_names(
        [str(r[0]) for r in oos_all if r[0]]
    )

    low_all = (
        await db.execute(
            select(PharmacyStock.medicine_name)
            .where(
                and_(
                    PharmacyStock.quantity > 0,
                    PharmacyStock.quantity <= PharmacyStock.low_stock_threshold,
                )
            )
            .order_by(PharmacyStock.medicine_name.asc())
            .limit(_NAME_LIST_CAP)
        )
    ).all()
    low_stock_medicines = _sorted_unique_medicine_names(
        [str(r[0]) for r in low_all if r[0]]
    )

    oos_proj_r = await db.execute(
        select(
            PharmacyStock.medicine_name,
            PharmacyStock.quantity,
            PharmacyStock.low_stock_threshold,
        )
        .where(PharmacyStock.quantity == 0)
        .order_by(PharmacyStock.medicine_name.asc())
        .limit(35)
    )
    low_proj_r = await db.execute(
        select(
            PharmacyStock.medicine_name,
            PharmacyStock.quantity,
            PharmacyStock.low_stock_threshold,
        )
        .where(
            and_(
                PharmacyStock.quantity > 0,
                PharmacyStock.quantity <= PharmacyStock.low_stock_threshold,
            )
        )
        .order_by(PharmacyStock.quantity.asc(), PharmacyStock.medicine_name.asc())
        .limit(35)
    )
    oos_proj_rows = list(oos_proj_r.all())
    low_proj_rows = list(low_proj_r.all())
    raw_projections: List[Dict[str, Any]] = []
    for name, q, mq in oos_proj_rows + low_proj_rows:
        raw_projections.append(
            _projection_row(str(name), int(q or 0), int(mq or 0))
        )
    by_name: Dict[str, Dict[str, Any]] = {}
    for row in raw_projections:
        n = row["name"]
        if n not in by_name or row["quantity"] < by_name[n]["quantity"]:
            by_name[n] = row
    projection_list = sorted(
        by_name.values(), key=lambda r: (r["quantity"], r["name"].lower())
    )
    stockout_prediction = _format_stockout_prediction(projection_list)
    low_tuples = [
        (str(a), int(b or 0), int(c or 0)) for a, b, c in low_proj_rows
    ]
    medicines_to_reorder = _deterministic_reorder_names(
        out_of_stock_medicines, low_tuples
    )

    exp_rows = (
        await db.execute(
            select(
                PharmacyStock.medicine_name,
                PharmacyStock.quantity,
                exp_col.label("exp_dt"),
            )
            .where(
                and_(
                    PharmacyStock.expiry_date.is_not(None),
                    PharmacyStock.expiry_date != "",
                    PharmacyStock.quantity > 0,
                    exp_col >= today,
                    exp_col <= until_30,
                )
            )
            .order_by(exp_col.asc())
            .limit(14)
        )
    ).all()
    expiring_details: List[Dict[str, Any]] = []
    for name, qty, exp_dt in exp_rows:
        if exp_dt is None:
            continue
        if isinstance(exp_dt, datetime):
            exp_d = exp_dt.date()
        elif isinstance(exp_dt, date):
            exp_d = exp_dt
        else:
            continue
        days_until = (exp_d - today).days
        nm = str(name)
        expiring_details.append(
            {
                "name": nm,
                "category": _infer_medicine_category(nm),
                "days_until_expiry": int(days_until),
                "quantity": int(qty or 0),
            }
        )

    expiring_name_rows = (
        await db.execute(
            select(PharmacyStock.medicine_name)
            .where(
                and_(
                    PharmacyStock.expiry_date.is_not(None),
                    PharmacyStock.expiry_date != "",
                    PharmacyStock.quantity > 0,
                    exp_col >= today,
                    exp_col <= until_30,
                )
            )
            .order_by(PharmacyStock.medicine_name.asc())
            .limit(_NAME_LIST_CAP)
        )
    ).all()
    expiring_soon_medicines = _sorted_unique_medicine_names(
        [str(r[0]) for r in expiring_name_rows if r[0]]
    )

    expired_rows = (
        await db.execute(
            select(PharmacyStock.medicine_name)
            .where(
                and_(
                    PharmacyStock.expiry_date.is_not(None),
                    PharmacyStock.expiry_date != "",
                    exp_col < today,
                )
            )
            .order_by(PharmacyStock.medicine_name.asc())
            .limit(_NAME_LIST_CAP)
        )
    ).all()
    expired_medicines = _sorted_unique_medicine_names(
        [str(r[0]) for r in expired_rows if r[0]]
    )

    expired_sample_names = expired_medicines[:18]

    try:
        ai_exp = await _fetch_ai_expiry_suggestion(
            total_medicines,
            out_of_stock_count,
            low_stock_count,
            expiring_soon_count,
            expired_count,
            expiring_details,
            expired_sample_names,
        )
    except Exception:
        ai_exp = dict(FALLBACK_EXPIRY)

    return {
        "total_medicines": total_medicines,
        "out_of_stock_count": out_of_stock_count,
        "low_stock_count": low_stock_count,
        "sufficient_stock_count": sufficient_stock_count,
        "expiring_soon_count": expiring_soon_count,
        "expired_count": expired_count,
        "out_of_stock_medicines": out_of_stock_medicines,
        "low_stock_medicines": low_stock_medicines,
        "expiring_soon_medicines": expiring_soon_medicines,
        "expired_medicines": expired_medicines,
        "stockout_prediction": stockout_prediction,
        "medicines_to_reorder": medicines_to_reorder,
        "expiry_warning": ai_exp["expiry_warning"],
        "suggestion": ai_exp["suggestion"],
    }
