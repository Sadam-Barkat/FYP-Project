from pydantic import BaseModel, EmailStr
from typing import Optional


class StaffInviteRequest(BaseModel):
    email: EmailStr
    staff_type: str  # e.g., Doctor, Nurse, Laboratorian, Receptionist


class StaffSignupRequest(BaseModel):
    token: str
    first_name: str
    last_name: str
    password: str
    age: int
    gender: str
    phone: Optional[str] = None
    address: Optional[str] = None
    department: str


class StaffUpdateRequest(BaseModel):
    """Update staff profile. Role cannot be changed."""
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    age: Optional[int] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    department: Optional[str] = None

