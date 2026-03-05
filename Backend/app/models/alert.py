from sqlalchemy import String, Integer, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin
import enum

class AlertSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class Alert(Base, TimestampMixin):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String, nullable=False) # e.g., 'Vitals Deterioration', 'System'
    message: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), nullable=False)
    is_resolved: Mapped[bool] = mapped_column(default=False)
    
    # Relationships
    patient = relationship("Patient", back_populates="alerts")
