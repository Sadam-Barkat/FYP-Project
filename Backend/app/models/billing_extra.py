from sqlalchemy import String, Integer, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin
from datetime import datetime

class BillItem(Base, TimestampMixin):
    __tablename__ = "bill_items"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    billing_id: Mapped[int] = mapped_column(ForeignKey("billings.id"), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)

class Transaction(Base, TimestampMixin):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    billing_id: Mapped[int] = mapped_column(ForeignKey("billings.id"), nullable=False)
    payment_method: Mapped[str] = mapped_column(String, nullable=False)
    amount_paid: Mapped[float] = mapped_column(Float, nullable=False)
    transaction_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
