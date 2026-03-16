"""
Doctor API: list assigned patients, view vitals (nurse-updated; real-time via WebSocket),
and discharge patients (admin dashboard updates via WebSocket).

All endpoints require authentication and doctor role. Under /api/doctor.
When nurse updates vitals, frontend subscribes to vitals_updated. When doctor discharges,
backend broadcasts patient_discharged so admin (and nurse) dashboards can refetch.
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import manager as ws_manager
from app.database import get_db
from app.models.admission import Admission
from app.models.assignments import DoctorAssignment, NursePatientAssignment
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.vital import Vital
from app.api.routers.auth import get_current_user
from app.schemas.doctor import (
    DischargeResponse,
    DoctorPatientOption,
    VitalRecordResponse,
)

router = APIRouter(prefix="/api/doctor", tags=["doctor"])


def require_doctor(current_user: User = Depends(get_current_user)) -> User:
    """Ensure the current user is a doctor; otherwise 403."""
    if current_user.role != UserRole.doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor role required.",
        )
    return current_user


async def _ensure_patient_assigned_to_doctor(
    doctor_id: int,
    patient_id: int,
    db: AsyncSession,
) -> None:
    """Raise 404 if the patient is not assigned to this doctor (active assignment)."""
    stmt = select(DoctorAssignment).where(
        DoctorAssignment.doctor_id == doctor_id,
        DoctorAssignment.patient_id == patient_id,
        DoctorAssignment.status == "active",
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not assigned to you or assignment is inactive.",
        )


# ----- Assigned patients -----


@router.get("/patients", response_model=List[DoctorPatientOption])
async def list_assigned_patients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
) -> List[DoctorPatientOption]:
    """
    List patients assigned to the current doctor (active assignments only).
    Nurse-recorded vitals for these patients can be viewed via GET .../vitals;
    when nurse updates vitals, frontend should subscribe to vitals_updated for real-time refresh.
    """
    stmt = (
        select(Patient.id, Patient.name, Patient.age)
        .join(DoctorAssignment, DoctorAssignment.patient_id == Patient.id)
        .where(
            DoctorAssignment.doctor_id == current_user.id,
            DoctorAssignment.status == "active",
        )
        .order_by(Patient.name)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        DoctorPatientOption(
            id=row.id,
            name=row.name,
            age=int(row.age) if row.age is not None else 0,
        )
        for row in rows
    ]


# ----- Vitals for an assigned patient (nurse-updated; real-time via vitals_updated) -----


@router.get("/patients/{patient_id}/vitals", response_model=List[VitalRecordResponse])
async def list_patient_vitals(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
) -> List[VitalRecordResponse]:
    """
    List vital records for a patient. Only allowed if the patient is assigned to the current doctor.
    Vitals are recorded by nurses; when nurse adds/updates vitals, backend broadcasts vitals_updated
    so doctor dashboard can refetch for real-time display.
    """
    await _ensure_patient_assigned_to_doctor(current_user.id, patient_id, db)
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


# ----- Discharge patient (broadcasts patient_discharged for admin / nurse real-time) -----


@router.post("/patients/{patient_id}/discharge", response_model=DischargeResponse)
async def discharge_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
) -> DischargeResponse:
    """
    Discharge a patient: set active admission discharge_date and mark doctor/nurse
    assignments as discharged. Patient is removed from doctor and nurse assigned lists.
    Broadcasts patient_discharged so admin dashboard (overview, patients & beds) and
    nurse dashboard can refetch in real time.
    """
    await _ensure_patient_assigned_to_doctor(current_user.id, patient_id, db)

    now = datetime.utcnow()

    # Set discharge_date on any active admission for this patient
    await db.execute(
        update(Admission)
        .where(Admission.patient_id == patient_id, Admission.discharge_date.is_(None))
        .values(discharge_date=now)
    )

    # Mark doctor and nurse assignments for this patient as discharged (so they drop off lists)
    await db.execute(
        update(DoctorAssignment)
        .where(DoctorAssignment.patient_id == patient_id)
        .values(status="discharged")
    )
    await db.execute(
        update(NursePatientAssignment)
        .where(NursePatientAssignment.patient_id == patient_id)
        .values(status="discharged")
    )

    await db.commit()

    await ws_manager.broadcast({
        "type": "patient_discharged",
        "patient_id": patient_id,
    })

    return DischargeResponse(
        message="Patient discharged successfully. Admin and nurse dashboards will update in real time.",
        patient_id=patient_id,
    )
