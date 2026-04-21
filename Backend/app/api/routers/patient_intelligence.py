"""
Admin Patient Intelligence — top 5 highest NEWS2 active patients + compact summary.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.auth import get_current_user
from app.database import get_db
from app.models.admission import Admission
from app.models.bed import Bed
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
    respiratory_rate: Optional[int],
    spo2: Optional[int],
    temperature: Optional[float],
    systolic_bp: Optional[int],
    heart_rate: Optional[int],
) -> int:
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


def news2_trend_label(current_score: int, previous_score: Optional[int]) -> str:
    if previous_score is None:
        return "STABLE"
    delta = current_score - previous_score
    if delta >= 2:
        return "WORSENING"
    if delta == 1:
        return "MONITOR"
    return "STABLE"


def _metric_trend(
    curr: Optional[float], prev: Optional[float]
) -> str:
    if curr is None or prev is None:
        return "STABLE"
    if curr > prev:
        return "UP"
    if curr < prev:
        return "DOWN"
    return "STABLE"


def predicted_condition_24h(score: int, trend: str) -> str:
    if score >= 7 and trend == "WORSENING":
        return "CRITICAL"
    if score >= 5 or trend == "WORSENING":
        return "HIGH RISK"
    return "STABLE"


def estimated_discharge(condition_level: str, score: int) -> str:
    cl = (condition_level or "").lower().strip()
    if cl == "emergency":
        return "Indeterminate"
    if cl == "critical" or score >= 7:
        return "10+ days"
    if cl == "observation":
        return "3-5 days"
    if cl == "stable":
        if score <= 2:
            return "1-2 days"
        if score <= 4:
            return "3-5 days"
    return "3-5 days"


def _vital_scores(v: Vital) -> int:
    return calculate_news2(
        v.respiratory_rate,
        v.spo2,
        v.temperature,
        v.blood_pressure_sys,
        v.heart_rate,
    )


def _build_patient_payload(
    patient: Patient,
    bed: Bed,
    latest: Optional[Vital],
    previous: Optional[Vital],
) -> Dict[str, Any]:
    cond = (latest.condition_level if latest else "") or "unknown"
    cur = (
        _vital_scores(latest)
        if latest
        else calculate_news2(None, None, None, None, None)
    )
    prev_score = _vital_scores(previous) if previous else None
    trend = news2_trend_label(cur, prev_score)

    if latest is None:
        vitals_out = {
            "heart_rate": 0,
            "systolic_bp": 0,
            "diastolic_bp": 0,
            "temperature": 0.0,
            "spo2": 0,
            "respiratory_rate": 0,
        }
        vt = {
            "heart_rate_trend": "STABLE",
            "bp_trend": "STABLE",
            "spo2_trend": "STABLE",
            "temp_trend": "STABLE",
        }
    else:
        vitals_out = {
            "heart_rate": int(latest.heart_rate)
            if latest.heart_rate is not None
            else 0,
            "systolic_bp": int(latest.blood_pressure_sys)
            if latest.blood_pressure_sys is not None
            else 0,
            "diastolic_bp": int(latest.blood_pressure_dia)
            if latest.blood_pressure_dia is not None
            else 0,
            "temperature": float(latest.temperature)
            if latest.temperature is not None
            else 0.0,
            "spo2": int(latest.spo2) if latest.spo2 is not None else 0,
            "respiratory_rate": int(latest.respiratory_rate)
            if latest.respiratory_rate is not None
            else 0,
        }

    if latest is not None and previous is not None:
        vt = {
            "heart_rate_trend": _metric_trend(
                float(latest.heart_rate) if latest.heart_rate is not None else None,
                float(previous.heart_rate)
                if previous.heart_rate is not None
                else None,
            ),
            "bp_trend": _metric_trend(
                float(latest.blood_pressure_sys)
                if latest.blood_pressure_sys is not None
                else None,
                float(previous.blood_pressure_sys)
                if previous.blood_pressure_sys is not None
                else None,
            ),
            "spo2_trend": _metric_trend(
                float(latest.spo2) if latest.spo2 is not None else None,
                float(previous.spo2) if previous.spo2 is not None else None,
            ),
            "temp_trend": _metric_trend(
                float(latest.temperature)
                if latest.temperature is not None
                else None,
                float(previous.temperature)
                if previous.temperature is not None
                else None,
            ),
        }
    elif latest is not None:
        vt = {
            "heart_rate_trend": "STABLE",
            "bp_trend": "STABLE",
            "spo2_trend": "STABLE",
            "temp_trend": "STABLE",
        }

    return {
        "patient_id": int(patient.id),
        "name": patient.name,
        "age": int(patient.age) if patient.age is not None else 0,
        "gender": patient.gender or "",
        "ward": bed.ward or "",
        "condition_level": cond,
        "news2_score": cur,
        "risk_level": news2_risk_level(cur),
        "trend": trend,
        "vitals": vitals_out,
        "vitals_trend": vt,
        "predicted_condition_24h": predicted_condition_24h(cur, trend),
        "estimated_discharge": estimated_discharge(cond, cur),
    }


@router.get("/patient-intelligence")
async def get_patient_intelligence(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Dict[str, Any]:
    adm_res = await db.execute(
        select(Admission, Patient, Bed)
        .join(Patient, Admission.patient_id == Patient.id)
        .join(Bed, Admission.bed_id == Bed.id)
        .where(Admission.discharge_date.is_(None))
    )
    adm_rows = adm_res.all()
    patient_ids = [int(row.Patient.id) for row in adm_rows]

    vitals_map: Dict[int, List[Vital]] = defaultdict(list)
    if patient_ids:
        vit_res = await db.execute(
            select(Vital)
            .where(Vital.patient_id.in_(patient_ids))
            .order_by(Vital.patient_id, Vital.recorded_at.desc())
        )
        for v in vit_res.scalars().all():
            if len(vitals_map[v.patient_id]) < 2:
                vitals_map[v.patient_id].append(v)

    built: List[Tuple[int, Dict[str, Any]]] = []
    high_n = med_n = low_n = 0

    for row in adm_rows:
        patient: Patient = row.Patient
        bed: Bed = row.Bed
        pid = int(patient.id)
        vlist = vitals_map.get(pid, [])
        latest = vlist[0] if vlist else None
        previous = vlist[1] if len(vlist) > 1 else None
        cur = (
            _vital_scores(latest)
            if latest
            else calculate_news2(None, None, None, None, None)
        )
        rl = news2_risk_level(cur)
        if rl == "HIGH":
            high_n += 1
        elif rl == "MEDIUM":
            med_n += 1
        else:
            low_n += 1
        built.append((cur, _build_patient_payload(patient, bed, latest, previous)))

    built.sort(key=lambda x: x[0], reverse=True)
    top5 = [p for _, p in built[:5]]

    trend_block: Dict[str, Any] = {
        "patient_name": "",
        "points": [],
        "current_score": 0,
        "score_delta": 0,
    }
    if top5:
        top_pid = int(top5[0]["patient_id"])
        hist_res = await db.execute(
            select(Vital)
            .where(Vital.patient_id == top_pid)
            .order_by(Vital.recorded_at.desc())
            .limit(5)
        )
        hist = list(hist_res.scalars().all())
        hist.reverse()
        points: List[Dict[str, Any]] = []
        scores: List[int] = []
        for v in hist:
            sc = _vital_scores(v)
            scores.append(sc)
            label = v.recorded_at.strftime("%H:%M") if v.recorded_at else ""
            points.append(
                {
                    "label": label,
                    "news2_score": sc,
                    "recorded_at": v.recorded_at.isoformat()
                    if v.recorded_at
                    else "",
                }
            )
        current_score = scores[-1] if scores else 0
        score_delta = (
            (scores[-1] - scores[-2]) if len(scores) >= 2 else 0
        )
        trend_block = {
            "patient_name": str(top5[0]["name"]),
            "points": points,
            "current_score": current_score,
            "score_delta": score_delta,
        }

    summary = {
        "total_active_patients": len(patient_ids),
        "high_risk_count": high_n,
        "medium_risk_count": med_n,
        "low_risk_count": low_n,
    }

    return {
        "summary": summary,
        "patients": top5,
        "risk_score_trend": trend_block,
    }
