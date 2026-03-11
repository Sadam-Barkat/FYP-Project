"""
One-time script: seed Staff and Attendance with varied data (present, absent, leave)
so HR & Staff overview shows data when selecting previous dates.
Does NOT modify users table (demo doctor/nurse remain same).
Run from backend dir: python seed_hr_attendance.py
Then delete this file.
"""
import asyncio
import os
import random
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal
from app.models.staff import Staff
from app.models.hr import Attendance, AttendanceStatus

STAFF_ROSTER = [
    ("Dr. Ayesha", "Cardiologist", "Cardiology"),
    ("Dr. Bilal", "General Surgeon", "Surgery"),
    ("Nurse Fatima", "Head Nurse", "ICU"),
    ("Nurse Sana", "Staff Nurse", "Emergency"),
    ("Mr. Ali", "Lab Technician", "Laboratory"),
    ("Dr. Farhan", "Physician", "General"),
    ("Nurse Zainab", "Staff Nurse", "General"),
    ("Dr. Omar", "Pediatrician", "Pediatrics"),
    ("Nurse Hira", "Staff Nurse", "Cardiology"),
    ("Mr. Hassan", "Lab Technician", "Laboratory"),
    ("Dr. Sara", "Emergency Doctor", "Emergency"),
    ("Nurse Ayesha", "Staff Nurse", "Emergency"),
    ("Dr. Kamran", "Neurologist", "Neurology"),
    ("Nurse Mariam", "Staff Nurse", "ICU"),
    ("Mr. Usman", "Radiology Tech", "Laboratory"),
]

STATUS_WEIGHTS = [
    (AttendanceStatus.present, 70),
    (AttendanceStatus.absent, 15),
    (AttendanceStatus.leave, 15),
]


async def ensure_staff(session: AsyncSession) -> list:
    existing = await session.execute(select(Staff.id))
    ids = list(existing.scalars().all())
    if ids:
        return ids
    for name, role, dept in STAFF_ROSTER:
        s = Staff(name=name, role=role, department=dept, shift_start="08:00", shift_end="16:00")
        session.add(s)
    await session.flush()
    existing = await session.execute(select(Staff.id))
    return list(existing.scalars().all())


async def get_existing_pairs(session: AsyncSession, start: date, end: date) -> set:
    result = await session.execute(
        select(Attendance.staff_id, Attendance.date).where(
            Attendance.date >= start, Attendance.date <= end
        )
    )
    return set((row[0], row[1]) for row in result.all())


def pick_status() -> AttendanceStatus:
    r = random.randint(1, 100)
    acc = 0
    for st, w in STATUS_WEIGHTS:
        acc += w
        if r <= acc:
            return st
    return AttendanceStatus.present


async def run():
    async with SessionLocal() as session:
        try:
            staff_ids = await ensure_staff(session)
            print(f"Using {len(staff_ids)} staff.")
            end_date = date.today()
            start_date = end_date - timedelta(days=60)
            existing_pairs = await get_existing_pairs(session, start_date, end_date)
            to_add = []
            d = start_date
            while d <= end_date:
                for sid in staff_ids:
                    if (sid, d) in existing_pairs:
                        continue
                    to_add.append(
                        Attendance(staff_id=sid, date=d, status=pick_status(), check_in=None, check_out=None)
                    )
                d += timedelta(days=1)
            for a in to_add:
                session.add(a)
            await session.commit()
            print(f"Inserted {len(to_add)} attendance records from {start_date} to {end_date}.")
        except Exception as e:
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(run())
