from __future__ import annotations

import json
import os
import pickle
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple


@dataclass(frozen=True)
class ModelThresholds:
    low: float
    moderate: float
    high: float
    critical: float


@dataclass(frozen=True)
class RiskResult:
    risk_prob: float  # 0..1
    risk_pct: int  # 0..100
    risk_label: str  # Low/Moderate/High/Critical


def _ml_dir() -> str:
    # Backend/app/services -> Backend/ml
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", "..", "ml"))


def _load_metadata() -> Dict[str, Any]:
    meta_path = os.path.join(_ml_dir(), "patient_model_metadata.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_model() -> Any:
    model_path = os.path.join(_ml_dir(), "patient_deterioration_model.pkl")
    # Prefer joblib (common for sklearn), fallback to pickle.
    try:
        import joblib  # type: ignore

        return joblib.load(model_path)
    except Exception:
        with open(model_path, "rb") as f:
            return pickle.load(f)


@lru_cache(maxsize=1)
def get_model_bundle() -> Tuple[Any, List[str], ModelThresholds]:
    meta = _load_metadata()
    features = list(meta.get("features") or [])
    th = meta.get("risk_thresholds") or {}
    thresholds = ModelThresholds(
        low=float(th.get("low", 0.25)),
        moderate=float(th.get("moderate", 0.5)),
        high=float(th.get("high", 0.75)),
        critical=float(th.get("critical", 0.9)),
    )
    model = _load_model()
    return model, features, thresholds


def _label_from_prob(prob: float, thresholds: ModelThresholds) -> str:
    if prob >= thresholds.critical:
        return "Critical"
    if prob >= thresholds.high:
        return "High"
    if prob >= thresholds.moderate:
        return "Moderate"
    return "Low"


def predict_deterioration_risk_batch(feature_rows: List[Dict[str, Optional[float]]]) -> List[RiskResult]:
    """
    Predict deterioration risk probability for a batch of patients.
    """
    model, features, thresholds = get_model_bundle()

    if not feature_rows:
        return []

    X = []
    for row in feature_rows:
        x = []
        for f in features:
            v = row.get(f)
            x.append(0.0 if v is None else float(v))
        X.append(x)

    try:
        proba = model.predict_proba(X)
        probs = [float(p[1]) for p in proba]
    except Exception:
        probs = [0.0] * len(feature_rows)

    results = []
    for prob in probs:
        pct = int(round(max(0.0, min(1.0, prob)) * 100))
        results.append(
            RiskResult(
                risk_prob=prob,
                risk_pct=pct,
                risk_label=_label_from_prob(prob, thresholds),
            )
        )
    return results

def predict_deterioration_risk(feature_row: Dict[str, Optional[float]]) -> RiskResult:
    """
    Predict deterioration risk probability using the bundled sklearn model.

    - `feature_row` must provide keys for every model feature; missing values become 0.
    - Returns a probability + label derived from metadata thresholds.
    """
    model, features, thresholds = get_model_bundle()

    # Build X row in model's expected feature order.
    x = []
    for f in features:
        v = feature_row.get(f)
        x.append(0.0 if v is None else float(v))

    prob = 0.0
    try:
        proba = model.predict_proba([x])  # type: ignore[attr-defined]
        # Binary classifier: assume class 1 is "at_risk"
        prob = float(proba[0][1])
    except Exception:
        # If the model cannot score, stay safe and return low probability.
        prob = 0.0

    pct = int(round(max(0.0, min(1.0, prob)) * 100))
    return RiskResult(
        risk_prob=prob,
        risk_pct=pct,
        risk_label=_label_from_prob(prob, thresholds),
    )

