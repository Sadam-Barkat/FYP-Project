"""
Receptionist API: list doctors, list nurses, and register new patients with doctor/nurse assignment.

All endpoints are under /api/receptionist.
"""

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import manager as ws_manager
from app.database import get_db
from app.models.assignments import DoctorAssignment, NursePatientAssignment
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.receptionist import (
    DoctorOption,
    NurseOption,
    PatientCreate,
    PatientCreatedResponse,
)

router = APIRouter(prefix="/api/receptionist", tags=["receptionist"])


@router.get("/doctors", response_model=List[DoctorOption])
async def list_doctors(
    db: AsyncSession = Depends(get_db),
) -> List[DoctorOption]:
    """
    List all doctors for the receptionist's assignment dropdown.
    Returns id and display name (first_name + last_name).
    """
    try:
        result = await db.execute(
            select(User.id, User.first_name, User.last_name)
            .where(User.role == UserRole.doctor, User.is_active == True)
            .order_by(User.id)
        )
        rows = result.all()
        return [
            DoctorOption(
                id=row.id,
                name=f"{row.first_name or ''} {row.last_name or ''}".strip() or f"Doctor #{row.id}",
            )
            for row in rows
        ]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load doctors: {exc}",
        )


@router.get("/nurses", response_model=List[NurseOption])
async def list_nurses(
    db: AsyncSession = Depends(get_db),
) -> List[NurseOption]:
    """
    List all nurses for the receptionist's assignment dropdown.
    Returns id and display name (first_name + last_name).
    """
    try:
        result = await db.execute(
            select(User.id, User.first_name, User.last_name)
            .where(User.role == UserRole.nurse, User.is_active == True)
            .order_by(User.id)
        )
        rows = result.all()
        return [
            NurseOption(
                id=row.id,
                name=f"{row.first_name or ''} {row.last_name or ''}".strip() or f"Nurse #{row.id}",
            )
            for row in rows
        ]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load nurses: {exc}",
        )


@router.post("/patients", response_model=PatientCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    body: PatientCreate,
    db: AsyncSession = Depends(get_db),
) -> PatientCreatedResponse:
    """
    Register a new patient and assign one doctor and one nurse.
    Creates Patient, DoctorAssignment, and NursePatientAssignment with status 'active'.
    """
    try:
        today = date.today()

        # Validate doctor exists and is a doctor
        doctor_result = await db.execute(
            select(User.id).where(User.id == body.doctor_id, User.role == UserRole.doctor)
        )
        if not doctor_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or inactive doctor selected.",
            )

        # Validate nurse exists and is a nurse
        nurse_result = await db.execute(
            select(User.id).where(User.id == body.nurse_id, User.role == UserRole.nurse)
        )
        if not nurse_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or inactive nurse selected.",
            )

        patient = Patient(
            name=body.name.strip(),
            age=body.age,
            gender=body.gender.strip(),
            contact=body.contact.strip() if body.contact else None,
            address=body.address.strip() if body.address else None,
            blood_group=body.blood_group.strip() if body.blood_group else None,
        )
        db.add(patient)
        await db.flush()

        doc_assignment = DoctorAssignment(
            doctor_id=body.doctor_id,
            patient_id=patient.id,
            assigned_date=today,
            status="active",
        )
        db.add(doc_assignment)

        nurse_assignment = NursePatientAssignment(
            nurse_id=body.nurse_id,
            patient_id=patient.id,
            assigned_date=today,
            status="active",
        )
        db.add(nurse_assignment)

        await db.commit()
        await db.refresh(patient)

        await ws_manager.broadcast({"type": "patients_updated"})

        return PatientCreatedResponse(
            id=patient.id,
            name=patient.name,
            message="Patient registered successfully.",
        )
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register patient: {exc}",
        )
