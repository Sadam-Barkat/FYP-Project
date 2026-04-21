"""
Admin Patient Intelligence — aggregated active patients, vitals, labs, NEWS2, predictions.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.auth import get_current_user
from app.core.websocket_manager import broadcast_admin_data_changed, manager as ws_manager
from app.database import get_db
from app.models.admission import Admission
from app.models.alert import Alert, AlertSeverity
from app.models.assignments import DoctorAssignment, NursePatientAssignment
from app.models.bed import Bed
from app.models.laboratory import LaboratoryResult
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.vital import Vital

router = APIRouter(prefix="/api", tags=["patient-intelligence"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return user


def calculate_news2(
    heart_rate: Optional[int],
    systolic_bp: Optional[int],
    temperature: Optional[float],
    spo2: Optional[int],
    respiratory_rate: Optional[int],
) -> int:
    """NEWS2 aggregate score (0–20 scale used here maps subscores per NHS-style bands)."""
    rr = int(respiratory_rate) if respiratory_rate is not None else 16
    sp = int(spo2) if spo2 is not None else 98
    temp = float(temperature) if temperature is not None else 37.0
    sys_bp = int(systolic_bp) if systolic_bp is not None else 120
    hr = int(heart_rate) if heart_rate is not None else 75

    score = 0

    if rr <= 8:
        score += 3
    elif rr <= 11:
        score += 1
    elif rr <= 20:
        score += 0
    elif rr <= 24:
        score += 2
    else:
        score += 3

    if sp <= 91:
        score += 3
    elif sp <= 93:
        score += 2
    elif sp <= 95:
        score += 1
    else:
        score += 0

    if temp <= 35.0:
        score += 3
    elif temp <= 36.0:
        score += 1
    elif temp <= 38.0:
        score += 0
    elif temp <= 39.0:
        score += 1
    else:
        score += 2

    if sys_bp <= 90:
        score += 3
    elif sys_bp <= 100:
        score += 2
    elif sys_bp <= 110:
        score += 1
    elif sys_bp <= 219:
        score += 0
    else:
        score += 3

    if hr <= 40:
        score += 3
    elif hr <= 50:
        score += 1
    elif hr <= 90:
        score += 0
    elif hr <= 110:
        score += 1
    elif hr <= 130:
        score += 2
    else:
        score += 3

    return score


def news2_risk_level(score: int) -> str:
    if score <= 4:
        return "LOW"
    if score <= 6:
        return "MEDIUM"
    return "HIGH"


def deterioration_risk_label(
    current_score: int, previous_score: Optional[int]
) -> str:
    if previous_score is None:
        return "STABLE"
    delta = current_score - previous_score
    if delta >= 2:
        return "LIKELY TO DETERIORATE"
    if delta == 1:
        return "MONITOR CLOSELY"
    return "STABLE"


def predicted_condition_24h(
    score: int, deterioration_risk: str, condition_level: str
) -> str:
    cl = (condition_level or "").lower().strip()
    if score >= 7 and deterioration_risk == "LIKELY TO DETERIORATE":
        return "CRITICAL"
    if score >= 5 and deterioration_risk == "LIKELY TO DETERIORATE":
        return "HIGH RISK"
    if score >= 5:
        return "NEEDS ATTENTION"
    return "STABLE"


def estimated_discharge_string(condition_level: str, score: int) -> str:
    cl = (condition_level or "").lower().strip()
    if cl == "emergency":
        return "Indeterminate"
    if cl == "critical" or score >= 7:
        return "10+ days"
    if cl == "observation":
        return "5-7 days"
    if cl == "stable":
        if score <= 2:
            return "1-2 days"
        if score <= 4:
            return "3-5 days"
    return "3-5 days"


def ai_risk_flag(score: int, deterioration_risk: str) -> bool:
    return score >= 7 or deterioration_risk == "LIKELY TO DETERIORATE"


def _user_display_name(u: Optional[User]) -> str:
    if u is None:
        return ""
    return f"{u.first_name} {u.last_name}".strip()


async def _load_users(db: AsyncSession, user_ids: List[int]) -> Dict[int, User]:
    if not user_ids:
        return {}
    res = await db.execute(select(User).where(User.id.in_(user_ids)))
    users = res.scalars().all()
    return {u.id: u for u in users}


@router.get("/patient-intelligence")
async def get_patient_intelligence(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Dict[str, Any]:
    now = datetime.utcnow()
    today = now.date()
    day_start = datetime.combine(today, time.min)
    day_end = datetime.combine(today, time.max)

    adm_res = await db.execute(
        select(Admission, Patient, Bed)
        .join(Patient, Admission.patient_id == Patient.id)
        .join(Bed, Admission.bed_id == Bed.id)
        .where(Admission.discharge_date.is_(None))
        .order_by(Patient.name)
    )
    adm_rows = adm_res.all()
    patient_ids = [int(row.Patient.id) for row in adm_rows]

    discharged_res = await db.execute(
        select(func.count()).select_from(Admission).where(
            Admission.discharge_date.is_not(None),
            Admission.discharge_date >= day_start,
            Admission.discharge_date <= day_end,
        )
    )
    discharged_today = int(discharged_res.scalar_one() or 0)

    vitals_map: Dict[int, List[Vital]] = defaultdict(list)
    if patient_ids:
        vit_stmt = (
            select(Vital)
            .where(Vital.patient_id.in_(patient_ids))
            .order_by(Vital.patient_id, Vital.recorded_at.desc())
        )
        vit_res = await db.execute(vit_stmt)
        for v in vit_res.scalars().all():
            if len(vitals_map[v.patient_id]) < 2:
                vitals_map[v.patient_id].append(v)

    lab_map: Dict[int, Optional[LaboratoryResult]] = {}
    if patient_ids:
        lab_stmt = (
            select(LaboratoryResult)
            .where(LaboratoryResult.patient_id.in_(patient_ids))
            .order_by(
                LaboratoryResult.patient_id,
                LaboratoryResult.collected_at.desc(),
            )
        )
        lab_res = await db.execute(lab_stmt)
        for lab in lab_res.scalars().all():
            if lab.patient_id not in lab_map:
                lab_map[lab.patient_id] = lab

    doctor_by_patient: Dict[int, int] = {}
    if patient_ids:
        doc_stmt = (
            select(DoctorAssignment)
            .where(
                DoctorAssignment.status == "active",
                DoctorAssignment.patient_id.in_(patient_ids),
            )
            .order_by(
                DoctorAssignment.patient_id,
                DoctorAssignment.assigned_date.desc(),
            )
        )
        doc_rows = await db.execute(doc_stmt)
        for da in doc_rows.scalars().all():
            if da.patient_id not in doctor_by_patient:
                doctor_by_patient[da.patient_id] = da.doctor_id

    nurse_by_patient: Dict[int, int] = {}
    if patient_ids:
        nur_stmt = (
            select(NursePatientAssignment)
            .where(
                NursePatientAssignment.status == "active",
                NursePatientAssignment.patient_id.in_(patient_ids),
            )
            .order_by(
                NursePatientAssignment.patient_id,
                NursePatientAssignment.assigned_date.desc(),
            )
        )
        nur_rows = await db.execute(nur_stmt)
        for na in nur_rows.scalars().all():
            if na.patient_id not in nurse_by_patient:
                nurse_by_patient[na.patient_id] = na.nurse_id

    uid_set = set(doctor_by_patient.values()) | set(nurse_by_patient.values())
    users = await _load_users(db, list(uid_set))

    summary_counts = {
        "critical": 0,
        "emergency": 0,
        "stable": 0,
        "observation": 0,
    }

    patients_out: List[Dict[str, Any]] = []

    for row in adm_rows:
        admission: Admission = row.Admission
        patient: Patient = row.Patient
        bed: Bed = row.Bed
        pid = int(patient.id)

        vlist = vitals_map.get(pid, [])
        latest: Optional[Vital] = vlist[0] if vlist else None
        previous: Optional[Vital] = vlist[1] if len(vlist) > 1 else None

        cond_raw = (latest.condition_level if latest else "") or ""
        cond_lower = cond_raw.lower().strip()
        if cond_lower == "critical":
            summary_counts["critical"] += 1
        elif cond_lower == "emergency":
            summary_counts["emergency"] += 1
        elif cond_lower == "stable":
            summary_counts["stable"] += 1
        elif cond_lower == "observation":
            summary_counts["observation"] += 1

        cur_score = calculate_news2(
            latest.heart_rate if latest else None,
            latest.blood_pressure_sys if latest else None,
            latest.temperature if latest else None,
            latest.spo2 if latest else None,
            latest.respiratory_rate if latest else None,
        )
        prev_score: Optional[int] = None
        if previous:
            prev_score = calculate_news2(
                previous.heart_rate,
                previous.blood_pressure_sys,
                previous.temperature,
                previous.spo2,
                previous.respiratory_rate,
            )

        det = deterioration_risk_label(cur_score, prev_score)
        pred_cond = predicted_condition_24h(cur_score, det, cond_raw)
        est_dis = estimated_discharge_string(cond_raw, cur_score)
        risk_lvl = news2_risk_level(cur_score)
        flag = ai_risk_flag(cur_score, det)

        doc_id = doctor_by_patient.get(pid)
        nur_id = nurse_by_patient.get(pid)
        doc_name = _user_display_name(users.get(doc_id)) if doc_id else ""
        nur_name = _user_display_name(users.get(nur_id)) if nur_id else ""

        lab = lab_map.get(pid)
        latest_lab: Optional[Dict[str, Any]] = None
        if lab:
            latest_lab = {
                "test_name": lab.test_name,
                "result_value": lab.result_value,
                "status": lab.status,
                "collected_at": lab.collected_at.isoformat()
                if lab.collected_at
                else None,
            }

        patients_out.append(
            {
                "patient_id": pid,
                "name": patient.name,
                "age": int(patient.age) if patient.age is not None else 0,
                "gender": patient.gender or "",
                "blood_group": patient.blood_group or "",
                "ward": bed.ward or "",
                "bed_number": bed.number or "",
                "admission_date": admission.admission_date.isoformat()
                if admission.admission_date
                else None,
                "assigned_doctor": doc_name,
                "assigned_nurse": nur_name,
                "condition_level": cond_raw or "unknown",
                "vitals": {
                    "heart_rate": latest.heart_rate if latest else None,
                    "systolic_bp": latest.blood_pressure_sys if latest else None,
                    "diastolic_bp": latest.blood_pressure_dia if latest else None,
                    "temperature": float(latest.temperature)
                    if latest and latest.temperature is not None
                    else None,
                    "spo2": latest.spo2 if latest else None,
                    "respiratory_rate": latest.respiratory_rate if latest else None,
                    "recorded_at": latest.recorded_at.isoformat()
                    if latest and latest.recorded_at
                    else None,
                },
                "latest_lab": latest_lab,
                "prediction": {
                    "news2_score": cur_score,
                    "risk_level": risk_lvl,
                    "deterioration_risk": det,
                    "predicted_condition_24h": pred_cond,
                    "estimated_discharge": est_dis,
                    "ai_risk_flag": flag,
                },
            }
        )

    summary = {
        "total_patients": len(patient_ids),
        "critical_count": summary_counts["critical"],
        "emergency_count": summary_counts["emergency"],
        "stable_count": summary_counts["stable"],
        "observation_count": summary_counts["observation"],
        "discharged_today": discharged_today,
    }

    return {"summary": summary, "patients": patients_out}


class AdminAlertCreate(BaseModel):
    patient_id: int = Field(..., ge=1)
    message: Optional[str] = None


@router.post("/alerts")
async def create_admin_urgent_alert(
    body: AdminAlertCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Create an urgent alert from the Patient Intelligence dashboard."""
    p = await db.get(Patient, body.patient_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    msg = (body.message or "").strip() or (
        f"Urgent: Patient Intelligence flagged patient {p.name} (ID {p.id}) for immediate review."
    )
    alert = Alert(
        patient_id=body.patient_id,
        type="Patient Intelligence",
        message=msg,
        severity=AlertSeverity.critical,
        is_resolved=False,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    await ws_manager.broadcast({"type": "patient_intelligence_updated"})
    await broadcast_admin_data_changed("patient_intelligence_alert")
    return {
        "id": alert.id,
        "patient_id": alert.patient_id,
        "message": alert.message,
        "severity": alert.severity.value,
    }
