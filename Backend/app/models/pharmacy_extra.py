from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin

class MedicineCategory(Base, TimestampMixin):
    __tablename__ = "medicine_categories"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=True)

class InventoryItem(Base, TimestampMixin):
    __tablename__ = "inventory_items"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    item_name: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    threshold: Mapped[int] = mapped_column(Integer, default=10)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
