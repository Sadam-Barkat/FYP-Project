from sqlalchemy import String, Integer, Float, Date
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin

class PharmacyStock(Base, TimestampMixin):
    __tablename__ = "pharmacy_stock"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    medicine_name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    expiry_date: Mapped[str] = mapped_column(String, nullable=True) # or Date
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10)
