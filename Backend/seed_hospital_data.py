"""
Complete Hospital Dummy Data Seeding Script
==========================================
- Covers all major tables
- 6 months of realistic data ending at TODAY
- Run this script to reset and repopulate your database
- Usage: python seed_hospital_data.py
"""

import asyncio
import random
from datetime import datetime, date, timedelta, time
from typing import List
import os

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# ─── CONFIG ───────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://neondb_owner:YOUR_PASSWORD@ep-late-dawn-airfr6iq-pooler.c-4.us-east-1.aws.neon.tech/neondb?ssl=require"
)

TODAY = date.today()
NOW = datetime.now()
START_DATE = TODAY - timedelta(days=180)  # 6 months ago

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# ─── HELPERS ──────────────────────────────────────────────────────────────────
def rand_date(start: date, end: date) -> date:
    return start + timedelta(days=random.randint(0, (end - start).days))

def rand_dt(start: date, end: date) -> datetime:
    d = rand_date(start, end)
    return datetime.combine(d, time(random.randint(0, 23), random.randint(0, 59)))

def rand_time(hour_start=7, hour_end=22) -> time:
    return time(random.randint(hour_start, hour_end), random.randint(0, 59))

def rand_phone():
    return f"03{random.randint(10,49)}{random.randint(1000000,9999999)}"

def rand_blood_group():
    return random.choice(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"])

def rand_gender():
    return random.choice(["Male", "Female"])

def seasonal_admission_count(d: date) -> int:
    """Simulate seasonal variation - more patients in winter months"""
    month = d.month
    if month in [12, 1, 2]:   # winter - high
        return random.randint(4, 8)
    elif month in [6, 7, 8]:  # summer - medium high
        return random.randint(3, 6)
    else:
        return random.randint(2, 5)

# ─── PAKISTANI NAMES ──────────────────────────────────────────────────────────
MALE_NAMES = [
    "Ahmed Khan", "Muhammad Ali", "Usman Malik", "Hassan Raza", "Bilal Sheikh",
    "Tariq Mehmood", "Imran Butt", "Zubair Ahmed", "Fahad Siddiqui", "Naveed Iqbal",
    "Salman Chaudhry", "Adnan Mirza", "Kamran Yousaf", "Omer Farooq", "Asad Rehman",
    "Waqar Hussain", "Faisal Nawaz", "Junaid Anwar", "Rizwan Saeed", "Shahid Qureshi",
    "Hamza Aziz", "Yasir Shah", "Talha Javed", "Amir Latif", "Danyal Baig",
    "Zain Ul Abideen", "Saad Mumtaz", "Furqan Ilyas", "Haris Awan", "Mudassar Gill"
]

FEMALE_NAMES = [
    "Fatima Zahra", "Ayesha Siddiqui", "Maryam Nawaz", "Zainab Ali", "Sara Malik",
    "Hina Baig", "Nadia Hussain", "Sana Khan", "Rabia Chaudhry", "Amna Sheikh",
    "Uzma Qureshi", "Sobia Mirza", "Farah Iqbal", "Mehwish Raza", "Asma Butt",
    "Lubna Ahmed", "Noor Fatima", "Iqra Tariq", "Sumera Yousaf", "Hafsa Anwar",
    "Madiha Saeed", "Alishba Samar", "Kiran Latif", "Bushra Mumtaz", "Tahira Javed"
]

ADDRESSES = [
    "House 12, Street 5, Gulberg, Lahore",
    "Block C, Model Town, Faisalabad",
    "Flat 3, Al-Hamra Arcade, Multan",
    "Village Chak 45, District Sargodha",
    "Plot 7, DHA Phase 2, Islamabad",
    "Street 9, Satellite Town, Rawalpindi",
    "House 88, Johar Town, Lahore",
    "Near DHQ Hospital, Gujranwala",
    "Mohalla Hussain Abad, Sialkot",
    "House 23, New City, Wah Cantt",
]

REASONS = [
    "Fever and body ache", "Chest pain", "Difficulty breathing",
    "Abdominal pain", "Road traffic accident", "Fracture",
    "High blood pressure", "Diabetes complication", "Kidney stone",
    "Appendicitis", "Dengue fever", "Typhoid", "Malaria",
    "Heart attack", "Stroke", "Pneumonia", "Asthma attack",
    "Urinary tract infection", "Severe dehydration", "Jaundice"
]

MEDICINES = [
    ("Paracetamol 500mg", 180, 5.0, 20),
    ("Amoxicillin 500mg", 120, 12.0, 15),
    ("Metformin 500mg", 200, 8.0, 25),
    ("Omeprazole 20mg", 150, 15.0, 20),
    ("Amlodipine 5mg", 100, 18.0, 15),
    ("Ciprofloxacin 500mg", 80, 22.0, 10),
    ("Dexamethasone 4mg", 60, 30.0, 10),
    ("Ondansetron 4mg", 90, 25.0, 12),
    ("Ceftriaxone 1g", 50, 120.0, 8),
    ("Diazepam 5mg", 40, 35.0, 8),
    ("Atorvastatin 40mg", 110, 20.0, 15),
    ("Losartan 50mg", 95, 22.0, 12),
    ("Salbutamol Inhaler", 45, 180.0, 8),
    ("Insulin Regular", 30, 250.0, 5),
    ("Aspirin 75mg", 160, 6.0, 20),
    ("Ibuprofen 400mg", 130, 8.0, 18),
    ("Azithromycin 500mg", 70, 45.0, 10),
    ("Ranitidine 150mg", 85, 10.0, 12),
    ("Metronidazole 400mg", 75, 9.0, 10),
    ("Vitamin C 500mg", 200, 4.0, 25),
]

LAB_TESTS = [
    ("Complete Blood Count (CBC)", "Haematology", "cells/uL", "Normal"),
    ("Blood Sugar Fasting", "Biochemistry", "mg/dL", "Normal"),
    ("Blood Sugar Random", "Biochemistry", "mg/dL", "Normal"),
    ("HbA1c", "Biochemistry", "%", "Normal"),
    ("Urine Complete Examination", "Microbiology", "N/A", "Normal"),
    ("Liver Function Test", "Biochemistry", "IU/L", "Normal"),
    ("Kidney Function Test", "Biochemistry", "mg/dL", "Normal"),
    ("Chest X-Ray", "Radiology", "N/A", "Normal"),
    ("ECG", "Cardiology", "N/A", "Normal"),
    ("Thyroid Function Test", "Biochemistry", "mIU/L", "Normal"),
    ("Dengue NS1 Antigen", "Serology", "N/A", "Negative"),
    ("Typhoid IgM", "Serology", "N/A", "Negative"),
    ("Hepatitis B Surface Antigen", "Serology", "N/A", "Negative"),
    ("Malaria Parasite Test", "Haematology", "N/A", "Negative"),
]

DEPARTMENTS = [
    ("Emergency", "24/7 emergency services"),
    ("ICU", "Intensive Care Unit"),
    ("General Ward", "General patient ward"),
    ("Cardiology", "Heart and cardiovascular care"),
    ("Orthopedics", "Bone and joint care"),
    ("Pediatrics", "Children healthcare"),
    ("Gynecology", "Women healthcare"),
    ("Neurology", "Brain and nervous system"),
]

WARDS = [
    ("General Ward A", 30),
    ("General Ward B", 30),
    ("ICU", 15),
    ("Emergency Ward", 20),
    ("Pediatric Ward", 20),
    ("Gynecology Ward", 15),
    ("Cardiology Ward", 20),
]

STAFF_DATA = [
    # (name, role, department)
    ("Dr. Khalid Mahmood", "doctor", "Cardiology"),
    ("Dr. Fatima Zaidi", "doctor", "General Ward"),
    ("Dr. Imran Siddiqui", "doctor", "Emergency"),
    ("Dr. Nadia Hussain", "doctor", "Pediatrics"),
    ("Dr. Asad Mehmood", "doctor", "Orthopedics"),
    ("Dr. Sara Qureshi", "doctor", "Gynecology"),
    ("Dr. Bilal Chaudhry", "doctor", "ICU"),
    ("Dr. Uzma Malik", "doctor", "Neurology"),
    ("Nurse Hina Tariq", "nurse", "General Ward"),
    ("Nurse Sana Baig", "nurse", "ICU"),
    ("Nurse Rabia Anwar", "nurse", "Emergency"),
    ("Nurse Amna Yousaf", "nurse", "Pediatrics"),
    ("Nurse Lubna Raza", "nurse", "Gynecology"),
    ("Nurse Mehwish Ali", "nurse", "General Ward"),
    ("Nurse Iqra Sheikh", "nurse", "Cardiology"),
    ("Pharmacist Kamran", "pharmacist", "Pharmacy"),
    ("Admin Officer Tariq", "admin", "Administration"),
]


# ─── SEEDER FUNCTIONS ─────────────────────────────────────────────────────────

async def clear_all_tables(session: AsyncSession) -> None:
    """
    Wipe all application tables before reseeding.

    Uses Postgres catalog discovery so we don't miss any tables when schema changes.
    """
    print("🗑️  Clearing all tables (TRUNCATE CASCADE)...")

    # Fetch all public tables, excluding Alembic's version table (if present).
    result = await session.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename <> 'alembic_version'
            ORDER BY tablename;
            """
        )
    )
    tables = [str(r[0]) for r in result.fetchall()]

    if not tables:
        print("   (No tables found in public schema.)")
        return

    # Truncate everything in one statement for speed.
    # Quote identifiers defensively.
    def _quote_ident(name: str) -> str:
        return '"' + name.replace('"', '""') + '"'

    quoted = ", ".join([_quote_ident(t) for t in tables])
    await session.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))
    await session.commit()
    print(f"✅ Cleared {len(tables)} tables.")


async def seed_login_users(session: AsyncSession) -> None:
    """
    Seed minimal login users required for the app:
    - Exactly one admin
    - Lab + reception accounts (stored as nurse role; frontend routes by email)
    """
    print("🔐 Seeding login users (admin, lab, reception)...")

    users = [
        # (email, role, first, last)
        ("admin@hospital.com", "admin", "Admin", "User"),
        # NOTE: backend UserRole enum does not have laboratorian/receptionist roles.
        # The frontend routes by email for these two accounts.
        ("lab@hospital.com", "nurse", "Laboratorian", "User"),
        ("reception@hospital.com", "nurse", "Receptionist", "User"),
    ]

    for email, role, first, last in users:
        await session.execute(
            text(
                "INSERT INTO users (email, hashed_password, role, first_name, last_name, is_active, created_at, updated_at) "
                "VALUES (:e, :p, :r, :f, :l, true, :c, :u)"
            ),
            {
                "e": email,
                # Keep plaintext for compatibility (backend verify_password supports it).
                "p": "123",
                "r": role,
                "f": first,
                "l": last,
                "c": NOW,
                "u": NOW,
            },
        )
    await session.commit()
    print("✅ Login users created.")

    # Ensure exactly one Staff profile row for each unique Lab/Reception account (for HR screens).
    # Seed other staff (doctors/nurses) later via seed_staff().
    await session.execute(
        text(
            "INSERT INTO staff (name, role, department, shift_start, shift_end, age, phone, address, created_at, updated_at) "
            "VALUES (:n, :r, :d, :ss, :se, :a, :p, :addr, :c, :u)"
        ),
        {
            "n": "Lab Staff",
            "r": "Laboratorian",
            "d": "Laboratory",
            "ss": "08:00",
            "se": "16:00",
            "a": 28,
            "p": "03001234567",
            "addr": "Hospital Lab",
            "c": NOW,
            "u": NOW,
        },
    )
    await session.execute(
        text(
            "INSERT INTO staff (name, role, department, shift_start, shift_end, age, phone, address, created_at, updated_at) "
            "VALUES (:n, :r, :d, :ss, :se, :a, :p, :addr, :c, :u)"
        ),
        {
            "n": "Reception Staff",
            "r": "Receptionist",
            "d": "Administration",
            "ss": "08:00",
            "se": "16:00",
            "a": 26,
            "p": "03007654321",
            "addr": "Front Desk",
            "c": NOW,
            "u": NOW,
        },
    )
    await session.commit()
    print("✅ Staff profiles created for lab + reception.")

async def seed_departments(session: AsyncSession) -> List[int]:
    print("🏥 Seeding departments...")
    ids = []
    for name, desc in DEPARTMENTS:
        result = await session.execute(text(
            "INSERT INTO departments (name, description, created_at, updated_at) "
            "VALUES (:n, :d, :c, :u) RETURNING id"
        ), {"n": name, "d": desc, "c": NOW, "u": NOW})
        ids.append(result.scalar())
    await session.commit()
    print(f"   ✅ {len(ids)} departments")
    return ids


async def seed_wards(session: AsyncSession, dept_ids: List[int]) -> List[int]:
    print("🏨 Seeding wards...")
    ids = []
    for i, (name, cap) in enumerate(WARDS):
        dept_id = dept_ids[i % len(dept_ids)]
        occ = random.randint(int(cap * 0.5), int(cap * 0.85))
        result = await session.execute(text(
            "INSERT INTO ward_details (ward_name, capacity, current_occupancy, department_id, created_at, updated_at) "
            "VALUES (:wn, :cap, :occ, :did, :c, :u) RETURNING id"
        ), {"wn": name, "cap": cap, "occ": occ, "did": dept_id, "c": NOW, "u": NOW})
        ids.append(result.scalar())
    await session.commit()
    print(f"   ✅ {len(ids)} wards")
    return ids


async def seed_beds(session: AsyncSession) -> List[int]:
    print("🛏️  Seeding beds...")
    ids = []
    bed_configs = [
        ("General Ward A", 30), ("General Ward B", 30),
        ("ICU", 15), ("Emergency", 20),
        ("Pediatric", 20), ("Gynecology", 15), ("Cardiology", 20),
    ]
    ward_codes = {
        "General Ward A": "GWA",
        "General Ward B": "GWB",
        "ICU": "ICU",
        "Emergency": "EME",
        "Pediatric": "PED",
        "Gynecology": "GYN",
        "Cardiology": "CAR",
    }
    for ward, count in bed_configs:
        code = ward_codes.get(ward, ward.replace(" ", "")[:3].upper())
        for i in range(1, count + 1):
            status = random.choices(
                ["available", "occupied", "maintenance"],
                weights=[30, 60, 10]
            )[0]
            result = await session.execute(text(
                "INSERT INTO beds (number, ward, status, created_at, updated_at) "
                "VALUES (:num, :ward, :status, :c, :u) RETURNING id"
            ), {"num": f"{code}-{i:03d}", "ward": ward,
                "status": status, "c": NOW, "u": NOW})
            ids.append(result.scalar())
    await session.commit()
    print(f"   ✅ {len(ids)} beds")
    return ids


async def seed_staff(session: AsyncSession) -> tuple[List[int], List[int], List[int]]:
    print("👨‍⚕️ Seeding staff...")
    staff_ids: List[int] = []
    doctor_user_ids: List[int] = []
    nurse_user_ids: List[int] = []

    def _name_to_user_parts(full_name: str) -> tuple[str, str, str]:
        clean = full_name.replace("Dr. ", "").replace("Nurse ", "").strip()
        parts = [p for p in clean.split(" ") if p]
        first = parts[0] if parts else "User"
        last = parts[-1] if len(parts) > 1 else "User"
        local = ".".join([p.lower() for p in parts]) if parts else "user"
        email = f"{local}@hospital.com"
        return email, first, last

    for name, role, dept in STAFF_DATA:
        result = await session.execute(text(
            "INSERT INTO staff (name, role, department, shift_start, shift_end, "
            "age, phone, address, created_at, updated_at) "
            "VALUES (:n, :r, :d, :ss, :se, :a, :p, :addr, :c, :u) RETURNING id"
        ), {
            "n": name, "r": role, "d": dept,
            "ss": "08:00", "se": "16:00",
            "a": random.randint(25, 55),
            "p": rand_phone(),
            "addr": random.choice(ADDRESSES),
            "c": NOW, "u": NOW
        })
        staff_id = result.scalar()
        staff_ids.append(staff_id)

        # Create login users for doctors/nurses so FK relations to users.id work.
        if role in ("doctor", "nurse"):
            email, first, last = _name_to_user_parts(name)
            ures = await session.execute(
                text(
                    "INSERT INTO users (email, hashed_password, role, first_name, last_name, is_active, created_at, updated_at) "
                    "VALUES (:e, :p, :r, :f, :l, true, :c, :u) RETURNING id"
                ),
                {"e": email, "p": "123", "r": role, "f": first, "l": last, "c": NOW, "u": NOW},
            )
            uid = ures.scalar()
            if role == "doctor":
                doctor_user_ids.append(uid)
            else:
                nurse_user_ids.append(uid)
    await session.commit()
    print(f"   ✅ {len(staff_ids)} staff")
    return staff_ids, doctor_user_ids, nurse_user_ids


async def seed_attendance_shifts(session: AsyncSession, staff_ids: List[int]):
    print("📅 Seeding attendance & shifts (6 months)...")
    att_rows = []
    shift_rows = []
    shift_types = ["morning", "evening", "night"]
    shift_times = {
        "morning": (time(8, 0), time(16, 0)),
        "evening": (time(16, 0), time(0, 0)),
        "night":   (time(0, 0), time(8, 0)),
    }
    statuses = ["present", "present", "present", "present", "absent", "leave"]

    d = START_DATE
    while d <= TODAY:
        for sid in staff_ids:
            status = random.choice(statuses)
            check_in = rand_time(7, 9) if status == "present" else None
            check_out = rand_time(15, 17) if status == "present" else None
            att_rows.append({
                "sid": sid, "date": d, "status": status,
                "ci": check_in,
                "co": check_out,
                "c": NOW, "u": NOW
            })
            st = random.choice(shift_types)
            s_start, s_end = shift_times[st]
            shift_rows.append({
                "sid": sid, "date": d, "stype": st,
                "sstart": s_start, "send": s_end,
                "c": NOW, "u": NOW
            })
        d += timedelta(days=1)

    # Batch insert
    for i in range(0, len(att_rows), 500):
        batch = att_rows[i:i+500]
        await session.execute(text(
            "INSERT INTO attendance (staff_id, date, status, check_in, check_out, created_at, updated_at) "
            "VALUES (:sid, :date, :status, :ci, :co, :c, :u)"
        ), batch)

    for i in range(0, len(shift_rows), 500):
        batch = shift_rows[i:i+500]
        await session.execute(text(
            "INSERT INTO shifts (staff_id, date, shift_type, start_time, end_time, created_at, updated_at) "
            "VALUES (:sid, :date, :stype, :sstart, :send, :c, :u)"
        ), batch)

    await session.commit()
    print(f"   ✅ {len(att_rows)} attendance + {len(shift_rows)} shift records")


async def seed_patients(session: AsyncSession, count=300) -> List[int]:
    print(f"🧑‍🤝‍🧑 Seeding {count} patients...")
    ids = []
    all_names = [(n, "Male") for n in MALE_NAMES * 6] + [(n, "Female") for n in FEMALE_NAMES * 6]
    random.shuffle(all_names)

    for i in range(count):
        name, gender = all_names[i % len(all_names)]
        if i >= len(all_names):
            name = f"{name} {i}"
        result = await session.execute(text(
            "INSERT INTO patients (name, age, gender, contact, address, blood_group, created_at, updated_at) "
            "VALUES (:n, :a, :g, :c, :addr, :bg, :cr, :up) RETURNING id"
        ), {
            "n": name, "a": random.randint(5, 85),
            "g": gender, "c": rand_phone(),
            "addr": random.choice(ADDRESSES),
            "bg": rand_blood_group(),
            "cr": rand_dt(START_DATE, TODAY),
            "up": NOW
        })
        ids.append(result.scalar())
    await session.commit()
    print(f"   ✅ {len(ids)} patients")
    return ids


async def seed_pharmacy(session: AsyncSession) -> List[int]:
    print("💊 Seeding pharmacy stock...")
    ids = []
    for name, qty, price, threshold in MEDICINES:
        # Some medicines should be low stock for predictions
        actual_qty = random.choices(
            [qty, random.randint(1, threshold - 1), 0],
            weights=[70, 20, 10]
        )[0]
        expiry = TODAY + timedelta(days=random.randint(30, 730))
        result = await session.execute(text(
            "INSERT INTO pharmacy_stock (medicine_name, quantity, unit_price, expiry_date, "
            "low_stock_threshold, created_at, updated_at) "
            "VALUES (:n, :q, :p, :e, :t, :c, :u) RETURNING id"
        ), {
            "n": name, "q": actual_qty, "p": price,
            "e": expiry.isoformat(), "t": threshold,
            "c": NOW, "u": NOW
        })
        ids.append(result.scalar())
    await session.commit()
    print(f"   ✅ {len(ids)} medicines")
    return ids


async def seed_medicine_categories(session: AsyncSession) -> List[int]:
    print("📦 Seeding medicine categories...")
    cats = [
        ("Antibiotics", "Medicines that fight bacterial infections"),
        ("Analgesics", "Pain relief medicines"),
        ("Antidiabetics", "Medicines for diabetes management"),
        ("Antihypertensives", "Blood pressure medicines"),
        ("Gastrointestinal", "Digestive system medicines"),
        ("Cardiovascular", "Heart and circulation medicines"),
        ("Respiratory", "Breathing and lung medicines"),
        ("Vitamins & Supplements", "Nutritional supplements"),
    ]
    ids = []
    for name, desc in cats:
        result = await session.execute(text(
            "INSERT INTO medicine_categories (name, description, created_at, updated_at) "
            "VALUES (:n, :d, :c, :u) RETURNING id"
        ), {"n": name, "d": desc, "c": NOW, "u": NOW})
        ids.append(result.scalar())
    await session.commit()
    print(f"   ✅ {len(ids)} medicine categories")
    return ids


async def seed_lab_categories(session: AsyncSession) -> List[int]:
    print("🔬 Seeding lab categories...")
    cats = [
        ("Haematology", "Blood cell tests"),
        ("Biochemistry", "Chemical analysis of blood"),
        ("Microbiology", "Urine and culture tests"),
        ("Serology", "Antibody and antigen tests"),
        ("Radiology", "X-ray and imaging"),
        ("Cardiology", "Heart related tests"),
    ]
    ids = []
    for name, desc in cats:
        result = await session.execute(text(
            "INSERT INTO lab_categories (name, description, created_at, updated_at) "
            "VALUES (:n, :d, :c, :u) RETURNING id"
        ), {"n": name, "d": desc, "c": NOW, "u": NOW})
        ids.append(result.scalar())
    await session.commit()
    print(f"   ✅ {len(ids)} lab categories")
    return ids


async def seed_admissions_and_related(
    session: AsyncSession,
    patient_ids: List[int],
    bed_ids: List[int],
    doctor_user_ids: List[int],
    nurse_user_ids: List[int],
    medicine_ids: List[int],
    lab_cat_ids: List[int],
):
    print("🏥 Seeding admissions, vitals, billings, labs, appointments (6 months)...")
    doctor_ids = doctor_user_ids
    nurse_ids = nurse_user_ids

    admission_count = 0
    vitals_count = 0
    billing_count = 0
    lab_count = 0
    appt_count = 0
    prescription_count = 0

    used_beds = set()
    available_beds = list(bed_ids)

    d = START_DATE
    while d <= TODAY:
        n_admissions = seasonal_admission_count(d)

        for _ in range(n_admissions):
            if not available_beds:
                break

            patient_id = random.choice(patient_ids)
            bed_id = random.choice(available_beds)
            used_beds.add(bed_id)

            admit_dt = datetime.combine(d, rand_time(6, 22))
            stay_days = random.randint(1, 14)
            discharge_dt = None
            if d + timedelta(days=stay_days) < TODAY:
                discharge_dt = datetime.combine(
                    d + timedelta(days=stay_days), rand_time(9, 18)
                )

            # Admission
            result = await session.execute(text(
                "INSERT INTO admissions (patient_id, bed_id, admission_date, discharge_date, "
                "reason_for_admission, created_at, updated_at) "
                "VALUES (:pid, :bid, :ad, :dd, :r, :c, :u) RETURNING id"
            ), {
                "pid": patient_id, "bid": bed_id,
                "ad": admit_dt, "dd": discharge_dt,
                "r": random.choice(REASONS),
                "c": admit_dt, "u": NOW
            })
            admission_id = result.scalar()
            admission_count += 1

            # Doctor assignment
            doctor_id = random.choice(doctor_ids)
            await session.execute(text(
                "INSERT INTO doctor_assignments (doctor_id, patient_id, assigned_date, status, created_at, updated_at) "
                "VALUES (:did, :pid, :ad, :s, :c, :u)"
            ), {
                "did": doctor_id, "pid": patient_id,
                "ad": d, "s": "active" if not discharge_dt else "completed",
                "c": NOW, "u": NOW
            })

            # Vitals (1-3 per admission day)
            vitals_per_admission = random.randint(1, 3)
            for v in range(vitals_per_admission):
                vital_dt = admit_dt + timedelta(hours=v * 6)
                hr = random.randint(55, 130)
                sys_bp = random.randint(90, 170)
                dia_bp = random.randint(60, 110)
                spo2 = random.randint(88, 100)
                temp = round(random.uniform(36.0, 40.5), 1)
                rr = random.randint(12, 28)

                # Determine condition
                if hr > 120 or spo2 < 90 or sys_bp > 160 or temp > 39.5:
                    condition = "critical"
                elif hr > 100 or spo2 < 95 or sys_bp > 140 or temp > 38.5:
                    condition = "moderate"
                else:
                    condition = "stable"

                await session.execute(text(
                    "INSERT INTO vitals (patient_id, recorded_by, recorded_at, heart_rate, "
                    "blood_pressure_sys, blood_pressure_dia, spo2, temperature, respiratory_rate, "
                    "condition_level, created_at, updated_at) "
                    "VALUES (:pid, :rb, :ra, :hr, :sys, :dia, :spo2, :temp, :rr, :cl, :c, :u)"
                ), {
                    "pid": patient_id,
                    "rb": random.choice(nurse_ids),
                    "ra": vital_dt,
                    "hr": hr, "sys": sys_bp, "dia": dia_bp,
                    "spo2": spo2, "temp": temp, "rr": rr,
                    "cl": condition, "c": vital_dt, "u": NOW
                })
                vitals_count += 1

            # Billing
            amount = round(random.uniform(2000, 50000), 2)
            bill_status = random.choices(
                ["paid", "pending"],
                weights=[70, 30]
            )[0]
            result = await session.execute(text(
                "INSERT INTO billings (patient_id, amount, status, date, description, created_at, updated_at) "
                "VALUES (:pid, :amt, :s, :dt, :desc, :c, :u) RETURNING id"
            ), {
                "pid": patient_id, "amt": amount, "s": bill_status,
                "dt": admit_dt,
                "desc": f"Hospital charges - {random.choice(REASONS)}",
                "c": admit_dt, "u": NOW
            })
            billing_id = result.scalar()
            billing_count += 1

            # Bill items
            for _ in range(random.randint(2, 5)):
                item_desc = random.choice([
                    "Consultation fee", "Lab test charges", "Medicine charges",
                    "Bed charges", "Nursing charges", "X-ray charges",
                    "ICU charges", "Procedure charges"
                ])
                await session.execute(text(
                    "INSERT INTO bill_items (billing_id, description, amount, created_at, updated_at) "
                    "VALUES (:bid, :desc, :amt, :c, :u)"
                ), {
                    "bid": billing_id,
                    "desc": item_desc,
                    "amt": round(random.uniform(200, 8000), 2),
                    "c": admit_dt, "u": NOW
                })

            # Transaction (if paid)
            if bill_status == "paid":
                paid_amt = amount
                await session.execute(text(
                    "INSERT INTO transactions (billing_id, payment_method, amount_paid, "
                    "transaction_date, created_at, updated_at) "
                    "VALUES (:bid, :pm, :amt, :td, :c, :u)"
                ), {
                    "bid": billing_id,
                    "pm": random.choice(["cash", "card", "bank_transfer", "insurance"]),
                    "amt": paid_amt,
                    "td": admit_dt + timedelta(hours=random.randint(1, 24)),
                    "c": NOW, "u": NOW
                })

            # Lab requests
            if random.random() < 0.7:
                test = random.choice(LAB_TESTS)
                result = await session.execute(text(
                    "INSERT INTO lab_requests (patient_id, doctor_id, lab_category_id, "
                    "request_date, status, created_at, updated_at) "
                    "VALUES (:pid, :did, :lcid, :rd, :s, :c, :u) RETURNING id"
                ), {
                    "pid": patient_id, "did": doctor_id,
                    "lcid": random.choice(lab_cat_ids),
                    "rd": admit_dt,
                    "s": random.choice(["pending", "completed", "completed", "completed"]),
                    "c": admit_dt, "u": NOW
                })
                lab_count += 1

                # Lab result
                await session.execute(text(
                    "INSERT INTO laboratory_results (patient_id, test_name, result_value, unit, "
                    "status, collected_at, created_at, updated_at) "
                    "VALUES (:pid, :tn, :rv, :unit, :s, :ca, :c, :u)"
                ), {
                    "pid": patient_id,
                    "tn": test[0],
                    "rv": str(round(random.uniform(50, 200), 1)),
                    "unit": test[2],
                    "s": test[3],
                    "ca": admit_dt + timedelta(hours=2),
                    "c": NOW, "u": NOW
                })

            # Prescription
            if random.random() < 0.8 and medicine_ids:
                await session.execute(text(
                    "INSERT INTO prescriptions (patient_id, doctor_id, medicine_id, dosage, "
                    "frequency, start_date, end_date, created_at, updated_at) "
                    "VALUES (:pid, :did, :mid, :dos, :freq, :sd, :ed, :c, :u)"
                ), {
                    "pid": patient_id, "did": doctor_id,
                    "mid": random.choice(medicine_ids),
                    "dos": random.choice(["1 tablet", "2 tablets", "5ml syrup", "1 injection"]),
                    "freq": random.choice(["Once daily", "Twice daily", "Three times daily", "SOS"]),
                    "sd": d,
                    "ed": d + timedelta(days=random.randint(3, 14)),
                    "c": NOW, "u": NOW
                })
                prescription_count += 1

        # Appointments (daily - some future, some past)
        for _ in range(random.randint(3, 8)):
            appt_date = d + timedelta(days=random.randint(-2, 7))
            await session.execute(text(
                "INSERT INTO appointments (patient_id, doctor_id, appointment_date, status, reason, created_at, updated_at) "
                "VALUES (:pid, :did, :ad, :s, :r, :c, :u)"
            ), {
                "pid": random.choice(patient_ids),
                "did": random.choice(doctor_ids),
                "ad": datetime.combine(appt_date, rand_time(9, 17)),
                "s": random.choices(
                    ["scheduled", "completed", "cancelled", "no_show"],
                    weights=[20, 55, 15, 10]
                )[0],
                "r": random.choice(REASONS),
                "c": NOW, "u": NOW
            })
            appt_count += 1

        d += timedelta(days=1)

        # Commit + progress every 7 days (keeps transactions small on Neon)
        if (d - START_DATE).days % 7 == 0:
            await session.commit()
            print(f"   … progress: up to {d} (admissions={admission_count}, vitals={vitals_count}, billings={billing_count})")

    await session.commit()
    print(f"   ✅ {admission_count} admissions")
    print(f"   ✅ {vitals_count} vitals records")
    print(f"   ✅ {billing_count} billing records")
    print(f"   ✅ {lab_count} lab requests/results")
    print(f"   ✅ {appt_count} appointments")
    print(f"   ✅ {prescription_count} prescriptions")


async def seed_alerts(session: AsyncSession, patient_ids: List[int]):
    print("🚨 Seeding alerts...")
    alert_types = [
        ("low_stock", "Medicine stock critically low", "high"),
        ("icu_full", "ICU beds at 95% capacity", "critical"),
        ("emergency_patient", "Patient condition changed to Emergency", "critical"),
        ("revenue_drop", "Daily revenue dropped below 60% of average", "medium"),
        ("expiry_warning", "Medicine expiring within 15 days", "medium"),
        ("surge_alert", "Emergency patient surge detected", "high"),
    ]
    count = 0
    for i in range(100):
        alert_type, message, severity = random.choice(alert_types)
        created = rand_dt(START_DATE, TODAY)
        await session.execute(text(
            "INSERT INTO alerts (patient_id, type, message, severity, is_resolved, created_at, updated_at) "
            "VALUES (:pid, :t, :m, :s, :ir, :c, :u)"
        ), {
            "pid": random.choice(patient_ids) if random.random() < 0.5 else None,
            "t": alert_type, "m": message, "s": severity,
            "ir": random.random() < 0.7,
            "c": created, "u": NOW
        })
        count += 1
    await session.commit()
    print(f"   ✅ {count} alerts")


async def seed_visits(session: AsyncSession, patient_ids: List[int], doctor_user_ids: List[int]):
    print("🩺 Seeding visits...")
    doctor_ids = doctor_user_ids
    count = 0
    for _ in range(400):
        visit_dt = rand_dt(START_DATE, TODAY)
        await session.execute(text(
            "INSERT INTO visits (patient_id, doctor_id, visit_date, notes, created_at, updated_at) "
            "VALUES (:pid, :did, :vd, :n, :c, :u)"
        ), {
            "pid": random.choice(patient_ids),
            "did": random.choice(doctor_ids),
            "vd": visit_dt,
            "n": random.choice([
                "Follow-up visit, condition improving",
                "Routine checkup, vitals stable",
                "Post-discharge follow-up",
                "Medication review and adjustment",
                "Emergency consultation",
            ]),
            "c": visit_dt, "u": NOW
        })
        count += 1
    await session.commit()
    print(f"   ✅ {count} visits")


async def seed_inventory(session: AsyncSession, dept_ids: List[int]):
    print("📦 Seeding inventory items...")
    items = [
        ("Surgical Gloves (Box)", 50, 10),
        ("Syringes 5ml (Pack)", 200, 30),
        ("IV Drip Sets", 100, 20),
        ("Surgical Masks (Box)", 80, 15),
        ("Bandages (Roll)", 150, 25),
        ("Cotton Wool (Roll)", 120, 20),
        ("Alcohol Swabs (Box)", 90, 15),
        ("Stethoscope", 15, 3),
        ("Blood Pressure Monitor", 10, 2),
        ("Thermometer", 25, 5),
        ("Oxygen Cylinders", 20, 5),
        ("Nebulizer Masks", 30, 8),
    ]
    count = 0
    for name, qty, threshold in items:
        actual_qty = random.choices(
            [qty, random.randint(1, threshold), 0],
            weights=[65, 25, 10]
        )[0]
        await session.execute(text(
            "INSERT INTO inventory_items (item_name, quantity, threshold, department_id, created_at, updated_at) "
            "VALUES (:n, :q, :t, :did, :c, :u)"
        ), {
            "n": name, "q": actual_qty, "t": threshold,
            "did": random.choice(dept_ids),
            "c": NOW, "u": NOW
        })
        count += 1
    await session.commit()
    print(f"   ✅ {count} inventory items")


async def seed_treatment_plans(session: AsyncSession, patient_ids: List[int], doctor_user_ids: List[int]):
    print("📋 Seeding treatment plans...")
    doctor_ids = doctor_user_ids
    plans = [
        "IV fluids + antibiotics for 5 days, daily vitals monitoring",
        "Oral medication regime, rest and dietary restrictions",
        "Surgical intervention planned, pre-op evaluation ongoing",
        "Conservative management, pain relief and physiotherapy",
        "Cardiac monitoring, beta-blockers and ACE inhibitors",
        "Insulin therapy titration, diabetic diet counseling",
        "Respiratory support, bronchodilators and steroids",
        "Renal dialysis 3x/week, fluid restriction",
    ]
    count = 0
    for _ in range(200):
        start = rand_date(START_DATE, TODAY)
        await session.execute(text(
            "INSERT INTO treatment_plans (patient_id, doctor_id, plan_details, start_date, end_date, created_at, updated_at) "
            "VALUES (:pid, :did, :pd, :sd, :ed, :c, :u)"
        ), {
            "pid": random.choice(patient_ids),
            "did": random.choice(doctor_ids),
            "pd": random.choice(plans),
            "sd": start,
            "ed": start + timedelta(days=random.randint(5, 30)),
            "c": NOW, "u": NOW
        })
        count += 1
    await session.commit()
    print(f"   ✅ {count} treatment plans")


async def seed_icu_details(session: AsyncSession):
    print("🏥 Seeding ICU details...")
    result = await session.execute(text(
        "SELECT id FROM admissions ORDER BY RANDOM() LIMIT 40"
    ))
    admission_ids = [row[0] for row in result.fetchall()]
    count = 0
    for adm_id in admission_ids:
        await session.execute(text(
            "INSERT INTO icu_details (admission_id, ventilator_used, days_in_icu, created_at, updated_at) "
            "VALUES (:aid, :vu, :days, :c, :u)"
        ), {
            "aid": adm_id,
            "vu": random.random() < 0.3,
            "days": random.randint(1, 14),
            "c": NOW, "u": NOW
        })
        count += 1
    await session.commit()
    print(f"   ✅ {count} ICU records")


async def seed_forecasts(session: AsyncSession):
    print("📈 Seeding forecast data...")
    metrics = [
        "patient_admissions", "revenue", "medicine_demand",
        "bed_occupancy", "lab_requests", "emergency_cases"
    ]
    count = 0
    # Historical forecasts
    for i in range(90):
        forecast_date = TODAY - timedelta(days=90) + timedelta(days=i)
        for metric in metrics:
            await session.execute(text(
                "INSERT INTO forecasts (metric_name, forecast_date, value, created_at, updated_at) "
                "VALUES (:mn, :fd, :v, :c, :u)"
            ), {
                "mn": metric,
                "fd": datetime.combine(forecast_date, time(0, 0)),
                "v": round(random.uniform(50, 500), 2),
                "c": NOW, "u": NOW
            })
            count += 1
    await session.commit()
    print(f"   ✅ {count} forecast records")


# ─── MAIN ─────────────────────────────────────────────────────────────────────
async def main():
    print("=" * 60)
    print("🏥 HOSPITAL DATA SEEDER — 6 MONTHS")
    print(f"   Date range: {START_DATE} → {TODAY}")
    print("=" * 60)

    async with AsyncSessionLocal() as session:
        # Step 1: Clear
        await clear_all_tables(session)
        await seed_login_users(session)

        # Step 2: Reference data
        dept_ids = await seed_departments(session)
        ward_ids = await seed_wards(session, dept_ids)
        bed_ids = await seed_beds(session)
        staff_ids, doctor_user_ids, nurse_user_ids = await seed_staff(session)
        medicine_ids = await seed_pharmacy(session)
        await seed_medicine_categories(session)
        lab_cat_ids = await seed_lab_categories(session)
        await seed_inventory(session, dept_ids)

        # Step 3: Operational data
        patient_ids = await seed_patients(session, count=300)
        await seed_attendance_shifts(session, staff_ids)

        # Step 4: Clinical data (admissions + all related)
        await seed_admissions_and_related(
            session, patient_ids, bed_ids, doctor_user_ids, nurse_user_ids, medicine_ids, lab_cat_ids
        )

        # Step 5: Supporting data
        await seed_alerts(session, patient_ids)
        await seed_visits(session, patient_ids, doctor_user_ids)
        await seed_treatment_plans(session, patient_ids, doctor_user_ids)
        await seed_icu_details(session)
        await seed_forecasts(session)

    print("=" * 60)
    print("✅ ALL DONE! Database seeded with 6 months of data.")
    print(f"   Data covers: {START_DATE} → {TODAY}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

