"""
Patient Deterioration Risk Model — Training Script
Run once from Backend/ folder: python train_model.py
Produces: app/ml/deterioration_model.pkl
"""

import os
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    classification_report, roc_auc_score, confusion_matrix
)
import joblib

# ── 1. Create output folder ───────────────────────────────────────────
os.makedirs("app/ml", exist_ok=True)

# ── 2. Generate synthetic training data ──────────────────────────────
# Based on NEWS2 clinical scoring distributions from medical literature.
# 2000 patients: 70% stable, 30% deteriorating.

np.random.seed(42)
N = 2000

def make_patients(n, deteriorating):
    if deteriorating:
        # Deteriorating patients have abnormal vitals
        hr       = np.random.normal(115, 18, n).clip(40, 180)
        spo2     = np.random.normal(91, 4, n).clip(70, 99)
        rr       = np.random.normal(26, 5, n).clip(8, 45)
        temp     = np.random.normal(38.6, 0.7, n).clip(34, 41)
        sbp      = np.random.normal(95, 15, n).clip(60, 180)
        age      = np.random.normal(68, 14, n).clip(18, 95)
        adm_days = np.random.exponential(6, n).clip(0, 30)
    else:
        # Stable patients have normal vitals
        hr       = np.random.normal(78, 12, n).clip(50, 110)
        spo2     = np.random.normal(97, 1.5, n).clip(92, 100)
        rr       = np.random.normal(16, 2, n).clip(10, 22)
        temp     = np.random.normal(37.0, 0.4, n).clip(35.5, 38.2)
        sbp      = np.random.normal(122, 14, n).clip(90, 160)
        age      = np.random.normal(52, 18, n).clip(18, 95)
        adm_days = np.random.exponential(3, n).clip(0, 30)

    return pd.DataFrame({
        "heart_rate":        hr,
        "spo2":              spo2,
        "respiratory_rate":  rr,
        "temperature":       temp,
        "blood_pressure_sys": sbp,
        "age":               age,
        "admission_days":    adm_days,
        "deteriorated":      int(deteriorating),
    })

stable       = make_patients(1400, deteriorating=False)
deteriorating = make_patients(600,  deteriorating=True)
df = pd.concat([stable, deteriorating], ignore_index=True).sample(frac=1, random_state=42)

print(f"Dataset: {len(df)} patients | "
      f"Stable: {(df.deteriorated==0).sum()} | "
      f"Deteriorating: {(df.deteriorated==1).sum()}")

# ── 3. Features and target ───────────────────────────────────────────
FEATURES = [
    "heart_rate", "spo2", "respiratory_rate",
    "temperature", "blood_pressure_sys",
    "age", "admission_days"
]

X = df[FEATURES]
y = df["deteriorated"]

# ── 4. Train / test split ────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# ── 5. Build pipeline (scaler + model) ───────────────────────────────
pipeline = Pipeline([
    ("scaler", StandardScaler()),
    ("model",  LogisticRegression(max_iter=1000, random_state=42))
])

# ── 6. Train ─────────────────────────────────────────────────────────
pipeline.fit(X_train, y_train)
print("Model trained successfully.")

# ── 7. Evaluate ──────────────────────────────────────────────────────
y_pred      = pipeline.predict(X_test)
y_pred_prob = pipeline.predict_proba(X_test)[:, 1]
auc         = roc_auc_score(y_test, y_pred_prob)

print("\n── Evaluation on held-out test set ──")
print(classification_report(y_test, y_pred,
      target_names=["Stable", "Deteriorating"]))
print(f"ROC-AUC Score : {auc:.3f}")
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# ── 8. Save model ────────────────────────────────────────────────────
MODEL_PATH = "app/ml/deterioration_model.pkl"
joblib.dump(pipeline, MODEL_PATH)
print(f"\nModel saved → {MODEL_PATH}")
print("Done. You can now load this model in FastAPI.")