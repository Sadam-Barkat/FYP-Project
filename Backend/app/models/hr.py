from sqlalchemy import String, Integer, ForeignKey, Date, Time, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin
import enum
from datetime import date, time

class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    leave = "leave"

class Attendance(Base, TimestampMixin):
    __tablename__ = "attendance"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus), nullable=False)
    check_in: Mapped[time] = mapped_column(Time, nullable=True)
    check_out: Mapped[time] = mapped_column(Time, nullable=True)

class ShiftType(str, enum.Enum):
    morning = "morning"
    evening = "evening"
    night = "night"

class Shift(Base, TimestampMixin):
    __tablename__ = "shifts"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_type: Mapped[ShiftType] = mapped_column(Enum(ShiftType), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=True)
    end_time: Mapped[time] = mapped_column(Time, nullable=True)
