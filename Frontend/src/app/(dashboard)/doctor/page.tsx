"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, Activity, HeartPulse, RefreshCcw, Loader2 } from "lucide-react";
import { useRealtimeEvent } from "@/hooks/useRealtimeEvent";
import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = getApiBaseUrl();

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
      return "bg-base-muted text-text-primary text-xs font-medium px-2.5 py-1 rounded-full";
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
    <div id="dashboard-content" className="bg-base-surface min-h-screen px-8 py-8 space-y-8">
      <div className="-mx-8 -mt-8 bg-base-card border-b border-base-border px-8 py-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-text-primary font-semibold text-xl tracking-tight">
            My Patients Overview
          </h2>
          <p className="text-text-primary text-sm leading-relaxed mt-1">
            Prioritized view of your assigned patients. Updates in real time when nurses record vitals.
          </p>
          {userDisplayName && (
            <p className="text-text-secondary text-sm mt-2">
              Logged in as{" "}
              <span className="text-text-primary font-medium">{userDisplayName}</span>
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 xs:flex-row xs:flex-wrap sm:w-auto sm:items-center sm:gap-3">
          <Link
            href="/doctor/analytics"
            className="bg-transparent border border-base-border text-text-secondary rounded-xl px-5 py-2.5 hover:border-brand-primary/50 hover:text-text-primary transition-all duration-200 inline-flex items-center justify-center gap-2"
          >
            <Activity size={16} />
            View My Analytics
          </Link>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || loading}
            className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-semibold rounded-xl px-5 py-2.5 shadow-[0_0_16px_rgba(59,130,246,0.3)] hover:shadow-[0_0_24px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-2 text-text-muted">
          <Loader2 size={20} className="animate-spin" />
          Loading assigned patients...
        </div>
      )}

      {!loading && patients.length === 0 && (
        <div className="bg-base-card border border-base-border rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.4)] p-12 text-center text-text-muted">
          No patients assigned to you. The list updates when reception assigns new patients.
        </div>
      )}

      {hasEmergency && !loading && (
        <div className="bg-status-danger/10 border border-status-danger/30 text-status-danger rounded-xl px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-status-danger/20 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              Emergency patients detected
            </p>
            <p className="text-sm font-medium opacity-80">
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
                className="bg-base-card border border-base-border rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.4)] hover:bg-base-hover hover:border-brand-primary/20 transition-all duration-200 flex flex-col justify-between min-h-[160px] group"
              >
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-text-muted text-xs mt-0.5 font-mono">
                        #{patient.id}
                      </p>
                      <h3 className="text-text-primary font-semibold text-sm mt-1">
                        {patient.name}
                      </h3>
                      <p className="text-text-muted text-xs mt-0.5">
                        {patient.age} yrs
                      </p>
                    </div>
                    <span
                      className={getStatusClasses(status)}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="bg-base-muted rounded-xl p-4 mt-1">
                    <p className="text-text-primary text-sm leading-relaxed">
                      Vitals updated by nurse. View details for full history and discharge.
                    </p>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-base-border flex items-center justify-between text-text-muted text-xs bg-base-muted/30 rounded-b-2xl">
                  <span>Assigned patient</span>
                  <span className="group-hover:text-brand-primary font-medium transition-colors duration-150">
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
