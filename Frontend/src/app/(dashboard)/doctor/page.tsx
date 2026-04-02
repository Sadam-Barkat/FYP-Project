"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, Activity, HeartPulse, RefreshCcw, Loader2 } from "lucide-react";
import { useRealtimeEvent } from "@/hooks/useRealtimeEvent";
import { getAuthHeaders } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function useDoctorDisplayName() {
  const [name, setName] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    setName(
      sessionStorage.getItem("userName") || localStorage.getItem("userName") || ""
    );
  }, []);
  return name;
}

type PatientStatus = "Normal" | "Critical" | "Emergency";

function getSeverityScore(status: PatientStatus) {
  if (status === "Emergency") return 3;
  if (status === "Critical") return 2;
  return 1;
}

function getStatusClasses(status: PatientStatus) {
  switch (status) {
    case "Normal":
      return "bg-[#10b981]/10 text-[#10b981]";
    case "Critical":
      return "bg-[#f59e0b]/10 text-[#f59e0b]";
    case "Emergency":
      return "bg-[#ef4444]/10 text-[#ef4444] animate-pulse";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

interface AssignedPatient {
  id: number;
  name: string;
  age: number;
}

export default function DoctorDashboardPage() {
  const [patients, setPatients] = useState<AssignedPatient[]>([]);
  const [latestCondition, setLatestCondition] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const userDisplayName = useDoctorDisplayName();

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/doctor/patients`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please log in again.");
        throw new Error("Failed to load assigned patients.");
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setPatients(list);
      if (list.length === 0) {
        setLatestCondition({});
        return;
      }
      const conditionMap: Record<number, string> = {};
      await Promise.all(
        list.slice(0, 30).map(async (p: AssignedPatient) => {
          try {
            const vRes = await fetch(
              `${API_BASE}/api/doctor/patients/${p.id}/vitals`,
              { headers: getAuthHeaders() }
            );
            if (!vRes.ok) return;
            const vitals = await vRes.json();
            const latest = Array.isArray(vitals) ? vitals[0] : null;
            if (latest?.condition_level)
              conditionMap[p.id] = latest.condition_level;
          } catch {
            // ignore per-patient failure
          }
        })
      );
      setLatestCondition((prev) => ({ ...prev, ...conditionMap }));
    } catch {
      setPatients([]);
      setLatestCondition({});
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useRealtimeEvent("vitals_updated", () => {
    fetchPatients();
  });
  useRealtimeEvent("patient_discharged", () => {
    fetchPatients();
  });

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchPatients();
  };

  const sortedPatients = useMemo(
    () =>
      [...patients].sort((a, b) => {
        const statusA = (latestCondition[a.id] || "Normal") as PatientStatus;
        const statusB = (latestCondition[b.id] || "Normal") as PatientStatus;
        return getSeverityScore(statusB) - getSeverityScore(statusA);
      }),
    [patients, latestCondition]
  );

  const hasEmergency = sortedPatients.some(
    (p) => (latestCondition[p.id] || "").toLowerCase() === "emergency"
  );

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-[#1e40af] dark:text-[#60a5fa] sm:text-3xl">
            My Patients Overview
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Prioritized view of your assigned patients. Updates in real time when nurses record vitals.
          </p>
          {userDisplayName && (
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">
              Logged in as{" "}
              <span className="text-[#0066cc] dark:text-[#60a5fa]">{userDisplayName}</span>
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 xs:flex-row xs:flex-wrap sm:w-auto sm:items-center sm:gap-3">
          <Link
            href="/doctor/analytics"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#e6f2ff] px-4 py-2.5 text-sm font-medium text-[#0066cc] transition-colors hover:bg-[#d0e6ff] dark:bg-[#1e3a5f] dark:text-[#60a5fa]"
          >
            <Activity size={16} />
            View My Analytics
          </Link>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCcw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
          <Loader2 size={20} className="animate-spin" />
          Loading assigned patients...
        </div>
      )}

      {!loading && patients.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
          No patients assigned to you. The list updates when reception assigns new patients.
        </div>
      )}

      {hasEmergency && !loading && (
        <div className="bg-[#fef2f2] dark:bg-red-900/20 border border-[#fecaca] dark:border-red-800 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-full bg-[#fee2e2] dark:bg-red-900/40 text-[#ef4444]">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#b91c1c] dark:text-red-300">
              Emergency patients detected
            </p>
            <p className="text-xs text-[#7f1d1d] dark:text-red-200/80">
              Patients marked as Emergency are at the top for immediate attention.
            </p>
          </div>
        </div>
      )}

      {!loading && sortedPatients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedPatients.map((patient) => {
            const status = (latestCondition[patient.id] || "Normal") as PatientStatus;
            return (
              <Link
                key={patient.id}
                href={`/doctor/patients/${patient.id}`}
                className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-[#1e40af]/30 dark:hover:border-[#60a5fa]/30 transition-all flex flex-col justify-between min-h-[160px]"
              >
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        #{patient.id}
                      </p>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mt-1">
                        {patient.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {patient.age} yrs
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(status)}`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2 mt-1">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Vitals updated by nurse. View details for full history and discharge.
                    </p>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30 rounded-b-xl">
                  <span>Assigned patient</span>
                  <span className="group-hover:text-[#1e40af] dark:group-hover:text-[#60a5fa] font-medium transition-colors">
                    View details →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
