from __future__ import annotations

import json
import os
import pickle
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import Date, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_bounds import day_bounds_utc_naive, get_app_timezone
from app.models.admission import Admission
from app.models.patient import Patient


@dataclass(frozen=True)
class BedForecastPoint:
    date: str  # ISO date (calendar day in APP_TIMEZONE)
    predicted_admissions: float
    shortage_probability: float  # 0..1
    shortage_risk: bool
    estimated_occupied_beds: int
    estimated_occupancy_pct: float


def _ml_dir() -> str:
    # Backend/app/services -> Backend/ml
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", "..", "ml"))


def _load_metadata() -> Dict[str, Any]:
    meta_path = os.path.join(_ml_dir(), "bed_model_metadata.json")
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
def get_bed_models_bundle() -> Tuple[Any, List[str], Any, List[str]]:
    meta = _load_metadata()

    sm = meta.get("shortage_model") or {}
    shortage_features = list(sm.get("features") or [])
    shortage_model = _load_pickle_model(os.path.join(_ml_dir(), "bed_shortage_model.pkl"))

    um = meta.get("surge_model") or {}
    surge_features = list(um.get("features") or [])
    surge_model = _load_pickle_model(os.path.join(_ml_dir(), "bed_surge_model.pkl"))

    return shortage_model, shortage_features, surge_model, surge_features


def _mean(xs: List[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def _risk_label_from_prob(prob: float) -> str:
    if prob >= 0.9:
        return "Critical"
    if prob >= 0.75:
        return "High"
    if prob >= 0.5:
        return "Moderate"
    return "Low"


async def _count_admissions_on_day(db: AsyncSession, day: date, tz: Any) -> int:
    d0, d1 = day_bounds_utc_naive(day, tz)
    r = await db.execute(
        select(func.count())
        .select_from(Admission)
        .where(and_(Admission.admission_date >= d0, Admission.admission_date <= d1))
    )
    return int(r.scalar_one() or 0)


async def _count_discharges_on_day(db: AsyncSession, day: date, tz: Any) -> int:
    d0, d1 = day_bounds_utc_naive(day, tz)
    r = await db.execute(
        select(func.count())
        .select_from(Admission)
        .where(
            and_(
                Admission.discharge_date.is_not(None),
                Admission.discharge_date >= d0,
                Admission.discharge_date <= d1,
            )
        )
    )
    return int(r.scalar_one() or 0)


async def _avg_active_patient_age(db: AsyncSession, base_date: date, tz: Any) -> float:
    d0, d1 = day_bounds_utc_naive(base_date, tz)
    r = await db.execute(
        select(func.avg(Patient.age))
        .select_from(Admission)
        .join(Patient, Patient.id == Admission.patient_id)
        .where(
            and_(
                Admission.admission_date <= d1,
                or_(Admission.discharge_date.is_(None), Admission.discharge_date >= d0),
            )
        )
    )
    v = r.scalar_one()  # may be None
    try:
        return float(v or 0.0)
    except Exception:
        return 0.0


def _lags(series: List[float], k: int, default: float = 0.0) -> float:
    return float(series[-k]) if len(series) >= k else float(default)


async def predict_next_7_days_beds(
    db: AsyncSession,
    *,
    base_date: date,
    total_capacity: int,
    occupied_beds: int,
) -> Tuple[List[BedForecastPoint], Dict[str, Any]]:
    """
    Predicts next 7 days of admissions ("surge" model) and shortage probability
    ("shortage" model). Returns a forecast list + an aggregated risk summary.
    """
    shortage_model, shortage_features, surge_model, surge_features = get_bed_models_bundle()
    tz = get_app_timezone()

    # Pull last 7 days admissions/discharges ending yesterday (lags).
    history_days = [base_date - timedelta(days=i) for i in range(1, 8)]
    admissions_hist = [float(await _count_admissions_on_day(db, d, tz)) for d in reversed(history_days)]
    discharges_hist = [float(await _count_discharges_on_day(db, d, tz)) for d in reversed(history_days)]

    admissions_sum7 = float(sum(admissions_hist))
    discharges_sum7 = float(sum(discharges_hist))
    discharge_rate = float(discharges_sum7 / max(1.0, admissions_sum7))

    net_hist = [float(a - d) for a, d in zip(admissions_hist, discharges_hist)]
    net_occupancy_change = float(net_hist[-1] if net_hist else 0.0)
    cumulative_pressure = float(sum(net_hist))

    avg_age = await _avg_active_patient_age(db, base_date, tz)

    def feature_row(target_day: date, admissions_series: List[float]) -> Dict[str, float]:
        rolling3 = _mean(admissions_series[-3:]) if len(admissions_series) >= 3 else _mean(admissions_series)
        rolling7 = _mean(admissions_series[-7:]) if len(admissions_series) >= 7 else _mean(admissions_series)
        return {
            "admissions_lag1": _lags(admissions_series, 1),
            "admissions_lag2": _lags(admissions_series, 2, _lags(admissions_series, 1)),
            "admissions_lag3": _lags(admissions_series, 3, _lags(admissions_series, 2, _lags(admissions_series, 1))),
            "admissions_lag7": _lags(admissions_series, 7, _lags(admissions_series, 3, _lags(admissions_series, 1))),
            "admissions_rolling3": float(rolling3),
            "admissions_rolling7": float(rolling7),
            "discharge_rate": float(discharge_rate),
            "net_occupancy_change": float(net_occupancy_change),
            "cumulative_pressure": float(cumulative_pressure),
            "avg_patient_age": float(avg_age),
            "day_of_week": float(target_day.weekday()),
            "month": float(target_day.month),
            "day_of_month": float(target_day.day),
        }

    out: List[BedForecastPoint] = []
    admissions_series = list(admissions_hist)

    est_occupied = int(max(0, min(int(total_capacity), int(occupied_beds))))
    total_capacity_i = int(max(0, int(total_capacity)))

    probs: List[float] = []
    for i in range(7):
        target_day = base_date + timedelta(days=i)

        feats = feature_row(target_day, admissions_series)

        # Surge: predicted admissions
        x_surge = [float(feats.get(f, 0.0)) for f in surge_features]
        pred_adm = 0.0
        try:
            pred_adm = float(surge_model.predict([x_surge])[0])  # type: ignore[attr-defined]
        except Exception:
            pred_adm = 0.0
        pred_adm = float(max(0.0, pred_adm))

        # Shortage probability
        x_short = [float(feats.get(f, 0.0)) for f in shortage_features]
        prob = 0.0
        try:
            proba = shortage_model.predict_proba([x_short])  # type: ignore[attr-defined]
            prob = float(proba[0][1])
        except Exception:
            prob = 0.0
        prob = float(max(0.0, min(1.0, prob)))
        probs.append(prob)

        shortage = bool(prob >= 0.5)

        # Very lightweight occupancy evolution: admissions add pressure, discharges relieve.
        expected_discharges = float(discharge_rate * pred_adm)
        est_occupied = int(round(est_occupied + pred_adm - expected_discharges))
        est_occupied = int(max(0, min(total_capacity_i, est_occupied)))

        occ_pct = float(est_occupied / max(1, total_capacity_i) * 100.0)

        out.append(
            BedForecastPoint(
                date=target_day.isoformat(),
                predicted_admissions=float(pred_adm),
                shortage_probability=float(prob),
                shortage_risk=shortage,
                estimated_occupied_beds=int(est_occupied),
                estimated_occupancy_pct=float(occ_pct),
            )
        )

        admissions_series.append(float(pred_adm))

    avg_prob = float(_mean(probs)) if probs else 0.0
    risk_pct = int(round(avg_prob * 100))
    summary = {
        "risk_prob": avg_prob,
        "risk_pct": risk_pct,
        "risk_label": _risk_label_from_prob(avg_prob),
        "predicted_admissions_7d_total": float(sum(p.predicted_admissions for p in out)),
        "predicted_admissions_7d_avg": float(_mean([p.predicted_admissions for p in out]) if out else 0.0),
    }

    return out, summary

