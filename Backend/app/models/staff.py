from sqlalchemy import Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin

class Staff(Base, TimestampMixin):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String, nullable=False)
    shift_start: Mapped[str] = mapped_column(String, nullable=True)  # or Time
    shift_end: Mapped[str] = mapped_column(String, nullable=True)  # or Time
    # Filled when staff completes signup (invitation flow)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)  # location
