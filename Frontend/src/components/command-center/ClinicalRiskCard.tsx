"use client";

import React, { useEffect, useState } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Activity, ChevronRight, ChevronDown, Bell, BarChart3, ClipboardList } from "lucide-react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer } from "recharts";

const FAKE_BAR_DATA = [
  { value: 10 }, { value: 12 }, { value: 8 }, { value: 15 }, 
  { value: 14 }, { value: 18 }, { value: 22 }, { value: 20 },
  { value: 25 }, { value: 28 }, { value: 24 }, { value: 30 }
];

export default function ClinicalRiskCard({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [alertsData, setAlertsData] = useState<any>(null);
  const [hospitalData, setHospitalData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const headers = getAuthHeaders();
        const API_BASE = getApiBaseUrl();
        
        const [alerts, hosp] = await Promise.all([
          fetch(`${API_BASE}/api/alerts-overview`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/hospital-overview`, { headers }).then(r => r.json())
        ]);

        if (cancelled) return;
        setAlertsData(alerts);
        setHospitalData(hosp);
      } catch (error) {
        console.error("Failed to load clinical risk data", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const criticalAlerts = alertsData?.critical_emergencies ?? 0;
  const activeWarnings = alertsData?.active_warnings ?? 0;
  const totalAlerts = criticalAlerts + activeWarnings;
  
  const icuOcc = hospitalData?.icu_occupancy ?? 0;
  const emergencyWard = hospitalData?.bed_occupancy_by_department?.find((d: any) => d.department === "Emergency") || { occupied: 0, total: 0 };
  const emergencyPct = emergencyWard.total > 0 ? Math.round((emergencyWard.occupied / emergencyWard.total) * 100) : 0;

  // Dynamic logic for Row 2
  let row2Title = <>ICU occupancy stable at <span className="font-semibold">{Math.round(icuOcc)}%</span></>;
  let row2Sub = "Capacity is within safe limits.";
  if (icuOcc > 85) {
    row2Title = <><span className="font-semibold">ICU occupancy critical at {Math.round(icuOcc)}%</span></>;
    row2Sub = "Follow up urgently to secure available beds.";
  } else if (icuOcc > 70) {
    row2Title = <>ICU occupancy elevated at <span className="font-semibold">{Math.round(icuOcc)}%</span></>;
    row2Sub = "Monitor closely for potential overflow.";
  }

  // Dynamic logic for Row 3
  let row3Title = <>Emergency ward at <span className="font-semibold">{emergencyPct}%</span> capacity.</>;
  let row3Sub = "Operations are running smoothly.";
  if (emergencyPct > 85) {
    row3Title = <><span className="font-semibold">Emergency ward critical at {emergencyPct}%</span> capacity.</>;
    row3Sub = "Follow up urgently to manage patient influx.";
  } else if (emergencyPct > 70) {
    row3Title = <>Emergency ward elevated at <span className="font-semibold">{emergencyPct}%</span> capacity.</>;
    row3Sub = "Monitor triage times and bed availability.";
  }

  return (
    <section className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Activity className="text-[#9f1239] dark:text-rose-500" size={22} strokeWidth={2} />
          <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">Clinical Risk Intelligence</h3>
        </div>
        <ChevronRight size={18} className="text-gray-400" />
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Top Metric */}
      <div className="py-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">Active Clinical Alerts</p>
            <p className="text-[32px] font-bold text-gray-900 dark:text-gray-100 mt-1 leading-none">
              {loading ? "..." : totalAlerts}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 bg-[#f0f5ff] text-[#475569] px-2.5 py-1.5 rounded-md text-[12px] font-medium dark:bg-[#0b2a52] dark:text-gray-300">
              About {Math.round((totalAlerts / 50) * 100)}% of threshold
              <ChevronDown size={14} />
            </div>
            <div className="h-8 w-32 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={FAKE_BAR_DATA}>
                  <Bar dataKey="value" fill="#dbeafe" radius={[2, 2, 0, 0]} />
                  <ReferenceLine y={15} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Rows */}
      <div className="pt-4 flex flex-col gap-4">
        {/* Row 1 */}
        <div className="flex gap-3">
          <Bell className="text-[#9f1239] dark:text-rose-500 shrink-0 mt-0.5" size={20} strokeWidth={2} />
          <div>
            <p className="text-[14px] text-gray-900 dark:text-gray-100">
              <span className="font-semibold">{loading ? "..." : criticalAlerts} New Critical Alerts</span> in 24 hours
            </p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
              Monitor closely for potential risks.
            </p>
          </div>
        </div>

        <hr className="border-gray-100 dark:border-gray-800" />

        {/* Row 2 */}
        <div className="flex gap-3">
          <BarChart3 className="text-[#0066cc] dark:text-blue-400 shrink-0 mt-0.5" size={20} strokeWidth={2} />
          <div>
            <p className="text-[14px] text-gray-900 dark:text-gray-100">
              {loading ? "..." : row2Title}
            </p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
              {loading ? "..." : row2Sub}
            </p>
          </div>
        </div>

        {/* Row 3 */}
        <div className="flex gap-3 bg-[#f4f7fb] dark:bg-gray-800/50 p-3.5 rounded-xl border border-gray-50 dark:border-gray-800 mt-1">
          <ClipboardList className="text-[#0066cc] dark:text-blue-400 shrink-0 mt-0.5" size={20} strokeWidth={2} />
          <div>
            <p className="text-[14px] text-gray-900 dark:text-gray-100">
              {loading ? "..." : row3Title}
            </p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
              {loading ? "..." : row3Sub}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}