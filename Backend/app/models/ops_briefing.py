"""Stored AI-generated operational briefings for the Ops Copilot admin feature."""

from __future__ import annotations

from sqlalchemy import String, Text, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class OpsBriefing(Base, TimestampMixin):
    __tablename__ = "ops_briefings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    risk_category: Mapped[str] = mapped_column(String(128), nullable=False, default="general")
    what_changed: Mapped[str] = mapped_column(Text, nullable=False)
    why_it_matters: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_actions: Mapped[list] = mapped_column(JSON, nullable=False)
    evidence_links: Mapped[list] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    signals_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
