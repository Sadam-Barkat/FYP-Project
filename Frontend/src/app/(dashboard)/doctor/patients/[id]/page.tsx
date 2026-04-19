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

type PatientStatus = "Normal" | "Critical" | "Emergency";

function getStatusClasses(status: PatientStatus) {
  switch (status) {
    case "Normal":
      return "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20";
    case "Critical":
      return "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20";
    case "Emergency":
      return "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20 animate-pulse";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="discharge-confirm-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="discharge-confirm-title" className="text-lg font-semibold text-gray-800 dark:text-gray-200 p-4 border-b border-gray-200 dark:border-gray-700">
          Discharge patient
        </h3>
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to discharge this patient? They will be removed from your assigned list.
          </p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onConfirm(); }}
            disabled={loading}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg flex items-center gap-2"
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="discharge-message-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          {isError ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          )}
          <h3 id="discharge-message-modal-title" className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {title}
          </h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        </div>
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
            className="px-4 py-2 bg-[#0066cc] text-white text-sm font-medium rounded-lg hover:bg-[#0052a3]"
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
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500 dark:text-gray-400">
        <Loader2 size={24} className="animate-spin" />
        Loading patient data...
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-600 dark:text-gray-300">{error || "Patient not found."}</p>
          <button
            onClick={() => router.push("/doctor")}
            className="mt-4 px-4 py-2 bg-[#0066cc] text-white rounded-lg hover:bg-[#0052a3]"
          >
            Back to My Patients
          </button>
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

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-700 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="truncate text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{patient.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ID: {patient.id} • {patient.age} yrs
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <button
            onClick={openDischargeConfirm}
            disabled={discharging}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-60 sm:w-auto"
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
        <div className="bg-red-500 text-white rounded-xl p-4 flex items-center gap-3 shadow-sm animate-pulse">
          <AlertTriangle size={24} />
          <div>
            <p className="font-bold">CRITICAL ATTENTION REQUIRED</p>
            <p className="text-sm text-red-100">
              Severe deterioration in vital signs. Immediate intervention recommended.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-red-400" />
          <HeartPulse className="text-red-400 mb-2" size={28} />
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Heart Rate
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{lastVitals.heartRate}</h3>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">bpm</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-blue-400" />
          <Activity className="text-blue-400 mb-2" size={28} />
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Blood Pressure
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
              {lastVitals.bloodPressure}
            </h3>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">mmHg</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-sky-400" />
          <Wind className="text-sky-400 mb-2" size={28} />
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            SpO2
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{lastVitals.spo2}</h3>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">%</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-orange-400" />
          <Thermometer className="text-orange-400 mb-2" size={28} />
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Temperature
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
              {lastVitals.temperature}
            </h3>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">°C</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-purple-400" />
          <Activity className="text-purple-400 mb-2" size={28} />
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Resp Rate
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{lastVitals.respRate}</h3>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">/min</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-[400px]">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Vitals Trend (nurse-recorded; updates in real time)
          </h3>
          <div className="flex-1 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No vitals recorded yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, bottom: 5, left: -20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="time"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Recent Readings Log
            </h3>
            <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
              {vitals.slice(0, 5).map((v) => (
                <div
                  key={v.id}
                  className="relative flex items-center justify-between md:justify-normal py-2"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shadow shrink-0 z-10">
                    <Clock size={16} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 shadow-sm ml-2 md:ml-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900 dark:text-white text-sm">
                        {new Date(v.recorded_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      HR: {v.heart_rate ?? "—"} | BP: {v.blood_pressure_sys ?? "—"}/
                      {v.blood_pressure_dia ?? "—"} | SpO2: {v.spo2 ?? "—"}%
                    </p>
                    {v.condition_level && (
                      <p className="text-xs font-medium mt-1">{v.condition_level}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {vitals.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
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
  );
}
