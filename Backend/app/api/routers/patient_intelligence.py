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
from app.core.ops_openai_settings import resolve_openai_api_key
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
    "requested in the user message. Use real counts and timeframes you infer "
    "from the data — do not assume a fixed number of days. "
    "From the patient table, judge which individuals look most serious using "
    "NEWS2 and vitals together (not NEWS2 alone). "
    "If you state a specific number of at-risk patients in SUMMARY, the NAMES "
    "section MUST list exactly that many distinct patients, one per numbered line, "
    "using ONLY full names that appear in the provided table — do not invent names "
    "or pad with duplicates. If you cannot support a count with real names, use a "
    "qualitative summary without a precise patient count."
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


def _openai_summary_sync(
    total_patients: int,
    at_risk_count: int,
    vitals_health_percentage: int,
    critical_vitals_percentage: int,
    change_from_last_week: int,
    top_risk_patient_names: str,
    patient_risk_table: str,
) -> str:
    from openai import OpenAI

    api_key = (resolve_openai_api_key() or "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing")

    user_prompt = f"""
Hospital patient data:
- Total active patients: {total_patients}
- Patients with abnormal vitals (NEWS2 >= 5): {at_risk_count}
- Overall vitals health score: {vitals_health_percentage}%
- Critical vitals percentage: {critical_vitals_percentage}%
- Change from last week: {change_from_last_week}
- Highest NEWS2 names (subset): {top_risk_patient_names}

Full active-patient table (highest NEWS2 first; NEWS2 is internal severity score — use with vitals to judge who looks most serious):
{patient_risk_table}

You are a clinical AI. Based on this vitals data, predict how many patients
may be at risk and over what approximate timeframe (you choose the horizon
from the data — e.g. 2 days, 3 days, 5 days, or longer — do not use a fixed default).

You MUST output ONLY the following three sections, in this exact order, with these exact headers:

SUMMARY:
One line: your risk outlook (how many patients, roughly how soon, based on the metrics).

NAMES:
1. First Patient Full Name
2. Second Patient Full Name
(One numbered line per patient you are flagging. If SUMMARY gives a specific patient count N, 
include exactly N distinct names from the table above — same N, same real people. If N is large, still list every name.)

SUGGESTION:
One imperative sentence for staff (e.g. "Escalate to the duty physician and increase vitals monitoring frequency.")

Rules:
- No text before SUMMARY: or after the SUGGESTION: line.
- NAMES must use numbered lines starting with "1.", "2.", etc.
- Use only names that appear in the full table; never invent patients.
"""

    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=1800,
        messages=[
            {"role": "system", "content": OPENAI_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
    )
    msg = resp.choices[0].message.content
    return (msg or "").strip()


async def _fetch_ai_prediction(
    total_patients: int,
    at_risk_count: int,
    vitals_health_percentage: int,
    critical_vitals_percentage: int,
    change_from_last_week: int,
    top_risk_patient_names: str,
    patient_risk_table: str,
) -> str:
    return await asyncio.to_thread(
        _openai_summary_sync,
        total_patients,
        at_risk_count,
        vitals_health_percentage,
        critical_vitals_percentage,
        change_from_last_week,
        top_risk_patient_names,
        patient_risk_table,
    )


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

    try:
        ai_prediction = await _fetch_ai_prediction(
            total_patients,
            at_risk_count,
            vitals_health_percentage,
            critical_vitals_percentage,
            change_from_last_week,
            top_risk_patients_full or top_risk_patients or "(none listed)",
            patient_risk_table,
        )
    except Exception:
        ai_prediction = "Prediction unavailable at this time."

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
