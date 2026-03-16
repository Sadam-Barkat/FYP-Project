"""
Pydantic schemas for the Receptionist API.

Used for: listing doctors/nurses for assignment dropdowns and creating new patients.
"""

from typing import Optional

from pydantic import BaseModel, Field


class DoctorOption(BaseModel):
    """Doctor item for assignment dropdown."""

    id: int
    name: str


class NurseOption(BaseModel):
    """Nurse item for assignment dropdown."""

    id: int
    name: str


class PatientCreate(BaseModel):
    """Payload to register a new patient and assign doctor and nurse."""

    name: str = Field(..., min_length=1, description="Full name of the patient")
    age: int = Field(..., ge=1, le=120, description="Age in years")
    gender: str = Field(..., min_length=1, description="e.g. Male, Female, Other")
    contact: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    blood_group: Optional[str] = Field(default=None)
    doctor_id: int = Field(..., description="User ID of the assigned doctor")
    nurse_id: int = Field(..., description="User ID of the assigned nurse")
    admit_now: bool = Field(
        default=True,
        description=(
            "If true, automatically create an admission and assign an available bed. "
            "Drives the Occupied Beds / Available Beds cards."
        ),
    )


class PatientCreatedResponse(BaseModel):
    """Response after successfully creating a patient."""

    id: int
    name: str
    message: str = "Patient registered successfully."
