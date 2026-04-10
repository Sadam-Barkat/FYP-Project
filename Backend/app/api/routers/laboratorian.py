"""
Laboratorian API: patient list, lab categories, and daily lab result entry.

Flow: laboratorian selects a patient, then adds daily tests for that patient.
All endpoints are under /api/laboratorian.
"""

from datetime import date, datetime, time, timezone
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import cast, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import broadcast_admin_data_changed, manager as ws_manager
from app.database import get_db
from app.models.laboratory import LaboratoryResult
from app.models.laboratory_extra import LabCategory
from app.models.patient import Patient
from app.schemas.laboratorian import (
    LabCategoryOption,
    LabEntryCreate,
    LabEntryResponse,
    PatientOption,
)

router = APIRouter(prefix="/api/laboratorian", tags=["laboratorian"])

# Stored in LaboratoryResult.test_name as "CategoryName | TestName" (no column for category)
LAB_ENTRY_DELIMITER = " | "


# ----- Patients (for step 1: select patient) -----


@router.get("/patients", response_model=List[PatientOption])
async def list_patients(
    db: AsyncSession = Depends(get_db),
) -> List[PatientOption]:
    """
    List all patients for the laboratorian dropdown.
    Laboratorian selects a patient first, then adds daily tests for that patient.
    """
    try:
        result = await db.execute(
            select(Patient.id, Patient.name, Patient.age).order_by(Patient.id)
        )
        rows = result.all()
        return [
            PatientOption(id=row.id, name=row.name, age=int(row.age) if row.age is not None else 0)
            for row in rows
        ]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load patients: {exc}",
        )


# ----- Lab categories (for step 2: add test) -----


@router.get("/categories", response_model=List[LabCategoryOption])
async def list_categories(
    db: AsyncSession = Depends(get_db),
) -> List[LabCategoryOption]:
    """List lab test categories for the test category dropdown."""
    try:
        result = await db.execute(
            select(LabCategory.id, LabCategory.name).order_by(LabCategory.name)
        )
        rows = result.all()
        return [LabCategoryOption(id=row.id, name=row.name) for row in rows]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load categories: {exc}",
        )


# ----- Lab results for a patient (daily tests list) -----


def _parse_test_display(test_name_stored: str) -> Tuple[str, str]:
    """Split stored test_name (Category | TestName) into category and test name."""
    if LAB_ENTRY_DELIMITER in test_name_stored:
        parts = test_name_stored.split(LAB_ENTRY_DELIMITER, 1)
        return (parts[0].strip(), parts[1].strip() if len(parts) > 1 else "")
    return ("", test_name_stored)


@router.get("/patients/{patient_id}/results", response_model=List[LabEntryResponse])
async def list_patient_results(
    patient_id: int,
    date_param: Optional[date] = Query(None, alias="date", description="Filter by collection date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
) -> List[LabEntryResponse]:
    """
    List lab results for a patient. Optionally filter by date (daily tests for that date).
    """
    try:
        # Check patient exists and get name
        patient_result = await db.execute(
            select(Patient.id, Patient.name).where(Patient.id == patient_id)
        )
        patient_row = patient_result.first()
        if not patient_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

        patient_name = patient_row.name

        stmt = (
            select(LaboratoryResult)
            .where(LaboratoryResult.patient_id == patient_id)
            .order_by(LaboratoryResult.collected_at.desc())
        )

        if date_param is not None:
            day_start = datetime.combine(date_param, time.min)
            day_end = datetime.combine(date_param, time.max)
            stmt = stmt.where(
                LaboratoryResult.collected_at >= day_start,
                LaboratoryResult.collected_at <= day_end,
            )

        result = await db.execute(stmt)
        rows = result.scalars().all()

        out: List[LabEntryResponse] = []
        for r in rows:
            category_part, test_part = _parse_test_display(r.test_name)
            out.append(
                LabEntryResponse(
                    id=r.id,
                    patient_id=r.patient_id,
                    patient_name=patient_name,
                    test_category=category_part,
                    test_name=test_part,
                    status=r.status or "pending",
                    result_summary=r.result_value or "",
                    collected_at=r.collected_at or datetime.utcnow(),
                )
            )
        return out
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load lab results: {exc}",
        )


# ----- Create a new lab result (add daily test) -----


@router.post("/results", response_model=LabEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_lab_result(
    body: LabEntryCreate,
    db: AsyncSession = Depends(get_db),
) -> LabEntryResponse:
    """
    Add a new daily lab test for a patient.
    Laboratorian must have selected the patient first; this records one test entry.
    """
    try:
        # Validate patient exists
        patient_result = await db.execute(
            select(Patient.id, Patient.name).where(Patient.id == body.patient_id)
        )
        patient_row = patient_result.first()
        if not patient_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

        # Validate category exists and get name
        cat_result = await db.execute(
            select(LabCategory.id, LabCategory.name).where(LabCategory.id == body.lab_category_id)
        )
        cat_row = cat_result.first()
        if not cat_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab category not found")

        category_name = cat_row.name
        # DB uses TIMESTAMP WITHOUT TIME ZONE; normalize to naive UTC to avoid offset-naive/aware mismatch
        if body.collected_at:
            collected = body.collected_at
            if collected.tzinfo is not None:
                collected = collected.astimezone(timezone.utc).replace(tzinfo=None)
        else:
            collected = datetime.utcnow()
        status_val = body.status if body.status in ("pending", "completed") else "pending"

        # Store category + test name in single column: "CategoryName | TestName"
        test_name_stored = f"{category_name}{LAB_ENTRY_DELIMITER}{body.test_name.strip()}"

        entry = LaboratoryResult(
            patient_id=body.patient_id,
            test_name=test_name_stored,
            result_value=(body.result_summary or "").strip() or "Pending interpretation",
            unit=None,
            status=status_val,
            collected_at=collected,
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)

        await ws_manager.broadcast({"type": "laboratory_updated"})
        await broadcast_admin_data_changed("laboratory_entry")

        return LabEntryResponse(
            id=entry.id,
            patient_id=entry.patient_id,
            patient_name=patient_row.name,
            test_category=category_name,
            test_name=body.test_name.strip(),
            status=entry.status,
            result_summary=entry.result_value or "",
            collected_at=entry.collected_at,
        )
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create lab result: {exc}",
        )
