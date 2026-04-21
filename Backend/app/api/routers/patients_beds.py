from datetime import datetime, timedelta, time, date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, and_, cast, func, or_, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import broadcast_admin_data_changed
from app.database import get_db
from app.models.bed import Bed, BedStatus
from app.models.admission import Admission
from app.models.alert import Alert, AlertSeverity
from app.models.patient import Patient
from app.models.vital import Vital
from app.models.laboratory import LaboratoryResult
from app.models.billing import Billing
from app.models.assignments import DoctorAssignment, NursePatientAssignment
from app.models.laboratory_extra import LabRequest
from app.models.clinical import Appointment, Visit, Prescription, TreatmentPlan
from app.models.analytics import Categorization, EmergencyLog

router = APIRouter(prefix="/api", tags=["patients_beds"])


@router.get("/patients-beds-overview")
async def get_patients_beds_overview(
    date_param: Optional[date] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Backend for the Admin 'Patients & Beds Overview' page.

    Returns capacity/occupancy cards, bed occupancy by department, and
    admissions vs discharges trend for the 7-day window ending on selected date.
    """
    try:
        # ----- Resolve date window -----
        now = datetime.utcnow()
        base_date = date_param or now.date()
        day_start = datetime.combine(base_date, time.min)
        day_end = datetime.combine(base_date, time.max)
        seven_days_ago = base_date - timedelta(days=6)

        # ----- Active admissions snapshot for selected date -----
        # Admissions that overlap the selected date
        active_admissions_subq = (
            select(Admission.id, Admission.bed_id)
            .where(
                and_(
                    Admission.admission_date <= day_end,
                    or_(
                        Admission.discharge_date.is_(None),
                        Admission.discharge_date >= day_start,
                    ),
                )
            )
            .subquery()
        )

        # ----- Total capacity (all beds) -----
        total_capacity_result = await db.execute(
            select(func.count(Bed.id)).select_from(Bed)
        )
        total_capacity = total_capacity_result.scalar_one() or 0

        # ----- Total patients (all registered in system) -----
        total_patients_result = await db.execute(select(func.count(Patient.id)))
        total_patients = total_patients_result.scalar_one() or 0

        # ----- Occupied beds on selected date -----
        # Beds that are marked occupied AND have an active admission that day
        occupied_beds_result = await db.execute(
            select(func.count(func.distinct(Bed.id)))
            .select_from(Bed)
            .join(
                active_admissions_subq,
                Bed.id == active_admissions_subq.c.bed_id,
            )
            .where(Bed.status == BedStatus.occupied)
        )
        occupied_beds = occupied_beds_result.scalar_one() or 0

        available_beds = max(int(total_capacity) - int(occupied_beds), 0)
        occupancy_percentage = (
            float(occupied_beds) / float(total_capacity) * 100.0
            if total_capacity > 0
            else 0.0
        )

        # ----- Emergency cases on selected date -----
        emergency_cases_result = await db.execute(
            select(func.count())
            .select_from(Alert)
            .where(
                and_(
                    Alert.severity == AlertSeverity.critical,
                    Alert.created_at >= day_start,
                    Alert.created_at <= day_end,
                )
            )
        )
        emergency_cases = emergency_cases_result.scalar_one() or 0

        # ----- Critical condition cases (high severity) on selected date -----
        critical_condition_result = await db.execute(
            select(func.count())
            .select_from(Alert)
            .where(
                and_(
                    Alert.severity == AlertSeverity.high,
                    Alert.created_at >= day_start,
                    Alert.created_at <= day_end,
                )
            )
        )
        critical_condition_cases = critical_condition_result.scalar_one() or 0

        # ----- Bed occupancy by department on selected date -----
        # Total beds per ward
        total_by_ward_result = await db.execute(
            select(Bed.ward, func.count(Bed.id))
            .group_by(Bed.ward)
        )
        total_by_ward = {ward: total for ward, total in total_by_ward_result.all()}

        # Occupied beds per ward (active admissions snapshot)
        occupied_by_ward_result = await db.execute(
            select(Bed.ward, func.count(func.distinct(Bed.id)))
            .join(
                active_admissions_subq,
                Bed.id == active_admissions_subq.c.bed_id,
            )
            .where(Bed.status == BedStatus.occupied)
            .group_by(Bed.ward)
        )
        occupied_by_ward = {
            ward: occupied for ward, occupied in occupied_by_ward_result.all()
        }

        bed_occupancy_by_department: List[Dict[str, Any]] = []
        for ward, total in total_by_ward.items():
            occupied = int(occupied_by_ward.get(ward, 0))
            bed_occupancy_by_department.append(
                {
                    "department": ward,
                    "occupied": occupied,
                    "total": int(total),
                }
            )

        # ----- Admissions & discharges trend (past week ending on selected date) -----
        # Admissions grouped by calendar date
        admissions_result = await db.execute(
            select(
                cast(Admission.admission_date, Date).label("day"),
                func.count().label("count"),
            )
            .where(
                and_(
                    cast(Admission.admission_date, Date) >= seven_days_ago,
                    cast(Admission.admission_date, Date) <= base_date,
                )
            )
            .group_by("day")
        )
        admissions_by_day = {
            row.day: row.count for row in admissions_result
        }

        # Discharges grouped by calendar date
        discharges_result = await db.execute(
            select(
                cast(Admission.discharge_date, Date).label("day"),
                func.count().label("count"),
            )
            .where(
                and_(
                    Admission.discharge_date.is_not(None),
                    cast(Admission.discharge_date, Date) >= seven_days_ago,
                    cast(Admission.discharge_date, Date) <= base_date,
                )
            )
            .group_by("day")
        )
        discharges_by_day = {
            row.day: row.count for row in discharges_result
        }

        admissions_discharges_trend: List[Dict[str, Any]] = []
        for i in range(7):
            day = seven_days_ago + timedelta(days=i)
            weekday_label = day.strftime("%a")  # Mon, Tue, ...
            admissions_count = int(admissions_by_day.get(day, 0))
            discharges_count = int(discharges_by_day.get(day, 0))
            admissions_discharges_trend.append(
                {
                    "day": weekday_label,
                    "admissions": admissions_count,
                    "discharges": discharges_count,
                }
            )


        # ----- Previous 7 Days (for comparison) -----
        fourteen_days_ago = base_date - timedelta(days=13)
        previous_seven_days_end = base_date - timedelta(days=7)

        prev_admissions_result = await db.execute(
            select(func.count())
            .select_from(Admission)
            .where(
                and_(
                    cast(Admission.admission_date, Date) >= fourteen_days_ago,
                    cast(Admission.admission_date, Date) <= previous_seven_days_end,
                )
            )
        )
        prev_admissions = prev_admissions_result.scalar_one() or 0

        prev_discharges_result = await db.execute(
            select(func.count())
            .select_from(Admission)
            .where(
                and_(
                    Admission.discharge_date.is_not(None),
                    cast(Admission.discharge_date, Date) >= fourteen_days_ago,
                    cast(Admission.discharge_date, Date) <= previous_seven_days_end,
                )
            )
        )
        prev_discharges = prev_discharges_result.scalar_one() or 0

        return {

            "total_capacity": int(total_capacity),
            "total_patients": int(total_patients),
            "occupied_beds": int(occupied_beds),
            "occupancy_percentage": occupancy_percentage,
            "available_beds": int(available_beds),
            "emergency_cases": int(emergency_cases),
            "critical_condition_cases": int(critical_condition_cases),
            "bed_occupancy_by_department": bed_occupancy_by_department,
            "admissions_discharges_trend": admissions_discharges_trend,
            "previous_7_days_admissions": int(prev_admissions),
            "previous_7_days_discharges": int(prev_discharges),
            "selected_date": base_date.isoformat(),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load patients & beds overview: {exc}",
        )


@router.get("/user-management/patients")
async def get_user_management_patients(
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Backend for the Admin 'User Management' page — Patients tab.

    Returns a simple list of patients for management UI:
    id, name, age, gender, contact, address.
    """
    try:
        result = await db.execute(
            select(
                Patient.id,
                Patient.name,
                Patient.age,
                Patient.gender,
                Patient.contact,
                Patient.address,
            ).order_by(Patient.id)
        )
        rows = result.all()
        patients: List[Dict[str, Any]] = []
        for row in rows:
            patients.append(
                {
                    "id": row.id,
                    "name": row.name,
                    "age": int(row.age) if row.age is not None else None,
                    "gender": row.gender,
                    "contact": row.contact,
                    "address": row.address,
                }
            )
        return patients
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load user management patients: {exc}",
        )


@router.delete("/user-management/patients/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_management_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a patient for the User Management page.

    Removes the patient and all related rows so the patient disappears from both
    doctor and nurse dashboards (assignments) and satisfies all foreign key constraints.
    """
    try:
        # Make sure patient exists
        result = await db.execute(select(Patient.id).where(Patient.id == patient_id))
        exists = result.scalar_one_or_none()
        if not exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

        # Delete dependent records first (order matters for FKs)
        # Assignments: so patient is removed from doctor and nurse dashboards
        await db.execute(delete(DoctorAssignment).where(DoctorAssignment.patient_id == patient_id))
        await db.execute(delete(NursePatientAssignment).where(NursePatientAssignment.patient_id == patient_id))
        # Lab, clinical, analytics
        await db.execute(delete(LabRequest).where(LabRequest.patient_id == patient_id))
        await db.execute(delete(Appointment).where(Appointment.patient_id == patient_id))
        await db.execute(delete(Visit).where(Visit.patient_id == patient_id))
        await db.execute(delete(Prescription).where(Prescription.patient_id == patient_id))
        await db.execute(delete(TreatmentPlan).where(TreatmentPlan.patient_id == patient_id))
        await db.execute(delete(Categorization).where(Categorization.patient_id == patient_id))
        await db.execute(delete(EmergencyLog).where(EmergencyLog.patient_id == patient_id))
        # Core patient data
        await db.execute(delete(Vital).where(Vital.patient_id == patient_id))
        await db.execute(delete(Alert).where(Alert.patient_id == patient_id))
        await db.execute(delete(LaboratoryResult).where(LaboratoryResult.patient_id == patient_id))
        await db.execute(delete(Billing).where(Billing.patient_id == patient_id))
        await db.execute(delete(Admission).where(Admission.patient_id == patient_id))
        await db.execute(delete(Patient).where(Patient.id == patient_id))
        await db.commit()
        await broadcast_admin_data_changed("patient_deleted")
    except HTTPException:
        # Re-raise explicit HTTP errors
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete patient: {exc}",
        )

