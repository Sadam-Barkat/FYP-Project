from __future__ import annotations

import json
import logging
import os
import pickle
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import Date, and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.laboratory import LaboratoryResult
from app.models.laboratory_extra import LabCategory, LabRequest
from app.models.patient import Patient

logger = logging.getLogger(__name__)

LAB_ENTRY_DELIMITER = " | "


@dataclass(frozen=True)
class LabBacklogForecastPoint:
    date: str
    backlog_risk: bool
    risk_probability: float
    day_name: str


def _ml_dir() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", "..", "ml"))


def _load_metadata() -> Dict[str, Any]:
    meta_path = os.path.join(_ml_dir(), "lab_model_metadata.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_pickle_model(path: str) -> Any:
    try:
        import joblib  # type: ignore

        return joblib.load(path)
    except Exception:
        with open(path, "rb") as f:
            return pickle.load(f)


@lru_cache(maxsize=1)
def get_lab_models_bundle() -> Tuple[Any, List[str], Any, List[str], Dict[str, Any]]:
    meta = _load_metadata()
    am = meta.get("abnormal_model") or {}
    bm = meta.get("backlog_model") or {}
    abnormal_features = list(am.get("features") or [])
    backlog_features = list(bm.get("features") or [])
    abnormal_model = _load_pickle_model(os.path.join(_ml_dir(), "lab_abnormal_model.pkl"))
    backlog_model = _load_pickle_model(os.path.join(_ml_dir(), "lab_backlog_model.pkl"))
    return abnormal_model, abnormal_features, backlog_model, backlog_features, meta


def _mean(xs: List[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def _lags(series: List[float], k: int, default: float = 0.0) -> float:
    return float(series[-k]) if len(series) >= k else float(default)


def _risk_label_from_prob(prob: float) -> str:
    if prob >= 0.75:
        return "Critical"
    if prob >= 0.5:
        return "High"
    if prob >= 0.25:
        return "Moderate"
    return "Low"


def _gender_encoded(gender: Optional[str]) -> int:
    g = (gender or "").strip().lower()
    return 1 if g.startswith("m") else 0


def _parse_numeric_value(result_value: Optional[str]) -> float:
    if not result_value:
        return 0.0
    m = re.search(r"[-+]?\d*\.?\d+", str(result_value))
    if not m:
        return 0.0
    try:
        return float(m.group(0))
    except Exception:
        return 0.0


def _is_abnormal_result(result_value: Optional[str]) -> bool:
    rv = (result_value or "").strip().lower()
    if not rv:
        return False
    if "critical" in rv:
        return True
    if "abnormal" in rv:
        return True
    if "normal" in rv or "negative" in rv:
        return False
    return True


async def _count_requests_on_day(db: AsyncSession, day: date) -> int:
    r = await db.execute(
        select(func.count(LabRequest.id)).where(cast(LabRequest.request_date, Date) == day)
    )
    return int(r.scalar_one() or 0)


async def _count_results_on_day(db: AsyncSession, day: date) -> int:
    r = await db.execute(
        select(func.count(LaboratoryResult.id)).where(
            cast(LaboratoryResult.collected_at, Date) == day
        )
    )
    return int(r.scalar_one() or 0)


async def _count_pending_as_of(db: AsyncSession, day: date) -> int:
    day_end = datetime.combine(day, time.max)
    r = await db.execute(
        select(func.count(LabRequest.id)).where(
            and_(
                LabRequest.status == "pending",
                LabRequest.request_date <= day_end,
            )
        )
    )
    return int(r.scalar_one() or 0)


async def _abnormal_rate_for_window(db: AsyncSession, end_day: date, days: int = 7) -> float:
    start = end_day - timedelta(days=days - 1)
    r = await db.execute(
        select(LaboratoryResult.result_value).where(
            and_(
                cast(LaboratoryResult.collected_at, Date) >= start,
                cast(LaboratoryResult.collected_at, Date) <= end_day,
            )
        )
    )
    vals = [row[0] for row in r.all()]
    if not vals:
        return 0.0
    abnormal = sum(1 for v in vals if _is_abnormal_result(v))
    return float(abnormal) / float(len(vals))


async def _build_category_test_encoders(db: AsyncSession) -> Tuple[Dict[str, int], Dict[str, int]]:
    cat_map: Dict[str, int] = {}
    cat_rows = await db.execute(select(LabCategory.name).order_by(LabCategory.id))
    for i, (name,) in enumerate(cat_rows.all()):
        cat_map[(name or "").strip() or "Other"] = i

    test_res = await db.execute(
        select(LaboratoryResult.test_name)
        .distinct()
        .order_by(LaboratoryResult.test_name)
        .limit(200)
    )
    test_map: Dict[str, int] = {}
    for i, (tn,) in enumerate(test_res.all()):
        key = (tn or "").strip() or "unknown"
        test_map[key] = i
    return cat_map, test_map


def _metadata_backlog_forecast(meta: Dict[str, Any], base_date: date) -> List[LabBacklogForecastPoint]:
    raw = list(meta.get("next_7_days_forecast") or [])
    out: List[LabBacklogForecastPoint] = []
    for i in range(7):
        d = base_date + timedelta(days=i)
        row = raw[i] if i < len(raw) else {}
        prob = float(row.get("risk_probability") or 0.0)
        out.append(
            LabBacklogForecastPoint(
                date=str(row.get("date") or d.isoformat()),
                backlog_risk=bool(row.get("backlog_risk")),
                risk_probability=max(0.0, min(1.0, prob)),
                day_name=str(row.get("day_name") or d.strftime("%A")),
            )
        )
    return out


async def predict_next_7_days_lab_backlog(
    db: AsyncSession,
    *,
    base_date: date,
) -> Tuple[List[LabBacklogForecastPoint], Dict[str, Any]]:
    try:
        abnormal_model, _af, backlog_model, backlog_features, meta = get_lab_models_bundle()
    except Exception as exc:
        logger.warning("Lab ML models unavailable: %s", exc)
        pts = _metadata_backlog_forecast({}, base_date)
        return pts, {
            "risk_prob": 0.0,
            "risk_pct": 0,
            "risk_label": "Low",
            "ml_available": False,
        }

    history_days = [base_date - timedelta(days=i) for i in range(7, 0, -1)]
    total_hist: List[float] = []
    pending_hist: List[float] = []
    for d in history_days:
        req = float(await _count_requests_on_day(db, d))
        res = float(await _count_results_on_day(db, d))
        total_hist.append(max(req, res, req + res * 0.5))
        pending_hist.append(float(await _count_pending_as_of(db, d)))

    abnormal_rate = await _abnormal_rate_for_window(db, base_date, days=7)
    total_series = list(total_hist)
    pending_series = list(pending_hist)

    out: List[LabBacklogForecastPoint] = []
    probs: List[float] = []

    for i in range(7):
        target = base_date + timedelta(days=i + 1)
        feats = {
            "total_lag1": _lags(total_series, 1),
            "total_lag7": _lags(total_series, 7, _lags(total_series, 1)),
            "total_rolling7": _mean(total_series[-7:]) if total_series else 0.0,
            "pending_lag1": _lags(pending_series, 1),
            "abnormal_rate": float(abnormal_rate),
            "day_of_week": float(target.weekday()),
            "month": float(target.month),
            "day_of_month": float(target.day),
        }
        x = [float(feats.get(f, 0.0)) for f in backlog_features]
        prob = 0.0
        try:
            proba = backlog_model.predict_proba([x])  # type: ignore[attr-defined]
            if proba.shape[1] >= 2:
                prob = float(proba[0][1])
            else:
                prob = float(proba[0][0])
        except Exception:
            try:
                pred = backlog_model.predict([x])  # type: ignore[attr-defined]
                prob = float(pred[0])
            except Exception as exc:
                logger.warning("Lab backlog predict failed for %s: %s", target, exc)
        prob = max(0.0, min(1.0, prob))
        probs.append(prob)
        out.append(
            LabBacklogForecastPoint(
                date=target.isoformat(),
                backlog_risk=bool(prob >= 0.5),
                risk_probability=prob,
                day_name=target.strftime("%A"),
            )
        )
        total_series.append(max(_lags(total_series, 1), _mean(total_series[-3:]) if total_series else 0.0))
        pending_series.append(_lags(pending_series, 1) * (1.0 + prob * 0.15))

    if not out:
        out = _metadata_backlog_forecast(meta, base_date + timedelta(days=1))
        probs = [p.risk_probability for p in out]

    avg_prob = _mean(probs) if probs else 0.0
    summary = {
        "risk_prob": avg_prob,
        "risk_pct": int(round(avg_prob * 100)),
        "risk_label": _risk_label_from_prob(avg_prob),
        "ml_available": True,
        "ml_model_backlog": "lab_backlog_model.pkl (GradientBoostingClassifier)",
        "ml_model_abnormal": "lab_abnormal_model.pkl (RandomForestClassifier)",
    }
    return out, summary


async def predict_abnormal_risk_samples(
    db: AsyncSession,
    *,
    base_date: date,
    limit: int = 15,
) -> List[Dict[str, Any]]:
    try:
        abnormal_model, abnormal_features, _, _, _meta = get_lab_models_bundle()
    except Exception as exc:
        logger.warning("Lab abnormal model unavailable: %s", exc)
        return []

    cat_map, test_map = await _build_category_test_encoders(db)
    day_end = datetime.combine(base_date, time.max)

    pending_req = await db.execute(
        select(LabRequest, Patient, LabCategory)
        .join(Patient, Patient.id == LabRequest.patient_id)
        .join(LabCategory, LabCategory.id == LabRequest.lab_category_id)
        .where(
            and_(
                LabRequest.status == "pending",
                LabRequest.request_date <= day_end,
            )
        )
        .limit(80)
    )

    scored: List[Dict[str, Any]] = []
    for req, patient, cat in pending_req.all():
        when = req.request_date or datetime.utcnow()
        cat_name = cat.name if cat else "Other"
        test_name = cat_name
        feats = {
            "age": float(patient.age or 0),
            "gender_encoded": float(_gender_encoded(patient.gender)),
            "hour_of_day": float(when.hour),
            "day_of_week": float(when.weekday()),
            "month": float(when.month),
            "numeric_value": 0.0,
            "category_encoded": float(cat_map.get(cat_name, len(cat_map) % 20)),
            "test_encoded": float(test_map.get(test_name, len(test_map) % 50)),
        }
        x = [float(feats.get(f, 0.0)) for f in abnormal_features]
        prob = 0.0
        try:
            proba = abnormal_model.predict_proba([x])  # type: ignore[attr-defined]
            if proba.shape[1] >= 2:
                prob = float(proba[0][1])
            else:
                prob = float(proba[0][0])
        except Exception as exc:
            logger.debug("Abnormal predict failed: %s", exc)
            continue
        scored.append(
            {
                "patient_name": (patient.name or "").strip() or f"Patient #{patient.id}",
                "test_name": test_name,
                "category": cat_name,
                "abnormal_probability": round(prob, 3),
            }
        )

    pending_results = await db.execute(
        select(LaboratoryResult, Patient)
        .join(Patient, Patient.id == LaboratoryResult.patient_id)
        .where(
            and_(
                LaboratoryResult.status != "completed",
                cast(LaboratoryResult.collected_at, Date) <= base_date,
            )
        )
        .limit(40)
    )
    for result, patient in pending_results.all():
        when = result.collected_at or datetime.utcnow()
        test_name = (result.test_name or "").strip() or "Unknown"
        if LAB_ENTRY_DELIMITER in test_name:
            cat_name, test_only = test_name.split(LAB_ENTRY_DELIMITER, 1)
            cat_name = cat_name.strip() or "Other"
            test_name = test_only.strip() or test_name
        else:
            cat_name = "Other"
        feats = {
            "age": float(patient.age or 0),
            "gender_encoded": float(_gender_encoded(patient.gender)),
            "hour_of_day": float(when.hour),
            "day_of_week": float(when.weekday()),
            "month": float(when.month),
            "numeric_value": _parse_numeric_value(result.result_value),
            "category_encoded": float(cat_map.get(cat_name, len(cat_map) % 20)),
            "test_encoded": float(test_map.get(test_name, len(test_map) % 50)),
        }
        x = [float(feats.get(f, 0.0)) for f in abnormal_features]
        try:
            proba = abnormal_model.predict_proba([x])  # type: ignore[attr-defined]
            prob = float(proba[0][1]) if proba.shape[1] >= 2 else float(proba[0][0])
        except Exception:
            continue
        scored.append(
            {
                "patient_name": (patient.name or "").strip() or f"Patient #{patient.id}",
                "test_name": test_name,
                "category": cat_name,
                "abnormal_probability": round(max(0.0, min(1.0, prob)), 3),
            }
        )

    scored.sort(key=lambda r: r["abnormal_probability"], reverse=True)
    return scored[:limit]
