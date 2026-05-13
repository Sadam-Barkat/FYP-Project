"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Heart,
  Thermometer,
  Wind,
  CheckCircle,
  AlertTriangle,
  User,
  RefreshCw,
  Loader2,
  Info,
  RotateCcw,
  Gauge,
  CircleDot,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = getApiBaseUrl();

function nurseVitalsConditionBadgeClass(level: string): string {
  const k = level.trim().toLowerCase();
  if (k === "emergency") {
    return "rounded-full border border-rose-400/75 bg-rose-100/95 px-2.5 py-1 text-xs font-semibold text-rose-900 shadow-[0_1px_3px_rgba(244,63,94,0.15)] dark:border-rose-500/45 dark:bg-rose-950/65 dark:text-rose-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_16px_rgba(244,63,94,0.28)]";
  }
  if (k === "critical") {
    return "rounded-full border border-amber-400/80 bg-amber-100/95 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow-[0_1px_3px_rgba(245,158,11,0.15)] dark:border-amber-500/45 dark:bg-amber-950/60 dark:text-amber-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_16px_rgba(245,158,11,0.22)]";
  }
  return "rounded-full border border-emerald-400/75 bg-emerald-100/95 px-2.5 py-1 text-xs font-semibold text-emerald-950 shadow-[0_1px_3px_rgba(16,185,129,0.12)] dark:border-emerald-500/45 dark:bg-emerald-950/60 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_16px_rgba(52,211,153,0.2)]";
}

function nurseVitalsHistoryRowBorderClass(level: string | null): string {
  if (!level) return "";
  const k = level.trim().toLowerCase();
  if (k === "emergency") return "border-l-[3px] border-l-rose-500 dark:border-l-rose-500/90";
  if (k === "critical") return "border-l-[3px] border-l-amber-500 dark:border-l-amber-500/90";
  if (k === "normal") return "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-500/90";
  return "";
}

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nurse-message-modal-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-violet-200/90 bg-white/95 shadow-[0_24px_60px_rgba(124,58,237,0.15),0_0_1px_rgba(124,58,237,0.2)] backdrop-blur-md dark:border-violet-400/30 dark:bg-gradient-to-b dark:from-[#151b2e] dark:to-[#0f141f] dark:shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_60px_rgba(139,92,246,0.18)] dark:backdrop-blur-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-violet-200/80 p-4 dark:border-violet-500/25">
          {isError ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-danger/15">
              <AlertTriangle className="h-5 w-5 text-status-danger" />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-success/15">
              <CheckCircle className="h-5 w-5 text-status-success" />
            </div>
          )}
          <h3 id="nurse-message-modal-title" className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
        </div>
        <div className="p-4">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
        </div>
        <div className="flex justify-end border-t border-violet-200/80 p-4 dark:border-violet-500/25">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 font-semibold text-white shadow-[0_0_24px_rgba(139,92,246,0.35)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(59,130,246,0.4)] active:scale-[0.98]"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function NurseVitalsNumberInput({
  id,
  "aria-labelledby": ariaLabelledby,
  "aria-label": ariaLabel,
  value,
  onChange,
  placeholder,
  step,
  inputMode = "numeric",
  disabled,
  wrapperClassName,
  inputClassName,
  stepUpLabel = "Increase value",
  stepDownLabel = "Decrease value",
}: {
  id: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  step: number;
  inputMode?: "numeric" | "decimal";
  disabled?: boolean;
  wrapperClassName: string;
  inputClassName: string;
  stepUpLabel?: string;
  stepDownLabel?: string;
}) {
  const bump = (dir: 1 | -1) => {
    if (disabled) return;
    const parsed = parseFloat(value.replace(",", "."));
    const fallback = parseFloat(String(placeholder).replace(",", "."));
    const base = Number.isFinite(parsed)
      ? parsed
      : Number.isFinite(fallback)
        ? fallback
        : 0;
    const next = base + step * dir;
    const fractional = step % 1 !== 0;
    if (fractional) {
      const rounded = Math.round(next * 100) / 100;
      onChange(rounded.toFixed(1));
    } else {
      onChange(String(Math.round(next)));
    }
  };

  const stepperBtn =
    "flex h-[1.125rem] w-[1.375rem] shrink-0 items-center justify-center border-transparent bg-violet-100/95 text-violet-700 transition-colors hover:bg-violet-200 hover:text-violet-950 active:bg-violet-300/80 disabled:pointer-events-none disabled:opacity-40 dark:bg-violet-950/55 dark:text-violet-200/95 dark:hover:bg-violet-500/30 dark:hover:text-white dark:active:bg-violet-500/40";

  return (
    <div
      className={`group relative focus-within:z-[2] focus-within:[&_.nurse-vitals-stepper]:opacity-100 focus-within:[&_.nurse-vitals-stepper]:pointer-events-auto ${wrapperClassName}`}
    >
      <input
        id={id}
        type="number"
        step={step}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-labelledby={ariaLabelledby}
        aria-label={ariaLabel}
        className={`${inputClassName} pr-[2rem]`}
      />
      <div
        className={`nurse-vitals-stepper pointer-events-none absolute inset-y-0 right-1.5 z-[1] flex items-center opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 ${disabled ? "hidden" : ""}`}
        aria-hidden={disabled}
      >
        <div className="pointer-events-auto flex flex-col overflow-hidden rounded-md border border-violet-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1),0_1px_2px_rgba(124,58,237,0.12)] dark:border-violet-500/40 dark:bg-[#060a12] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <button
            type="button"
            disabled={disabled}
            className={`${stepperBtn} rounded-b-none border-b border-violet-300/60 dark:border-violet-500/30`}
            onClick={() => bump(1)}
            aria-label={stepUpLabel}
          >
            <ChevronUp className="h-2.5 w-2.5 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            disabled={disabled}
            className={`${stepperBtn} rounded-t-none`}
            onClick={() => bump(-1)}
            aria-label={stepDownLabel}
          >
            <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
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

  const selectFieldRing =
    "rounded-xl border border-violet-300/80 bg-white/95 py-3 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_1px_3px_rgba(124,58,237,0.06)] backdrop-blur-sm placeholder:text-slate-400 transition-all duration-200 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400/35 disabled:opacity-45 hover:border-violet-400 dark:border-violet-500/40 dark:bg-[#060a12]/90 dark:text-white dark:shadow-none dark:placeholder:text-slate-500 dark:focus:border-cyan-400/70 dark:focus:ring-violet-500/35 dark:hover:border-violet-400/55";
  /** Right padding for built-in stepper column (see `NurseVitalsNumberInput`). */
  const numberInputRing =
    "nurse-vitals-number w-full min-h-[3.5rem] min-w-0 rounded-xl border border-violet-300/80 bg-white/95 py-4 pl-4 text-lg tabular-nums text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_1px_3px_rgba(124,58,237,0.06)] backdrop-blur-sm placeholder:text-slate-400 transition-all duration-200 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400/35 disabled:opacity-45 hover:border-violet-400 dark:border-violet-500/40 dark:bg-[#060a12]/90 dark:text-white dark:shadow-none dark:placeholder:text-slate-500 dark:focus:border-cyan-400/70 dark:focus:ring-violet-500/35 dark:hover:border-violet-400/55";
  const fieldErr =
    "border-rose-500 focus:border-rose-500 focus:ring-rose-400/35 dark:border-rose-500/70 dark:focus:border-rose-400 dark:focus:ring-rose-500/25";
  /** Dark mode uses a single gradient layer so light theme stops cannot bleed through. */
  const vitalCardShell =
    "group relative rounded-2xl border border-violet-200/90 bg-gradient-to-b from-white via-violet-50/60 to-slate-50/95 p-4 shadow-[0_8px_28px_rgba(124,58,237,0.08),inset_0_1px_0_rgba(255,255,255,0.92)] transition-all duration-300 hover:border-violet-400/70 hover:shadow-[0_14px_40px_rgba(139,92,246,0.15)] dark:border-violet-500/25 dark:bg-none dark:bg-[linear-gradient(180deg,#191f38f2_0%,#14192fff_42%,#0c101cf5_100%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_40px_rgba(0,0,0,0.45)] dark:hover:border-violet-400/50 dark:hover:shadow-[0_12px_40px_rgba(139,92,246,0.14)]";
  const vitalUnitPill =
    "flex min-h-[3.5rem] min-w-[3.25rem] shrink-0 items-center justify-center rounded-xl border border-violet-300/70 bg-gradient-to-b from-violet-100/95 to-violet-50/90 px-3 text-sm font-semibold tabular-nums text-violet-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-violet-500/30 dark:bg-none dark:bg-violet-950/55 dark:text-violet-200/95 dark:shadow-none";

  return (
    <div
      id="dashboard-content"
      className="relative isolate mx-auto max-w-7xl space-y-6 overflow-x-hidden pb-8 text-slate-800 dark:text-slate-100 min-h-full px-4 py-6 sm:px-6 lg:px-8"
    >
      <div
        className="pointer-events-none absolute -left-40 top-20 h-[380px] w-[380px] rounded-full bg-violet-400/25 blur-[100px] dark:bg-violet-600/14"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 top-1/4 h-[320px] w-[320px] rounded-full bg-cyan-400/20 blur-[90px] dark:bg-cyan-500/10"
        aria-hidden
      />

      {/* Hero — original neon medical banner */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-200/90 bg-gradient-to-br from-violet-100 via-white to-sky-50 p-6 shadow-[0_20px_50px_rgba(124,58,237,0.11),0_0_48px_rgba(56,189,248,0.08)] dark:border-violet-400/25 dark:from-[#1f1038] dark:via-[#141a30] dark:to-[#081018] dark:shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_80px_rgba(139,92,246,0.12)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_20%,rgba(124,58,237,0.18),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_20%_20%,rgba(167,139,250,0.12),transparent)]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_90%_80%,rgba(34,211,238,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_50%_at_90%_80%,rgba(34,211,238,0.08),transparent)]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(167,139,250,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.5) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-violet-400/70 via-fuchsia-500/35 to-cyan-400/55 opacity-90" aria-hidden />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center">
              <div
                className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 opacity-30 blur-lg"
                aria-hidden
              />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-400 shadow-[0_12px_36px_rgba(59,130,246,0.35)] ring-2 ring-white/80 dark:shadow-[0_12px_36px_rgba(59,130,246,0.45)] dark:ring-white/10">
                <Activity className="h-8 w-8 text-white" strokeWidth={2.25} aria-hidden />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300/85">
                Clinical workspace
              </p>
              <h1 className="mt-1 bg-gradient-to-r from-violet-950 via-violet-700 to-cyan-700 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-white dark:via-violet-100 dark:to-cyan-200 sm:text-3xl">
                Record Patient Vitals
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Select an assigned patient and enter the latest vital signs. Updates appear on the
                doctor dashboard.
              </p>
              {userDisplayName && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-violet-200/90 bg-white/75 px-4 py-1.5 text-sm text-slate-600 shadow-[0_4px_16px_rgba(124,58,237,0.08)] backdrop-blur-sm dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-slate-300 dark:shadow-none">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.85)] dark:bg-emerald-400" aria-hidden />
                  Logged in as{" "}
                  <span className="bg-gradient-to-r from-violet-700 to-fuchsia-700 bg-clip-text font-semibold text-transparent dark:from-violet-300 dark:to-fuchsia-300">
                    {userDisplayName}
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="relative mx-auto flex h-36 w-36 shrink-0 items-center justify-center lg:mx-0 lg:h-40 lg:w-40">
            <div className="absolute inset-2 rounded-full border border-violet-300/40 dark:border-violet-500/15" aria-hidden />
            <div className="absolute inset-0 animate-[spin_28s_linear_infinite] rounded-full border border-dashed border-violet-400/35 opacity-60 dark:border-violet-400/20 dark:opacity-50" aria-hidden />
            <div className="absolute inset-0 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-600/20" aria-hidden />
            <svg viewBox="0 0 120 120" className="relative h-full w-full drop-shadow-[0_0_18px_rgba(167,139,250,0.55)]" aria-hidden>
              <path
                d="M60 95 C20 60 20 35 45 28 C58 24 60 42 60 42 C60 42 62 24 75 28 C100 35 100 60 60 95Z"
                fill="none"
                stroke="url(#nhGrad)"
                strokeWidth="2.5"
              />
              <defs>
                <linearGradient id="nhGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="12,62 28,62 36,48 44,76 52,40 60,62 68,52 76,68 84,56 92,62 108,62"
                opacity="0.85"
              />
            </svg>
          </div>
        </div>
      </section>

      <div className="relative rounded-[1.25rem] bg-gradient-to-br from-violet-400/35 via-fuchsia-400/18 to-cyan-400/25 p-px shadow-[0_16px_48px_rgba(124,58,237,0.14)] dark:from-violet-500/40 dark:via-fuchsia-500/22 dark:to-cyan-500/32 dark:shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="overflow-hidden rounded-[1.2rem] border border-violet-200/70 bg-white/92 backdrop-blur-xl dark:border-white/[0.05] dark:bg-[#090f18]/98">
          {/* Step 1 */}
          <div className="border-b border-violet-200/80 bg-gradient-to-r from-violet-50/95 via-white to-indigo-50/90 px-5 py-5 dark:border-violet-500/15 dark:from-[#101827]/95 dark:via-[#0d1320]/98 dark:to-[#101827]/95 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/90 to-fuchsia-700/80 text-sm font-bold text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)] ring-2 ring-violet-400/25">
                1
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Select Patient{" "}
                <span className="font-normal text-slate-500 dark:text-slate-400">(assigned to you)</span>
              </h2>
            </div>
            <label htmlFor="nurse-patient-select" className="sr-only">
              Select patient assigned to you
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-4 top-1/2 z-[1] h-5 w-5 -translate-y-1/2 text-violet-600 dark:text-violet-400/90"
                aria-hidden
              />
              <select
                id="nurse-patient-select"
                value={selectedPatientId}
                onChange={(e) => {
                  setSelectedPatientId(e.target.value);
                  setResult(null);
                }}
                disabled={loadingPatients}
                className={`${selectFieldRing} w-full appearance-none py-3.5 pl-12 pr-10`}
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
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-violet-500 dark:text-violet-400/75">
                ▾
              </span>
            </div>

            {selectedPatient && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-cyan-300/50 bg-gradient-to-r from-sky-50/95 to-cyan-50/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-cyan-500/25 dark:from-[#0c1424]/95 dark:to-[#080f18]/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400/40 to-cyan-400/30 text-sky-700 shadow-[0_4px_16px_rgba(14,165,233,0.2)] ring-2 ring-sky-300/50 dark:from-sky-500/30 dark:to-cyan-500/20 dark:text-sky-300 dark:shadow-[0_0_20px_rgba(56,189,248,0.25)] dark:ring-sky-400/15">
                  <User size={22} aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">
                    Selected patient
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">{selectedPatient.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{selectedPatient.age} yrs</p>
                </div>
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div className="bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(124,58,237,0.09),transparent)] px-5 py-6 dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(139,92,246,0.045),transparent)] sm:px-6">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/90 to-fuchsia-700/80 text-sm font-bold text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)] ring-2 ring-violet-400/25">
                  2
                </span>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Enter Latest Vital Signs</h2>
              </div>
              <span className="rounded-full border border-violet-300/80 bg-gradient-to-r from-violet-100 via-fuchsia-50 to-violet-100 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-900 shadow-[0_4px_14px_rgba(124,58,237,0.12)] backdrop-blur-sm dark:border-violet-400/35 dark:from-violet-950/90 dark:via-fuchsia-950/45 dark:to-violet-950/90 dark:text-violet-100 dark:shadow-[0_0_20px_rgba(167,139,250,0.2)]">
                Enter at least one vital
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {!selectedPatientId && (
                <p className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/25 dark:text-amber-100/95">
                  Select a patient in step 1 first — vital fields stay inactive until then.
                </p>
              )}
              <div
                className="nurse-vitals-stepper-scope grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 [&:focus-within_.nurse-vitals-stepper]:pointer-events-none [&:focus-within_.nurse-vitals-stepper]:!opacity-0 [&:focus-within_.group:focus-within_.nurse-vitals-stepper]:pointer-events-auto [&:focus-within_.group:focus-within_.nurse-vitals-stepper]:!opacity-100"
              >
                {/* Heart rate */}
                <div className={vitalCardShell}>
                  <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/12 to-transparent opacity-90 dark:via-white/30 dark:opacity-75" aria-hidden />
                  <div className="relative flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 shadow-[0_4px_14px_rgba(244,63,94,0.12)] transition-transform duration-300 group-hover:scale-105 dark:bg-rose-500/20 dark:text-rose-300 dark:shadow-[0_0_14px_rgba(244,63,94,0.22)]">
                        <Heart className="h-5 w-5" aria-hidden />
                      </div>
                      <label htmlFor="nurse-vitals-hr" className="min-w-0 flex-1 text-sm font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
                        Heart rate
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">Beats per minute</span>
                      </label>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-stretch gap-3">
                        <NurseVitalsNumberInput
                          id="nurse-vitals-hr"
                          value={formData.heartRate}
                          onChange={(heartRate) => setFormData({ ...formData, heartRate })}
                          placeholder="75"
                          step={1}
                          disabled={!selectedPatientId || isSubmitting}
                          wrapperClassName="min-w-0 flex-1"
                          inputClassName={`${numberInputRing} ${errors.heartRate ? fieldErr : ""}`}
                          stepUpLabel="Increase heart rate"
                          stepDownLabel="Decrease heart rate"
                        />
                        <span className={vitalUnitPill}>bpm</span>
                      </div>
                      {errors.heartRate && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">{errors.heartRate}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Blood pressure */}
                <div className={vitalCardShell}>
                  <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/12 to-transparent opacity-90 dark:via-white/30 dark:opacity-75" aria-hidden />
                  <div className="relative flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 shadow-[0_4px_14px_rgba(245,158,11,0.12)] transition-transform duration-300 group-hover:scale-105 dark:bg-amber-500/20 dark:text-amber-300 dark:shadow-[0_0_14px_rgba(245,158,11,0.22)]">
                        <Gauge className="h-5 w-5" aria-hidden />
                      </div>
                      <span id="nurse-vitals-bp-label" className="min-w-0 flex-1 text-sm font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
                        Blood pressure
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">Systolic / diastolic (mmHg)</span>
                      </span>
                    </div>
                    <div className="flex flex-col gap-1" role="group" aria-labelledby="nurse-vitals-bp-label">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
                        <NurseVitalsNumberInput
                          id="nurse-vitals-bpsys"
                          aria-label="Systolic blood pressure"
                          value={formData.bpSys}
                          onChange={(bpSys) => setFormData({ ...formData, bpSys })}
                          placeholder="120"
                          step={1}
                          disabled={!selectedPatientId || isSubmitting}
                          wrapperClassName="min-w-0 w-full"
                          inputClassName={`${numberInputRing} ${errors.bpSys ? fieldErr : ""}`}
                          stepUpLabel="Increase systolic blood pressure"
                          stepDownLabel="Decrease systolic blood pressure"
                        />
                        <span className="flex items-center justify-center text-lg font-bold text-slate-400 dark:text-slate-500" aria-hidden>
                          /
                        </span>
                        <NurseVitalsNumberInput
                          id="nurse-vitals-bpdia"
                          aria-label="Diastolic blood pressure"
                          value={formData.bpDia}
                          onChange={(bpDia) => setFormData({ ...formData, bpDia })}
                          placeholder="80"
                          step={1}
                          disabled={!selectedPatientId || isSubmitting}
                          wrapperClassName="min-w-0 w-full"
                          inputClassName={`${numberInputRing} ${errors.bpDia ? fieldErr : ""}`}
                          stepUpLabel="Increase diastolic blood pressure"
                          stepDownLabel="Decrease diastolic blood pressure"
                        />
                      </div>
                      {(errors.bpSys || errors.bpDia) && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">{errors.bpSys || errors.bpDia}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* SpO2 */}
                <div className={vitalCardShell}>
                  <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/12 to-transparent opacity-90 dark:via-white/30 dark:opacity-75" aria-hidden />
                  <div className="relative flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 shadow-[0_4px_14px_rgba(14,165,233,0.12)] transition-transform duration-300 group-hover:scale-105 dark:bg-sky-500/20 dark:text-sky-300 dark:shadow-[0_0_14px_rgba(14,165,233,0.22)]">
                        <CircleDot className="h-5 w-5" aria-hidden />
                      </div>
                      <label htmlFor="nurse-vitals-spo2" className="min-w-0 flex-1 text-sm font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
                        SpO₂
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">Oxygen saturation</span>
                      </label>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-stretch gap-3">
                        <NurseVitalsNumberInput
                          id="nurse-vitals-spo2"
                          value={formData.spo2}
                          onChange={(spo2) => setFormData({ ...formData, spo2 })}
                          placeholder="98"
                          step={1}
                          disabled={!selectedPatientId || isSubmitting}
                          wrapperClassName="min-w-0 flex-1"
                          inputClassName={`${numberInputRing} ${errors.spo2 ? fieldErr : ""}`}
                          stepUpLabel="Increase SpO₂"
                          stepDownLabel="Decrease SpO₂"
                        />
                        <span className={vitalUnitPill}>%</span>
                      </div>
                      {errors.spo2 && <p className="text-xs text-rose-600 dark:text-rose-400">{errors.spo2}</p>}
                    </div>
                  </div>
                </div>

                {/* Temperature */}
                <div className={vitalCardShell}>
                  <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/12 to-transparent opacity-90 dark:via-white/30 dark:opacity-75" aria-hidden />
                  <div className="relative flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 shadow-[0_4px_14px_rgba(52,211,153,0.12)] transition-transform duration-300 group-hover:scale-105 dark:bg-emerald-500/20 dark:text-emerald-300 dark:shadow-[0_0_14px_rgba(52,211,153,0.22)]">
                        <Thermometer className="h-5 w-5" aria-hidden />
                      </div>
                      <label htmlFor="nurse-vitals-temp" className="min-w-0 flex-1 text-sm font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
                        Temperature
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">Degrees Celsius</span>
                      </label>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-stretch gap-3">
                        <NurseVitalsNumberInput
                          id="nurse-vitals-temp"
                          value={formData.temperature}
                          onChange={(temperature) => setFormData({ ...formData, temperature })}
                          placeholder="37.2"
                          step={0.1}
                          inputMode="decimal"
                          disabled={!selectedPatientId || isSubmitting}
                          wrapperClassName="min-w-0 flex-1"
                          inputClassName={`${numberInputRing} ${errors.temperature ? fieldErr : ""}`}
                          stepUpLabel="Increase temperature"
                          stepDownLabel="Decrease temperature"
                        />
                        <span className={vitalUnitPill}>°C</span>
                      </div>
                      {errors.temperature && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">{errors.temperature}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Respiratory rate */}
                <div className={vitalCardShell}>
                  <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/12 to-transparent opacity-90 dark:via-white/30 dark:opacity-75" aria-hidden />
                  <div className="relative flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/18 text-violet-800 shadow-[0_4px_14px_rgba(139,92,246,0.14)] transition-transform duration-300 group-hover:scale-105 dark:bg-violet-500/25 dark:text-violet-200 dark:shadow-[0_0_14px_rgba(167,139,250,0.3)]">
                        <Wind className="h-5 w-5" aria-hidden />
                      </div>
                      <label htmlFor="nurse-vitals-rr" className="min-w-0 flex-1 text-sm font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
                        Respiratory rate
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">Breaths per minute</span>
                      </label>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-stretch gap-3">
                        <NurseVitalsNumberInput
                          id="nurse-vitals-rr"
                          value={formData.respRate}
                          onChange={(respRate) => setFormData({ ...formData, respRate })}
                          placeholder="16"
                          step={1}
                          disabled={!selectedPatientId || isSubmitting}
                          wrapperClassName="min-w-0 flex-1"
                          inputClassName={`${numberInputRing} ${errors.respRate ? fieldErr : ""}`}
                          stepUpLabel="Increase respiratory rate"
                          stepDownLabel="Decrease respiratory rate"
                        />
                        <span className={vitalUnitPill}>bpm</span>
                      </div>
                      {errors.respRate && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">{errors.respRate}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-white via-violet-50/40 to-slate-50 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] dark:border-white/[0.06] dark:from-[#0c121f]/95 dark:via-[#080e18]/98 dark:to-[#0a101c]/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/45 to-transparent dark:via-violet-400/35" aria-hidden />
                <div className="flex items-start gap-3 text-sm leading-snug text-slate-600 dark:text-slate-400">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 ring-1 ring-sky-400/30 dark:text-sky-400 dark:ring-sky-400/20">
                    <Info className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="pt-1">Please ensure all values are accurate before submitting.</span>
                </div>
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-950 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:shadow-none dark:hover:border-violet-400/45 dark:hover:bg-violet-500/10 dark:hover:text-white"
                  >
                    <RotateCcw size={16} aria-hidden />
                    Clear Form
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedPatientId || isSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600 px-7 py-2.5 text-sm font-bold text-white shadow-[0_4px_24px_rgba(139,92,246,0.45)] ring-2 ring-white/10 transition-all duration-200 hover:shadow-[0_8px_36px_rgba(167,139,250,0.45)] hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100"
                  >
                    {isSubmitting ? (
                      <Loader2 size={18} className="animate-spin" aria-hidden />
                    ) : (
                      <Activity size={18} aria-hidden />
                    )}
                    Record Vitals
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {selectedPatientId && (vitalsHistory.length > 0 || loadingVitals) && (
        <div className="relative rounded-[1.25rem] bg-gradient-to-br from-violet-400/30 via-transparent to-cyan-400/22 p-px shadow-[0_14px_40px_rgba(124,58,237,0.12)] dark:from-violet-500/35 dark:to-cyan-500/28 dark:shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
          <section className="rounded-[1.2rem] border border-violet-200/80 bg-white/92 p-6 backdrop-blur-xl dark:border-white/[0.05] dark:bg-[#090f18]/96">
            <div className="mb-5 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 shadow-[0_0_12px_rgba(167,139,250,0.45)] dark:from-violet-400 dark:to-cyan-400 dark:shadow-[0_0_12px_rgba(167,139,250,0.7)]" aria-hidden />
              <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                Recent vitals{" "}
                <span className="font-normal text-slate-500 dark:text-slate-500">(updates after you record)</span>
              </h3>
            </div>
            {loadingVitals ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
            ) : (
              <ul className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {vitalsHistory.slice(0, 5).map((v) => (
                  <li
                    key={v.id}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-violet-200/90 bg-gradient-to-r from-white to-violet-50/60 py-3 pl-3 pr-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-violet-500/18 dark:bg-none dark:bg-[linear-gradient(90deg,#0f1628f0_0%,#0a0f1aed_100%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${nurseVitalsHistoryRowBorderClass(v.condition_level)}`}
                  >
                    <span className="text-xs text-slate-500 dark:text-slate-500">
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
                      <span className={nurseVitalsConditionBadgeClass(v.condition_level)}>
                        {v.condition_level}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {result && (
        <div
          className={`relative overflow-hidden rounded-3xl border p-6 backdrop-blur-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)] ${
            result === "Normal"
              ? "border-emerald-300/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-[0_16px_48px_rgba(16,185,129,0.12)] dark:border-emerald-400/38 dark:from-emerald-950/40 dark:via-[#0a1218]/92 dark:to-emerald-950/18 dark:shadow-none"
              : result === "Critical"
                ? "border-amber-300/80 bg-gradient-to-br from-amber-50 via-white to-orange-50/80 shadow-[0_16px_48px_rgba(245,158,11,0.12)] dark:border-amber-400/38 dark:from-amber-950/32 dark:via-[#12100c]/92 dark:to-amber-950/12 dark:shadow-none"
                : "animate-pulse border-rose-300/80 bg-gradient-to-br from-rose-50 via-white to-red-50 shadow-[0_16px_48px_rgba(244,63,94,0.12)] dark:border-rose-400/42 dark:from-rose-950/38 dark:via-[#140a10]/95 dark:to-rose-950/22 dark:shadow-none"
          }`}
        >
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl opacity-35"
            aria-hidden
            style={{
              background:
                result === "Normal"
                  ? "radial-gradient(circle, rgba(52,211,153,0.45), transparent)"
                  : result === "Critical"
                    ? "radial-gradient(circle, rgba(245,158,11,0.4), transparent)"
                    : "radial-gradient(circle, rgba(244,63,94,0.45), transparent)",
            }}
          />
          <div className="relative z-10 flex flex-col items-center gap-6 sm:flex-row">
            <div
              className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full ring-2 ring-slate-200/90 dark:ring-white/10 ${
                result === "Normal"
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/18 dark:text-emerald-400"
                  : result === "Critical"
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-500/18 dark:text-amber-400"
                    : "bg-rose-100 text-rose-600 dark:bg-rose-500/18 dark:text-rose-400"
              }`}
            >
              {result === "Normal" ? <CheckCircle size={38} /> : <AlertTriangle size={38} />}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">
                Condition:{" "}
                <span
                  className={
                    result === "Normal"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : result === "Critical"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400"
                  }
                >
                  {result}
                </span>
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {result === "Normal" && "Patient vitals are stable. Routine monitoring continues."}
                {result === "Critical" &&
                  "Vitals indicate deterioration. Doctor has been notified for review."}
                {result === "Emergency" &&
                  "CRITICAL ALERT: Emergency protocol triggered. Medical team dispatched."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-violet-300/90 bg-white px-5 py-2.5 text-sm font-semibold text-violet-900 shadow-sm backdrop-blur-sm transition-all hover:border-violet-500 hover:bg-violet-50 dark:border-violet-500/35 dark:bg-white/[0.06] dark:text-slate-100 dark:shadow-none dark:hover:border-violet-400/55 dark:hover:bg-violet-500/12"
            >
              <RefreshCw size={16} aria-hidden /> Next Patient
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
