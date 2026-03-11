import asyncio
import os
import random
from datetime import datetime, timedelta, time
from faker import Faker
from dotenv import load_dotenv

# Important: load dot env before importing database
load_dotenv()

from app.database import SessionLocal, engine
from app.models.base import Base
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.bed import Bed, BedStatus
from app.models.vital import Vital
from app.models.alert import Alert, AlertSeverity
from app.models.admission import Admission
from app.models.pharmacy import PharmacyStock
from app.models.laboratory import LaboratoryResult
from app.models.billing import Billing, BillingStatus
from app.models.staff import Staff

from app.models.organization import Department, WardDetail
from app.models.hr import Attendance, Shift, AttendanceStatus, ShiftType
from app.models.clinical import Appointment, Visit, Prescription, TreatmentPlan, DischargeSummary
from app.models.assignments import DoctorAssignment, NurseAssignment
from app.models.laboratory_extra import LabCategory, LabRequest
from app.models.pharmacy_extra import MedicineCategory, InventoryItem
from app.models.billing_extra import BillItem, Transaction
from app.models.analytics import Forecast, Categorization, EmergencyLog, ICUDetail
from app.models.system import AuditLog

fake = Faker()

async def create_dummy_data():
    async with SessionLocal() as session:
        print("Starting dummy data generation for all 32 tables...")

        # 1. Users
        users = []
        admin = User(email=f"admin_{fake.unique.random_number(digits=6)}@hospital.com", hashed_password="pw", role=UserRole.admin, first_name="Super", last_name="Admin")
        session.add(admin)
        users.append(admin)
        
        doctors = []
        for i in range(10):
            doc = User(email=fake.unique.email(), hashed_password="pw", role=UserRole.doctor, first_name=fake.first_name(), last_name=fake.last_name())
            session.add(doc)
            doctors.append(doc)
            users.append(doc)
            
        nurses = []
        for i in range(20):
            nurse = User(email=fake.unique.email(), hashed_password="pw", role=UserRole.nurse, first_name=fake.first_name(), last_name=fake.last_name())
            session.add(nurse)
            nurses.append(nurse)
            users.append(nurse)
            
        await session.commit()

        # 2. Staff (for HR) - also set basic shift windows for doctors
        staff_members = []
        for user in users:
            # Simple mapping of department/shift by role to create variation in doctors_on_duty
            base_department = "General"
            shift_start = None
            shift_end = None
            if user.role == UserRole.doctor:
                base_department = "Cardiology"
                # Morning shift for some, evening for others
                if random.random() < 0.5:
                    shift_start = "08:00"
                    shift_end = "16:00"
                else:
                    shift_start = "16:00"
                    shift_end = "23:00"
            elif user.role == UserRole.nurse:
                base_department = "ICU"

            staff = Staff(
                name=f"{user.first_name} {user.last_name}",
                role=user.role.value,
                department=base_department,
                shift_start=shift_start,
                shift_end=shift_end,
            )
            session.add(staff)
            staff_members.append(staff)
        await session.commit()

        # 3. Departments
        depts = []
        # Include core department names that match the overview aggregations
        core_departments = ["Cardiology", "Neurology", "Emergency", "ICU", "Pediatrics", "General"]
        for d in core_departments:
            dept = Department(name=f"{d}_{fake.unique.random_number(digits=6)}", description=f"{d} Department")
            session.add(dept)
            depts.append(dept)
        await session.commit()

        # 4. Ward Details
        wards = []
        for dept in depts:
            # Use a human-friendly ward name, but keep a clear base label
            base_label = dept.name.split("_", 1)[0]  # e.g. "ICU", "Emergency", "General"
            ward = WardDetail(ward_name=f"{base_label} Ward", capacity=30, department_id=dept.id)
            session.add(ward)
            wards.append(ward)
        await session.commit()

        # 5. Beds
        beds = []
        for ward in wards:
            base_label = ward.ward_name.split(" ", 1)[0]  # "ICU", "Emergency", "General", etc.
            for i in range(1, 11):
                # Bed.ward will use the base label so overview aggregations by ward name work correctly
                bed = Bed(
                    number=f"{base_label[:3]}-{fake.unique.random_number(digits=6)}",
                    ward=base_label,
                    status=random.choice(list(BedStatus)),
                )
                session.add(bed)
                beds.append(bed)
        await session.commit()

        # 6. Patients
        patients = []
        for _ in range(200):
            patient = Patient(name=fake.name(), age=random.randint(1, 90), gender=random.choice(['M', 'F']), contact=fake.phone_number(), address=fake.address(), blood_group=random.choice(['A+', 'O+']))
            session.add(patient)
            patients.append(patient)
        await session.commit()

        # 7. Admissions
        # Spread admissions across the last ~60 days and randomly discharge some patients
        admissions = []
        now = datetime.utcnow()
        for patient in patients[:100]:
            admission_date = fake.date_time_between(start_date="-60d", end_date="-5d")
            discharge_date = None
            # ~60% of patients get discharged a few days after admission
            if random.random() < 0.6:
                discharge_offset = random.randint(1, 20)
                discharge_candidate = admission_date + timedelta(days=discharge_offset)
                # Some may still be admitted today (no discharge if in the future)
                if discharge_candidate <= now:
                    discharge_date = discharge_candidate

            adm = Admission(
                patient_id=patient.id,
                bed_id=random.choice(beds).id,
                admission_date=admission_date,
                discharge_date=discharge_date,
            )
            session.add(adm)
            admissions.append(adm)
        await session.commit()

        # 8. ICU Details
        for adm in admissions[:20]:
            icu = ICUDetail(admission_id=adm.id, ventilator_used=random.choice([True, False]), days_in_icu=random.randint(1, 10))
            session.add(icu)
        await session.commit()

        # 9. Vitals, Alerts, Emergency Logs, Categorizations
        vitals = []
        for patient in patients[:50]:
            for _ in range(5):
                is_crit = random.random() > 0.8
                cond = "Emergency" if is_crit else ("Critical" if random.random() > 0.5 else "Normal")
                hr = random.randint(110, 150) if cond == "Emergency" else random.randint(60, 100)

                # Distribute vitals over the last 30 days
                recorded_at = fake.date_time_between(start_date="-30d", end_date="now")
                vital = Vital(
                    patient_id=patient.id,
                    recorded_by=random.choice(nurses).id,
                    heart_rate=hr,
                    condition_level=cond,
                    recorded_at=recorded_at,
                )
                session.add(vital)
                vitals.append(vital)

                if cond != "Normal":
                    alert_time = fake.date_time_between(start_date="-30d", end_date="now")
                    alert = Alert(
                        patient_id=patient.id,
                        type="Vitals",
                        message=f"{cond} vitals detected",
                        severity=AlertSeverity.critical,
                    )
                    # Override created_at to spread alerts over time
                    alert.created_at = alert_time
                    session.add(alert)
                    await session.flush()
                    if cond == "Emergency":
                        elog = EmergencyLog(
                            patient_id=patient.id,
                            alert_id=alert.id,
                            action_taken="Dispatched team",
                        )
                        elog.created_at = alert_time
                        session.add(elog)

                cat = Categorization(
                    patient_id=patient.id,
                    previous_condition="Normal",
                    new_condition=cond,
                    categorized_by=random.choice(doctors).id,
                )
                session.add(cat)
        await session.commit()

        # 10. Appointments & Visits
        for patient in patients[50:100]:
            app = Appointment(patient_id=patient.id, doctor_id=random.choice(doctors).id, appointment_date=fake.date_time_this_month())
            session.add(app)
            vis = Visit(patient_id=patient.id, doctor_id=random.choice(doctors).id, notes="Routine checkup")
            session.add(vis)
        await session.commit()

        # 11. Pharmacy, Med Categories, Prescriptions
        med_cats = []
        for c in ["Painkillers", "Antibiotics", "Vitamins"]:
            mc = MedicineCategory(name=f"{c}_{fake.unique.random_number(digits=6)}")
            session.add(mc)
            med_cats.append(mc)
        await session.commit()
        
        pharm_stock = []
        for i in range(20):
            ps = PharmacyStock(medicine_name=fake.word(), quantity=random.randint(10, 100), unit_price=random.uniform(5.0, 50.0))
            session.add(ps)
            pharm_stock.append(ps)
        await session.commit()

        for patient in patients[:30]:
            presc = Prescription(patient_id=patient.id, doctor_id=random.choice(doctors).id, medicine_id=random.choice(pharm_stock).id, dosage="10mg", frequency="Twice daily", start_date=fake.date_this_month())
            session.add(presc)
        await session.commit()

        # 12. Laboratory
        lab_cats = []
        for c in ["Hematology", "Pathology", "Radiology"]:
            lc = LabCategory(name=f"{c}_{fake.unique.random_number(digits=6)}")
            session.add(lc)
            lab_cats.append(lc)
        await session.commit()

        for patient in patients[:30]:
            lr = LabRequest(patient_id=patient.id, doctor_id=random.choice(doctors).id, lab_category_id=random.choice(lab_cats).id)
            session.add(lr)
            lres = LaboratoryResult(patient_id=patient.id, test_name="Blood Test", result_value="Normal")
            session.add(lres)
        await session.commit()

        # 13. Billing & Transactions
        # Spread billings across the last 30 days and randomize paid/pending for revenue variation
        for patient in patients[:40]:
            bill_date = fake.date_time_between(start_date="-30d", end_date="now")
            bill_status = random.choice(list(BillingStatus))
            bill = Billing(
                patient_id=patient.id,
                amount=random.uniform(100, 1000),
                status=bill_status,
                date=bill_date,
            )
            session.add(bill)
            await session.flush()
            bi = BillItem(billing_id=bill.id, description="Consultation", amount=50.0)
            session.add(bi)
            txn = Transaction(billing_id=bill.id, payment_method="Credit Card", amount_paid=50.0)
            session.add(txn)
        await session.commit()

        # 14. Inventory
        for d in depts:
            inv = InventoryItem(item_name="Syringes", quantity=500, department_id=d.id)
            session.add(inv)
        await session.commit()

        # 15. HR (Attendance & Shifts)
        for s in staff_members[:10]:
            att = Attendance(staff_id=s.id, date=fake.date_this_month(), status=AttendanceStatus.present)
            session.add(att)
            shf = Shift(staff_id=s.id, date=fake.date_this_month(), shift_type=ShiftType.morning)
            session.add(shf)
        await session.commit()

        # 16. Assignments
        for patient in patients[:20]:
            da = DoctorAssignment(doctor_id=random.choice(doctors).id, patient_id=patient.id, assigned_date=fake.date_this_month())
            session.add(da)
        for w in wards:
            na = NurseAssignment(nurse_id=random.choice(nurses).id, ward_id=w.id, assigned_date=fake.date_this_month(), shift="morning")
            session.add(na)
        await session.commit()

        # 17. Treatment Plans & Discharge
        for patient in patients[:10]:
            tp = TreatmentPlan(patient_id=patient.id, doctor_id=random.choice(doctors).id, plan_details="Rest and hydration", start_date=fake.date_this_month())
            session.add(tp)
        for adm in admissions[:10]:
            ds = DischargeSummary(admission_id=adm.id, summary="Recovered fully")
            session.add(ds)
        await session.commit()

        # 18. Analytics & Audit
        fc = Forecast(metric_name="Admissions", forecast_date=fake.date_time_this_month(), value=15.5)
        session.add(fc)
        
        al = AuditLog(user_id=admin.id, action="CREATE", table_name="patients", record_id=1)
        session.add(al)
        
        await session.commit()
        print("Data for all 32 tables successfully generated.")

if __name__ == "__main__":
    asyncio.run(create_dummy_data())