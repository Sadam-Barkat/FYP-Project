from sqlalchemy import String, Date, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List
from .base import Base, TimestampMixin
from datetime import date

class Patient(Base, TimestampMixin):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    gender: Mapped[str] = mapped_column(String, nullable=False) # e.g., 'M', 'F', 'Other'
    contact: Mapped[str] = mapped_column(String, nullable=True)
    address: Mapped[str] = mapped_column(String, nullable=True)
    blood_group: Mapped[str] = mapped_column(String, nullable=True)

    # Relationships
    admissions = relationship("Admission", back_populates="patient")
    vitals = relationship("Vital", back_populates="patient")
    alerts = relationship("Alert", back_populates="patient")
    lab_results = relationship("LaboratoryResult", back_populates="patient")
    billings = relationship("Billing", back_populates="patient")
