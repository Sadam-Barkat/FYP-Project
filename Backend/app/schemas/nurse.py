"""
Pydantic schemas for the Nurse API.

Used for: listing assigned patients (select list), listing/creating vitals for assigned patients.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ----- Response schemas -----


class NursePatientOption(BaseModel):
    """Patient assigned to the nurse (for select list / duty list)."""

    id: int
    name: str
    age: int


class VitalRecordResponse(BaseModel):
    """Single vital record for a patient."""

    id: int
    patient_id: int
    recorded_by: int
    recorded_at: datetime
    heart_rate: Optional[int] = None
    blood_pressure_sys: Optional[int] = None
    blood_pressure_dia: Optional[int] = None
    spo2: Optional[int] = None
    temperature: Optional[float] = None
    respiratory_rate: Optional[int] = None
    condition_level: Optional[str] = None

    class Config:
        from_attributes = True


# ----- Request schemas -----


class VitalCreate(BaseModel):
    """Payload to record/update vitals for an assigned patient."""

    heart_rate: Optional[int] = Field(None, ge=0, le=300, description="bpm")
    blood_pressure_sys: Optional[int] = Field(None, ge=0, le=300, description="mmHg systolic")
    blood_pressure_dia: Optional[int] = Field(None, ge=0, le=200, description="mmHg diastolic")
    spo2: Optional[int] = Field(None, ge=0, le=100, description="SpO2 %")
    temperature: Optional[float] = Field(None, ge=30.0, le=45.0, description="Celsius")
    respiratory_rate: Optional[int] = Field(None, ge=0, le=60, description="breaths/min")
    condition_level: Optional[str] = Field(None, max_length=64, description="e.g. Normal, Critical, Emergency")
