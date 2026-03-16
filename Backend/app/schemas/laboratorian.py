"""
Pydantic schemas for the Laboratorian (laboratory entry) API.

Used for: listing patients for selection, lab categories, and creating/listing daily lab results.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ----- Response schemas (API responses) -----


class PatientOption(BaseModel):
    """Patient item for laboratorian dropdown (select patient first)."""

    id: int
    name: str
    age: int


class LabCategoryOption(BaseModel):
    """Lab category for test category dropdown."""

    id: int
    name: str


class LabEntryResponse(BaseModel):
    """Single lab result entry for a patient (daily test)."""

    id: int
    patient_id: int
    patient_name: str
    test_category: str
    test_name: str
    status: str
    result_summary: str
    collected_at: datetime

    class Config:
        from_attributes = True


# ----- Request schemas (API request bodies) -----


class LabEntryCreate(BaseModel):
    """Payload to add a new daily lab test for a patient."""

    patient_id: int = Field(..., description="ID of the patient")
    lab_category_id: int = Field(..., description="ID of the lab category (e.g. Blood Test)")
    test_name: str = Field(..., min_length=1, description="Test name (e.g. CBC, LFT)")
    status: str = Field(default="pending", description="pending | completed")
    result_summary: str = Field(default="", description="Short result summary (e.g. Normal, Critical)")
    collected_at: Optional[datetime] = Field(default=None, description="When the sample was collected; defaults to now")
