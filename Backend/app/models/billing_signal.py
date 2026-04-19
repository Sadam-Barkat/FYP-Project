"""Clinical service events queued for finance (no money on clinical side)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class BillingServiceSignal(Base, TimestampMixin):
    """
    Finance reviews unresolved signals and posts Billing rows + mark paid.
    Created when lab completes, doctor discharges, or doctor logs consultation.
    """

    __tablename__ = "billing_service_signals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    signal_type: Mapped[str] = mapped_column(String(48), nullable=False)
    reference_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    patient = relationship("Patient", backref="billing_service_signals")
