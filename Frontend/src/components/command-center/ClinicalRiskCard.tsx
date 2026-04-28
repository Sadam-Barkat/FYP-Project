"use client";

import React, { useEffect, useState } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Activity, ChevronRight, Bell, BarChart3, ClipboardList, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip } from "recharts";

export default function ClinicalRiskCard({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [alertsData, setAlertsData] = useState<any>(null);
  const [hospitalData, setHospitalData] = useState<any>(null);
  const [hospitalDataY, setHospitalDataY] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const headers = getAuthHeaders();
        const API_BASE = getApiBaseUrl();
        
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const y = new Date(today);
        y.setDate(today.getDate() - 1);
        const yStr = y.toISOString().slice(0, 10);

        const [alerts, hosp, hospY] = await Promise.all([
          fetch(`${API_BASE}/api/alerts-overview`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/hospital-overview?date=${todayStr}`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/hospital-overview?date=${yStr}`, { headers }).then(r => r.json())
        ]);

        if (cancelled) return;
        setAlertsData(alerts);
        setHospitalData(hosp);
        setHospitalDataY(hospY);
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

  // --- Data Processing ---
  const criticalAlerts = alertsData?.critical_emergencies ?? 0;
  const activeWarnings = alertsData?.active_warnings ?? 0;
  const totalAlerts = criticalAlerts + activeWarnings;
  
  const avgTime = alertsData?.avg_response_time_minutes ?? 0;
  const avgTimeY = alertsData?.avg_response_time_prev_minutes ?? 0;
  const resolvedToday = alertsData?.resolved_today ?? 0;

  const icuOcc = hospitalData?.icu_occupancy ?? 0;
  const icuOccY = hospitalDataY?.icu_occupancy ?? 0;
  const critCases = hospitalData?.critical_condition_cases ?? 0;
  const critCasesY = hospitalDataY?.critical_condition_cases ?? 0;

  const emCases = hospitalData?.emergency_cases ?? 0;
  const emCasesY = hospitalDataY?.emergency_cases ?? 0;
  const emergencyWard = hospitalData?.bed_occupancy_by_department?.find((d: any) => d.department === "Emergency") || { occupied: 0, total: 0 };
  const emergencyPct = emergencyWard.total > 0 ? Math.round((emergencyWard.occupied / emergencyWard.total) * 100) : 0;

  // Build Real Histogram from alerts_feed (last 12 hours)
  let chartData: { name: string; value: number }[] = [];
  if (alertsData?.alerts_feed && alertsData.alerts_feed.length > 0) {
    const now = new Date();
    const bins = Array(12).fill(0);
    alertsData.alerts_feed.forEach((alert: any) => {
      if (!alert.created_at) return;
      const d = new Date(alert.created_at);
      const diffMs = now.getTime() - d.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours >= 0 && diffHours < 12) {
        bins[11 - diffHours]++;
      }
    });
    if (!bins.every(b => b === 0)) {
      chartData = bins.map((v, i) => ({ name: i === 11 ? "Now" : `-${11-i}h`, value: v }));
    }
  }

  // --- Dynamic Intelligence Logic ---

  // Row 1: Alerts & Response Time
  const timeDiff = avgTime - avgTimeY;
  const timeDiffAbs = Math.abs(timeDiff).toFixed(1);
  let row1Title = <><span className="font-semibold">{criticalAlerts} Critical Alerts</span> active right now</>;
  let row1Sub = `Avg response: ${avgTime}m. ${resolvedToday} risks mitigated today.`;
  if (criticalAlerts > 5) {
    row1Sub = `High alert volume. Avg response is ${avgTime}m. Expedite resolutions.`;
  } else if (timeDiff > 2) {
    row1Sub = `Response times are ${timeDiffAbs}m slower than yesterday. Investigate delays.`;
  } else if (timeDiff < -1) {
    row1Sub = `Response times improved by ${timeDiffAbs}m vs yesterday. Good efficiency.`;
  }

  // Row 2: ICU & Critical Cases
  let row2Title = <>ICU at <span className="font-semibold">{Math.round(icuOcc)}%</span> with {critCases} critical cases</>;
  let row2Sub = `Yesterday: ICU ${Math.round(icuOccY)}%, ${critCasesY} cases. Capacity is sufficient.`;
  if (icuOcc > 85) {
    row2Title = <><span className="font-semibold text-rose-600 dark:text-rose-400">ICU Critical ({Math.round(icuOcc)}%)</span> with {critCases} cases</>;
    row2Sub = `Yesterday: ${Math.round(icuOccY)}%. Extreme risk of capacity breach. Expedite step-downs.`;
  } else if (icuOcc > icuOccY + 10) {
    row2Title = <>ICU surging to <span className="font-semibold">{Math.round(icuOcc)}%</span> ({critCases} cases)</>;
    row2Sub = `Sharp increase from yesterday's ${Math.round(icuOccY)}%. Monitor closely for potential overflow.`;
  } else if (critCases > critCasesY) {
    row2Sub = `Critical cases up from ${critCasesY} yesterday. Ensure adequate specialist coverage.`;
  }

  // Row 3: Emergency Influx
  let row3Title = <>Emergency influx: <span className="font-semibold">{emCases} active cases</span></>;
  let row3Sub = `Ward at ${emergencyPct}% capacity. Influx is stable compared to yesterday (${emCasesY}).`;
  if (emergencyPct > 85 || emCases > emCasesY * 1.5) {
    row3Title = <><span className="font-semibold text-amber-600 dark:text-amber-500">Emergency Surge: {emCases} active cases</span></>;
    row3Sub = `Ward at ${emergencyPct}% (Yesterday: ${emCasesY} cases). Deploy backup triage staff immediately.`;
  } else if (emCases > emCasesY) {
    row3Title = <>Emergency influx rising: <span className="font-semibold">{emCases} cases</span></>;
    row3Sub = `Ward at ${emergencyPct}%. Higher volume than yesterday (${emCasesY}). Monitor triage times.`;
  } else if (emCases < emCasesY) {
    row3Sub = `Ward at ${emergencyPct}%. Volume decreased from yesterday (${emCasesY}). Operations running smoothly.`;
  }

  return (
    <section className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Activity className="text-status-danger dark:text-status-danger" size={22} strokeWidth={2} />
          <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">Clinical Risk Intelligence</h3>
        </div>
        <ChevronRight size={18} className="text-gray-400" />
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Top Metric */}
      <div className="py-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">Total Active Risks</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-[32px] font-bold text-gray-900 dark:text-gray-100 leading-none">
                {loading ? "..." : totalAlerts}
              </p>
              <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                ({criticalAlerts} critical, {activeWarnings} warnings)
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium ${
              timeDiff > 0 
                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400" 
                : timeDiff < 0 
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}>
              <Clock size={13} />
              Avg Response: {avgTime}m
              {timeDiff > 0 ? <TrendingUp size={13} /> : timeDiff < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
            </div>
            <div className="h-9 w-36 mt-2 relative group">
              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-sm text-gray-400">
                  No alert activity in the last 12 hours
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px' }}
                      labelStyle={{ display: 'none' }}
                    />
                    <Bar dataKey="value" fill="#93c5fd" radius={[2, 2, 0, 0]} />
                    <ReferenceLine y={Math.max(...chartData.map(d => d.value)) * 0.8} stroke="#94a3b8" strokeDasharray="2 2" strokeWidth={1} opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <span className="absolute -bottom-4 right-0 text-[9px] text-gray-400">12h trend</span>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-gray-100 dark:border-gray-800 mt-2" />

      {/* Rows */}
      <div className="pt-4 flex flex-col gap-4">
        {/* Row 1: Alerts */}
        <div className="flex gap-3">
          <Bell className={`${criticalAlerts > 5 ? 'text-rose-600 dark:text-rose-500' : 'text-status-danger dark:text-status-danger'} shrink-0 mt-0.5`} size={20} strokeWidth={2} />
          <div>
            <p className="text-[14px] text-gray-900 dark:text-gray-100">
              {loading ? "..." : row1Title}
            </p>
            <p className={`text-[13px] mt-0.5 ${timeDiff > 2 || criticalAlerts > 5 ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
              {loading ? "..." : row1Sub}
            </p>
          </div>
        </div>

        <hr className="border-gray-100 dark:border-gray-800" />

        {/* Row 2: ICU */}
        <div className="flex gap-3">
          <BarChart3 className={`${icuOcc > 85 ? 'text-rose-600 dark:text-rose-500' : 'text-brand-blue dark:text-brand-blue'} shrink-0 mt-0.5`} size={20} strokeWidth={2} />
          <div>
            <p className="text-[14px] text-gray-900 dark:text-gray-100">
              {loading ? "..." : row2Title}
            </p>
            <p className={`text-[13px] mt-0.5 ${icuOcc > 85 || icuOcc > icuOccY + 10 ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
              {loading ? "..." : row2Sub}
            </p>
          </div>
        </div>

        {/* Row 3: Emergency */}
        <div className={`flex gap-3 p-3.5 rounded-xl border mt-1 transition-colors ${
          emergencyPct > 85 || emCases > emCasesY * 1.5 
            ? 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30' 
            : 'bg-base-card/30 border-gray-50 dark:bg-gray-800/50 dark:border-gray-800'
        }`}>
          <ClipboardList className={`${emergencyPct > 85 || emCases > emCasesY * 1.5 ? 'text-amber-600 dark:text-amber-500' : 'text-brand-blue dark:text-brand-blue'} shrink-0 mt-0.5`} size={20} strokeWidth={2} />
          <div>
            <p className="text-[14px] text-gray-900 dark:text-gray-100">
              {loading ? "..." : row3Title}
            </p>
            <p className={`text-[13px] mt-0.5 ${emergencyPct > 85 || emCases > emCasesY * 1.5 ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
              {loading ? "..." : row3Sub}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}