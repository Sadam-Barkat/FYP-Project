"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";

type HospitalOverview = {
  total_beds: number;
  active_patients: { total: number };
  todays_revenue: number;
  icu_occupancy: number;
  critical_condition_cases: number;
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

function fmtPct(n: number): string {
  return `${Math.round(clampPct(n))}%`;
}

function fmtPKR(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `PKR ${Math.round(v).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

function diffPct(today: number, yesterday: number): { tone: "up" | "down" | "flat"; text: string } {
  const d = Math.round((today - yesterday) * 10) / 10;
  if (!Number.isFinite(d) || d === 0) return { tone: "flat", text: "0%" };
  return { tone: d > 0 ? "up" : "down", text: `${d > 0 ? "+" : ""}${d}%` };
}

function diffInt(today: number, yesterday: number, label: string): { tone: "up" | "down" | "flat"; text: string } {
  const d = Math.round((today ?? 0) - (yesterday ?? 0));
  if (!Number.isFinite(d) || d === 0) return { tone: "flat", text: `vs yesterday` };
  return { tone: d > 0 ? "up" : "down", text: `${label} ${d > 0 ? "+" : ""}${d}` };
}

function TrendPill({
  tone,
  children,
}: {
  tone: "up" | "down" | "flat";
  children: React.ReactNode;
}) {
  const cls =
    tone === "up"
      ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/60"
      : tone === "down"
        ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-900/60"
        : "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/40 dark:text-slate-200 dark:border-slate-800";

  return (
    <span className={["inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium", cls].join(" ")}>
      {children}
    </span>
  );
}

function MiniBars({ tone }: { tone: "up" | "down" | "flat" }) {
  const barColor =
    tone === "up" ? "bg-amber-500" : tone === "down" ? "bg-rose-500" : "bg-slate-400";
  return (
    <span className="inline-flex items-end gap-[2px]" aria-hidden>
      <span className={["h-2 w-[3px] rounded-sm", barColor].join(" ")} />
      <span className={["h-3 w-[3px] rounded-sm opacity-80", barColor].join(" ")} />
      <span className={["h-4 w-[3px] rounded-sm opacity-70", barColor].join(" ")} />
    </span>
  );
}

export default function CoreHospitalKpisCard() {
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
  const totalStaffY = yesterdayHr?.live_staff_status?.length ?? 0;

  const staffAvailable = todayHr?.staff_on_duty ?? 0;
  const staffAvailableY = yesterdayHr?.staff_on_duty ?? 0;

  const activePatients = todayOverview?.active_patients?.total ?? 0;
  const activePatientsY = yesterdayOverview?.active_patients?.total ?? 0;

  const icuOcc = todayOverview?.icu_occupancy ?? 0;
  const icuOccY = yesterdayOverview?.icu_occupancy ?? 0;

  const criticalPatients = todayOverview?.critical_condition_cases ?? 0;
  const criticalPatientsY = yesterdayOverview?.critical_condition_cases ?? 0;

  const revenue = todayOverview?.todays_revenue ?? 0;
  const revenueY = yesterdayOverview?.todays_revenue ?? 0;

  const bedTrend = diffPct(bedOccupancy, bedOccupancyY);
  const icuTrend = diffPct(icuOcc, icuOccY);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#e6f2ff] text-[#0066cc] dark:bg-[#0b2a52] dark:text-[#60a5fa]">
            ▦
          </span>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Core Hospital KPIs</h2>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{loading ? "Loading…" : "Live"}</span>
      </div>

      <div className="grid grid-cols-1 divide-y divide-gray-100 dark:divide-gray-800 md:grid-cols-2 md:divide-x md:divide-y-0">
        {/* Row 1 */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Bed Occupancy</p>
            <div className="flex items-center gap-2">
              <MiniBars tone={bedTrend.tone} />
              <TrendPill tone={bedTrend.tone}>{bedTrend.text}</TrendPill>
            </div>
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-amber-600 dark:text-amber-300">
            {fmtPct(bedOccupancy)}
          </p>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Active Patients</p>
            <TrendPill tone={activePatients - activePatientsY >= 0 ? "up" : "down"}>
              {diffInt(activePatients, activePatientsY, "").text}
            </TrendPill>
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {activePatients}
          </p>
        </div>

        {/* Row 2 */}
        <div className="border-t border-gray-100 p-6 dark:border-gray-800 md:border-t-0 md:border-r">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">ICU Occupancy</p>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block h-1 w-10 rounded-full bg-gray-200 dark:bg-gray-800" />
              <TrendPill tone={icuTrend.tone}>{icuTrend.text}</TrendPill>
            </div>
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-amber-600 dark:text-amber-300">
            {fmtPct(icuOcc)}
          </p>
        </div>

        <div className="border-t border-gray-100 p-6 dark:border-gray-800 md:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Critical Patients</p>
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {criticalPatients}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            High-severity alerts today (proxy)
          </p>
        </div>

        {/* Row 3 */}
        <div className="border-t border-gray-100 p-6 dark:border-gray-800 md:border-r">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Today&apos;s Revenue</p>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {fmtPKR(revenue)}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {loading ? "—" : `Yesterday: ${fmtPKR(revenueY)}`}
          </p>
        </div>

        <div className="border-t border-gray-100 p-6 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Staff Available</p>
            <div className="flex items-center gap-2">
              <TrendPill tone={(todayHr?.absent_today ?? 0) > 0 ? "down" : "flat"}>
                {(todayHr?.absent_today ?? 0)} absent
              </TrendPill>
              <TrendPill tone="flat">{todayHr?.on_leave ?? 0} leave</TrendPill>
            </div>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <p className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{staffAvailable}</p>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              <span className="mx-1">/</span>
              {totalStaff || totalStaffY}
            </p>
            <TrendPill tone={staffAvailable - staffAvailableY >= 0 ? "up" : "down"}>
              {diffInt(staffAvailable, staffAvailableY, "").text}
            </TrendPill>
          </div>
        </div>
      </div>
    </section>
  );
}

