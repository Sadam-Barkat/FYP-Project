"""
Admin patient intelligence: census, vitals quality metrics, NEWS2 (internal), OpenAI summary.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.auth import get_current_user
from app.database import get_db
from app.models.admission import Admission
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.vital import Vital

router = APIRouter(prefix="/api", tags=["patient-intelligence"])

OPENAI_SYSTEM = (
    "You are a clinical AI assistant for a hospital dashboard. "
    "Be concise, direct, and medically practical. "
    "Always follow the exact SUMMARY / NAMES / SUGGESTION section layout "
    "requested in the user message. "
    "Base every risk judgment ONLY on the patient table and aggregate metrics "
    "provided — no outside assumptions. "
    "From the table, judge severity using NEWS2 together with vitals (not NEWS2 alone). "
    "Time horizon: you may name ONLY 1, 2, 3, 4, 5, 6, or 7 days ahead (pick one window "
    "from the data); never predict beyond 7 days. Prefer the shortest justified window. "
    "In SUMMARY you MUST use explicit integers: say exactly how many patients (e.g. "
    "\"5 patients\", \"6 patients\") and exactly which day window (e.g. \"within 2 days\", "
    "\"within 7 days\") — never use vague phrases like \"some patients\", \"several\", or "
    "\"a few\". "
    "SUMMARY must also say WHAT those patients are in plain clinical terms (e.g. \"are at "
    "elevated risk of deterioration\", \"need closer monitoring\", \"warrant urgent review\") — "
    "not only a count plus a day window. "
    "If you give a specific patient count N in SUMMARY, NAMES must list exactly N distinct "
    "names from the table, one per numbered line; do not invent names. If you cannot match "
    "N to real names, lower N or omit a precise count. "
    "SUGGESTION must be one imperative sentence grounded ONLY in this snapshot (who to watch, "
    "what to verify, bed flow, labs, observation frequency, etc.). Do NOT reuse canned "
    "template lines from instructions; do NOT copy example phrasing; vary wording when the "
    "underlying issue differs."
)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return user


def calculate_news2(
    rr: Optional[int],
    spo2: Optional[int],
    temp: Optional[float],
    sbp: Optional[int],
    hr: Optional[int],
) -> int:
    """NEWS2 aggregate; not returned to API clients."""
    r = int(rr) if rr is not None else 16
    sp = int(spo2) if spo2 is not None else 98
    t = float(temp) if temp is not None else 37.0
    sys_bp = int(sbp) if sbp is not None else 120
    h = int(hr) if hr is not None else 72

    score = 0
    if r <= 8:
        score += 3
    elif r <= 11:
        score += 1
    elif r <= 20:
        score += 0
    elif r <= 24:
        score += 2
    else:
        score += 3

    if sp <= 91:
        score += 3
    elif sp <= 93:
        score += 2
    elif sp <= 95:
        score += 1

    if t <= 35.0:
        score += 3
    elif t <= 36.0:
        score += 1
    elif t <= 38.0:
        score += 0
    elif t <= 39.0:
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

    if h <= 40:
        score += 3
    elif h <= 50:
        score += 1
    elif h <= 90:
        score += 0
    elif h <= 110:
        score += 1
    elif h <= 130:
        score += 2
    else:
        score += 3

    return score


def _hr_normal(v: Optional[int]) -> bool:
    return v is not None and 60 <= v <= 100


def _sbp_normal(v: Optional[int]) -> bool:
    return v is not None and 90 <= v <= 120


def _temp_normal(v: Optional[float]) -> bool:
    return v is not None and 36.1 <= v <= 37.2


def _spo2_normal(v: Optional[int]) -> bool:
    return v is not None and v >= 95


def _rr_normal(v: Optional[int]) -> bool:
    return v is not None and 12 <= v <= 20


def _patient_has_any_abnormal(v: Vital) -> bool:
    checks = [
        (v.heart_rate, _hr_normal),
        (v.blood_pressure_sys, _sbp_normal),
        (v.temperature, _temp_normal),
        (v.spo2, _spo2_normal),
        (v.respiratory_rate, _rr_normal),
    ]
    for val, ok in checks:
        if val is None:
            continue
        if not ok(val):
            return True
    return False


def _score_for_vital(v: Optional[Vital]) -> int:
    if not v:
        return calculate_news2(None, None, None, None, None)
    return calculate_news2(
        v.respiratory_rate,
        v.spo2,
        v.temperature,
        v.blood_pressure_sys,
        v.heart_rate,
    )


def _vital_snapshot(v: Optional[Vital]) -> str:
    if not v:
        return "no vitals on file"
    hr = v.heart_rate if v.heart_rate is not None else "—"
    sp = v.spo2 if v.spo2 is not None else "—"
    t = v.temperature if v.temperature is not None else "—"
    sys_bp = v.blood_pressure_sys if v.blood_pressure_sys is not None else "—"
    rr = v.respiratory_rate if v.respiratory_rate is not None else "—"
    return f"HR={hr} SpO2={sp}% Temp={t}°C BPsys={sys_bp} RR={rr}/min"


def _generate_local_summary(metrics: dict, top_patients: list) -> dict:
    """
    Generates a patient intelligence summary using rule-based templates.
    No external API calls. Uses only the data already computed in this file.
    """
    risk_score = metrics.get("avg_news2_score", 0)
    high_risk_count = metrics.get("high_risk_count", 0)
    total_patients = metrics.get("total_patients", 0)

    # Risk level label
    if risk_score >= 7:
        risk_level = "Critical"
        recommendation = "Immediate clinical review required for flagged patients."
    elif risk_score >= 5:
        risk_level = "High"
        recommendation = "Priority monitoring recommended. Reassess vitals within 2 hours."
    elif risk_score >= 3:
        risk_level = "Moderate"
        recommendation = "Continue standard monitoring. Review flagged cases at next round."
    else:
        risk_level = "Low"
        recommendation = "Patient population is currently stable. Maintain routine monitoring."

    # Top patient names from the already-computed list
    if top_patients:
        names = ", ".join([p.get("name", "Unknown") for p in top_patients[:3]])
        names_line = f"Highest risk patients: {names}."
    else:
        names_line = "No high-risk patients currently flagged."

    summary = (
        f"Current ward risk level is {risk_level} "
        f"(average NEWS2 score: {round(risk_score, 1)}). "
        f"{high_risk_count} of {total_patients} patients are flagged as high risk. "
        f"{names_line} {recommendation}"
    )

    return {
        "summary": summary,
        "risk_level": risk_level,
        "recommendation": recommendation,
        "generated_by": "local_rule_engine",
    }


@router.get("/patient-intelligence")
async def get_patient_intelligence(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Dict[str, Any]:
    adm_res = await db.execute(
        select(Admission, Patient)
        .join(Patient, Admission.patient_id == Patient.id)
        .where(Admission.discharge_date.is_(None))
    )
    adm_rows = adm_res.all()
    patient_ids = [int(row.Patient.id) for row in adm_rows]
    total_patients = len(patient_ids)

    week_ago = datetime.utcnow() - timedelta(days=7)
    prev_week_res = await db.execute(
        select(func.count(Admission.id)).where(
            Admission.discharge_date.is_(None),
            Admission.admission_date >= week_ago,
        )
    )
    previous_week_patients = int(prev_week_res.scalar() or 0)
    change_from_last_week = total_patients - previous_week_patients

    latest_by_pid: Dict[int, Vital] = {}
    if patient_ids:
        vit_res = await db.execute(
            select(Vital)
            .where(Vital.patient_id.in_(patient_ids))
            .order_by(Vital.recorded_at.desc())
        )
        for v in vit_res.scalars().all():
            if v.patient_id not in latest_by_pid:
                latest_by_pid[v.patient_id] = v

    normal_checks = 0
    total_checks = 0
    abnormal_patient_ids: set[int] = set()
    scored: List[Tuple[int, str, int]] = []

    for row in adm_rows:
        patient: Patient = row.Patient
        pid = int(patient.id)
        v = latest_by_pid.get(pid)
        name = (patient.name or "").strip() or f"Patient #{pid}"

        if v:
            field_vals = [
                (v.heart_rate, _hr_normal),
                (v.blood_pressure_sys, _sbp_normal),
                (v.temperature, _temp_normal),
                (v.spo2, _spo2_normal),
                (v.respiratory_rate, _rr_normal),
            ]
            for val, ok_fn in field_vals:
                if val is None:
                    continue
                total_checks += 1
                if ok_fn(val):
                    normal_checks += 1
                else:
                    abnormal_patient_ids.add(pid)

        sc = _score_for_vital(v)
        scored.append((sc, name, pid))

    vitals_health_percentage = (
        int(round(100 * normal_checks / total_checks)) if total_checks else 0
    )
    critical_vitals_percentage = (
        int(round(100 * len(abnormal_patient_ids) / total_patients))
        if total_patients
        else 0
    )

    at_risk_count = sum(1 for sc, _, _ in scored if sc >= 5)

    scored.sort(key=lambda x: x[0], reverse=True)
    top_names = [n for _, n, _ in scored[:5]]
    top_risk_patients = ", ".join(top_names) if top_names else ""
    at_risk_names = [n for sc, n, _ in scored if sc >= 5]
    top_risk_patients_full = ", ".join(at_risk_names) if at_risk_names else ""

    risk_lines: List[str] = []
    for sc, name, pid in scored:
        v = latest_by_pid.get(pid)
        risk_lines.append(
            f"- {name} | NEWS2={sc} | {_vital_snapshot(v)}"
        )
    patient_risk_table = "\n".join(risk_lines) if risk_lines else "(no patients)"

    avg_news2_score = round(
        (sum(sc for sc, _name, _pid in scored) / len(scored)) if scored else 0.0,
        2,
    )
    metrics = {
        "avg_news2_score": avg_news2_score,
        "high_risk_count": at_risk_count,
        "total_patients": total_patients,
    }
    top_patients = [
        {"name": name, "news2_score": sc, "patient_id": pid}
        for sc, name, pid in scored[:5]
    ]
    ai_prediction = _generate_local_summary(metrics, top_patients)

    return {
        "total_patients": total_patients,
        "previous_week_patients": previous_week_patients,
        "change_from_last_week": change_from_last_week,
        "vitals_health_percentage": vitals_health_percentage,
        "critical_vitals_percentage": critical_vitals_percentage,
        "at_risk_count": at_risk_count,
        "top_risk_patients": top_risk_patients_full or top_risk_patients,
        "ai_prediction": ai_prediction,
    }
