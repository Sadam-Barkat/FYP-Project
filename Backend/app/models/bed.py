from sqlalchemy import String, Integer, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List
from .base import Base, TimestampMixin
import enum

class BedStatus(str, enum.Enum):
    available = "available"
    occupied = "occupied"
    maintenance = "maintenance"

class Bed(Base, TimestampMixin):
    __tablename__ = "beds"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    number: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    ward: Mapped[str] = mapped_column(String, nullable=False) # e.g., 'ICU', 'General', 'Emergency'
    status: Mapped[BedStatus] = mapped_column(Enum(BedStatus), default=BedStatus.available, nullable=False)
    
    # Relationships
    admissions = relationship("Admission", back_populates="bed")
