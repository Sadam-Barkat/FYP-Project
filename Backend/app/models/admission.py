from sqlalchemy import Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin
from datetime import datetime

class Admission(Base, TimestampMixin):
    __tablename__ = "admissions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
    bed_id: Mapped[int] = mapped_column(ForeignKey("beds.id"), nullable=False)
    
    admission_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    discharge_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    reason_for_admission: Mapped[str] = mapped_column(nullable=True)
    
    # Relationships
    patient = relationship("Patient", back_populates="admissions")
    bed = relationship("Bed", back_populates="admissions")
