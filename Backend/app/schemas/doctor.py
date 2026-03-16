"""
Pydantic schemas for the Doctor API.

Used for: listing assigned patients, viewing vitals (updated by nurse; real-time via WebSocket),
and discharging patients (admin dashboard reflects via WebSocket).
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ----- Response schemas -----


class DoctorPatientOption(BaseModel):
    """Patient assigned to the doctor (for dashboard list)."""

    id: int
    name: str
    age: int


class VitalRecordResponse(BaseModel):
    """Single vital record for a patient (nurse-recorded; doctor views)."""

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


class DischargeResponse(BaseModel):
    """Response after doctor discharges a patient."""

    message: str
    patient_id: int
