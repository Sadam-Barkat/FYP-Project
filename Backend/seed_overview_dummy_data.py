"""
Seed minimal, demo-safe data so Admin Overview date filter never shows
empty/zero values for:
- Doctors on duty
- Today's revenue

IMPORTANT:
- Does NOT seed laboratory results or lab requests (those should remain real).
- Idempotent: safe to run multiple times; it won't duplicate per-day billings.

Run from Backend/:
  python seed_overview_dummy_data.py
"""

import asyncio
import os
import sys
from datetime import date, datetime, time, timedelta
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import Date, and_, cast, func, select

from app.database import SessionLocal
from app.models.billing import Billing, BillingStatus
from app.models.patient import Patient
from app.models.staff import Staff


DEMO_PATIENT_NAME = "Demo Patient"
DEMO_DOCTOR_STAFF_NAME = "On Duty Doctor"
DEMO_DOCTOR_DEPARTMENT = "General"


def _date_range(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def _amount_for_day(d: date) -> float:
    """
    Deterministic "random-ish" amount, always > 0.
    Keeps charts/filters looking alive without external deps.
    """
    base = 2500
    jitter = ((d.toordinal() * 37) % 4500)  # 0..4499
    return float(base + jitter)


async def _ensure_on_duty_doctor_staff() -> None:
    """
    Admin overview calculates doctors_on_duty from Staff rows:
      Staff.role == "doctor" AND shift_start <= now <= shift_end (string compare "HH:MM").

    Ensure at least one doctor is always on duty by covering 00:00..23:59.
    """
    async with SessionLocal() as session:
        # If any staff doctor already covers full day, keep as-is.
        r = await session.execute(
            select(Staff).where(
                and_(
                    Staff.role == "doctor",
                    Staff.shift_start.is_not(None),
                    Staff.shift_end.is_not(None),
                    Staff.shift_start <= "00:01",
                    Staff.shift_end >= "23:58",
                )
            )
        )
        existing = r.scalar_one_or_none()
        if existing:
            return

        # Prefer updating an existing staff doctor row if present, otherwise create one.
        r2 = await session.execute(select(Staff).where(Staff.role == "doctor").limit(1))
        staff = r2.scalar_one_or_none()
        if staff is None:
            staff = Staff(
                name=DEMO_DOCTOR_STAFF_NAME,
                role="doctor",
                department=DEMO_DOCTOR_DEPARTMENT,
                shift_start="00:00",
                shift_end="23:59",
            )
            session.add(staff)
        else:
            staff.shift_start = "00:00"
            staff.shift_end = "23:59"
            if not (staff.department or "").strip():
                staff.department = DEMO_DOCTOR_DEPARTMENT
            if not (staff.name or "").strip():
                staff.name = DEMO_DOCTOR_STAFF_NAME

        await session.commit()


async def _ensure_demo_patient() -> int:
    async with SessionLocal() as session:
        r = await session.execute(select(Patient).where(Patient.name == DEMO_PATIENT_NAME).limit(1))
        p = r.scalar_one_or_none()
        if p:
            return int(p.id)

        p = Patient(
            name=DEMO_PATIENT_NAME,
            age=35,
            gender="Male",
            contact=None,
            address=None,
            blood_group="O+",
        )
        session.add(p)
        await session.commit()
        await session.refresh(p)
        return int(p.id)


async def _seed_paid_billings(start: date, end: date, patient_id: int) -> int:
    """
    Ensure at least one PAID billing exists for every day in [start..end].
    Admin overview uses sum(Billing.amount) for that selected date.
    """
    inserted = 0
    async with SessionLocal() as session:
        # Fetch days that already have at least one paid billing
        existing_days_result = await session.execute(
            select(cast(Billing.date, Date).label("day"))
            .where(
                and_(
                    Billing.status == BillingStatus.paid,
                    cast(Billing.date, Date) >= start,
                    cast(Billing.date, Date) <= end,
                )
            )
            .group_by("day")
        )
        existing_days = {row.day for row in existing_days_result.all()}

        for d in _date_range(start, end):
            if d in existing_days:
                continue
            # Place the billing at noon UTC (within that calendar day boundaries).
            bill_dt = datetime.combine(d, time(hour=12, minute=0))
            b = Billing(
                patient_id=patient_id,
                amount=_amount_for_day(d),
                status=BillingStatus.paid,
                date=bill_dt,
            )
            session.add(b)
            inserted += 1

        if inserted:
            await session.commit()
    return inserted


async def run(months_ahead: int = 6) -> None:
    today = date.today()
    end = today + timedelta(days=months_ahead * 31)  # rough, ensures June/July are included

    await _ensure_on_duty_doctor_staff()
    patient_id = await _ensure_demo_patient()
    inserted = await _seed_paid_billings(today, end, patient_id)

    print("Seeded overview demo data.")
    print(f"- Doctors on duty: ensured at least 1 staff doctor on duty (00:00-23:59).")
    print(f"- Revenue: ensured at least 1 paid billing per day from {today.isoformat()} to {end.isoformat()}.")
    print(f"- Inserted new paid billing rows: {inserted}")


if __name__ == "__main__":
    asyncio.run(run())

