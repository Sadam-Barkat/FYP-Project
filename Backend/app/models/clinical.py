from sqlalchemy import String, Integer, ForeignKey, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin
from datetime import datetime, date

class Appointment(Base, TimestampMixin):
    __tablename__ = "appointments"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    appointment_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String, default="scheduled")
    reason: Mapped[str] = mapped_column(String, nullable=True)

class Visit(Base, TimestampMixin):
    __tablename__ = "visits"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    visit_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    notes: Mapped[str] = mapped_column(String, nullable=True)

class Prescription(Base, TimestampMixin):
    __tablename__ = "prescriptions"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("pharmacy_stock.id"), nullable=False)
    dosage: Mapped[str] = mapped_column(String, nullable=False)
    frequency: Mapped[str] = mapped_column(String, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=True)

class TreatmentPlan(Base, TimestampMixin):
    __tablename__ = "treatment_plans"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    plan_details: Mapped[str] = mapped_column(String, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=True)

class DischargeSummary(Base, TimestampMixin):
    __tablename__ = "discharge_summaries"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    admission_id: Mapped[int] = mapped_column(ForeignKey("admissions.id"), nullable=False)
    summary: Mapped[str] = mapped_column(String, nullable=False)
    discharge_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    follow_up_date: Mapped[date] = mapped_column(Date, nullable=True)
