import asyncio
import os
import random
import argparse
from datetime import datetime, time, timedelta
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Database URL from environment
DATABASE_URL = os.environ.get("DATABASE_URL")

# --- DATA POOLS FOR RANDOM GENERATION ---
MALE_NAMES = ["Ahmed Khan", "Muhammad Ali", "Usman Malik", "Hassan Raza", "Bilal Sheikh", "Tariq Mehmood", "Zubair Ahmed", "Faisal Nawaz", "Junaid Anwar", "Rizwan Saeed"]
FEMALE_NAMES = ["Fatima Zahra", "Ayesha Siddiqui", "Maryam Nawaz", "Zainab Ali", "Sara Malik", "Hina Baig", "Nadia Hussain", "Sana Khan", "Asma Butt", "Lubna Ahmed"]
ADDRESSES = ["House 12, Gulberg, Lahore", "Block C, Model Town, Faisalabad", "Flat 3, Al-Hamra, Multan", "Village Chak 45, Sargodha", "Plot 7, DHA Phase 2, Islamabad", "Street 9, Satellite Town, Rawalpindi", "House 88, Johar Town, Lahore", "Near DHQ Hospital, Gujranwala"]
REASONS = ["Fever and body ache", "Chest pain", "Difficulty breathing", "Abdominal pain", "Road traffic accident", "Fracture", "High blood pressure", "Diabetes complication", "Kidney stone", "Dengue fever", "Typhoid", "Malaria", "Asthma attack", "Urinary tract infection", "Severe dehydration"]

LAB_TESTS = [
    ("Complete Blood Count (CBC)", "cells/uL"),
    ("Blood Sugar Fasting", "mg/dL"),
    ("Blood Sugar Random", "mg/dL"),
    ("HbA1c", "%"),
    ("Liver Function Test", "IU/L"),
    ("Kidney Function Test", "mg/dL"),
    ("Chest X-Ray", "N/A"),
    ("ECG", "N/A"),
    ("Dengue NS1 Antigen", "N/A"),
]

def rand_phone():
    return f"03{random.randint(10,49)}{random.randint(1000000,9999999)}"

async def seed_daily_data(days_back: int, data_types: list[str]):
    print("Connecting to database...")
    engine = create_async_engine(DATABASE_URL)
    
    do_all = "all" in data_types
    do_att = do_all or "attendance" in data_types
    do_pat = do_all or "patients" in data_types
    do_vit = do_all or "vitals" in data_types
    do_fin = do_all or "finance" in data_types
    do_pha = do_all or "pharmacy" in data_types
    do_lab = do_all or "labs" in data_types
    
    async with engine.begin() as conn:
        today = datetime.utcnow().date()
        
        # 1. Fetch reference data
        staff_res = await conn.execute(text("SELECT id FROM staff"))
        staff_ids = [row[0] for row in staff_res.fetchall()]
        
        users_res = await conn.execute(text("SELECT id, role FROM users WHERE role IN ('doctor', 'nurse')"))
        doctors = []
        nurses = []
        for row in users_res.fetchall():
            if row[1] == 'doctor': doctors.append(row[0])
            elif row[1] == 'nurse': nurses.append(row[0])

        med_res = await conn.execute(text("SELECT id FROM pharmacy_stock"))
        medicine_ids = [row[0] for row in med_res.fetchall()]

        lab_cat_res = await conn.execute(text("SELECT id FROM lab_categories"))
        lab_cat_ids = [row[0] for row in lab_cat_res.fetchall()]

        bed_res = await conn.execute(text("SELECT id, status FROM beds"))
        all_beds = []
        available_beds = []
        for row in bed_res.fetchall():
            all_beds.append(row[0])
            if row[1] == "available":
                available_beds.append(row[0])

        # 2. Iterate through requested days
        for i in range(days_back, -1, -1):
            target_date = today - timedelta(days=i)
            target_datetime = datetime.combine(target_date, time(12, 0)) # noon
            
            print(f"\n--- Seeding data for {target_date} ---")
            now = datetime.utcnow()
            
            # A. ATTENDANCE & SHIFTS
            if do_att:
                await conn.execute(text("DELETE FROM attendance WHERE date = :d"), {"d": target_date})
                await conn.execute(text("DELETE FROM shifts WHERE date = :d"), {"d": target_date})
                
                att_rows = []
                shift_rows = []
                
                for sid in staff_ids:
                    status = random.choice(["present", "present", "present", "present", "absent", "leave"])
                    check_in = time(random.randint(7, 8), random.randint(0, 59)) if status == "present" else None
                    check_out = time(random.randint(15, 17), random.randint(0, 59)) if status == "present" else None
                    att_rows.append({
                        "sid": sid, "date": target_date, "status": status,
                        "ci": check_in, "co": check_out, "c": now, "u": now
                    })
                    
                    st = random.choice(["morning", "evening", "night"])
                    s_start, s_end = {"morning": (time(8, 0), time(16, 0)), "evening": (time(16, 0), time(0, 0)), "night": (time(0, 0), time(8, 0))}[st]
                    shift_rows.append({
                        "sid": sid, "date": target_date, "stype": st,
                        "sstart": s_start, "send": s_end, "c": now, "u": now
                    })
                    
                if att_rows:
                    await conn.execute(text(
                        "INSERT INTO attendance (staff_id, date, status, check_in, check_out, created_at, updated_at) "
                        "VALUES (:sid, :date, :status, :ci, :co, :c, :u)"
                    ), att_rows)
                if shift_rows:
                    await conn.execute(text(
                        "INSERT INTO shifts (staff_id, date, shift_type, start_time, end_time, created_at, updated_at) "
                        "VALUES (:sid, :date, :stype, :sstart, :send, :c, :u)"
                    ), shift_rows)
                print(f"  ✅ Seeded {len(att_rows)} attendance/shift records.")

            # B. NEW PATIENTS (Admissions / IPD)
            new_patients = 0
            new_patient_ids = []
            if do_pat:
                new_patients = random.randint(2, 6)
                for _ in range(new_patients):
                    gender = random.choice(["Male", "Female"])
                    name = random.choice(MALE_NAMES) if gender == "Male" else random.choice(FEMALE_NAMES)
                    p_res = await conn.execute(text(
                        "INSERT INTO patients (name, age, gender, blood_group, contact, address, created_at, updated_at) "
                        "VALUES (:n, :a, :g, :bg, :c_no, :addr, :c, :u) RETURNING id"
                    ), {
                        "n": name, "a": random.randint(1, 85), "g": gender,
                        "bg": random.choice(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]),
                        "c_no": rand_phone(), "addr": random.choice(ADDRESSES),
                        "c": target_datetime, "u": now
                    })
                    new_patient_ids.append(p_res.scalar())

            # C. ADMISSIONS, DOCTOR/NURSE ASSIGNMENTS, BEDS
            if do_pat:
                for pid in new_patient_ids:
                    if not available_beds:
                        break # Hospital full
                    bed_id = available_beds.pop(0)
                    
                    # Admission
                    a_res = await conn.execute(text(
                        "INSERT INTO admissions (patient_id, bed_id, admission_date, discharge_date, reason_for_admission, created_at, updated_at) "
                        "VALUES (:pid, :bid, :ad, NULL, :r, :c, :u) RETURNING id"
                    ), {"pid": pid, "bid": bed_id, "ad": target_datetime, "r": random.choice(REASONS), "c": now, "u": now})
                    
                    # Mark bed occupied
                    await conn.execute(text("UPDATE beds SET status='occupied' WHERE id=:bid"), {"bid": bed_id})

                    # Doctor & Nurse Assignment
                    if doctors:
                        await conn.execute(text(
                            "INSERT INTO doctor_assignments (doctor_id, patient_id, assigned_date, status, created_at, updated_at) "
                            "VALUES (:did, :pid, :ad, 'active', :c, :u)"
                        ), {"did": random.choice(doctors), "pid": pid, "ad": target_date, "c": now, "u": now})
                    if nurses:
                        await conn.execute(text(
                            "INSERT INTO nurse_patient_assignments (nurse_id, patient_id, assigned_date, status, created_at, updated_at) "
                            "VALUES (:nid, :pid, :ad, 'active', :c, :u)"
                        ), {"nid": random.choice(nurses), "pid": pid, "ad": target_date, "c": now, "u": now})

            # D. DISCHARGING SOME PATIENTS (to free up beds)
            # Find active admissions
            active_admissions = await conn.execute(text("SELECT id, patient_id, bed_id FROM admissions WHERE discharge_date IS NULL"))
            active_admissions = active_admissions.fetchall()
            
            discharged_today = 0
            if do_pat:
                for adm in active_admissions:
                    if random.random() < 0.15: # 15% chance to discharge today
                        await conn.execute(text("UPDATE admissions SET discharge_date=:dd WHERE id=:aid"), {"dd": target_datetime + timedelta(hours=5), "aid": adm[0]})
                        await conn.execute(text("UPDATE beds SET status='available' WHERE id=:bid"), {"bid": adm[2]})
                        await conn.execute(text("UPDATE doctor_assignments SET status='completed' WHERE patient_id=:pid"), {"pid": adm[1]})
                        available_beds.append(adm[2])
                        discharged_today += 1

            # E. VITALS FOR ACTIVE ADMISSIONS
            if do_vit:
                for adm in active_admissions:
                    # Add 1-2 vitals for active patients
                    for v in range(random.randint(1, 2)):
                        hr = random.randint(60, 125)
                        spo2 = random.randint(89, 100)
                        temp = round(random.uniform(36.5, 39.5), 1)
                        cond = "critical" if hr > 115 or spo2 < 92 else "moderate" if hr > 100 or spo2 < 95 else "stable"
                        await conn.execute(text(
                            "INSERT INTO vitals (patient_id, recorded_by, recorded_at, heart_rate, blood_pressure_sys, blood_pressure_dia, spo2, temperature, respiratory_rate, condition_level, created_at, updated_at) "
                            "VALUES (:pid, :rb, :ra, :hr, :sys, :dia, :spo2, :temp, :rr, :cl, :c, :u)"
                        ), {
                            "pid": adm[1], "rb": random.choice(nurses) if nurses else 1, "ra": target_datetime + timedelta(hours=v*2),
                            "hr": hr, "sys": random.randint(100, 150), "dia": random.randint(60, 90),
                            "spo2": spo2, "temp": temp, "rr": random.randint(14, 24), "cl": cond, "c": now, "u": now
                        })

            # F. FINANCE (Billings & Transactions) - tied to new patients + some random existing ones
            patients_res = await conn.execute(text("SELECT id FROM patients"))
            all_patients = [row[0] for row in patients_res.fetchall()]
            
            num_billings = 0
            finance_amount = 0.0
            
            if do_fin and all_patients:
                num_billings = random.randint(8, 20)
                for _ in range(num_billings):
                    pid = random.choice(new_patient_ids) if new_patient_ids and random.random() < 0.5 else random.choice(all_patients)
                    amount = round(random.uniform(2000, 50000), 2)
                    finance_amount += amount
                    bill_status = random.choices(["paid", "pending"], weights=[70, 30])[0]
                    
                    b_res = await conn.execute(text(
                        "INSERT INTO billings (patient_id, amount, status, date, description, created_at, updated_at) "
                        "VALUES (:pid, :amt, :s, :dt, :desc, :c, :u) RETURNING id"
                    ), {"pid": pid, "amt": amount, "s": bill_status, "dt": target_datetime, "desc": "Daily hospital charges", "c": now, "u": now})
                    billing_id = b_res.scalar()
                    
                    for _ in range(random.randint(2, 4)):
                        await conn.execute(text(
                            "INSERT INTO bill_items (billing_id, description, amount, created_at, updated_at) "
                            "VALUES (:bid, :desc, :amt, :c, :u)"
                        ), {"bid": billing_id, "desc": random.choice(["Consultation", "Lab test", "Medicine", "Bed charges"]), "amt": round(random.uniform(200, 5000), 2), "c": now, "u": now})
                    
                    if bill_status == "paid":
                        await conn.execute(text(
                            "INSERT INTO transactions (billing_id, payment_method, amount_paid, transaction_date, created_at, updated_at) "
                            "VALUES (:bid, :pm, :amt, :td, :c, :u)"
                        ), {"bid": billing_id, "pm": random.choice(["cash", "card", "bank_transfer"]), "amt": amount, "td": target_datetime, "c": now, "u": now})

            # G. LABS
            if do_lab and all_patients and lab_cat_ids and doctors:
                for _ in range(random.randint(3, 8)):
                    pid = random.choice(all_patients)
                    test_name, test_unit = random.choice(LAB_TESTS)
                    
                    # Lab request
                    lr_res = await conn.execute(text(
                        "INSERT INTO lab_requests (patient_id, doctor_id, lab_category_id, request_date, status, created_at, updated_at) "
                        "VALUES (:pid, :did, :lcid, :rd, 'completed', :c, :u) RETURNING id"
                    ), {"pid": pid, "did": random.choice(doctors), "lcid": random.choice(lab_cat_ids), "rd": target_datetime, "c": now, "u": now})
                    
                    # Lab result
                    await conn.execute(text(
                        "INSERT INTO laboratory_results (patient_id, test_name, result_value, unit, status, collected_at, created_at, updated_at) "
                        "VALUES (:pid, :tn, :rv, :unit, 'Normal', :ca, :c, :u)"
                    ), {"pid": pid, "tn": test_name, "rv": str(random.randint(50, 150)), "unit": test_unit, "ca": target_datetime, "c": now, "u": now})

            # H. PHARMACY (Prescriptions)
            if do_pha and all_patients and medicine_ids and doctors:
                for _ in range(random.randint(5, 12)):
                    pid = random.choice(all_patients)
                    mid = random.choice(medicine_ids)
                    qty = random.randint(1, 10)
                    
                    # Prescription
                    pr_res = await conn.execute(text(
                        "INSERT INTO prescriptions (patient_id, doctor_id, medicine_id, dosage, frequency, start_date, end_date, created_at, updated_at) "
                        "VALUES (:pid, :did, :mid, '1 tab', 'Twice a day', :sd, :ed, :c, :u) RETURNING id"
                    ), {"pid": pid, "did": random.choice(doctors), "mid": mid, "sd": target_date, "ed": target_date + timedelta(days=5), "c": now, "u": now})
                    
                    # Decrease stock
                    await conn.execute(text(
                        "UPDATE pharmacy_stock SET quantity = GREATEST(0, quantity - :qty), updated_at = :u WHERE id = :mid"
                    ), {"qty": qty, "mid": mid, "u": now})

            print(f"  ✅ Added {new_patients} new admissions/patients, {num_billings} billings (${finance_amount:,.2f}), discharged {discharged_today} patients, generated vitals, labs & pharmacy data.")
                
    print("\n✅ All daily data successfully seeded!")
    await engine.dispose()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed daily hospital data.")
    parser.add_argument("--days-back", type=int, default=0, help="Number of past days to seed (default 0 = today only).")
    parser.add_argument("--data-types", type=str, default="all", help="Comma separated list of data types to generate (e.g. 'attendance,finance').")
    args = parser.parse_args()
    
    types_list = [t.strip() for t in args.data_types.split(",")]
    asyncio.run(seed_daily_data(args.days_back, types_list))
