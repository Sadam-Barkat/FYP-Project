"""
Nurse API: list assigned patients and record vitals for them.

Nurse logs in and sees only patients assigned to them (NursePatientAssignment with status=active).
Endpoints require authentication and nurse role. All under /api/nurse.
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import broadcast_admin_data_changed, manager as ws_manager
from app.database import get_db
from app.models.alert import Alert, AlertSeverity
from app.models.assignments import NursePatientAssignment
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.vital import Vital
from app.api.routers.auth import get_current_user
from app.schemas.nurse import NursePatientOption, VitalCreate, VitalRecordResponse

router = APIRouter(prefix="/api/nurse", tags=["nurse"])


def require_nurse(current_user: User = Depends(get_current_user)) -> User:
    """Ensure the current user is a nurse; otherwise 403."""
    if current_user.role != UserRole.nurse:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nurse role required.",
        )
    return current_user


async def _ensure_patient_assigned_to_nurse(
    nurse_id: int,
    patient_id: int,
    db: AsyncSession,
) -> None:
    """Raise 404 if the patient is not assigned to this nurse (active assignment)."""
    stmt = select(NursePatientAssignment).where(
        NursePatientAssignment.nurse_id == nurse_id,
        NursePatientAssignment.patient_id == patient_id,
        NursePatientAssignment.status == "active",
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not assigned to you or assignment is inactive.",
        )


# ----- Assigned patients (for select list / dashboard) -----


@router.get("/patients", response_model=List[NursePatientOption])
async def list_assigned_patients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_nurse),
) -> List[NursePatientOption]:
    """
    List patients assigned to the current nurse (active assignments only).
    Used for the nurse dashboard select list so she only sees her duty patients.
    """
    stmt = (
        select(Patient.id, Patient.name, Patient.age)
        .join(NursePatientAssignment, NursePatientAssignment.patient_id == Patient.id)
        .where(
            NursePatientAssignment.nurse_id == current_user.id,
            NursePatientAssignment.status == "active",
        )
        .order_by(Patient.name)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        NursePatientOption(id=row.id, name=row.name, age=int(row.age) if row.age is not None else 0)
        for row in rows
    ]


# ----- Vitals for an assigned patient -----


@router.get("/patients/{patient_id}/vitals", response_model=List[VitalRecordResponse])
async def list_patient_vitals(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_nurse),
) -> List[VitalRecordResponse]:
    """
    List vital records for a patient. Only allowed if the patient is assigned to the current nurse.
    Returns most recent first.
    """
    await _ensure_patient_assigned_to_nurse(current_user.id, patient_id, db)
    stmt = (
        select(Vital)
        .where(Vital.patient_id == patient_id)
        .order_by(Vital.recorded_at.desc())
    )
    result = await db.execute(stmt)
    vitals = result.scalars().all()
    return [
        VitalRecordResponse(
            id=v.id,
            patient_id=v.patient_id,
            recorded_by=v.recorded_by,
            recorded_at=v.recorded_at,
            heart_rate=v.heart_rate,
            blood_pressure_sys=v.blood_pressure_sys,
            blood_pressure_dia=v.blood_pressure_dia,
            spo2=v.spo2,
            temperature=v.temperature,
            respiratory_rate=v.respiratory_rate,
            condition_level=v.condition_level,
        )
        for v in vitals
    ]


@router.post("/patients/{patient_id}/vitals", response_model=VitalRecordResponse)
async def create_patient_vital(
    patient_id: int,
    body: VitalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_nurse),
) -> VitalRecordResponse:
    """
    Record a new vital entry for a patient. Only allowed if the patient is assigned to the current nurse.
    At least one vital field should be provided. recorded_by is set to the current user.
    """
    await _ensure_patient_assigned_to_nurse(current_user.id, patient_id, db)
    # Require at least one value so we don't create empty records
    if all(
        getattr(body, f) is None
        for f in (
            "heart_rate",
            "blood_pressure_sys",
            "blood_pressure_dia",
            "spo2",
            "temperature",
            "respiratory_rate",
            "condition_level",
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one vital value (e.g. heart_rate, blood_pressure_sys, temperature).",
        )
    vital = Vital(
        patient_id=patient_id,
        recorded_by=current_user.id,
        recorded_at=datetime.utcnow(),
        heart_rate=body.heart_rate,
        blood_pressure_sys=body.blood_pressure_sys,
        blood_pressure_dia=body.blood_pressure_dia,
        spo2=body.spo2,
        temperature=body.temperature,
        respiratory_rate=body.respiratory_rate,
        condition_level=body.condition_level,
    )
    db.add(vital)
    await db.flush()
    condition_level = (body.condition_level or "").strip() or None
    if condition_level and condition_level.lower() in ("emergency", "critical"):
        severity = AlertSeverity.critical if condition_level.lower() == "emergency" else AlertSeverity.high
        message = f"Vitals recorded: {condition_level} (HR/BP/SpO2 outside normal range)."
        alert = Alert(
            patient_id=patient_id,
            type="Vitals",
            message=message,
            severity=severity,
            is_resolved=False,
        )
        db.add(alert)
    await db.commit()
    await db.refresh(vital)
    await ws_manager.broadcast({
        "type": "vitals_updated",
        "patient_id": patient_id,
        "condition_level": condition_level,
    })
    await broadcast_admin_data_changed("nurse_vitals")
    return VitalRecordResponse(
        id=vital.id,
        patient_id=vital.patient_id,
        recorded_by=vital.recorded_by,
        recorded_at=vital.recorded_at,
        heart_rate=vital.heart_rate,
        blood_pressure_sys=vital.blood_pressure_sys,
        blood_pressure_dia=vital.blood_pressure_dia,
        spo2=vital.spo2,
        temperature=vital.temperature,
        respiratory_rate=vital.respiratory_rate,
        condition_level=vital.condition_level,
    )
