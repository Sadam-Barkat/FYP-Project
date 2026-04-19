from sqlalchemy import Float, String, ForeignKey, Enum, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin
import enum
from datetime import datetime

class BillingStatus(str, enum.Enum):
    paid = "paid"
    pending = "pending"

class Billing(Base, TimestampMixin):
    __tablename__ = "billings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    status: Mapped[BillingStatus] = mapped_column(Enum(BillingStatus), default=BillingStatus.pending)
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="billings")
