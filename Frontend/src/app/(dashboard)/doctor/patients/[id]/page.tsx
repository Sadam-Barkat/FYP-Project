"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  HeartPulse,
  Activity,
  Thermometer,
  Wind,
  AlertTriangle,
  ChevronDown,
  Clock,
  Loader2,
  CheckCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useRealtimeEvent } from "@/hooks/useRealtimeEvent";
import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = getApiBaseUrl();

/** Matches admin overview panel cards (light + dark). */
const panelCard =
  "rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] dark:border-white/[0.06] dark:bg-panel dark:shadow-panel";

type PatientStatus = "Normal" | "Critical" | "Emergency";

function getStatusClasses(status: PatientStatus) {
  switch (status) {
    case "Normal":
      return "bg-status-success/10 text-status-success border-status-success/20";
    case "Critical":
      return "bg-status-warning/10 text-status-warning border-status-warning/20";
    case "Emergency":
      return "bg-status-danger/10 text-status-danger border-status-danger/20 animate-pulse";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-tx-secondary dark:border-white/15";
  }
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

interface PatientInfo {
  id: number;
  name: string;
  age: number;
}

function DischargeConfirmModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="discharge-confirm-title"
    >
      <div
        className={`${panelCard} w-full max-w-md overflow-hidden shadow-panel`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="discharge-confirm-title" className="text-lg font-semibold text-slate-900 dark:text-tx-bright p-4 border-b border-slate-200 dark:border-dash-border">
          Discharge patient
        </h3>
        <div className="p-4">
          <p className="text-sm text-slate-600 dark:text-tx-secondary">
            Are you sure you want to discharge this patient? They will be removed from your assigned list.
          </p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-dash-border bg-slate-50/80 dark:bg-white/[0.03]">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
            className="px-4 py-2 text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 text-sm font-medium dark:text-tx-secondary dark:bg-dash-elevated dark:hover:bg-white/[0.08]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onConfirm(); }}
            disabled={loading}
            className="px-4 py-2 bg-btn-danger text-white text-sm font-medium rounded-xl shadow-md hover:opacity-95 disabled:opacity-60 flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Discharge
          </button>
        </div>
      </div>
    </div>
  );
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="discharge-message-modal-title"
    >
      <div
        className={`${panelCard} w-full max-w-md overflow-hidden shadow-panel`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-dash-border">
          {isError ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-danger/15">
              <AlertTriangle className="h-5 w-5 text-status-danger" />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-success/15">
              <CheckCircle className="h-5 w-5 text-status-success" />
            </div>
          )}
          <h3 id="discharge-message-modal-title" className="text-lg font-semibold text-slate-900 dark:text-tx-bright">
            {title}
          </h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-600 dark:text-tx-secondary">{message}</p>
        </div>
        <div className="flex justify-end p-4 border-t border-slate-200 dark:border-dash-border bg-slate-50/80 dark:bg-white/[0.03]">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
            className="px-4 py-2 bg-btn-primary text-white text-sm font-medium rounded-xl shadow-btn hover:shadow-glow-blue hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const patientId = id ? parseInt(id, 10) : NaN;

  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [discharging, setDischarging] = useState(false);
  const [consultRecording, setConsultRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dischargeConfirmOpen, setDischargeConfirmOpen] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageModalTitle, setMessageModalTitle] = useState("Success");
  const [messageModalMessage, setMessageModalMessage] = useState("");
  const [messageModalVariant, setMessageModalVariant] = useState<"success" | "error">("success");

  const fetchPatientAndVitals = useCallback(async () => {
    if (!id || isNaN(patientId)) return;
    setError(null);
    const headers = getAuthHeaders();
    try {
      // Fetch vitals first; 200 means patient is assigned to this doctor
      const vitalsRes = await fetch(
        `${API_BASE}/api/doctor/patients/${id}/vitals`,
        { headers }
      );
      if (vitalsRes.status === 401) {
        setError("Please log in again.");
        setPatient(null);
        setVitals([]);
        setLoading(false);
        return;
      }
      if (vitalsRes.status === 403) {
        setError("Access denied. Please ensure you're logged in as a doctor.");
        setPatient(null);
        setVitals([]);
        setLoading(false);
        return;
      }
      if (vitalsRes.status === 404 || !vitalsRes.ok) {
        setError("Patient not found or not assigned to you.");
        setPatient(null);
        setVitals([]);
        setLoading(false);
        return;
      }
      const vitalsData: VitalRecord[] = await vitalsRes.json().then((d) => (Array.isArray(d) ? d : []));
      setVitals(vitalsData);

      // Get name/age from list (optional; fallback to "Patient #id" if list fails)
      const listRes = await fetch(`${API_BASE}/api/doctor/patients`, { headers });
      if (listRes.ok) {
        const list: PatientInfo[] = await listRes.json().then((d) => (Array.isArray(d) ? d : []));
        const found = list.find((p) => p.id === patientId);
        setPatient(found ?? { id: patientId, name: `Patient #${patientId}`, age: 0 });
      } else {
        setPatient({ id: patientId, name: `Patient #${patientId}`, age: 0 });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load patient.");
      setPatient(null);
      setVitals([]);
    } finally {
      setLoading(false);
    }
  }, [id, patientId]);

  useEffect(() => {
    fetchPatientAndVitals();
  }, [fetchPatientAndVitals]);

  useRealtimeEvent("vitals_updated", (payload) => {
    const p = payload as { patient_id?: number } | undefined;
    if (p?.patient_id === patientId) fetchPatientAndVitals();
  });

  const openDischargeConfirm = () => {
    if (patient) setDischargeConfirmOpen(true);
  };

  const handleConsultationComplete = async () => {
    if (!patient) return;
    setConsultRecording(true);
    try {
      const res = await fetch(`${API_BASE}/api/doctor/patients/${patientId}/consultation-complete`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ notes: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Failed to record consultation.");
      }
      setMessageModalTitle("Recorded");
      setMessageModalMessage(
        typeof data.message === "string"
          ? data.message
          : "Consultation recorded for billing. Finance will add the fee.",
      );
      setMessageModalVariant("success");
      setMessageModalOpen(true);
    } catch (e) {
      setMessageModalTitle("Error");
      setMessageModalMessage(e instanceof Error ? e.message : "Failed to record consultation.");
      setMessageModalVariant("error");
      setMessageModalOpen(true);
    } finally {
      setConsultRecording(false);
    }
  };

  const handleDischargeConfirm = async () => {
    if (!patient) return;
    setDischarging(true);
    try {
      const res = await fetch(`${API_BASE}/api/doctor/patients/${patientId}/discharge`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Failed to discharge.");
      }
      setDischargeConfirmOpen(false);
      setMessageModalTitle("Success");
      setMessageModalMessage("Patient discharged successfully. Redirecting to your dashboard.");
      setMessageModalVariant("success");
      setMessageModalOpen(true);
      setTimeout(() => router.push("/doctor"), 1500);
    } catch (e) {
      setDischargeConfirmOpen(false);
      setMessageModalTitle("Error");
      setMessageModalMessage(e instanceof Error ? e.message : "Failed to discharge patient.");
      setMessageModalVariant("error");
      setMessageModalOpen(true);
    } finally {
      setDischarging(false);
    }
  };

  if (loading) {
    return (
      <div
        id="dashboard-content"
        className="admin-overview-theme flex min-h-[calc(100dvh-72px)] w-full items-center justify-center bg-gray-50 px-4 dark:bg-dash-bg"
      >
        <div className="flex items-center gap-2 text-slate-500 dark:text-tx-muted">
          <Loader2 size={24} className="animate-spin text-brand-blue" />
          Loading patient data...
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div
        id="dashboard-content"
        className="admin-overview-theme min-h-[calc(100dvh-72px)] w-full bg-gray-50 px-4 py-3 text-gray-900 sm:px-6 dark:bg-dash-bg dark:text-tx-primary"
      >
        <div className="dashboard-page-shell max-w-7xl mx-auto">
          <div className={`${panelCard} p-8 text-center`}>
            <p className="text-slate-600 dark:text-tx-secondary">{error || "Patient not found."}</p>
            <button
              type="button"
              onClick={() => router.push("/doctor")}
              className="mt-4 px-4 py-2.5 bg-btn-primary text-white rounded-xl shadow-btn hover:shadow-glow-blue hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 text-sm font-semibold"
            >
              Back to My Patients
            </button>
          </div>
        </div>
      </div>
    );
  }

  const latest = vitals[0] || null;
  const status: PatientStatus = (latest?.condition_level as PatientStatus) || "Normal";
  const lastVitals = {
    heartRate: latest?.heart_rate ?? "—",
    bloodPressure:
      latest?.blood_pressure_sys != null && latest?.blood_pressure_dia != null
        ? `${latest.blood_pressure_sys}/${latest.blood_pressure_dia}`
        : "—",
    spo2: latest?.spo2 ?? "—",
    temperature: latest?.temperature ?? "—",
    respRate: latest?.respiratory_rate ?? "—",
  };

  const chartData = vitals
    .slice(0, 24)
    .reverse()
    .map((v) => ({
      time: new Date(v.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      heartRate: v.heart_rate ?? 0,
      spo2: v.spo2 ?? 0,
      bloodPressureSys: v.blood_pressure_sys ?? 0,
      bloodPressureDia: v.blood_pressure_dia ?? 0,
    }));

  const chartAxisMuted = "#64748b";
  const chartGrid = "#e2e8f0";

  return (
    <div
      id="dashboard-content"
      className="admin-overview-theme min-h-[calc(100dvh-72px)] w-full bg-gray-50 px-4 py-3 text-gray-900 sm:px-6 dark:bg-dash-bg dark:text-tx-primary"
    >
    <div className="dashboard-page-shell max-w-7xl mx-auto">
      <div className={`${panelCard} p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between`}>
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:border-brand-blue/35 hover:bg-slate-50 hover:text-slate-900 dark:border-white/[0.08] dark:bg-dash-elevated dark:text-tx-secondary dark:hover:bg-white/[0.05] dark:hover:text-tx-bright"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="truncate text-xl font-bold text-slate-900 dark:text-tx-bright sm:text-2xl">{patient.name}</h2>
            <p className="text-sm text-slate-500 dark:text-tx-secondary">
              ID: {patient.id} • {patient.age} yrs
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={handleConsultationComplete}
            disabled={consultRecording}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-blue shadow-sm transition-all hover:border-brand-blue/40 hover:bg-brand-blue/5 disabled:opacity-60 dark:border-white/[0.08] dark:bg-dash-elevated dark:hover:bg-white/[0.05] sm:w-auto"
            title="Care event only — no charges. Finance adds the consultation fee."
          >
            {consultRecording ? <Loader2 size={16} className="animate-spin" /> : null}
            Consultation complete
          </button>
          <button
            type="button"
            onClick={openDischargeConfirm}
            disabled={discharging}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-btn-danger px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-60 sm:w-auto"
          >
            {discharging ? <Loader2 size={16} className="animate-spin" /> : null}
            Discharge Patient
          </button>
          <div
            className={`flex items-center gap-3 rounded-xl border-2 px-4 py-2 shadow-sm sm:px-5 sm:py-2.5 ${getStatusClasses(status)}`}
          >
            <div className="h-3 w-3 shrink-0 rounded-full bg-current" />
            <span className="text-base font-bold sm:text-lg">{status} Condition</span>
          </div>
        </div>
      </div>

      {status === "Emergency" && (
        <div className="rounded-2xl border border-status-danger/40 bg-white px-5 py-4 text-status-danger shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-3 animate-pulse dark:bg-dash-card dark:shadow-panel">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-status-danger/15">
            <AlertTriangle size={22} className="text-status-danger" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-tx-bright">CRITICAL ATTENTION REQUIRED</p>
            <p className="text-sm text-status-danger/95 mt-0.5 dark:text-status-danger">
              Severe deterioration in vital signs. Immediate intervention recommended.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        <div className={`${panelCard} p-5 flex flex-col items-center justify-center relative overflow-hidden`}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-400/90" />
          <HeartPulse className="text-red-400 mb-2" size={28} />
          <p className="text-xs text-slate-500 dark:text-tx-muted font-medium uppercase tracking-wide">
            Heart Rate
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-slate-900 dark:text-tx-bright">{lastVitals.heartRate}</h3>
            <span className="text-sm font-medium text-slate-500 dark:text-tx-secondary">bpm</span>
          </div>
        </div>

        <div className={`${panelCard} p-5 flex flex-col items-center justify-center relative overflow-hidden`}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400/90" />
          <Activity className="text-blue-400 mb-2" size={28} />
          <p className="text-xs text-slate-500 dark:text-tx-muted font-medium uppercase tracking-wide">
            Blood Pressure
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-slate-900 dark:text-tx-bright">
              {lastVitals.bloodPressure}
            </h3>
            <span className="text-sm font-medium text-slate-500 dark:text-tx-secondary">mmHg</span>
          </div>
        </div>

        <div className={`${panelCard} p-5 flex flex-col items-center justify-center relative overflow-hidden`}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-sky-400/90" />
          <Wind className="text-sky-400 mb-2" size={28} />
          <p className="text-xs text-slate-500 dark:text-tx-muted font-medium uppercase tracking-wide">
            SpO2
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-slate-900 dark:text-tx-bright">{lastVitals.spo2}</h3>
            <span className="text-sm font-medium text-slate-500 dark:text-tx-secondary">%</span>
          </div>
        </div>

        <div className={`${panelCard} p-5 flex flex-col items-center justify-center relative overflow-hidden`}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-orange-400/90" />
          <Thermometer className="text-orange-400 mb-2" size={28} />
          <p className="text-xs text-slate-500 dark:text-tx-muted font-medium uppercase tracking-wide">
            Temperature
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-slate-900 dark:text-tx-bright">
              {lastVitals.temperature}
            </h3>
            <span className="text-sm font-medium text-slate-500 dark:text-tx-secondary">°C</span>
          </div>
        </div>

        <div className={`${panelCard} p-5 flex flex-col items-center justify-center relative overflow-hidden`}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-400/90" />
          <Activity className="text-purple-400 mb-2" size={28} />
          <p className="text-xs text-slate-500 dark:text-tx-muted font-medium uppercase tracking-wide">
            Resp Rate
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-slate-900 dark:text-tx-bright">{lastVitals.respRate}</h3>
            <span className="text-sm font-medium text-slate-500 dark:text-tx-secondary">/min</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 ${panelCard} p-6 flex flex-col h-[400px]`}>
          <h3 className="font-semibold text-slate-900 dark:text-tx-bright mb-4">
            Vitals Trend (nurse-recorded; updates in real time)
          </h3>
          <div className="flex-1 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 dark:text-tx-muted text-sm">
                No vitals recorded yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, bottom: 5, left: -20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                  <XAxis
                    dataKey="time"
                    stroke={chartAxisMuted}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke={chartAxisMuted}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke={chartAxisMuted}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid rgb(226 232 240)",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.08)",
                      background: "rgba(255,255,255,0.98)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "10px" }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="heartRate"
                    name="Heart Rate"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="spo2"
                    name="SpO2 %"
                    stroke="#38bdf8"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="bloodPressureSys"
                    name="BP Sys"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className={`${panelCard} p-6`}>
            <h3 className="font-semibold text-slate-900 dark:text-tx-bright mb-4">
              Recent Readings Log
            </h3>
            <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent dark:before:via-dash-border">
              {vitals.slice(0, 5).map((v) => (
                <div
                  key={v.id}
                  className="relative flex items-center justify-between md:justify-normal py-2"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white dark:border-dash-card bg-slate-100 dark:bg-dash-elevated text-slate-500 dark:text-tx-muted shadow-sm shrink-0 z-10">
                    <Clock size={16} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border border-slate-100 bg-slate-50 shadow-sm ml-2 md:ml-0 dark:border-white/[0.06] dark:bg-white/[0.04]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 dark:text-tx-bright text-sm">
                        {new Date(v.recorded_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-tx-secondary">
                      HR: {v.heart_rate ?? "—"} | BP: {v.blood_pressure_sys ?? "—"}/
                      {v.blood_pressure_dia ?? "—"} | SpO2: {v.spo2 ?? "—"}%
                    </p>
                    {v.condition_level && (
                      <p className="text-xs font-medium mt-1 text-slate-700 dark:text-tx-secondary">{v.condition_level}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {vitals.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-tx-muted py-4">
                No vitals recorded yet. Nurse will add readings.
              </p>
            )}
          </div>
        </div>
      </div>

      <DischargeConfirmModal
        open={dischargeConfirmOpen}
        onClose={() => setDischargeConfirmOpen(false)}
        onConfirm={handleDischargeConfirm}
        loading={discharging}
      />
      <MessageModal
        open={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        title={messageModalTitle}
        message={messageModalMessage}
        variant={messageModalVariant}
      />
    </div>
    </div>
  );
}
