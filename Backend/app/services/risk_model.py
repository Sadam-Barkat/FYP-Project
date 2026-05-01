"""
Patient deterioration risk model service.
Loads the trained sklearn pipeline once at import time.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import joblib
import numpy as np

# Path to saved model
_MODEL_PATH = Path(__file__).parent.parent / "ml" / "deterioration_model.pkl"

# Load once when module is imported
_pipeline = None

def _load_model():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    if not _MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model file not found at {_MODEL_PATH}. "
            "Run train_model.py first."
        )
    _pipeline = joblib.load(_MODEL_PATH)
    return _pipeline


def predict_deterioration_risk(
    heart_rate: Optional[float],
    spo2: Optional[float],
    respiratory_rate: Optional[float],
    temperature: Optional[float],
    blood_pressure_sys: Optional[float],
    age: Optional[float],
    admission_days: Optional[float],
) -> dict:
    """
    Returns deterioration risk for a single patient.
    All inputs are optional — missing values are replaced
    with clinically normal defaults.

    Returns:
        {
            "risk_score": float (0.0 to 1.0),
            "risk_label": str ("Low" | "Moderate" | "High" | "Critical"),
            "risk_pct": int (0 to 100),
            "model": "logistic_regression_v1"
        }
    """
    # Safe defaults (clinically normal values)
    hr   = float(heart_rate)        if heart_rate        is not None else 75.0
    sp   = float(spo2)              if spo2              is not None else 97.0
    rr   = float(respiratory_rate)  if respiratory_rate  is not None else 16.0
    tmp  = float(temperature)       if temperature       is not None else 37.0
    sbp  = float(blood_pressure_sys)if blood_pressure_sys is not None else 120.0
    ag   = float(age)               if age               is not None else 50.0
    days = float(admission_days)    if admission_days    is not None else 1.0

    features = np.array([[hr, sp, rr, tmp, sbp, ag, days]])

    model = _load_model()
    prob = float(model.predict_proba(features)[0][1])

    # Risk label thresholds
    if prob >= 0.75:
        label = "Critical"
    elif prob >= 0.50:
        label = "High"
    elif prob >= 0.25:
        label = "Moderate"
    else:
        label = "Low"

    return {
        "risk_score": round(prob, 4),
        "risk_label": label,
        "risk_pct":   int(round(prob * 100)),
        "model":      "logistic_regression_v1",
    }

