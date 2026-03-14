"""Tracks pending staff invitations so the same email cannot be invited for another role."""
from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class StaffInvitation(Base):
    """One row per invited email (before signup). Prevents duplicate invites for same email."""
    __tablename__ = "staff_invitations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    email_lower: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    staff_type: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)