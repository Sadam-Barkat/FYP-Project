import asyncio
import os
import random
import argparse
from datetime import datetime, time, timedelta
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Database URL from environment
DATABASE_URL = os.environ.get("DATABASE_URL")

async def seed_daily_data(days_back: int):
    print("Connecting to database...")
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        today = datetime.utcnow().date()
        
        # 1. Get all staff members
        result = await conn.execute(text("SELECT id FROM staff"))
        staff_ids = [row[0] for row in result.fetchall()]
        print(f"Found {len(staff_ids)} staff members.")
        
        # 2. Get all patients
        result = await conn.execute(text("SELECT id FROM patients"))
        patient_ids = [row[0] for row in result.fetchall()]
        print(f"Found {len(patient_ids)} patients.")

        if not patient_ids:
            print("No patients found! Cannot seed finance data without patients.")
            return

        statuses = ["present", "present", "present", "present", "absent", "leave"]
        shift_times = {
            "morning": (time(8, 0), time(16, 0)),
            "evening": (time(16, 0), time(0, 0)),
            "night":   (time(0, 0), time(8, 0)),
        }
        
        for i in range(days_back, -1, -1):
            target_date = today - timedelta(days=i)
            target_datetime = datetime.combine(target_date, time(12, 0)) # noon
            
            print(f"\n--- Seeding data for {target_date} ---")
            
            # -------------------------------------------------------------
            # A. ATTENDANCE & SHIFTS
            # -------------------------------------------------------------
            # Clear existing attendance for this day
            await conn.execute(text("DELETE FROM attendance WHERE date = :d"), {"d": target_date})
            await conn.execute(text("DELETE FROM shifts WHERE date = :d"), {"d": target_date})
            
            att_rows = []
            shift_rows = []
            now = datetime.utcnow()
            
            for sid in staff_ids:
                status = random.choice(statuses)
                
                check_in = time(random.randint(7, 8), random.randint(0, 59)) if status == "present" else None
                check_out = time(random.randint(15, 17), random.randint(0, 59)) if status == "present" else None
                
                att_rows.append({
                    "sid": sid, "date": target_date, "status": status,
                    "ci": check_in, "co": check_out,
                    "c": now, "u": now
                })
                
                st = random.choice(list(shift_times.keys()))
                s_start, s_end = shift_times[st]
                shift_rows.append({
                    "sid": sid, "date": target_date, "stype": st,
                    "sstart": s_start, "send": s_end,
                    "c": now, "u": now
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

            # -------------------------------------------------------------
            # B. FINANCE (Billings & Transactions)
            # -------------------------------------------------------------
            # Note: We won't delete past finance data to allow historical accumulation,
            # but if you run this multiple times for the same day, it will ADD more revenue.
            
            num_billings = random.randint(5, 15)
            finance_amount = 0.0
            
            for _ in range(num_billings):
                pid = random.choice(patient_ids)
                amount = round(random.uniform(2000, 50000), 2)
                finance_amount += amount
                
                bill_status = random.choices(["paid", "pending"], weights=[70, 30])[0]
                
                # Create Billing
                b_res = await conn.execute(text(
                    "INSERT INTO billings (patient_id, amount, status, date, description, created_at, updated_at) "
                    "VALUES (:pid, :amt, :s, :dt, :desc, :c, :u) RETURNING id"
                ), {
                    "pid": pid, "amt": amount, "s": bill_status,
                    "dt": target_datetime,
                    "desc": f"Daily auto-generated hospital charges",
                    "c": now, "u": now
                })
                billing_id = b_res.scalar()
                
                # Create Bill Items
                for _ in range(random.randint(2, 5)):
                    await conn.execute(text(
                        "INSERT INTO bill_items (billing_id, description, amount, created_at, updated_at) "
                        "VALUES (:bid, :desc, :amt, :c, :u)"
                    ), {
                        "bid": billing_id,
                        "desc": random.choice(["Consultation fee", "Lab test charges", "Medicine charges", "Bed charges"]),
                        "amt": round(random.uniform(200, 8000), 2),
                        "c": now, "u": now
                    })
                
                # Create Transaction if paid
                if bill_status == "paid":
                    await conn.execute(text(
                        "INSERT INTO transactions (billing_id, payment_method, amount_paid, transaction_date, created_at, updated_at) "
                        "VALUES (:bid, :pm, :amt, :td, :c, :u)"
                    ), {
                        "bid": billing_id,
                        "pm": random.choice(["cash", "card", "bank_transfer", "insurance"]),
                        "amt": amount,
                        "td": target_datetime + timedelta(hours=random.randint(1, 4)),
                        "c": now, "u": now
                    })
            
            print(f"  ✅ Seeded {num_billings} billings (Total: {finance_amount:,.2f} generated).")
                
    print("\n✅ All daily data successfully seeded!")
    await engine.dispose()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed daily attendance and finance data.")
    parser.add_argument("--days-back", type=int, default=0, help="Number of past days to seed (default 0 = today only).")
    args = parser.parse_args()
    
    asyncio.run(seed_daily_data(args.days_back))
