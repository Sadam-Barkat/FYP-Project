"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { assignedPatients, DoctorPatient } from "@/lib/mockData";
import { AlertTriangle, Activity, HeartPulse, RefreshCcw } from "lucide-react";

function getSeverityScore(status: DoctorPatient['status']) {
  if (status === "Emergency") return 3;
  if (status === "Critical") return 2;
  return 1;
}

function getStatusClasses(status: DoctorPatient['status']) {
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

export default function DoctorDashboardPage() {
  const [patients, setPatients] = useState<DoctorPatient[]>(assignedPatients);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sort by severity on each render
  const sortedPatients = useMemo(
    () =>
      [...patients].sort((a, b) =>
        getSeverityScore(b.status) - getSeverityScore(a.status)
      ),
    [patients]
  );

  // Fake real-time updates (every 10s tweak a random patient)
  useEffect(() => {
    const interval = setInterval(() => {
      setPatients(prev => {
        const clone = [...prev];
        if (!clone.length) return clone;
        const index = Math.floor(Math.random() * clone.length);
        const current = clone[index];
        const order: DoctorPatient['status'][] = ["Normal", "Critical", "Emergency"];
        const currentIdx = order.indexOf(current.status);
        const nextIdx = Math.min(order.length - 1, currentIdx + 1);
        clone[index] = {
          ...current,
          status: order[nextIdx],
          lastUpdated: "Just now",
        };
        return clone;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setPatients([...assignedPatients]);
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-[#1e40af]">My Patients Overview</h2>
          <p className="text-sm text-gray-500 mt-1">Prioritized view of your assigned patients based on AI condition.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/doctor/analytics"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e6f2ff] text-[#0066cc] text-sm font-medium hover:bg-[#d0e6ff] transition-colors"
          >
            <Activity size={16} />
            View My Analytics
          </Link>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing' : 'Reset View'}
          </button>
        </div>
      </div>

      {/* Live alert banner if any emergency */}
      {sortedPatients.some(p => p.status === 'Emergency') && (
        <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-full bg-[#fee2e2] text-[#ef4444]">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#b91c1c]">Emergency patients detected</p>
            <p className="text-xs text-[#7f1d1d]">Patients marked as Emergency are surfaced at the top for immediate attention.</p>
          </div>
        </div>
      )}

      {/* Patient cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sortedPatients.map((patient) => (
          <Link
            key={patient.id}
            href={`/doctor/patients/${patient.id}`}
            className="group bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-[#1e40af]/30 transition-all flex flex-col justify-between min-h-[180px]"
          >
            <div className="p-5 flex-1 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-gray-400 font-mono">{patient.id}</p>
                  <h3 className="text-base font-semibold text-gray-900 mt-1">{patient.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{patient.age} yrs · {patient.gender === 'M' ? 'Male' : 'Female'}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(patient.status)}`}>
                  {patient.status}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between text-xs text-gray-600 mt-1">
                <div>
                  <p className="font-medium text-gray-700">Bed {patient.bed}</p>
                  <p className="text-[11px]">{patient.ward}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <HeartPulse size={14} className="text-[#ef4444]" />
                    <span className="font-medium">HR {patient.lastVitals.heartRate}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-medium">SpO2 {patient.lastVitals.spo2}%</span>
                    <span className="text-[11px]">BP {patient.lastVitals.bloodPressure}</span>
                  </div>
                </div>
              </div>

              {patient.alerts.length > 0 && (
                <div className="flex items-start gap-2 mt-2">
                  <Activity size={14} className="text-[#f59e0b] mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-600 leading-snug">
                    {patient.alerts[0]}{patient.alerts.length > 1 ? ' +' + (patient.alerts.length - 1) + ' more' : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-500 bg-gray-50/50 rounded-b-xl">
              <span>Last update: {patient.lastUpdated}</span>
              <span className="group-hover:text-[#1e40af] font-medium transition-colors">View details →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
