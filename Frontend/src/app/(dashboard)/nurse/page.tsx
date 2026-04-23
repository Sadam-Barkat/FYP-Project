"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  HeartPulse,
  Thermometer,
  Wind,
  CheckCircle,
  AlertTriangle,
  User,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = getApiBaseUrl();

function MessageModal({
  open,
  onClose,
  title,
  message,
  variant = "success",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: "success" | "error";
}) {
  if (!open) return null;
  const isError = variant === "error";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nurse-message-modal-title"
    >
      <div
        className="bg-base-card border border-base-border rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-base-border">
          {isError ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-danger/15">
              <AlertTriangle className="h-5 w-5 text-status-danger" />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-success/15">
              <CheckCircle className="h-5 w-5 text-status-success" />
            </div>
          )}
          <h3 id="nurse-message-modal-title" className="text-text-primary font-semibold text-base">
            {title}
          </h3>
        </div>
        <div className="p-4">
          <p className="text-text-primary text-sm leading-relaxed">{message}</p>
        </div>
        <div className="flex justify-end p-4 border-t border-base-border">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            className="bg-btn-primary text-text-bright font-semibold rounded-xl px-5 py-2.5 shadow-btn hover:shadow-glow-blue hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

type VitalsForm = {
  heartRate: string;
  bpSys: string;
  bpDia: string;
  spo2: string;
  temperature: string;
  respRate: string;
};

type AIResult = "Normal" | "Critical" | "Emergency" | null;

interface AssignedPatient {
  id: number;
  name: string;
  age: number;
}

interface VitalRecord {
  id: number;
  patient_id: number;
  recorded_at: string;
  heart_rate: number | null;
  blood_pressure_sys: number | null;
  blood_pressure_dia: number | null;
  spo2: number | null;
  temperature: number | null;
  respiratory_rate: number | null;
  condition_level: string | null;
}

export default function NurseDashboardPage() {
  const [patients, setPatients] = useState<AssignedPatient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [vitalsHistory, setVitalsHistory] = useState<VitalRecord[]>([]);
  const [loadingVitals, setLoadingVitals] = useState(false);
  const [formData, setFormData] = useState<VitalsForm>({
    heartRate: "",
    bpSys: "",
    bpDia: "",
    spo2: "",
    temperature: "",
    respRate: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof VitalsForm, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AIResult>(null);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageModalTitle, setMessageModalTitle] = useState("Success");
  const [messageModalMessage, setMessageModalMessage] = useState("");
  const [messageModalVariant, setMessageModalVariant] = useState<"success" | "error">("success");
  const [userDisplayName, setUserDisplayName] = useState<string>("");

  const selectedPatient = patients.find((p) => String(p.id) === selectedPatientId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const name =
      sessionStorage.getItem("userName") ||
      localStorage.getItem("userName") ||
      "";
    setUserDisplayName(name);
  }, []);

  const fetchAssignedPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const res = await fetch(`${API_BASE}/api/nurse/patients`, { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please log in again.");
        throw new Error("Failed to load assigned patients.");
      }
      const data = await res.json();
      setPatients(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessageModalTitle("Error");
      setMessageModalMessage(e instanceof Error ? e.message : "Failed to load assigned patients.");
      setMessageModalVariant("error");
      setMessageModalOpen(true);
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  const fetchPatientVitals = useCallback(async (patientId: string) => {
    if (!patientId) {
      setVitalsHistory([]);
      return;
    }
    setLoadingVitals(true);
    try {
      const res = await fetch(`${API_BASE}/api/nurse/patients/${patientId}/vitals`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        setVitalsHistory([]);
        return;
      }
      const data = await res.json();
      setVitalsHistory(Array.isArray(data) ? data : []);
    } catch {
      setVitalsHistory([]);
    } finally {
      setLoadingVitals(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignedPatients();
  }, [fetchAssignedPatients]);

  useEffect(() => {
    setVitalsHistory([]);
    setResult(null);
    if (selectedPatientId) fetchPatientVitals(selectedPatientId);
  }, [selectedPatientId, fetchPatientVitals]);

  // Pre-fill form from latest vitals when patient has history; clear form for new patients
  useEffect(() => {
    if (!selectedPatientId || loadingVitals) return;
    if (vitalsHistory.length > 0) {
      const latest = vitalsHistory[0];
      setFormData({
        heartRate: latest.heart_rate != null ? String(latest.heart_rate) : "",
        bpSys: latest.blood_pressure_sys != null ? String(latest.blood_pressure_sys) : "",
        bpDia: latest.blood_pressure_dia != null ? String(latest.blood_pressure_dia) : "",
        spo2: latest.spo2 != null ? String(latest.spo2) : "",
        temperature: latest.temperature != null ? String(latest.temperature) : "",
        respRate: latest.respiratory_rate != null ? String(latest.respiratory_rate) : "",
      });
    } else {
      setFormData({
        heartRate: "",
        bpSys: "",
        bpDia: "",
        spo2: "",
        temperature: "",
        respRate: "",
      });
    }
    setErrors({});
  }, [selectedPatientId, loadingVitals, vitalsHistory]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof VitalsForm, string>> = {};
    const hr = parseInt(formData.heartRate, 10);
    if (formData.heartRate && (isNaN(hr) || hr < 30 || hr > 220))
      newErrors.heartRate = "Valid range: 30-220";
    const sys = parseInt(formData.bpSys, 10);
    if (formData.bpSys && (isNaN(sys) || sys < 70 || sys > 200)) newErrors.bpSys = "Range: 70-200";
    const dia = parseInt(formData.bpDia, 10);
    if (formData.bpDia && (isNaN(dia) || dia < 40 || dia > 130)) newErrors.bpDia = "Range: 40-130";
    const spo2 = parseInt(formData.spo2, 10);
    if (formData.spo2 && (isNaN(spo2) || spo2 < 50 || spo2 > 100))
      newErrors.spo2 = "Valid range: 50-100";
    const temp = parseFloat(formData.temperature);
    if (
      formData.temperature &&
      (isNaN(temp) || temp < 32 || temp > 43)
    )
      newErrors.temperature = "Valid range: 32-43°C";
    const rr = parseInt(formData.respRate, 10);
    if (formData.respRate && (isNaN(rr) || rr < 8 || rr > 60))
      newErrors.respRate = "Valid range: 8-60";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* Emergency = immediate action. Critical = monitor closely.
   * Emergency: HR < 40 or > 130 bpm; SpO2 < 90%; BP sys < 80 or > 180 mmHg.
   * Critical: HR > 100 bpm; SpO2 < 95%; BP sys > 140 mmHg. */
  const calculateConditionLevel = (data: VitalsForm): AIResult => {
    const hr = parseInt(data.heartRate, 10);
    const spo2 = parseInt(data.spo2, 10);
    const sys = parseInt(data.bpSys, 10);
    if (isNaN(hr) && isNaN(spo2) && isNaN(sys)) return null;
    if (hr > 130 || hr < 40 || (spo2 && spo2 < 90) || (sys && (sys < 80 || sys > 180)))
      return "Emergency";
    if (hr > 100 || (spo2 && spo2 < 95) || (sys && sys > 140)) return "Critical";
    return "Normal";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    const hasAny =
      formData.heartRate ||
      formData.bpSys ||
      formData.bpDia ||
      formData.spo2 ||
      formData.temperature ||
      formData.respRate;
    if (!hasAny) {
      setMessageModalTitle("Cannot record vitals");
      setMessageModalMessage("Please enter at least one vital value.");
      setMessageModalVariant("error");
      setMessageModalOpen(true);
      return;
    }
    if (!validateForm()) return;

    setIsSubmitting(true);
    setResult(null);
    const conditionLevel = calculateConditionLevel(formData);

    try {
      const body: Record<string, number | string | null> = {};
      if (formData.heartRate) body.heart_rate = parseInt(formData.heartRate, 10);
      if (formData.bpSys) body.blood_pressure_sys = parseInt(formData.bpSys, 10);
      if (formData.bpDia) body.blood_pressure_dia = parseInt(formData.bpDia, 10);
      if (formData.spo2) body.spo2 = parseInt(formData.spo2, 10);
      if (formData.temperature) body.temperature = parseFloat(formData.temperature);
      if (formData.respRate) body.respiratory_rate = parseInt(formData.respRate, 10);
      if (conditionLevel) body.condition_level = conditionLevel;

      const res = await fetch(
        `${API_BASE}/api/nurse/patients/${selectedPatientId}/vitals`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Failed to record vitals."
        );
      }
      setResult(conditionLevel);
      setFormData({
        heartRate: "",
        bpSys: "",
        bpDia: "",
        spo2: "",
        temperature: "",
        respRate: "",
      });
      setErrors({});
      setMessageModalTitle("Success");
      setMessageModalMessage(
        selectedPatient
          ? `Vitals recorded successfully for ${selectedPatient.name}. Doctor dashboard will reflect the update.`
          : "Vitals recorded successfully."
      );
      setMessageModalVariant("success");
      setMessageModalOpen(true);
      await fetchPatientVitals(selectedPatientId);
    } catch (err) {
      setMessageModalTitle("Error");
      setMessageModalMessage(
        err instanceof Error ? err.message : "Failed to record vitals."
      );
      setMessageModalVariant("error");
      setMessageModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      heartRate: "",
      bpSys: "",
      bpDia: "",
      spo2: "",
      temperature: "",
      respRate: "",
    });
    setErrors({});
    setResult(null);
    setSelectedPatientId("");
  };

  return (
    <div id="dashboard-content" className="bg-base-surface min-h-screen px-8 py-8 space-y-8">
      <div className="-mx-8 -mt-8 bg-base-card border-b border-base-border px-8 py-4 flex items-start justify-between">
        <div>
        <h2 className="text-text-primary font-semibold text-xl tracking-tight">
          Record Patient Vitals
        </h2>
        <p className="text-text-primary text-sm leading-relaxed mt-1">
          Select an assigned patient and enter latest vital signs. Updates appear on the doctor dashboard.
        </p>
        {userDisplayName && (
          <p className="text-text-secondary text-sm mt-2">
            Logged in as{" "}
            <span className="text-text-primary font-medium">{userDisplayName}</span>
          </p>
        )}
        </div>
      </div>

      <div className="bg-base-card border border-base-border rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="border-b border-base-border bg-base-muted/30 p-4 sm:p-6">
          <label className="text-text-secondary text-sm font-medium mb-1.5 block">
            Select Patient (assigned to you)
          </label>
          <select
            value={selectedPatientId}
            onChange={(e) => {
              setSelectedPatientId(e.target.value);
              setResult(null);
            }}
            disabled={loadingPatients}
            className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full md:max-w-md focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200 appearance-none"
          >
            <option value="">-- Choose a patient --</option>
            {loadingPatients ? (
              <option disabled>Loading…</option>
            ) : (
              patients.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} ({p.age} yrs)
                </option>
              ))
            )}
          </select>
        </div>

        {selectedPatient && (
          <div className="border-b border-base-border bg-base-card p-4 pt-3 sm:p-6 sm:pt-4">
            <p className="text-text-secondary text-xs font-medium uppercase tracking-widest mb-3">
              Selected patient
            </p>
            <div className="flex items-center gap-3 p-4 bg-base-muted rounded-xl border border-base-border">
              <div className="w-12 h-12 rounded-full bg-brand-blue/15 flex items-center justify-center text-brand-blue shrink-0">
                <User size={24} />
              </div>
              <div>
                <p className="text-text-primary font-semibold text-sm">{selectedPatient.name}</p>
                <p className="text-text-muted text-xs mt-0.5">{selectedPatient.age} yrs</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="text-text-secondary text-sm font-medium mb-1.5 block">
                  Heart Rate (bpm)
                </label>
                <input
                  type="number"
                  value={formData.heartRate}
                  onChange={(e) => setFormData({ ...formData, heartRate: e.target.value })}
                  disabled={!selectedPatientId || isSubmitting}
                  className={`bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200 ${
                    errors.heartRate ? "border-status-danger/60 focus:border-status-danger focus:ring-status-danger/20" : ""
                  }`}
                  placeholder="e.g. 75"
                />
                {errors.heartRate && (
                  <p className="text-status-danger text-xs mt-1">{errors.heartRate}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-text-secondary text-sm font-medium mb-1.5 block">
                  Blood Pressure (mmHg)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={formData.bpSys}
                      onChange={(e) => setFormData({ ...formData, bpSys: e.target.value })}
                      disabled={!selectedPatientId || isSubmitting}
                      className={`bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200 ${
                        errors.bpSys ? "border-status-danger/60 focus:border-status-danger focus:ring-status-danger/20" : ""
                      }`}
                      placeholder="Sys"
                    />
                  </div>
                  <span className="text-text-muted font-bold">/</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={formData.bpDia}
                      onChange={(e) => setFormData({ ...formData, bpDia: e.target.value })}
                      disabled={!selectedPatientId || isSubmitting}
                      className={`bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200 ${
                        errors.bpDia ? "border-status-danger/60 focus:border-status-danger focus:ring-status-danger/20" : ""
                      }`}
                      placeholder="Dia"
                    />
                  </div>
                </div>
                {(errors.bpSys || errors.bpDia) && (
                  <p className="text-status-danger text-xs mt-1">{errors.bpSys || errors.bpDia}</p>
                )}
              </div>

              <div>
                <label className="text-text-secondary text-sm font-medium mb-1.5 block">
                  SpO2 (%)
                </label>
                <input
                  type="number"
                  value={formData.spo2}
                  onChange={(e) => setFormData({ ...formData, spo2: e.target.value })}
                  disabled={!selectedPatientId || isSubmitting}
                  className={`bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200 ${
                    errors.spo2 ? "border-status-danger/60 focus:border-status-danger focus:ring-status-danger/20" : ""
                  }`}
                  placeholder="e.g. 98"
                />
                {errors.spo2 && <p className="text-status-danger text-xs mt-1">{errors.spo2}</p>}
              </div>

              <div>
                <label className="text-text-secondary text-sm font-medium mb-1.5 block">
                  Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                  disabled={!selectedPatientId || isSubmitting}
                  className={`bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200 ${
                    errors.temperature ? "border-status-danger/60 focus:border-status-danger focus:ring-status-danger/20" : ""
                  }`}
                  placeholder="e.g. 37.2"
                />
                {errors.temperature && (
                  <p className="text-status-danger text-xs mt-1">{errors.temperature}</p>
                )}
              </div>

              <div>
                <label className="text-text-secondary text-sm font-medium mb-1.5 block">
                  Resp. Rate (bpm)
                </label>
                <input
                  type="number"
                  value={formData.respRate}
                  onChange={(e) => setFormData({ ...formData, respRate: e.target.value })}
                  disabled={!selectedPatientId || isSubmitting}
                  className={`bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200 ${
                    errors.respRate ? "border-status-danger/60 focus:border-status-danger focus:ring-status-danger/20" : ""
                  }`}
                  placeholder="e.g. 16"
                />
                {errors.respRate && (
                  <p className="text-status-danger text-xs mt-1">{errors.respRate}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-base-border">
              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="bg-transparent border border-base-border text-text-secondary rounded-xl px-5 py-2.5 hover:border-brand-blue/50 hover:text-text-bright transition-all duration-200 disabled:opacity-50"
              >
                Clear Form
              </button>
              <button
                type="submit"
                disabled={!selectedPatientId || isSubmitting}
                className="bg-btn-primary text-text-bright font-semibold rounded-xl px-5 py-2.5 shadow-btn hover:shadow-glow-blue hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Activity size={18} />
                )}
                Record Vitals
              </button>
            </div>
          </form>
        </div>
      </div>

      {selectedPatientId && (vitalsHistory.length > 0 || loadingVitals) && (
        <div className="bg-base-card border border-base-border rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.4)] p-6">
          <h3 className="text-text-primary font-semibold text-base mb-5">
            Recent vitals (updates after you record)
          </h3>
          {loadingVitals ? (
            <p className="text-text-muted text-sm">Loading…</p>
          ) : (
            <ul className="space-y-2 text-text-primary text-sm leading-relaxed">
              {vitalsHistory.slice(0, 5).map((v) => (
                <li key={v.id} className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-text-muted text-xs">
                    {new Date(v.recorded_at).toLocaleString()}
                  </span>
                  {v.heart_rate != null && <span>HR: {v.heart_rate}</span>}
                  {(v.blood_pressure_sys != null || v.blood_pressure_dia != null) && (
                    <span>
                      BP: {v.blood_pressure_sys ?? "—"}/{v.blood_pressure_dia ?? "—"}
                    </span>
                  )}
                  {v.spo2 != null && <span>SpO2: {v.spo2}%</span>}
                  {v.temperature != null && <span>Temp: {v.temperature}°C</span>}
                  {v.respiratory_rate != null && <span>RR: {v.respiratory_rate}</span>}
                  {v.condition_level && (
                    <span className="bg-brand-blue/15 text-brand-blue text-xs font-medium px-2.5 py-1 rounded-full">
                      {v.condition_level}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result && (
        <div
          className={`rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.4)] border transition-colors ${
            result === "Normal"
              ? "bg-status-success/10 border-status-success/30"
              : result === "Critical"
                ? "bg-status-warning/10 border-status-warning/30"
                : "bg-status-danger/10 border-status-danger/30 animate-pulse"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center shrink-0 ${
                result === "Normal"
                  ? "bg-status-success/15 text-status-success"
                  : result === "Critical"
                    ? "bg-status-warning/15 text-status-warning"
                    : "bg-status-danger/15 text-status-danger"
              }`}
            >
              {result === "Normal" ? <CheckCircle size={40} /> : <AlertTriangle size={40} />}
            </div>
            <div className="text-center sm:text-left flex-1">
              <h3 className="text-text-primary text-2xl font-bold mb-1">
                Condition:{" "}
                <span
                  className={
                    result === "Normal"
                      ? "text-status-success"
                      : result === "Critical"
                        ? "text-status-warning"
                        : "text-status-danger"
                  }
                >
                  {result}
                </span>
              </h3>
              <p className="text-text-primary text-sm leading-relaxed">
                {result === "Normal" && "Patient vitals are stable. Routine monitoring continues."}
                {result === "Critical" &&
                  "Vitals indicate deterioration. Doctor has been notified for review."}
                {result === "Emergency" &&
                  "CRITICAL ALERT: Emergency protocol triggered. Medical team dispatched."}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="bg-transparent border border-base-border text-text-secondary rounded-xl px-5 py-2.5 hover:border-brand-blue/50 hover:text-text-bright transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCw size={16} /> Next Patient
            </button>
          </div>
        </div>
      )}

      <MessageModal
        open={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        title={messageModalTitle}
        message={messageModalMessage}
        variant={messageModalVariant}
      />
    </div>
  );
}
