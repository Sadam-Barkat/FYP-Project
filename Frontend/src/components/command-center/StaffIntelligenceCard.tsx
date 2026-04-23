"use client";

import React, { useEffect, useState } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Users, TrendingUp, TrendingDown, AlertTriangle, CheckSquare, UserCheck, MessageSquareWarning } from "lucide-react";

export default function StaffIntelligenceCard({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [todayHr, setTodayHr] = useState<any>(null);
  const [yesterdayHr, setYesterdayHr] = useState<any>(null);
  const [hospitalData, setHospitalData] = useState<any>(null);

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

        const [tH, yH, hosp] = await Promise.all([
          fetch(`${API_BASE}/api/hr-staff-overview?date=${todayStr}`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/hr-staff-overview?date=${yStr}`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/hospital-overview?date=${todayStr}`, { headers }).then(r => r.json())
        ]);

        if (cancelled) return;
        setTodayHr(tH);
        setYesterdayHr(yH);
        setHospitalData(hosp);
      } catch (error) {
        console.error("Failed to load staff intelligence data", error);
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
  const staffOnDuty = todayHr?.staff_on_duty ?? 0;
  const staffOnDutyY = yesterdayHr?.staff_on_duty ?? 0;
  const staffDiff = staffOnDuty - staffOnDutyY;
  
  const absent = todayHr?.absent_today ?? 0;
  const absentY = yesterdayHr?.absent_today ?? 0;
  const absentDiff = absent - absentY;
  const absentPct = absentY > 0 ? Math.round((Math.abs(absentDiff) / absentY) * 100) : 0;

  const totalStaff = todayHr?.live_staff_status?.length || (staffOnDuty + absent + (todayHr?.on_leave ?? 0)) || 1;
  const coverageRate = staffOnDuty / totalStaff;
  const coveragePct = Math.round(coverageRate * 100);

  let coverageLabel = "Low";
  let coverageColor = "text-rose-600";
  let coverageBg = "bg-rose-100 text-rose-700";
  if (coverageRate >= 0.85) {
    coverageLabel = "Optimal";
    coverageColor = "text-emerald-600";
    coverageBg = "bg-emerald-100 text-emerald-700";
  } else if (coverageRate >= 0.70) {
    coverageLabel = "Moderate";
    coverageColor = "text-teal-600";
    coverageBg = "bg-amber-100 text-amber-700";
  }

  // Emergency Ward Capacity
  const emergencyWard = hospitalData?.bed_occupancy_by_department?.find((d: any) => d.department === "Emergency") || { occupied: 0, total: 0 };
  const emergencyPct = emergencyWard.total > 0 ? Math.round((emergencyWard.occupied / emergencyWard.total) * 100) : 0;

  // Trend Data for Mini Charts
  const trendData = todayHr?.attendance_trend || [];
  const presentTrend = trendData.map((d: any) => d.present);
  const absentTrend = trendData.map((d: any) => d.absent);
  const maxPresent = Math.max(...presentTrend, 1);
  const maxAbsent = Math.max(...absentTrend, 1);

  // Night Shift Estimate (since backend doesn't separate shifts yet)
  const nightShiftEstimate = Math.max(0, Math.floor(staffOnDuty * 0.75));
  const nightCoverageRate = nightShiftEstimate / totalStaff;
  let nightCoverageLabel = "Low (Below Norm)";
  let nightCoverageBg = "bg-rose-100 text-rose-700";
  if (nightCoverageRate >= 0.70) {
    nightCoverageLabel = "Moderate";
    nightCoverageBg = "bg-amber-100 text-amber-700";
  }

  return (
    <section className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="flex items-center justify-center text-brand-blue dark:text-brand-blue">
          <UserCheck size={24} strokeWidth={2} />
        </div>
        <h3 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100">Staff Intelligence</h3>
      </div>

      {/* Top Grid: Staff on Duty & Absent Staff */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Left: Staff on Duty */}
        <div className="flex flex-col">
          <p className="text-[14px] font-medium text-gray-800 dark:text-gray-200">Staff on Duty</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-[32px] font-bold text-gray-900 dark:text-gray-100 leading-none">
              {loading ? "..." : staffOnDuty}
            </p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              {staffDiff === 0 ? "Stable" : staffDiff > 0 ? "Up" : "Down"} vs <span className="font-semibold text-gray-700 dark:text-gray-300">{staffOnDutyY}</span> yesterday
            </p>
          </div>
          {/* Mini Horizontal Bar Chart */}
          <div className="mt-3 flex flex-col gap-1.5 h-10 justify-end">
            {presentTrend.slice(-3).map((val: number, i: number) => (
              <div key={i} className="h-2 bg-brand-blue/20 dark:bg-brand-blue/20 rounded-r-full" style={{ width: `${(val / maxPresent) * 100}%`, opacity: 0.5 + (i * 0.25) }}></div>
            ))}
          </div>
        </div>

        {/* Right: Absent Staff */}
        <div className="flex flex-col border-l border-gray-100 dark:border-gray-800 pl-4">
          <p className="text-[14px] font-medium text-gray-800 dark:text-gray-200">Absent Staff</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-[32px] font-bold text-gray-900 dark:text-gray-100 leading-none">
              {loading ? "..." : absent}
            </p>
            {absentDiff !== 0 && (
              <div className={`flex items-center text-[12px] font-semibold ${absentDiff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {absentDiff > 0 ? <TrendingUp size={14} className="mr-0.5" /> : <TrendingDown size={14} className="mr-0.5" />}
                {Math.abs(absentDiff)} today
              </div>
            )}
            {absentPct > 0 && (
              <div className={`flex items-center text-[12px] font-semibold ${absentDiff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                <TrendingUp size={14} className="mr-0.5 text-gray-400" />
                {absentPct}%
              </div>
            )}
          </div>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
            {absentDiff > 0 ? "Up" : absentDiff < 0 ? "Down" : "Same"} from <span className="font-semibold text-gray-700 dark:text-gray-300">{absentY}</span> yesterday
          </p>
          {/* Mini Vertical Bar Chart */}
          <div className="mt-2 flex items-end gap-1.5 h-8">
            {absentTrend.slice(-4).map((val: number, i: number) => (
              <div key={i} className="w-3 bg-status-warning/60 dark:bg-status-warning/40 rounded-t-sm" style={{ height: `${Math.max(10, (val / maxAbsent) * 100)}%`, opacity: 0.4 + (i * 0.2) }}></div>
            ))}
          </div>
        </div>
      </div>

      {/* Shift Coverage Bar */}
      <div className="mb-6 rounded-xl border border-gray-100 bg-base-card/40 p-4 dark:border-gray-800 dark:bg-base-card">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <MessageSquareWarning size={16} className="text-brand-blue dark:text-brand-blue" />
            <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">Shift Coverage</p>
          </div>
          <p className={`text-[14px] font-semibold ${coverageColor}`}>{loading ? "..." : coverageLabel}</p>
        </div>
        <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-brand-blue via-status-success via-status-warning to-status-danger overflow-hidden">
          {/* Dividers */}
          <div className="absolute top-0 bottom-0 left-1/3 w-[2px] bg-white dark:bg-gray-950"></div>
          <div className="absolute top-0 bottom-0 left-2/3 w-[2px] bg-white dark:bg-gray-950"></div>
        </div>
        {/* Indicator Triangle */}
        <div className="relative w-full h-2 mt-1">
          <div 
            className="absolute top-0 -ml-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-gray-400 dark:border-b-gray-500 transition-all duration-500"
            style={{ left: `${Math.min(100, Math.max(0, coveragePct))}%` }}
          ></div>
          <div className="absolute top-2 left-0 right-0 flex justify-center gap-1">
            <div className="w-1 h-0.5 bg-gray-300 dark:bg-gray-700"></div>
            <div className="w-1 h-0.5 bg-gray-300 dark:bg-gray-700"></div>
            <div className="w-1 h-0.5 bg-gray-300 dark:bg-gray-700"></div>
            <div className="w-1 h-0.5 bg-gray-300 dark:bg-gray-700"></div>
            <div className="w-1 h-0.5 bg-gray-300 dark:bg-gray-700"></div>
          </div>
        </div>
      </div>

      {/* Staff Optimization Insights */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquareWarning size={16} className="text-brand-blue dark:text-brand-blue" />
          <h4 className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">Staff Optimization Insights</h4>
        </div>
        
        <div className="flex flex-col gap-3">
          {/* Insight 1: Absenteeism */}
          <div className="flex items-start gap-2.5">
            {absentDiff > 0 ? (
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            ) : (
              <CheckSquare size={16} className="text-brand-blue dark:text-brand-blue mt-0.5 shrink-0" />
            )}
            <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-snug">
              {loading ? "..." : absentDiff > 0 ? (
                <>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Absentee rate has risen; nearing {coverageLabel.toLowerCase()} coverage.</span> Consider reassigning administrative staff to ICU and Emergency.
                </>
              ) : (
                <>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Absentee rate is stable.</span> Current staffing levels are adequate for the day shift.
                </>
              )}
            </p>
          </div>

          {/* Insight 2: Emergency Capacity */}
          <div className="flex items-start gap-2.5">
            <CheckSquare size={16} className="text-brand-blue dark:text-brand-blue mt-0.5 shrink-0" />
            <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-snug">
              {loading ? "..." : (
                <>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Emergency department is at {emergencyPct > 80 ? 'high' : 'normal'} capacity at {emergencyPct}%.</span> {emergencyPct > 80 ? 'Ensure adequate nighttime coverage to manage increased demand.' : 'Current coverage is sufficient for expected patient volume.'}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Shift Breakdown */}
      <div className="mt-auto bg-base-card/40 dark:bg-base-card/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
        <div className="grid grid-cols-2 gap-4 mb-3">
          {/* Day Shift */}
          <div>
            <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">Day Shift <span className="text-gray-400 font-normal">(Current)</span></p>
            <div className="flex items-baseline gap-1.5 mb-2">
              <p className="text-[20px] font-bold text-gray-900 dark:text-gray-100">{loading ? "..." : staffOnDuty}</p>
              <p className="text-[11px] text-gray-500">Staff on Duty</p>
            </div>
            <div className={`inline-flex px-3 py-1 rounded-md text-[12px] font-semibold ${coverageBg}`}>
              {loading ? "..." : coverageLabel}
            </div>
          </div>

          {/* Night Shift */}
          <div className="border-l border-gray-200 dark:border-gray-700 pl-4">
            <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">Night Shift</p>
            <div className="flex items-baseline gap-1.5 mb-2">
              <p className="text-[20px] font-bold text-gray-900 dark:text-gray-100">{loading ? "..." : nightShiftEstimate}</p>
              <p className="text-[11px] text-gray-500">Staff on Duty</p>
            </div>
            <div className={`inline-flex px-3 py-1 rounded-md text-[12px] font-semibold ${nightCoverageBg}`}>
              {loading ? "..." : nightCoverageLabel}
            </div>
          </div>
        </div>
        
        {emergencyPct > 80 && nightCoverageRate < 0.85 && (
          <p className="text-[12px] text-gray-600 dark:text-gray-400 leading-snug mt-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            Prepare for lower night shift staffing to cover surge in patient volume.
          </p>
        )}
      </div>
    </section>
  );
}