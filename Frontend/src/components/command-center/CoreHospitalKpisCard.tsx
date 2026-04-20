"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";
import { LayoutDashboard, TrendingUp, Users } from "lucide-react";

type HospitalOverview = {
  total_beds: number;
  active_patients: { total: number };
  todays_revenue: number;
  icu_occupancy: number;
  critical_condition_cases: number;
  emergency_cases: number;
};

type HrStaffOverview = {
  staff_on_duty: number;
  absent_today: number;
  on_leave: number;
  live_staff_status: Array<unknown>;
};

const API_BASE = getApiBaseUrl();

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function diffPct(today: number, yesterday: number): { tone: "up" | "down" | "flat"; text: string } {
  const d = Math.round((today - yesterday) * 10) / 10;
  if (!Number.isFinite(d) || d === 0) return { tone: "flat", text: "0%" };
  return { tone: d > 0 ? "up" : "down", text: `${d > 0 ? "+" : ""}${d}%` };
}

function MiniChartUp() {
  return (
    <svg width="36" height="16" viewBox="0 0 36 16" className="mr-1 opacity-90">
      <line x1="0" y1="10" x2="16" y2="10" stroke="#9ca3af" strokeWidth="1" strokeDasharray="2 2" />
      <rect x="18" y="8" width="3" height="8" fill="#fcd34d" rx="1" />
      <rect x="24" y="4" width="3" height="12" fill="#f59e0b" rx="1" />
      <rect x="30" y="0" width="3" height="16" fill="#d97706" rx="1" />
    </svg>
  );
}

function MiniChartDown() {
  return (
    <svg width="36" height="16" viewBox="0 0 36 16" className="mr-1 opacity-90">
      <line x1="0" y1="8" x2="20" y2="8" stroke="#9ca3af" strokeWidth="1" strokeDasharray="2 2" />
      <rect x="24" y="4" width="3" height="12" fill="#f59e0b" rx="1" />
      <rect x="30" y="8" width="3" height="8" fill="#d97706" rx="1" />
    </svg>
  );
}

function MiniChartFlat() {
  return (
    <svg width="36" height="16" viewBox="0 0 36 16" className="mr-1 opacity-90">
      <line x1="0" y1="8" x2="16" y2="8" stroke="#9ca3af" strokeWidth="1" strokeDasharray="2 2" />
      <rect x="18" y="6" width="3" height="6" fill="#9ca3af" rx="1" />
      <rect x="24" y="6" width="3" height="6" fill="#9ca3af" rx="1" />
      <rect x="30" y="6" width="3" height="6" fill="#9ca3af" rx="1" />
    </svg>
  );
}

function diffInt(current: number, previous: number, suffix: string = "") {
  const diff = current - previous;
  if (diff > 0) return { tone: "up", text: `+${diff}${suffix}` };
  if (diff < 0) return { tone: "down", text: `${diff}${suffix}` };
  return { tone: "flat", text: `0${suffix}` };
}

export default function CoreHospitalKpisCard({ className = "" }: { className?: string }) {
  const [todayOverview, setTodayOverview] = useState<HospitalOverview | null>(null);
  const [yesterdayOverview, setYesterdayOverview] = useState<HospitalOverview | null>(null);
  const [todayHr, setTodayHr] = useState<HrStaffOverview | null>(null);
  const [yesterdayHr, setYesterdayHr] = useState<HrStaffOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const y = new Date(today);
        y.setDate(today.getDate() - 1);
        const yStr = y.toISOString().slice(0, 10);

        const [tO, yO, tH, yH] = await Promise.all([
          fetch(`${API_BASE}/api/hospital-overview?date=${todayStr}`, { headers }).then((r) => r.json()),
          fetch(`${API_BASE}/api/hospital-overview?date=${yStr}`, { headers }).then((r) => r.json()),
          fetch(`${API_BASE}/api/hr-staff-overview?date=${todayStr}`, { headers }).then((r) => r.json()),
          fetch(`${API_BASE}/api/hr-staff-overview?date=${yStr}`, { headers }).then((r) => r.json()),
        ]);

        if (cancelled) return;
        setTodayOverview(tO);
        setYesterdayOverview(yO);
        setTodayHr(tH);
        setYesterdayHr(yH);
      } catch {
        if (cancelled) return;
        setTodayOverview(null);
        setYesterdayOverview(null);
        setTodayHr(null);
        setYesterdayHr(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    const id = setInterval(run, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const bedOccupancy = useMemo(() => {
    const total = todayOverview?.total_beds ?? 0;
    const occupied = todayOverview?.active_patients?.total ?? 0;
    return total > 0 ? (occupied / total) * 100 : 0;
  }, [todayOverview]);

  const bedOccupancyY = useMemo(() => {
    const total = yesterdayOverview?.total_beds ?? 0;
    const occupied = yesterdayOverview?.active_patients?.total ?? 0;
    return total > 0 ? (occupied / total) * 100 : 0;
  }, [yesterdayOverview]);

  const totalStaff = todayHr?.live_staff_status?.length ?? 0;
  const staffAvailable = todayHr?.staff_on_duty ?? 0;

  const activePatients = todayOverview?.active_patients?.total ?? 0;
  const icuOcc = todayOverview?.icu_occupancy ?? 0;
  const icuOccY = yesterdayOverview?.icu_occupancy ?? 0;
  const criticalPatients = todayOverview?.critical_condition_cases ?? 0;
  const criticalPatientsY = yesterdayOverview?.critical_condition_cases ?? 0;
  const revenue = todayOverview?.todays_revenue ?? 0;

  const bedTrend = diffPct(bedOccupancy, bedOccupancyY);
  const icuTrend = diffPct(icuOcc, icuOccY);

  // High risk calculations
  const emergencyCases = todayOverview?.emergency_cases ?? 0;
  const emergencyCasesY = yesterdayOverview?.emergency_cases ?? 0;
  const totalHighRisk = criticalPatients + emergencyCases;
  const critPct = totalHighRisk > 0 ? (criticalPatients / totalHighRisk) * 100 : 0;
  const emergPct = totalHighRisk > 0 ? (emergencyCases / totalHighRisk) * 100 : 0;

  let highRiskInsight = "High-risk patient volume is stable compared to yesterday.";
  if (criticalPatients > criticalPatientsY && emergencyCases > emergencyCasesY) {
    highRiskInsight = "Both critical and emergency cases increased since yesterday. Ensure ICU and ED readiness.";
  } else if (criticalPatients > criticalPatientsY) {
    highRiskInsight = "Critical cases increased since yesterday. Monitor ICU availability.";
  } else if (emergencyCases > emergencyCasesY) {
    highRiskInsight = "Emergency influx is higher today. Monitor ED triage times.";
  } else if (criticalPatients < criticalPatientsY && emergencyCases < emergencyCasesY) {
    highRiskInsight = "High-risk patient volume has decreased since yesterday.";
  } else if (totalHighRisk === 0) {
    highRiskInsight = "No critical or emergency cases currently active.";
  }

  return (
    <section
      className={[
        "rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 flex flex-col",
        className,
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800 shrink-0">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#1d4ed8] text-white shadow-sm">
          <LayoutDashboard size={16} />
        </span>
        <h2 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">Core Hospital KPIs</h2>
      </div>

      {/* Grid */}
      <div className="grid flex-1 grid-cols-2 grid-rows-3">
        {/* Cell 1: Bed Occupancy */}
        <div className="flex flex-col justify-center border-b border-r border-gray-100 px-6 py-5 dark:border-gray-800">
          <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">Bed Occupancy</p>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-3xl font-bold text-[#d97706]">
              {Math.round(clampPct(bedOccupancy))}
              <span className="text-2xl ml-0.5">%</span>
            </p>
            <div className="flex h-7 items-center rounded-full bg-gray-50 px-2.5 border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
              {bedTrend.tone === "down" ? <MiniChartDown /> : bedTrend.tone === "up" ? <MiniChartUp /> : <MiniChartFlat />}
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 ml-1">{bedTrend.text}</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            {loading ? "..." : `Yesterday was ${Math.round(clampPct(bedOccupancyY))}%. ${bedOccupancy > bedOccupancyY ? "Higher demand today." : bedOccupancy < bedOccupancyY ? "Lower demand today." : "Stable demand."}`}
          </p>
        </div>

        {/* Cell 2: Active Patients */}
        <div className="flex flex-col justify-center border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">Active Patients</p>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{activePatients}</p>
            <div className="flex h-7 items-center gap-1.5 rounded-full bg-[#f0f5ff] px-2.5 text-[#0066cc] dark:bg-[#0b2a52] dark:text-[#60a5fa]">
              <TrendingUp size={12} strokeWidth={2.5} />
              <span className="text-[11px] font-semibold">
                {activePatients - (yesterdayOverview?.active_patients?.total ?? 0) > 0 ? "+" : ""}
                {activePatients - (yesterdayOverview?.active_patients?.total ?? 0)} Vs yesterday
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            {loading ? "..." : `${yesterdayOverview?.active_patients?.total ?? 0} patients yesterday. ${activePatients > (yesterdayOverview?.active_patients?.total ?? 0) ? "Inflow is increasing." : "Inflow is decreasing."}`}
          </p>
        </div>

        {/* Cell 3: ICU Occupancy */}
        <div className="flex flex-col justify-center border-b border-r border-gray-100 px-6 py-5 dark:border-gray-800">
          <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">ICU Occupancy</p>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {Math.round(clampPct(icuOcc))}
              <span className="text-2xl text-[#d97706] ml-0.5">%</span>
            </p>
            <div className="flex h-7 items-center rounded-full bg-gray-50 px-2.5 border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
              {icuTrend.tone === "down" ? <MiniChartDown /> : icuTrend.tone === "up" ? <MiniChartUp /> : <MiniChartFlat />}
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 ml-1">{icuTrend.text}</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            {loading ? "..." : `Yesterday: ${Math.round(clampPct(icuOccY))}%. ${icuOcc > 80 ? "Critical levels, monitor closely." : "Sufficient capacity available."}`}
          </p>
        </div>

        {/* Cell 4: High-Risk Patients */}
        <div className="flex flex-col justify-center border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">High-Risk Patients</p>
          
          <div className="mt-2 flex items-end gap-6">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-rose-500"></div>
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Critical</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{criticalPatients}</p>
                <span className={`text-[10px] font-medium ${diffInt(criticalPatients, criticalPatientsY, "").tone === "down" ? "text-emerald-600" : diffInt(criticalPatients, criticalPatientsY, "").tone === "up" ? "text-rose-600" : "text-gray-500"}`}>{diffInt(criticalPatients, criticalPatientsY, "").text}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Emergency</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{emergencyCases}</p>
                <span className={`text-[10px] font-medium ${diffInt(emergencyCases, emergencyCasesY, "").tone === "down" ? "text-emerald-600" : diffInt(emergencyCases, emergencyCasesY, "").tone === "up" ? "text-amber-600" : "text-gray-500"}`}>{diffInt(emergencyCases, emergencyCasesY, "").text}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div style={{ width: `${critPct}%` }} className="bg-rose-500 transition-all duration-500" />
            <div style={{ width: `${emergPct}%` }} className="bg-amber-500 transition-all duration-500" />
          </div>
          
          <p className="mt-2.5 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
            {loading ? "..." : highRiskInsight}
          </p>
        </div>

        {/* Cell 5: Today's Revenue */}
        <div className="flex flex-col justify-center border-r border-gray-100 px-6 py-5 dark:border-gray-800">
          <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">Today&apos;s Revenue</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              <span className="text-[22px] font-semibold mr-1.5">PKR</span>
              {Math.round(revenue).toLocaleString("en-PK")}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            {loading ? "..." : `Yesterday: PKR ${Math.round(yesterdayOverview?.todays_revenue ?? 0).toLocaleString("en-PK")} (${revenue - (yesterdayOverview?.todays_revenue ?? 0) >= 0 ? '+' : ''}${Math.round((yesterdayOverview?.todays_revenue ?? 0) > 0 ? ((revenue - (yesterdayOverview?.todays_revenue ?? 0)) / (yesterdayOverview?.todays_revenue ?? 0)) * 100 : 0)}%).`}
          </p>
        </div>

        {/* Cell 6: Staff Available */}
        <div className="flex flex-col justify-center px-6 py-5">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">Staff Available</p>
            <span className="rounded bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
              {todayHr?.absent_today || 0} absent
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{staffAvailable}</p>
            <p className="text-[11px] font-semibold text-[#0066cc] dark:text-[#60a5fa] mb-1">out of</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-0.5">{totalStaff}</p>
            <div className="flex items-center h-5 rounded bg-[#f0f5ff] px-1.5 gap-1 text-[#0066cc] mb-1 dark:bg-[#0b2a52] dark:text-[#60a5fa]">
              <Users size={10} strokeWidth={2.5} />
              <span className="text-[10px] font-semibold">Total</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            {loading ? "..." : (staffAvailable / (totalStaff || 1) < 0.8 ? "Warning: Operating with reduced staff." : "Coverage is optimal for current patient load.")}
          </p>
        </div>
      </div>
    </section>
  );
}
