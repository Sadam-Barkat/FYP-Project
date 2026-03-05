from sqlalchemy import String, Integer, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
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
    __tablename__ = "nurse_assignments"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nurse_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    ward_id: Mapped[int] = mapped_column(ForeignKey("ward_details.id"), nullable=False)
    assigned_date: Mapped[date] = mapped_column(Date, nullable=False)
    shift: Mapped[str] = mapped_column(String, nullable=False)
