"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, Activity, HeartPulse, RefreshCcw, Loader2 } from "lucide-react";
import { useRealtimeEvent } from "@/hooks/useRealtimeEvent";
import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = getApiBaseUrl();

/** Matches admin overview panel cards (light + dark). */
const panelCard =
  "rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] dark:border-white/[0.06] dark:bg-panel dark:shadow-panel";

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
      return "bg-status-success/10 text-status-success text-xs font-medium px-2.5 py-1 rounded-full";
    case "Critical":
      return "bg-status-danger/10 text-status-danger text-xs font-medium px-2.5 py-1 rounded-full";
    case "Emergency":
      return "bg-status-danger text-white text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse";
    default:
      return "bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full dark:bg-white/10 dark:text-tx-secondary";
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
    <div
      id="dashboard-content"
      className="admin-overview-theme min-h-[calc(100dvh-72px)] w-full bg-gray-50 px-4 py-3 text-gray-900 sm:px-6 dark:bg-dash-bg dark:text-tx-primary"
    >
      <div className="dashboard-page-shell max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className={`${panelCard} p-5 sm:p-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center`}>
        <div>
          <h2 className="text-slate-900 font-semibold text-xl tracking-tight dark:text-tx-bright">
            My Patients Overview
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed mt-1 dark:text-tx-secondary">
            Prioritized view of your assigned patients. Updates in real time when nurses record vitals.
          </p>
          {userDisplayName && (
            <p className="text-slate-500 text-sm mt-2 dark:text-tx-muted">
              Logged in as{" "}
              <span className="text-slate-900 font-medium dark:text-tx-bright">{userDisplayName}</span>
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 xs:flex-row xs:flex-wrap sm:w-auto sm:items-center sm:gap-3">
          <Link
            href="/doctor/analytics"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-all duration-200 hover:border-brand-blue/40 hover:text-slate-900 inline-flex items-center justify-center gap-2 dark:border-white/[0.08] dark:bg-dash-elevated dark:text-tx-secondary dark:hover:border-brand-blue/40 dark:hover:text-tx-bright"
          >
            <Activity size={16} />
            View My Analytics
          </Link>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || loading}
            className="bg-btn-primary text-white font-semibold rounded-xl px-5 py-2.5 shadow-btn hover:shadow-glow-blue hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-2 text-slate-500 dark:text-tx-muted">
          <Loader2 size={20} className="animate-spin" />
          Loading assigned patients...
        </div>
      )}

      {!loading && patients.length === 0 && (
        <div className={`${panelCard} p-12 text-center text-slate-600 dark:text-tx-secondary`}>
          No patients assigned to you. The list updates when reception assigns new patients.
        </div>
      )}

      {hasEmergency && !loading && (
        <div className="rounded-2xl border border-status-danger/35 bg-white px-5 py-4 text-status-danger shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-3 dark:border-status-danger/40 dark:bg-dash-card dark:shadow-panel">
          <div className="w-10 h-10 rounded-full bg-status-danger/15 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-tx-bright">
              Emergency patients detected
            </p>
            <p className="text-sm text-status-danger/90 dark:text-status-danger mt-0.5">
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
                className={`${panelCard} flex flex-col justify-between min-h-[160px] group hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-all duration-200 dark:hover:shadow-panel`}
              >
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-slate-400 text-xs mt-0.5 font-mono dark:text-tx-muted">
                        #{patient.id}
                      </p>
                      <h3 className="text-slate-900 font-semibold text-sm mt-1 dark:text-tx-bright">
                        {patient.name}
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5 dark:text-tx-secondary">
                        {patient.age} yrs
                      </p>
                    </div>
                    <span
                      className={getStatusClasses(status)}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 mt-1 dark:border-white/[0.06] dark:bg-dash-elevated">
                    <p className="text-slate-700 text-sm leading-relaxed dark:text-tx-secondary">
                      Vitals updated by nurse. View details for full history and discharge.
                    </p>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-slate-500 text-xs bg-slate-50/80 rounded-b-2xl dark:border-dash-border dark:bg-white/[0.03] dark:text-tx-muted">
                  <span>Assigned patient</span>
                  <span className="group-hover:text-brand-blue font-medium transition-colors duration-150">
                    View details →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
