"""AI Hospital Ops Copilot — admin-only endpoints for briefings and daily summary."""

from __future__ import annotations

from datetime import datetime, timedelta, time
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.auth import get_current_user
from app.database import get_db
from app.models.user import User, UserRole
from app.models.ops_briefing import OpsBriefing
from app.models.billing import Billing, BillingStatus
from app.models.alert import Alert
from app.services.ops_copilot_tools import collect_all_signals, get_occupancy_by_ward
from app.services.ops_copilot_agent import call_openai_for_briefing
from app.core.websocket_manager import broadcast_admin_data_changed

router = APIRouter(prefix="/api/ops-copilot", tags=["ops_copilot"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return user


class StatusUpdateBody(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def allowed_status(cls, v: str) -> str:
        s = (v or "").strip().lower()
        if s not in ("open", "resolved", "reviewed"):
            raise ValueError("status must be open, resolved, or reviewed")
        return s


def _row_to_briefing(b: OpsBriefing) -> Dict[str, Any]:
    return {
        "id": b.id,
        "title": b.title,
        "risk_category": b.risk_category,
        "what_changed": b.what_changed,
        "why_it_matters": b.why_it_matters,
        "recommended_actions": b.recommended_actions or [],
        "evidence_links": b.evidence_links or [],
        "status": b.status,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


@router.get("/daily-summary")
async def get_daily_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Lightweight KPI deltas for the Ops Copilot UI (no LLM)."""
    now = datetime.utcnow()
    today = now.date()
    yesterday = today - timedelta(days=1)
    occ_today = await get_occupancy_by_ward(db, today)
    occ_y = await get_occupancy_by_ward(db, yesterday)
    d0 = datetime.combine(today, time.min)
    d1 = datetime.combine(today, time.max)
    p0 = datetime.combine(yesterday, time.min)
    p1 = datetime.combine(yesterday, time.max)
    a_today = await db.execute(select(func.count(Alert.id)).where(Alert.created_at >= d0, Alert.created_at <= d1))
    a_y = await db.execute(select(func.count(Alert.id)).where(Alert.created_at >= p0, Alert.created_at <= p1))
    c_today = int(a_today.scalar_one() or 0)
    c_y = int(a_y.scalar_one() or 0)
    alert_delta_pct = None if c_y == 0 else round(100.0 * (c_today - c_y) / c_y, 1)
    rev_today = await db.execute(
        select(func.coalesce(func.sum(Billing.amount), 0.0)).where(
            Billing.status == BillingStatus.paid, Billing.date >= d0, Billing.date <= d1
        )
    )
    rev_y = await db.execute(
        select(func.coalesce(func.sum(Billing.amount), 0.0)).where(
            Billing.status == BillingStatus.paid, Billing.date >= p0, Billing.date <= p1
        )
    )
    rt = float(rev_today.scalar_one() or 0)
    ry = float(rev_y.scalar_one() or 0)
    rev_delta_pct = None if ry == 0 else round(100.0 * (rt - ry) / ry, 1)
    return {
        "occupancy_pct": occ_today["overall_occupancy_pct"],
        "occupancy_label": "stable"
        if abs(occ_today["overall_occupancy_pct"] - occ_y["overall_occupancy_pct"]) < 3
        else ("up" if occ_today["overall_occupancy_pct"] > occ_y["overall_occupancy_pct"] else "down"),
        "occupancy_prior_pct": occ_y["overall_occupancy_pct"],
        "alerts_today": c_today,
        "alerts_yesterday": c_y,
        "alerts_change_pct": alert_delta_pct,
        "revenue_today_pkr": round(rt, 2),
        "revenue_yesterday_pkr": round(ry, 2),
        "revenue_change_pct": rev_delta_pct,
    }


@router.get("/briefings")
async def list_briefings(
    limit: int = Query(40, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> List[Dict[str, Any]]:
    r = await db.execute(select(OpsBriefing).order_by(OpsBriefing.id.desc()).limit(limit))
    rows = r.scalars().all()
    return [_row_to_briefing(b) for b in rows]


@router.get("/briefings/latest")
async def latest_briefing(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Dict[str, Any]:
    r = await db.execute(select(OpsBriefing).order_by(OpsBriefing.id.desc()).limit(1))
    b = r.scalar_one_or_none()
    if not b:
        return {"briefing": None}
    return {"briefing": _row_to_briefing(b)}


@router.post("/briefings/generate", status_code=status.HTTP_201_CREATED)
async def generate_briefing(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Dict[str, Any]:
    signals = await collect_all_signals(db)
    try:
        out = await call_openai_for_briefing(signals)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e

    row = OpsBriefing(
        title=out["title"],
        risk_category=out.get("risk_category", "general"),
        what_changed=out["what_changed"],
        why_it_matters=out["why_it_matters"],
        recommended_actions=out.get("recommended_actions") or [],
        evidence_links=out.get("evidence_links") or [],
        status="open",
        signals_snapshot=signals,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    await broadcast_admin_data_changed("ops_copilot_briefing")
    return _row_to_briefing(row)


@router.patch("/briefings/{briefing_id}/status")
async def update_briefing_status(
    briefing_id: int,
    body: StatusUpdateBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Dict[str, Any]:
    r = await db.execute(select(OpsBriefing).where(OpsBriefing.id == briefing_id))
    b = r.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Briefing not found")
    b.status = body.status
    await db.commit()
    await db.refresh(b)
    await broadcast_admin_data_changed("ops_copilot_briefing")
    return _row_to_briefing(b)
