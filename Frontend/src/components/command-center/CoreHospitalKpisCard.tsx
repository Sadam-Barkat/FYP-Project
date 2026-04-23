"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";
import { LayoutDashboard, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight, AlertCircle } from "lucide-react";

type HospitalOverview = {
  total_beds: number;
  active_patients: { total: number };
  todays_revenue: number;
  icu_occupancy: number;
  critical_condition_cases: number;
  emergency_cases: number;
  bed_occupancy_trend?: number[];
  bed_occupancy_7d_avg?: number;
  icu_occupancy_trend?: number[];
  icu_occupancy_7d_avg?: number;
  revenue_trend?: number[];
  revenue_7d_avg?: number;
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

function diffInt(current: number, previous: number, suffix: string = "") {
  const diff = current - previous;
  if (diff > 0) return { tone: "up", text: `+${diff}${suffix}` };
  if (diff < 0) return { tone: "down", text: `${diff}${suffix}` };
  return { tone: "flat", text: `0${suffix}` };
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

function TinyTrendChart({ data, color }: { data: number[], color: "orange" | "green" }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const width = 120;
  const height = 20;
  const barWidth = 6;
  const gap = 4;
  
  const points = data.map((val, i) => {
    const x = i * (barWidth + gap);
    const y = height - ((val - min) / range) * height;
    return { x, y, val };
  });

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x + barWidth/2} ${p.y}` : `L ${p.x + barWidth/2} ${p.y}`)).join(" ");
  
  const fillColor = color === "orange" ? "#fcd34d" : "#86efac";
  const strokeColor = color === "orange" ? "#f59e0b" : "#22c55e";

  return (
    <div className="relative mt-2 h-[24px] w-full">
      <svg width={width} height={height} className="absolute bottom-0 left-0 overflow-visible">
        {/* Bars */}
        {points.map((p, i) => {
          const h = Math.max(2, height - p.y);
          // Make the last few bars darker/colored, earlier ones lighter/grayish
          const isRecent = i >= data.length - 3;
          const rectFill = isRecent ? fillColor : (color === "orange" ? "#fef3c7" : "#dcfce7");
          return (
            <rect key={i} x={p.x} y={height - h} width={barWidth} height={h} fill={rectFill} rx={1} />
          );
        })}
        {/* Line overlay */}
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60" />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="2 2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 translate-y-1" />
      </svg>
    </div>
  );
}

function StatusBadge({ type, text }: { type: "success" | "warning" | "error", text: string }) {
  const colors = {
    success: "text-status-success bg-status-success/10 border-status-success/30",
    warning: "text-status-warning bg-status-warning/10 border-status-warning/30",
    error: "text-status-danger bg-status-danger/10 border-status-danger/30",
  };
  
  return (
    <div className={`mt-3 ml-auto flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${colors[type]}`}>
      {type === "success" && <CheckCircle2 size={12} />}
      {type === "warning" && <AlertCircle size={12} />}
      {type === "error" && <AlertTriangle size={12} />}
      <span>{text}</span>
      <ChevronRight size={12} className="opacity-70" />
    </div>
  );
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
          fetch(`${API_BASE}/api/hospital-overview?date=${todayStr}`, { headers }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
          fetch(`${API_BASE}/api/hospital-overview?date=${yStr}`, { headers }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
          fetch(`${API_BASE}/api/hr-staff-overview?date=${todayStr}`, { headers }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
          fetch(`${API_BASE}/api/hr-staff-overview?date=${yStr}`, { headers }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
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
  const staffAbsent = todayHr?.absent_today ?? 0;
  const staffAbsentY = yesterdayHr?.absent_today ?? 0;

  const activePatients = todayOverview?.active_patients?.total ?? 0;
  const icuOcc = todayOverview?.icu_occupancy ?? 0;
  const icuOccY = yesterdayOverview?.icu_occupancy ?? 0;
  const criticalPatients = todayOverview?.critical_condition_cases ?? 0;
  const criticalPatientsY = yesterdayOverview?.critical_condition_cases ?? 0;
  const revenue = todayOverview?.todays_revenue ?? 0;
  const revenueY = yesterdayOverview?.todays_revenue ?? 0;

  const bedTrend = diffPct(bedOccupancy, bedOccupancyY);
  const icuTrend = diffPct(icuOcc, icuOccY);

  // 7-day averages
  const bed7dAvg = todayOverview?.bed_occupancy_7d_avg ?? bedOccupancy;
  const icu7dAvg = todayOverview?.icu_occupancy_7d_avg ?? icuOcc;
  const rev7dAvg = todayOverview?.revenue_7d_avg ?? revenue;

  // High risk calculations
  const emergencyCases = todayOverview?.emergency_cases ?? 0;
  const emergencyCasesY = yesterdayOverview?.emergency_cases ?? 0;
  const totalHighRisk = criticalPatients + emergencyCases;

  let highRiskInsight = "No critical or emergency cases currently active.";
  if (criticalPatients > 0) {
    highRiskInsight = `${criticalPatients} patient${criticalPatients > 1 ? 's' : ''} in critical condition is currently active.`;
  } else if (emergencyCases > 0) {
    highRiskInsight = `${emergencyCases} emergency case${emergencyCases > 1 ? 's' : ''} currently active.`;
  }

  // Revenue trend text
  const revDiff = revenue - revenueY;
  const revPct = revenueY > 0 ? (revDiff / revenueY) * 100 : 0;
  const revTone = revDiff >= 0 ? "up" : "down";

  return (
    <section
      className={[
        "rounded-2xl border border-base-border bg-base-card/70 shadow-card backdrop-blur-md flex flex-col transition-all duration-200 hover:-translate-y-1",
        className,
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-base-border px-6 py-4 bg-base-muted/20 shrink-0">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-blue text-text-bright shadow-glow-blue">
          <LayoutDashboard size={16} />
        </span>
        <h2 className="text-[17px] font-semibold text-text-bright">Core Hospital KPIs</h2>
      </div>

      {/* Grid */}
      <div className="grid flex-1 grid-cols-2 grid-rows-3">
        {/* Cell 1: Bed Occupancy */}
        <div className="flex flex-col justify-between border-b border-r border-base-border px-6 py-5">
          <div>
            <p className="text-[13px] font-semibold text-text-secondary">Bed Occupancy</p>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-3xl font-bold text-status-warning tabular-nums">
                {Math.round(clampPct(bedOccupancy))}
                <span className="text-2xl ml-0.5">%</span>
              </p>
              <div className="flex h-7 items-center rounded-full bg-base-muted/30 px-2.5 border border-base-border">
                {bedTrend.tone === "down" ? <MiniChartDown /> : bedTrend.tone === "up" ? <MiniChartUp /> : <MiniChartFlat />}
                <span className="text-xs font-semibold text-text-secondary ml-1 tabular-nums">{bedTrend.text}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-[11px] text-text-muted">
                7-Day Avg: {Math.round(clampPct(bed7dAvg))}%
              </p>
              <TinyTrendChart data={todayOverview?.bed_occupancy_trend || [65, 66, 68, 69, 70, 69, 68]} color="orange" />
            </div>
            <p className="mt-3 text-[12px] text-text-secondary leading-snug">
              {loading ? "..." : bedOccupancy < 80 ? "Bed availability is good, demand has eased today." : "High demand for beds today."}
            </p>
          </div>
          <StatusBadge type={bedOccupancy < 85 ? "success" : "warning"} text={bedOccupancy < 85 ? "Normal" : "High"} />
        </div>

        {/* Cell 2: Active Patients */}
        <div className="flex flex-col justify-between border-b border-base-border px-6 py-5">
          <div>
            <p className="text-[13px] font-semibold text-text-secondary">Active Patients</p>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-3xl font-bold text-text-bright tabular-nums">{activePatients}</p>
              <div className="flex h-7 items-center gap-1.5 rounded-full bg-brand-blue/10 px-2.5 text-brand-blue border border-brand-blue/20">
                <TrendingUp size={12} strokeWidth={2.5} />
                <span className="text-[11px] font-semibold">
                  {activePatients - (yesterdayOverview?.active_patients?.total ?? 0) > 0 ? "+" : ""}
                  {activePatients - (yesterdayOverview?.active_patients?.total ?? 0)} vs yesterday
                </span>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-text-secondary leading-snug">
              {loading ? "..." : `${yesterdayOverview?.active_patients?.total ?? 0} patients yesterday. Inflow is ${activePatients > (yesterdayOverview?.active_patients?.total ?? 0) ? "increasing" : "decreasing"} compared to yesterday.`}
            </p>
          </div>
          <StatusBadge type="success" text="Normal" />
        </div>

        {/* Cell 3: ICU Occupancy */}
        <div className="flex flex-col justify-between border-b border-r border-base-border px-6 py-5">
          <div>
            <p className="text-[13px] font-semibold text-text-secondary">ICU Occupancy</p>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-3xl font-bold text-text-bright tabular-nums">
                {Math.round(clampPct(icuOcc))}
                <span className="text-2xl text-status-warning ml-0.5">%</span>
              </p>
              <div className="flex h-7 items-center rounded-full bg-base-muted/30 px-2.5 border border-base-border">
                {icuTrend.tone === "down" ? <MiniChartDown /> : icuTrend.tone === "up" ? <MiniChartUp /> : <MiniChartFlat />}
                <span className="text-xs font-semibold text-text-secondary ml-1 tabular-nums">{icuTrend.text}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-[11px] text-text-muted">
                7-Day Avg: {Math.round(clampPct(icu7dAvg))}%
              </p>
              <TinyTrendChart data={todayOverview?.icu_occupancy_trend || [40, 42, 45, 46, 45, 42, 39]} color="orange" />
            </div>
            <p className="mt-3 text-[12px] text-text-secondary leading-snug">
              {loading ? "..." : icuOcc < 75 ? "ICU has good capacity available." : "ICU capacity is limited."}
            </p>
          </div>
          <StatusBadge type={icuOcc < 80 ? "success" : "error"} text={icuOcc < 80 ? "Sufficient" : "Critical"} />
        </div>

        {/* Cell 4: High-Risk Patients */}
        <div className="flex flex-col justify-between border-b border-base-border px-6 py-5">
          <div>
            <p className="text-[13px] font-semibold text-text-secondary">High-Risk Patients</p>
            
            <div className="mt-2 flex items-end gap-6">
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-status-danger"></div>
                  <span className="text-[11px] font-medium text-text-muted">Critical</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <p className="text-2xl font-bold text-text-bright tabular-nums">{criticalPatients}</p>
                  <span className="text-[10px] font-medium text-text-muted ml-1 tabular-nums">{criticalPatientsY}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-status-warning"></div>
                  <span className="text-[11px] font-medium text-text-muted">Emergency</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <p className="text-2xl font-bold text-text-bright tabular-nums">{emergencyCases}</p>
                  <span className="text-[10px] font-medium text-text-muted ml-1 tabular-nums">{emergencyCasesY}</span>
                </div>
              </div>
            </div>
            
            <p className="mt-4 text-[12px] text-text-secondary leading-snug">
              {loading ? "..." : highRiskInsight}
            </p>
          </div>
          <StatusBadge type={totalHighRisk > 5 ? "error" : "warning"} text={totalHighRisk > 5 ? "Critical" : "Stable"} />
        </div>

        {/* Cell 5: Today's Revenue */}
        <div className="flex flex-col justify-between border-r border-base-border px-6 py-5">
          <div>
            <p className="text-[13px] font-semibold text-text-secondary">Today&apos;s Revenue</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-3xl font-bold text-text-bright tabular-nums">
                <span className="text-[20px] font-semibold mr-1.5">PKR</span>
                {Math.round(revenue).toLocaleString("en-PK")}
              </p>
              <span className={`text-[13px] font-semibold ${revTone === "up" ? "text-status-success" : "text-status-danger"}`}>
                {revTone === "up" ? "↑" : "↓"}{revTone === "up" ? "+" : ""}{Math.round(revPct)}%
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-[11px] text-text-muted">
                7-Day Avg: PKR {Math.round(rev7dAvg).toLocaleString("en-PK")}
              </p>
              <TinyTrendChart data={todayOverview?.revenue_trend || [2000, 2200, 2500, 2400, 2800, 3000, 3399]} color="green" />
            </div>
            <p className="mt-3 text-[12px] text-text-secondary leading-snug">
              {loading ? "..." : "Revenue is stable, but clearance of aged pending payments is advised."}
            </p>
          </div>
        </div>

        {/* Cell 6: Staff Available */}
        <div className="flex flex-col justify-between px-6 py-5">
          <div>
            <p className="text-[13px] font-semibold text-text-secondary">Staff Available</p>
            
            <div className="mt-2 flex items-baseline gap-2">
              <p className={`text-3xl font-bold tabular-nums ${staffAvailable < totalStaff * 0.8 ? 'text-status-danger' : 'text-text-bright'}`}>{staffAvailable}</p>
              <p className="text-[12px] font-medium text-text-muted mb-1">of</p>
              <p className="text-xl font-bold text-text-bright tabular-nums mb-0.5">{totalStaff}</p>
              
              {staffAbsent > 0 && (
                <div className="ml-2 flex items-center gap-1 text-[11px] font-semibold text-status-danger">
                  <span className="bg-status-danger/10 text-status-danger px-1.5 py-0.5 rounded flex items-center gap-1 border border-status-danger/30">
                    <AlertTriangle size={10} />
                    +{staffAbsent} ill <ChevronRight size={10} className="ml-0.5" />
                  </span>
                </div>
              )}
            </div>

            {staffAvailable < totalStaff * 0.8 && (
              <div className="mt-3 flex items-center gap-1.5 text-status-warning">
                <AlertTriangle size={14} />
                <span className="text-[13px] font-semibold">Limited Staff</span>
              </div>
            )}
            
            <p className="mt-2 text-[12px] text-text-secondary leading-snug">
              {loading ? "..." : (staffAvailable / (totalStaff || 1) < 0.8 ? "Ensure adequate coverage for critical departments." : "Coverage is optimal for current patient load.")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
