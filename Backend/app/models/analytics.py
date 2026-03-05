from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin
from datetime import datetime

class Forecast(Base, TimestampMixin):
    __tablename__ = "forecasts"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    metric_name: Mapped[str] = mapped_column(String, nullable=False)
    forecast_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)

class Categorization(Base, TimestampMixin):
    __tablename__ = "categorizations"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
    previous_condition: Mapped[str] = mapped_column(String, nullable=True)
    new_condition: Mapped[str] = mapped_column(String, nullable=False)
    categorized_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)

class EmergencyLog(Base, TimestampMixin):
    __tablename__ = "emergency_logs"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id"), nullable=True)
    action_taken: Mapped[str] = mapped_column(String, nullable=False)
    logged_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ICUDetail(Base, TimestampMixin):
    __tablename__ = "icu_details"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    admission_id: Mapped[int] = mapped_column(ForeignKey("admissions.id"), nullable=False)
    ventilator_used: Mapped[bool] = mapped_column(Boolean, default=False)
    days_in_icu: Mapped[int] = mapped_column(Integer, default=0)
