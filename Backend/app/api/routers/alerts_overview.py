"""
Alerts & Monitoring overview API — real-time only (no date filter).
When nurse adds critical vitals (or other actions) and an alert is created, it shows here.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy import Date, and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import broadcast_admin_data_changed
from app.database import get_db, SessionLocal
from app.models.alert import Alert, AlertSeverity
from app.models.patient import Patient
from app.models.admission import Admission
from app.models.bed import Bed
from app.models.assignments import DoctorAssignment

router = APIRouter(prefix="/api", tags=["alerts"])

# Real-time feed: last N hours of alerts (so new alerts from nurse/actions show up immediately)
FEED_HOURS = 24
FEED_LIMIT = 50


async def _fetch_recent_alerts_feed(
    db: AsyncSession,
    limit: int = FEED_LIMIT,
    since_hours: int = FEED_HOURS,
    doctor_id: int | None = None,
) -> List[Dict[str, Any]]:
    """
    Fetch recent alerts (e.g. last 24h) for the live feed.
    If doctor_id is provided, restrict to alerts for patients currently assigned to that doctor.
    Department comes from the patient's current admission (bed.ward) when available.
    """
    since = datetime.utcnow() - timedelta(hours=since_hours)
    stmt = (
        select(
            Alert.id,
            Alert.patient_id,
            Alert.type,
            Alert.message,
            Alert.severity,
            Alert.is_resolved,
            Alert.created_at,
            Bed.ward,
        )
        .select_from(Alert)
        .outerjoin(Patient, Alert.patient_id == Patient.id)
        .outerjoin(
            Admission,
            and_(
                Admission.patient_id == Patient.id,
                Admission.discharge_date.is_(None),
            ),
        )
        .outerjoin(Bed, Admission.bed_id == Bed.id)
        .where(Alert.created_at >= since)
        .order_by(Alert.created_at.desc())
        .limit(limit)
    )
    if doctor_id is not None:
        # Only include alerts for patients currently assigned to this doctor.
        stmt = stmt.join(
            DoctorAssignment,
            and_(
                DoctorAssignment.patient_id == Alert.patient_id,
                DoctorAssignment.doctor_id == doctor_id,
                DoctorAssignment.status == "active",
            ),
        )
    result = await db.execute(stmt)
    rows = result.all()

    feed = []
    for row in rows:
        department = (row.ward or row.type or "General").strip()
        short_id = f"A-{row.id:03d}"
        feed.append({
            "id": row.id,
            "short_id": short_id,
            "patient_id": row.patient_id,
            "type": row.type,
            "message": row.message,
            "severity": row.severity.value if hasattr(row.severity, "value") else str(row.severity),
            "department": department,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "is_resolved": row.is_resolved,
        })
    return feed


@router.get("/alerts-overview")
async def get_alerts_overview(
    doctor_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Real-time Alerts & Monitoring. No date filter — current state only.
    Critical/warning counts = live unresolved; feed = recent alerts (e.g. last 24h).
    When nurse adds critical vitals and an alert is created, it appears here.
    """
    try:
        now = datetime.utcnow()
        today = now.date()
        yesterday = today - timedelta(days=1)

        # ---- Critical emergencies: currently unresolved critical alerts ----
        critical_stmt = select(func.count(Alert.id)).where(
            and_(
                Alert.severity == AlertSeverity.critical,
                Alert.is_resolved.is_(False),
            )
        )
        critical_result = await db.execute(critical_stmt)
        critical_emergencies = critical_result.scalar_one() or 0

        # ---- Active warnings: currently unresolved high/medium ----
        warnings_stmt = select(func.count(Alert.id)).where(
            and_(
                Alert.severity.in_([AlertSeverity.high, AlertSeverity.medium]),
                Alert.is_resolved.is_(False),
            )
        )
        warnings_result = await db.execute(warnings_stmt)
        active_warnings = warnings_result.scalar_one() or 0

        # ---- Resolved today: count resolved today (for "Resolved Today" card) ----
        resolved_stmt = select(func.count(Alert.id)).where(
            and_(
                Alert.is_resolved.is_(True),
                cast(Alert.updated_at, Date) == today,
            )
        )
        resolved_result = await db.execute(resolved_stmt)
        resolved_today = resolved_result.scalar_one() or 0

        # ---- Avg response time: for alerts resolved today (minutes) ----
        avg_stmt = (
            select(
                func.avg(
                    func.extract("epoch", Alert.updated_at - Alert.created_at) / 60.0
                ).label("avg_minutes"),
            )
            .where(
                and_(
                    Alert.is_resolved.is_(True),
                    cast(Alert.updated_at, Date) == today,
                )
            )
        )
        avg_result = await db.execute(avg_stmt)
        avg_minutes = avg_result.scalar_one()
        avg_response_time_minutes = round(float(avg_minutes), 1) if avg_minutes is not None else 0.0

        # Yesterday's avg for "vs yesterday" comparison
        avg_prev_stmt = (
            select(
                func.avg(
                    func.extract("epoch", Alert.updated_at - Alert.created_at) / 60.0
                ).label("avg_minutes"),
            )
            .where(
                and_(
                    Alert.is_resolved.is_(True),
                    cast(Alert.updated_at, Date) == yesterday,
                )
            )
        )
        avg_prev_result = await db.execute(avg_prev_stmt)
        avg_prev = avg_prev_result.scalar_one()
        avg_response_time_prev_minutes = round(float(avg_prev), 1) if avg_prev is not None else 0.0

        # ---- Live feed: recent alerts (last 24h) — nurse/action-triggered alerts show here ----
        feed = await _fetch_recent_alerts_feed(
            db,
            limit=FEED_LIMIT,
            since_hours=FEED_HOURS,
            doctor_id=doctor_id,
        )

        return {
            "critical_emergencies": critical_emergencies,
            "active_warnings": active_warnings,
            "avg_response_time_minutes": avg_response_time_minutes,
            "avg_response_time_prev_minutes": avg_response_time_prev_minutes,
            "resolved_today": resolved_today,
            "alerts_feed": feed,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load alerts overview: {exc}",
        )


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Mark an alert as resolved (acknowledged)."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.updated_at = datetime.utcnow()
    await db.commit()
    await broadcast_admin_data_changed("alert_acknowledged")
    return {"id": alert_id, "is_resolved": True}


@router.websocket("/alerts/ws")
async def alerts_websocket(websocket: WebSocket):
    """
    Real-time snapshot: on connect, send recent alerts feed (last 24h).
    Frontend can poll GET /api/alerts-overview or reconnect here for live updates.
    """
    await websocket.accept()
    try:
        async with SessionLocal() as db:
            feed = await _fetch_recent_alerts_feed(db, limit=FEED_LIMIT, since_hours=FEED_HOURS)
            await websocket.send_json({
                "type": "snapshot",
                "alerts": feed,
            })
        # Keep connection open; frontend can close or reuse for future push if we add it.
        while True:
            try:
                _ = await websocket.receive_text()
            except WebSocketDisconnect:
                break
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass
