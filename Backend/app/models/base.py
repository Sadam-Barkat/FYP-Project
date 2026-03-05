from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, DateTime, func
from datetime import datetime

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    """Mixin to add created_at and updated_at columns to all models."""
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
