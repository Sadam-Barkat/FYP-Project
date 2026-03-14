from sqlalchemy import String, Integer, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin
from datetime import date


class DoctorAssignment(Base, TimestampMixin):
    __tablename__ = "doctor_assignments"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
    assigned_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, default="active")


class NurseAssignment(Base, TimestampMixin):
    """
    Existing nurse assignment model (nurse -> ward). Kept as-is for future use.
    """

    __tablename__ = "nurse_assignments"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nurse_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    ward_id: Mapped[int] = mapped_column(ForeignKey("ward_details.id"), nullable=False)
    assigned_date: Mapped[date] = mapped_column(Date, nullable=False)
    shift: Mapped[str] = mapped_column(String, nullable=False)


class NursePatientAssignment(Base, TimestampMixin):
    """
    Nurse -> patient relationship, symmetric to DoctorAssignment.
    Each active row means this nurse is currently assigned to that patient.
    """

    __tablename__ = "nurse_patient_assignments"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nurse_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
    assigned_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, default="active")
