from sqlalchemy import Integer, Float, ForeignKey, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin
from datetime import datetime

class Vital(Base, TimestampMixin):
    __tablename__ = "vitals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    recorded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    heart_rate: Mapped[int] = mapped_column(Integer, nullable=True) # bpm
    blood_pressure_sys: Mapped[int] = mapped_column(Integer, nullable=True) # mmHg
    blood_pressure_dia: Mapped[int] = mapped_column(Integer, nullable=True) # mmHg
    spo2: Mapped[int] = mapped_column(Integer, nullable=True) # %
    temperature: Mapped[float] = mapped_column(Float, nullable=True) # Celsius
    respiratory_rate: Mapped[int] = mapped_column(Integer, nullable=True) # breaths/min
    condition_level: Mapped[str] = mapped_column(String, nullable=True) # e.g. Normal, Critical, Emergency
    
    # Relationships
    patient = relationship("Patient", back_populates="vitals")
    recorded_by_user = relationship("User", back_populates="vitals")
