"""
Optional one-time demo data for Analytics & Forecasts (richer 14-day history).

Creates discharged historical admissions (by day), paid billing rows, vitals with mixed
acuity, and a few alerts—so charts and intelligence insights populate for supervisor demos.

Run from Backend folder:
  python seed_analytics_demo.py

Safe to re-run: skips if patients named 'Analytics Demo Seed %' already exist.
"""
from __future__ import annotations

import asyncio
import os
import random
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal
from app.models.admission import Admission
from app.models.alert import Alert, AlertSeverity
from app.models.bed import Bed, BedStatus
from app.models.billing import Billing, BillingStatus
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.vital import Vital


async def already_seeded(session: AsyncSession) -> bool:
    r = await session.execute(
        select(func.count()).select_from(Patient).where(Patient.name.like("Analytics Demo Seed %"))
    )
    return (r.scalar_one() or 0) > 0


async def run() -> None:
    async with SessionLocal() as session:
        if await already_seeded(session):
            print("Analytics demo data already present (Analytics Demo Seed patients). Skipping.")
            return

        beds_result = await session.execute(select(Bed).order_by(Bed.id))
        beds = list(beds_result.scalars().all())
        if not beds:
            print("No beds in database; cannot seed admissions.")
            return

        nurse_result = await session.execute(
            select(User).where(User.role == UserRole.nurse).limit(1)
        )
        nurse = nurse_result.scalar_one_or_none()
        if not nurse:
            print("No nurse user found; vitals will be skipped.")
        nurse_id = nurse.id if nurse else None

        today = date.today()
        patients: list[Patient] = []
        seq = 0

        for day_offset in range(14, 0, -1):
            d = today - timedelta(days=day_offset)
            n_adm = random.randint(2, min(5, len(beds)))
            picked = random.sample(beds, n_adm)
            for bed in picked:
                seq += 1
                p = Patient(
                    name=f"Analytics Demo Seed {seq}",
                    age=random.randint(22, 78),
                    gender=random.choice(["Male", "Female"]),
                    contact=f"+92300{random.randint(1000000, 9999999)}",
                    address="Demo address",
                    blood_group=random.choice(["A+", "B+", "O+", "AB+"]),
                )
                session.add(p)
                await session.flush()
                patients.append(p)

                admit_dt = datetime.combine(d, datetime.min.time()) + timedelta(hours=random.randint(8, 18))
                los = random.randint(1, 4)
                discharge_dt = admit_dt + timedelta(days=los)
                if discharge_dt.date() >= today:
                    discharge_dt = datetime.combine(today - timedelta(days=1), datetime.max.time())

                adm = Admission(
                    patient_id=p.id,
                    bed_id=bed.id,
                    admission_date=admit_dt,
                    discharge_date=discharge_dt,
                    reason_for_admission="Demo historical admission for analytics charts",
                )
                session.add(adm)

                amt = random.uniform(8_000, 45_000)
                bill = Billing(
                    patient_id=p.id,
                    amount=round(amt, 2),
                    description="Demo admission package (seed)",
                    status=BillingStatus.paid,
                    date=discharge_dt - timedelta(hours=random.randint(1, 8)),
                )
                session.add(bill)

                if nurse_id:
                    cond = random.choices(
                        ["Normal", "Critical", "Emergency"],
                        weights=[0.72, 0.2, 0.08],
                        k=1,
                    )[0]
                    session.add(
                        Vital(
                            patient_id=p.id,
                            recorded_by=nurse_id,
                            recorded_at=admit_dt + timedelta(hours=2),
                            heart_rate=random.randint(62, 118),
                            blood_pressure_sys=random.randint(108, 148),
                            blood_pressure_dia=random.randint(68, 92),
                            spo2=random.randint(92, 99),
                            temperature=round(random.uniform(36.2, 38.4), 1),
                            respiratory_rate=random.randint(14, 24),
                            condition_level=cond,
                        )
                    )

                if random.random() < 0.22:
                    sev = random.choice(
                        [AlertSeverity.critical, AlertSeverity.high, AlertSeverity.medium]
                    )
                    session.add(
                        Alert(
                            patient_id=p.id,
                            type="Demo analytics",
                            severity=sev,
                            message="Demo alert for analytics trend",
                            is_resolved=random.random() < 0.65,
                            created_at=admit_dt + timedelta(hours=random.randint(1, 12)),
                        )
                    )

        await session.commit()
        print(f"Seeded {seq} demo patients with admissions, billing, vitals, and sample alerts.")


if __name__ == "__main__":
    asyncio.run(run())
