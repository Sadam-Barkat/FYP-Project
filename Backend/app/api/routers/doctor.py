"""
Doctor API: list assigned patients, view vitals (nurse-updated; real-time via WebSocket),
and discharge patients (admin dashboard updates via WebSocket).

All endpoints require authentication and doctor role. Under /api/doctor.
When nurse updates vitals, frontend subscribes to vitals_updated. When doctor discharges,
backend broadcasts patient_discharged so admin (and nurse) dashboards can refetch.
"""

from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import broadcast_admin_data_changed, manager as ws_manager
from app.database import get_db
from app.models.admission import Admission
from app.models.alert import Alert
from app.models.billing_signal import BillingServiceSignal
from app.models.assignments import DoctorAssignment, NursePatientAssignment
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.vital import Vital
from app.api.routers.auth import get_current_user
from app.schemas.doctor import (
    ConsultationCompleteRequest,
    ConsultationCompleteResponse,
    DischargeResponse,
    DoctorPatientOption,
    VitalRecordResponse,
)

router = APIRouter(prefix="/api/doctor", tags=["doctor"])


def require_doctor(current_user: User = Depends(get_current_user)) -> User:
    """Ensure the current user is a doctor; otherwise 403."""
    if current_user.role != UserRole.doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor role required.",
        )
    return current_user


async def _ensure_patient_assigned_to_doctor(
    doctor_id: int,
    patient_id: int,
    db: AsyncSession,
) -> None:
    """Raise 404 if the patient is not assigned to this doctor (active assignment)."""
    stmt = select(DoctorAssignment).where(
        DoctorAssignment.doctor_id == doctor_id,
        DoctorAssignment.patient_id == patient_id,
        DoctorAssignment.status == "active",
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not assigned to you or assignment is inactive.",
        )


# ----- Assigned patients -----


@router.get("/patients", response_model=List[DoctorPatientOption])
async def list_assigned_patients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
) -> List[DoctorPatientOption]:
    """
    List patients assigned to the current doctor (active assignments only).
    Nurse-recorded vitals for these patients can be viewed via GET .../vitals;
    when nurse updates vitals, frontend should subscribe to vitals_updated for real-time refresh.
    """
    stmt = (
        select(Patient.id, Patient.name, Patient.age)
        .join(DoctorAssignment, DoctorAssignment.patient_id == Patient.id)
        .where(
            DoctorAssignment.doctor_id == current_user.id,
            DoctorAssignment.status == "active",
        )
        .order_by(Patient.name)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        DoctorPatientOption(
            id=row.id,
            name=row.name,
            age=int(row.age) if row.age is not None else 0,
        )
        for row in rows
    ]


# ----- Vitals for an assigned patient (nurse-updated; real-time via vitals_updated) -----


@router.get("/patients/{patient_id}/vitals", response_model=List[VitalRecordResponse])
async def list_patient_vitals(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
) -> List[VitalRecordResponse]:
    """
    List vital records for a patient. Only allowed if the patient is assigned to the current doctor.
    Vitals are recorded by nurses; when nurse adds/updates vitals, backend broadcasts vitals_updated
    so doctor dashboard can refetch for real-time display.
    """
    await _ensure_patient_assigned_to_doctor(current_user.id, patient_id, db)
    stmt = (
        select(Vital)
        .where(Vital.patient_id == patient_id)
        .order_by(Vital.recorded_at.desc())
    )
    result = await db.execute(stmt)
    vitals = result.scalars().all()
    return [
        VitalRecordResponse(
            id=v.id,
            patient_id=v.patient_id,
            recorded_by=v.recorded_by,
            recorded_at=v.recorded_at,
            heart_rate=v.heart_rate,
            blood_pressure_sys=v.blood_pressure_sys,
            blood_pressure_dia=v.blood_pressure_dia,
            spo2=v.spo2,
            temperature=v.temperature,
            respiratory_rate=v.respiratory_rate,
            condition_level=v.condition_level,
        )
        for v in vitals
    ]


# ----- Discharge patient (broadcasts patient_discharged for admin / nurse real-time) -----


@router.post("/patients/{patient_id}/discharge", response_model=DischargeResponse)
async def discharge_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
) -> DischargeResponse:
    """
    Discharge a patient: set active admission discharge_date and mark doctor/nurse
    assignments as discharged. Patient is removed from doctor and nurse assigned lists.
    Broadcasts patient_discharged so admin dashboard (overview, patients & beds) and
    nurse dashboard can refetch in real time.
    """
    await _ensure_patient_assigned_to_doctor(current_user.id, patient_id, db)

    now = datetime.utcnow()

    # Set discharge_date on any active admission for this patient
    adm_res = await db.execute(
        update(Admission)
        .where(Admission.patient_id == patient_id, Admission.discharge_date.is_(None))
        .values(discharge_date=now)
    )
    if getattr(adm_res, "rowcount", None) and adm_res.rowcount > 0:
        db.add(
            BillingServiceSignal(
                patient_id=patient_id,
                signal_type="discharge",
                reference_id=None,
                detail="Patient discharged; finance finalizes bed/services and confirms payment.",
            )
        )

    # Mark doctor and nurse assignments for this patient as discharged (so they drop off lists)
    await db.execute(
        update(DoctorAssignment)
        .where(DoctorAssignment.patient_id == patient_id)
        .values(status="discharged")
    )
    await db.execute(
        update(NursePatientAssignment)
        .where(NursePatientAssignment.patient_id == patient_id)
        .values(status="discharged")
    )

    await db.commit()

    await ws_manager.broadcast({
        "type": "patient_discharged",
        "patient_id": patient_id,
    })
    await broadcast_admin_data_changed("doctor_discharge")

    return DischargeResponse(
        message="Patient discharged successfully. Admin and nurse dashboards will update in real time.",
        patient_id=patient_id,
    )


@router.post(
    "/patients/{patient_id}/consultation-complete",
    response_model=ConsultationCompleteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_consultation_complete(
    patient_id: int,
    body: ConsultationCompleteRequest = ConsultationCompleteRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
) -> ConsultationCompleteResponse:
    """
    Record that a consultation occurred (care event only). Billing amounts are added in Finance.
    """
    await _ensure_patient_assigned_to_doctor(current_user.id, patient_id, db)
    detail = (body.notes or "").strip() or "Consultation completed; finance may add consultation fee."
    db.add(
        BillingServiceSignal(
            patient_id=patient_id,
            signal_type="consultation_completed",
            reference_id=current_user.id,
            detail=detail[:512],
        )
    )
    await db.commit()
    await broadcast_admin_data_changed("doctor_consultation")
    return ConsultationCompleteResponse(
        message="Consultation recorded. Finance can add the consultation charge when ready.",
        patient_id=patient_id,
    )


@router.get("/analytics")
async def get_doctor_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
) -> dict:
    """
    Returns real aggregated analytics for the logged-in doctor.
    Queries live data — no mock values, no randomness.
    """
    doctor_id = current_user.id
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # --- 1. Get all patients currently assigned to this doctor ---
    active_assignments_res = await db.execute(
        select(DoctorAssignment.patient_id).where(
            DoctorAssignment.doctor_id == doctor_id,
            DoctorAssignment.status == "active",
        )
    )
    active_patient_ids = [int(pid) for (pid,) in active_assignments_res.all()]
    total_treated = len(active_patient_ids)

    # --- 2. Recent discharges (last 30 days) for this doctor ---
    discharged_count_res = await db.execute(
        select(func.count(func.distinct(Admission.id)))
        .select_from(Admission)
        .join(
            DoctorAssignment,
            and_(
                DoctorAssignment.patient_id == Admission.patient_id,
                DoctorAssignment.doctor_id == doctor_id,
            ),
        )
        .where(
            Admission.discharge_date.is_not(None),
            Admission.discharge_date >= thirty_days_ago,
        )
    )
    discharges_count = int(discharged_count_res.scalar_one() or 0)

    discharged_res = await db.execute(
        select(Admission, Patient)
        .join(Patient, Admission.patient_id == Patient.id)
        .join(
            DoctorAssignment,
            and_(
                DoctorAssignment.patient_id == Admission.patient_id,
                DoctorAssignment.doctor_id == doctor_id,
            ),
        )
        .where(
            Admission.discharge_date.is_not(None),
            Admission.discharge_date >= thirty_days_ago,
        )
        .order_by(Admission.discharge_date.desc())
        .limit(10)
    )
    discharged_rows = discharged_res.all()

    recent_discharges = []
    for row in discharged_rows:
        adm: Admission = row.Admission
        pat: Patient = row.Patient
        discharge_date = getattr(adm, "discharge_date", None)
        if isinstance(discharge_date, datetime):
            date_str = discharge_date.strftime("%Y-%m-%d")
        elif discharge_date:
            date_str = str(discharge_date)[:10]
        else:
            date_str = "N/A"
        recent_discharges.append({
            "name": (getattr(pat, "name", None) or "").strip() or f"Patient #{pat.id}",
            "date": date_str,
            "outcome": "Discharged",
        })

    # --- 3. Avg recovery days (admission to discharge, last 30 days) ---
    avg_recovery = 0.0
    if discharged_rows:
        recovery_days = []
        for row in discharged_rows:
            adm: Admission = row.Admission
            adm_dt = getattr(adm, "admission_date", None)
            dis_dt = getattr(adm, "discharge_date", None)
            if not adm_dt or not dis_dt:
                continue
            if isinstance(adm_dt, datetime) and isinstance(dis_dt, datetime):
                days = (dis_dt - adm_dt).days
            else:
                try:
                    days = (dis_dt - adm_dt).days  # type: ignore[operator]
                except Exception:
                    continue
            if days >= 0:
                recovery_days.append(int(days))
        if recovery_days:
            avg_recovery = round(sum(recovery_days) / len(recovery_days), 1)

    # --- 4. Recovery rate ---
    # = discharges / (discharges + active) * 100
    total_cases = discharges_count + total_treated
    recovery_rate = round((discharges_count / total_cases) * 100) if total_cases > 0 else 0

    # --- 5. Condition split from latest vitals ---
    normal_count = 0
    critical_count = 0
    emergency_count = 0

    if active_patient_ids:
        vitals_res = await db.execute(
            select(Vital)
            .where(Vital.patient_id.in_(active_patient_ids))
            .order_by(Vital.recorded_at.desc())
        )
        latest_vitals: dict[int, Vital] = {}
        for v in vitals_res.scalars().all():
            if v.patient_id not in latest_vitals:
                latest_vitals[int(v.patient_id)] = v

        for pid in active_patient_ids:
            v = latest_vitals.get(int(pid))
            level = (getattr(v, "condition_level", None) or "").strip().lower() if v else ""
            if not level:
                normal_count += 1
            elif level == "emergency":
                emergency_count += 1
            elif level == "critical":
                critical_count += 1
            else:
                normal_count += 1

    total_for_pct = normal_count + critical_count + emergency_count
    if total_for_pct > 0:
        conditions = {
            "normal": round((normal_count / total_for_pct) * 100),
            "critical": round((critical_count / total_for_pct) * 100),
            "emergency": round((emergency_count / total_for_pct) * 100),
        }
    else:
        conditions = {"normal": 100, "critical": 0, "emergency": 0}

    # --- 6. Alerts resolved today by this doctor's patients ---
    alerts_resolved = 0
    if active_patient_ids:
        resolved_res = await db.execute(
            select(func.count(Alert.id)).where(
                Alert.patient_id.in_(active_patient_ids),
                Alert.is_resolved == True,
                Alert.created_at >= today_start,
            )
        )
        alerts_resolved = int(resolved_res.scalar_one() or 0)

    # --- 7. Treatment trend (last 5 weeks) ---
    treatment_trend = []
    for i in range(4, -1, -1):
        week_start = now - timedelta(weeks=i + 1)
        week_end = now - timedelta(weeks=i)
        week_res = await db.execute(
            select(func.count(func.distinct(Admission.id)))
            .select_from(Admission)
            .join(
                DoctorAssignment,
                and_(
                    DoctorAssignment.patient_id == Admission.patient_id,
                    DoctorAssignment.doctor_id == doctor_id,
                ),
            )
            .where(
                Admission.admission_date >= week_start,
                Admission.admission_date < week_end,
            )
        )
        count = int(week_res.scalar_one() or 0)
        treatment_trend.append({
            "week": f"Week {5 - i}",
            "count": count,
        })

    return {
        "totalTreated": total_treated,
        "discharges": discharges_count,
        "avgRecovery": avg_recovery,
        "recoveryRate": recovery_rate,
        "alertsResolved": alerts_resolved,
        "conditions": conditions,
        "treatmentTrend": treatment_trend,
        "recentDischarges": recent_discharges,
    }
