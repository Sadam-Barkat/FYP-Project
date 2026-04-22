"""
Admin pharmacy intelligence: stock metrics + OpenAI JSON insights.
"""
from __future__ import annotations

import asyncio
import json
import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, List

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
    "You are an expert hospital pharmacy management AI. "
    "Your job is to analyze real pharmacy stock data and "
    "give intelligent, specific, actionable insights.\n"
    "RULES:\n"
    "- Never use placeholder text or generic statements\n"
    "- Always mention specific medicine names from the data\n"
    "- Decide timeframes yourself based on actual quantities\n"
    "- If out_of_stock_count is 0 and low_stock_count is 0 "
    "say stocks are healthy, do not invent problems\n"
    "- If there are real issues be very specific and urgent\n"
    "- Base every prediction strictly on the numbers given\n"
    "- Respond in JSON format only, no markdown, no extra text"
)

FALLBACK_AI: Dict[str, Any] = {
    "stockout_prediction": "Prediction unavailable.",
    "medicines_to_reorder": [],
    "expiry_warning": "Expiry data unavailable.",
    "suggestion": "Please check pharmacy stock manually.",
}


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )
    return user


def _expiry_as_date_col():
    return func.to_date(PharmacyStock.expiry_date, "YYYY-MM-DD")


def _parse_openai_json(raw: str) -> Dict[str, Any]:
    text = (raw or "").strip()
    if not text:
        return dict(FALLBACK_AI)
    fence = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", text, re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return dict(FALLBACK_AI)
    if not isinstance(data, dict):
        return dict(FALLBACK_AI)
    out = dict(FALLBACK_AI)
    for k in FALLBACK_AI:
        if k not in data:
            continue
        if k == "medicines_to_reorder":
            v = data[k]
            if isinstance(v, list):
                out[k] = [str(x) for x in v if x is not None]
            else:
                out[k] = []
        else:
            out[k] = str(data[k]) if data[k] is not None else out[k]
    return out


def _openai_pharmacy_sync(
    total_medicines: int,
    out_of_stock_count: int,
    low_stock_count: int,
    sufficient_stock_count: int,
    expiring_soon_count: int,
    expired_count: int,
    out_of_stock_names: List[str],
    low_stock_details: List[Dict[str, Any]],
    expiring_details: List[Dict[str, Any]],
) -> Dict[str, Any]:
    from openai import OpenAI

    api_key = (resolve_openai_api_key() or "").strip()
    if not api_key:
        return dict(FALLBACK_AI)

    user_prompt = f"""
Here is the real-time pharmacy stock data for
Gilkari Hospital right now:

STOCK STATUS:
- Total medicines being tracked: {total_medicines}
- Out of stock RIGHT NOW: {out_of_stock_count} medicines
- Low stock (at or below minimum level): {low_stock_count}
- Sufficient stock: {sufficient_stock_count}
- Expiring within 30 days: {expiring_soon_count}
- Already expired (must be removed): {expired_count}

OUT OF STOCK MEDICINES (need immediate reorder):
{out_of_stock_names if out_of_stock_names else "None"}

LOW STOCK MEDICINES WITH ESTIMATED DAYS UNTIL STOCKOUT:
{json.dumps(low_stock_details) if low_stock_details else "None"}

MEDICINES EXPIRING SOON:
{json.dumps(expiring_details) if expiring_details else "None"}

Based on this REAL data analyze and return
a JSON object with exactly these 4 fields:

{{
  "stockout_prediction": "Specific sentence about
    which exact medicines will run out and in how
    many days — base days on the quantity vs
    min_quantity ratio. If no stockout risk say so.",

  "medicines_to_reorder": ["list", "of", "medicine",
    "names", "that", "need", "reorder", "urgently"],

  "expiry_warning": "Specific sentence mentioning
    exact medicine names expiring soon and in how
    many days. If nothing expiring say stock expiry
    is healthy.",

  "suggestion": "One very specific actionable
    instruction for pharmacy staff based on the
    most urgent issue right now. Mention specific
    medicine names and exact action to take."
}}

Return ONLY the JSON. No explanation. No markdown.
"""

    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=250,
        temperature=0.3,
        messages=[
            {"role": "system", "content": OPENAI_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
    )
    msg = resp.choices[0].message.content
    return _parse_openai_json(msg or "")


async def _fetch_ai_pharmacy(
    total_medicines: int,
    out_of_stock_count: int,
    low_stock_count: int,
    sufficient_stock_count: int,
    expiring_soon_count: int,
    expired_count: int,
    out_of_stock_names: List[str],
    low_stock_details: List[Dict[str, Any]],
    expiring_details: List[Dict[str, Any]],
) -> Dict[str, Any]:
    return await asyncio.to_thread(
        _openai_pharmacy_sync,
        total_medicines,
        out_of_stock_count,
        low_stock_count,
        sufficient_stock_count,
        expiring_soon_count,
        expired_count,
        out_of_stock_names,
        low_stock_details,
        expiring_details,
    )


@router.get("/pharmacy-intelligence")
async def get_pharmacy_intelligence(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Dict[str, Any]:
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

    oos_rows = (
        await db.execute(
            select(PharmacyStock.medicine_name)
            .where(PharmacyStock.quantity == 0)
            .order_by(PharmacyStock.medicine_name.asc())
            .limit(5)
        )
    ).all()
    out_of_stock_names = [str(r[0]) for r in oos_rows if r[0]]

    low_rows = (
        await db.execute(
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
            .order_by(PharmacyStock.quantity.asc())
            .limit(5)
        )
    ).all()
    low_stock_details: List[Dict[str, Any]] = []
    for name, qty, min_q in low_rows:
        mq = int(min_q or 0)
        q = int(qty or 0)
        low_stock_details.append(
            {
                "name": str(name),
                "quantity": q,
                "min_quantity": mq,
                "days_until_stockout": int(
                    round((q / max(1, mq)) * 7),
                ),
            }
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
            .limit(5)
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
        expiring_details.append(
            {
                "name": str(name),
                "days_until_expiry": int(days_until),
                "quantity": int(qty or 0),
            }
        )

    try:
        ai = await _fetch_ai_pharmacy(
            total_medicines,
            out_of_stock_count,
            low_stock_count,
            sufficient_stock_count,
            expiring_soon_count,
            expired_count,
            out_of_stock_names,
            low_stock_details,
            expiring_details,
        )
    except Exception:
        ai = dict(FALLBACK_AI)

    return {
        "total_medicines": total_medicines,
        "out_of_stock_count": out_of_stock_count,
        "low_stock_count": low_stock_count,
        "sufficient_stock_count": sufficient_stock_count,
        "expiring_soon_count": expiring_soon_count,
        "expired_count": expired_count,
        "stockout_prediction": ai["stockout_prediction"],
        "medicines_to_reorder": ai["medicines_to_reorder"],
        "expiry_warning": ai["expiry_warning"],
        "suggestion": ai["suggestion"],
    }
