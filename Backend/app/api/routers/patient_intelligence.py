"""
Admin patient risk intelligence: NEWS2-based ranking (score not exposed) + OpenAI predictions.
"""
from __future__ import annotations

import asyncio
import json
import re
import urllib.request
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.auth import get_current_user
from app.core.ops_openai_settings import resolve_openai_api_key
from app.database import get_db
from app.models.admission import Admission
from app.models.bed import Bed
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.vital import Vital

router = APIRouter(prefix="/api", tags=["patient-intelligence"])

OPENAI_SYSTEM = (
    "You are a clinical AI assistant for a hospital dashboard. "
    "Be concise and direct."
)


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
    """NEWS2 aggregate (0–20+); used only for sorting / high-risk counts — not returned to clients."""
    rr = int(respiratory_rate) if respiratory_rate is not None else 16
    sp = int(spo2) if spo2 is not None else 98
    temp = float(temperature) if temperature is not None else 37.0
    sys_bp = int(systolic_bp) if systolic_bp is not None else 120
    hr = int(heart_rate) if heart_rate is not None else 72

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


def _news2_high_risk(score: int) -> bool:
    return score >= 7


def _metric_dir(curr: Optional[float], prev: Optional[float]) -> str:
    if curr is None or prev is None:
        return "STABLE"
    if curr > prev:
        return "UP"
    if curr < prev:
        return "DOWN"
    return "STABLE"


def _vitals_dict(v: Optional[Vital]) -> Dict[str, Any]:
    if not v:
        return {
            "heart_rate": 0,
            "systolic_bp": 0,
            "diastolic_bp": 0,
            "temperature": 0.0,
            "spo2": 0,
            "respiratory_rate": 0,
        }
    return {
        "heart_rate": int(v.heart_rate) if v.heart_rate is not None else 0,
        "systolic_bp": int(v.blood_pressure_sys)
        if v.blood_pressure_sys is not None
        else 0,
        "diastolic_bp": int(v.blood_pressure_dia)
        if v.blood_pressure_dia is not None
        else 0,
        "temperature": float(v.temperature) if v.temperature is not None else 0.0,
        "spo2": int(v.spo2) if v.spo2 is not None else 0,
        "respiratory_rate": int(v.respiratory_rate)
        if v.respiratory_rate is not None
        else 0,
    }


def _vitals_change(latest: Optional[Vital], previous: Optional[Vital]) -> Dict[str, str]:
    if not latest or not previous:
        return {
            "heart_rate": "STABLE",
            "bp": "STABLE",
            "spo2": "STABLE",
            "temp": "STABLE",
        }
    return {
        "heart_rate": _metric_dir(
            float(latest.heart_rate) if latest.heart_rate is not None else None,
            float(previous.heart_rate) if previous.heart_rate is not None else None,
        ),
        "bp": _metric_dir(
            float(latest.blood_pressure_sys)
            if latest.blood_pressure_sys is not None
            else None,
            float(previous.blood_pressure_sys)
            if previous.blood_pressure_sys is not None
            else None,
        ),
        "spo2": _metric_dir(
            float(latest.spo2) if latest.spo2 is not None else None,
            float(previous.spo2) if previous.spo2 is not None else None,
        ),
        "temp": _metric_dir(
            float(latest.temperature) if latest.temperature is not None else None,
            float(previous.temperature)
            if previous.temperature is not None
            else None,
        ),
    }


def _score_from_vital(v: Optional[Vital]) -> int:
    if not v:
        return 0
    return calculate_news2(
        v.respiratory_rate,
        v.spo2,
        v.temperature,
        v.blood_pressure_sys,
        v.heart_rate,
    )


def _parse_openai_json_array(raw: str) -> List[Dict[str, Any]]:
    txt = (raw or "").strip()
    if txt.startswith("```"):
        txt = re.sub(r"^```[a-zA-Z]*\s*", "", txt)
        txt = re.sub(r"\s*```$", "", txt)
    data = json.loads(txt)
    if not isinstance(data, list):
        return []
    return [x for x in data if isinstance(x, dict)]


def _openai_predictions_sync(patients_payload: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    api_key = (resolve_openai_api_key() or "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing")

    user_msg = f"""
Based on these patients vitals and trends,
give a one-line prediction for each patient
about their health risk in the next 24 hours.
Only use vitals data to predict. Be specific.
Format response as JSON array:
[
  {{"name": "...", "prediction": "one line prediction here"}},
  ...
]

Patients data:
{json.dumps(patients_payload)}
"""

    body = {
        "model": "gpt-4o-mini",
        "max_tokens": 300,
        "messages": [
            {"role": "system", "content": OPENAI_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    content = payload["choices"][0]["message"]["content"]
    return _parse_openai_json_array(content)


async def _fetch_openai_predictions(
    patients_payload: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_openai_predictions_sync, patients_payload)


def _merge_predictions(
    patients: List[Dict[str, Any]], preds: List[Dict[str, Any]]
) -> None:
    for p in patients:
        p["prediction"] = "Prediction unavailable"
    by_name: Dict[str, str] = {}
    for row in preds:
        name = str(row.get("name", "")).strip()
        pr = str(row.get("prediction", "")).strip()
        if name and pr:
            by_name[name.lower()] = pr
    for p in patients:
        key = str(p.get("name", "")).strip().lower()
        if key in by_name:
            p["prediction"] = by_name[key]


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

    high_risk_count = 0
    scored: List[Tuple[int, Dict[str, Any]]] = []

    for row in adm_rows:
        patient: Patient = row.Patient
        bed: Bed = row.Bed
        pid = int(patient.id)
        vlist = vitals_map.get(pid, [])
        latest = vlist[0] if vlist else None
        previous = vlist[1] if len(vlist) > 1 else None

        score = _score_from_vital(latest)
        if _news2_high_risk(score):
            high_risk_count += 1

        cond = (latest.condition_level if latest else None) or "unknown"
        payload = {
            "name": patient.name or "",
            "age": int(patient.age) if patient.age is not None else 0,
            "gender": patient.gender or "",
            "ward": bed.ward or "",
            "condition_level": (cond or "").lower().strip(),
            "vitals": _vitals_dict(latest),
            "vitals_change": _vitals_change(latest, previous),
        }
        scored.append((score, payload))

    scored.sort(key=lambda x: x[0], reverse=True)
    top5 = [dict(p) for _, p in scored[:5]]

    ai_payload = [
        {
            "name": p["name"],
            "age": p["age"],
            "gender": p["gender"],
            "ward": p["ward"],
            "condition_level": p["condition_level"],
            "vitals": p["vitals"],
            "vitals_change": p["vitals_change"],
        }
        for p in top5
    ]

    if top5:
        try:
            preds = await _fetch_openai_predictions(ai_payload)
            _merge_predictions(top5, preds)
        except Exception:
            for p in top5:
                p["prediction"] = "Prediction unavailable"

    return {"high_risk_count": high_risk_count, "patients": top5}
