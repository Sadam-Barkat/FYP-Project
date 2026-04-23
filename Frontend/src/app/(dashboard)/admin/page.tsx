"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Users,
  Bed,
  LayoutGrid,
  AlertTriangle,
  UserCheck,
  DollarSign,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer } from "recharts";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useRealtimeEvent } from "@/hooks/useRealtimeEvent";

const cardBase =
  "relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 cursor-default hover:-translate-y-1 p-4 pb-[48%]";

function makeSparkData(value: number) {
  const v = Number.isFinite(value) ? value : 0;
  return Array.from({ length: 14 }, (_, i) => ({
    v: Math.round(v * (0.82 + Math.sin(i * 0.75 + (v % 3)) * 0.16)),
  }));
}

export type TotalPatientsBreakdown = {
  in_hospital?: number | null;
  /** Same census definition as in_hospital, for previous calendar day (trend baseline). */
  in_hospital_yesterday?: number | null;
  admitted_today?: number | null;
  discharged_today?: number | null;
  under_observation?: number | null;
  outpatient?: number | null;
};

export type ActiveAdmissionsBreakdown = {
  male?: number | null;
  female?: number | null;
  children?: number | null;
  elderly?: number | null;
};

export type AvailableBedsBreakdown = {
  total_beds?: number | null;
  occupied?: number | null;
  available?: number | null;
  under_maintenance?: number | null;
};

export type CriticalPatientsBreakdown = {
  critical?: number | null;
  emergency?: number | null;
  stable?: number | null;
  under_observation?: number | null;
};

export type StaffOnDutyBreakdown = {
  doctors?: number | null;
  nurses?: number | null;
  admin?: number | null;
  finance?: number | null;
  laboratorians?: number | null;
  receptionists?: number | null;
};

export type RevenueTodayBreakdown = {
  paid?: number | null;
  pending?: number | null;
  total_transactions?: number | null;
  largest_bill?: number | null;
};

export type HospitalOverviewKpis = {
  total_patients?: number | null;
  active_admissions?: number | null;
  available_beds?: number | null;
  critical_patients?: number | null;
  staff_on_duty?: number | null;
  revenue_today?: number | null;
  total_patients_trend?: string | null;
  active_admissions_trend?: string | null;
  available_beds_trend?: string | null;
  critical_patients_trend?: string | null;
  staff_on_duty_trend?: string | null;
  revenue_today_trend?: string | null;
  total_patients_breakdown?: TotalPatientsBreakdown | null;
  active_admissions_breakdown?: ActiveAdmissionsBreakdown | null;
  available_beds_breakdown?: AvailableBedsBreakdown | null;
  critical_patients_breakdown?: CriticalPatientsBreakdown | null;
  staff_on_duty_breakdown?: StaffOnDutyBreakdown | null;
  revenue_today_breakdown?: RevenueTodayBreakdown | null;
};

export type PatientIntelResponse = {
  total_patients: number;
  previous_week_patients: number;
  change_from_last_week: number;
  vitals_health_percentage: number;
  critical_vitals_percentage: number;
  at_risk_count: number;
  top_risk_patients: string;
  ai_prediction: string;
};

export type PharmacyIntelResponse = {
  total_medicines: number;
  out_of_stock_count: number;
  low_stock_count: number;
  sufficient_stock_count: number;
  expiring_soon_count: number;
  expired_count: number;
  out_of_stock_medicines?: string[];
  low_stock_medicines?: string[];
  expiring_soon_medicines?: string[];
  expired_medicines?: string[];
  stockout_prediction: string;
  medicines_to_reorder: string[];
  expiry_warning: string;
  suggestion: string;
};

type PharmacyStatHover = "oos" | "low" | "soon" | "expired" | null;

function PharmacyMedicineTooltip({
  open,
  title,
  names,
}: {
  open: boolean;
  title: string;
  names: string[];
}) {
  if (!open) return null;
  const needsScroll = names.length > 10;
  return (
    <div className="absolute left-full top-1/2 z-[60] ml-2 min-w-[180px] max-w-[220px] -translate-y-1/2">
      <div
        className={`pointer-events-auto rounded-2xl border border-brand-blue/30 bg-base-card/90 px-3 py-2 shadow-nav backdrop-blur-md ${
          needsScroll
            ? "max-h-44 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
            : ""
        }`}
      >
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-brand-blue">
          {title}
        </p>
        {names.length === 0 ? (
          <p className="text-[10px] text-text-secondary">None</p>
        ) : (
          <ul className="space-y-0.5 text-[10px] leading-snug text-text-primary">
            {names.map((n, i) => (
              <li key={`${n}-${i}`} className="break-words">
                {n}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatKpiDisplay(
  data: HospitalOverviewKpis | null,
  valueKey: keyof HospitalOverviewKpis,
  kind: "int" | "currency"
): string {
  if (!data) return "—";
  const raw = data[valueKey];
  if (raw === null || raw === undefined) return "—";
  if (kind === "currency") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "—";
    return `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function trendTextClass(trend: string | null | undefined): string {
  const s = (trend ?? "").trim();
  if (!s || s === "N/A") return "text-text-secondary";
  if (s.startsWith("+")) return "text-status-success";
  if (s.startsWith("-")) return "text-status-danger";
  return "text-text-secondary";
}

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatRs(value: number): string {
  return `Rs. ${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function kpiTooltipContent(
  cardLabel: string,
  data: HospitalOverviewKpis | null
): { title: string; rows: { label: string; value: string }[] } {
  const d = data;
  switch (cardLabel) {
    case "Patients today": {
      const b = d?.total_patients_breakdown;
      return {
        title: "Patient Breakdown",
        rows: [
          {
            label: "Patients today (census EOD):",
            value: String(asNum(b?.in_hospital)),
          },
          {
            label: "Patients yesterday (EOD):",
            value: String(asNum(b?.in_hospital_yesterday)),
          },
          { label: "Admitted Today:", value: String(asNum(b?.admitted_today)) },
          { label: "Discharged Today:", value: String(asNum(b?.discharged_today)) },
          { label: "Under Observation:", value: String(asNum(b?.under_observation)) },
          { label: "Outpatient:", value: String(asNum(b?.outpatient)) },
        ],
      };
    }
    case "Active Admissions": {
      const b = d?.active_admissions_breakdown;
      return {
        title: "Admissions Breakdown",
        rows: [
          { label: "Male Patients:", value: String(asNum(b?.male)) },
          { label: "Female Patients:", value: String(asNum(b?.female)) },
          { label: "Children (under 18):", value: String(asNum(b?.children)) },
          { label: "Elderly (60+):", value: String(asNum(b?.elderly)) },
        ],
      };
    }
    case "Available Beds": {
      const b = d?.available_beds_breakdown;
      return {
        title: "Bed Status Breakdown",
        rows: [
          { label: "Total Beds:", value: String(asNum(b?.total_beds)) },
          { label: "Currently Occupied:", value: String(asNum(b?.occupied)) },
          { label: "Available Now:", value: String(asNum(b?.available)) },
          { label: "Under Maintenance:", value: String(asNum(b?.under_maintenance)) },
        ],
      };
    }
    case "Critical Patients": {
      const b = d?.critical_patients_breakdown;
      return {
        title: "Patient Condition Breakdown",
        rows: [
          { label: "🔴 Critical:", value: String(asNum(b?.critical)) },
          { label: "🚨 Emergency:", value: String(asNum(b?.emergency)) },
          { label: "🟡 Under Observation:", value: String(asNum(b?.under_observation)) },
          { label: "🟢 Stable:", value: String(asNum(b?.stable)) },
        ],
      };
    }
    case "Staff On Duty": {
      const b = d?.staff_on_duty_breakdown;
      return {
        title: "Staff Role Breakdown",
        rows: [
          { label: "👨‍⚕️ Doctors:", value: String(asNum(b?.doctors)) },
          { label: "👩‍⚕️ Nurses:", value: String(asNum(b?.nurses)) },
          { label: "🧪 Laboratorians:", value: String(asNum(b?.laboratorians)) },
          { label: "💰 Finance:", value: String(asNum(b?.finance)) },
          { label: "🏥 Receptionists:", value: String(asNum(b?.receptionists)) },
          { label: "⚙️ Admin:", value: String(asNum(b?.admin)) },
        ],
      };
    }
    case "Revenue Today": {
      const b = d?.revenue_today_breakdown;
      return {
        title: "Revenue Breakdown",
        rows: [
          { label: "✅ Paid Amount:", value: formatRs(asNum(b?.paid)) },
          { label: "⏳ Pending Amount:", value: formatRs(asNum(b?.pending)) },
          {
            label: "Total Transactions:",
            value: String(asNum(b?.total_transactions)),
          },
          { label: "Largest Bill:", value: formatRs(asNum(b?.largest_bill)) },
        ],
      };
    }
    default:
      return { title: "", rows: [] };
  }
}

function intelFooterUpdated(at: Date | null, tick: number): string {
  void tick;
  if (!at) return "last updated —";
  const m = Math.floor((Date.now() - at.getTime()) / 60000);
  if (m < 1) return "last updated just now";
  return `last updated ${m} mins ago`;
}

function healthPctClass(pct: number): string {
  if (pct >= 70) return "text-status-success";
  if (pct >= 50) return "text-status-warning";
  return "text-status-danger";
}

function changeVsWeekUi(delta: number): { arrow: string; cls: string; tail: string } {
  if (delta > 0) {
    return { arrow: "↑", cls: "text-status-success", tail: `${delta} vs last week` };
  }
  if (delta < 0) {
    return {
      arrow: "↓",
      cls: "text-status-danger",
      tail: `${Math.abs(delta)} vs last week`,
    };
  }
  return { arrow: "—", cls: "text-text-secondary", tail: "0 vs last week" };
}

type ParsedAiForecast = {
  summary: string;
  names: string[];
  suggestion: string;
  rawFallback: string;
};

/** Parses LLM output when it follows SUMMARY: / NAMES: / SUGGESTION: sections. */
function parseAiForecast(text: string): ParsedAiForecast {
  const raw = (text || "").trim();
  if (!raw) {
    return { summary: "", names: [], suggestion: "", rawFallback: "" };
  }

  const reSummary = /SUMMARY\s*:\s*([\s\S]*?)(?=\bNAMES\s*:)/i;
  const reNames = /NAMES\s*:\s*([\s\S]*?)(?=\bSUGGESTION\s*:)/i;
  const reSugg = /SUGGESTION\s*:\s*([\s\S]*)$/i;

  const mS = raw.match(reSummary);
  const mN = raw.match(reNames);
  const mG = raw.match(reSugg);

  if (mS && mN && mG) {
    const summary = mS[1].trim();
    const namesBlock = mN[1].trim();
    const suggestion = mG[1].trim();
    const names: string[] = [];
    for (const line of namesBlock.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      const num = t.match(/^\d+\.\s*(.+)$/);
      if (num) names.push(num[1].trim());
    }
    return { summary, names, suggestion, rawFallback: "" };
  }

  return { summary: "", names: [], suggestion: "", rawFallback: raw };
}

const KPI_CARD_DEFS = [
  {
    label: "Patients today",
    valueKey: "total_patients" as const,
    trendKey: "total_patients_trend" as const,
    icon: Users,
    accent: "bg-kpi-blue shadow-kpi-blue hover:shadow-kpi-blue-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-kpi-blue/20 border border-kpi-blue/30 flex items-center justify-center text-kpi-blue",
    kind: "int" as const,
    chart: "area" as const,
    stroke: "#3b82f6",
    gradId: "blue",
  },
  {
    label: "Active Admissions",
    valueKey: "active_admissions" as const,
    trendKey: "active_admissions_trend" as const,
    icon: Bed,
    accent: "bg-kpi-purple shadow-kpi-purple hover:shadow-kpi-purple-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-kpi-purple/20 border border-kpi-purple/30 flex items-center justify-center text-kpi-purple",
    kind: "int" as const,
    chart: "area" as const,
    stroke: "#a855f7",
    gradId: "purple",
  },
  {
    label: "Available Beds",
    valueKey: "available_beds" as const,
    trendKey: "available_beds_trend" as const,
    icon: LayoutGrid,
    accent: "bg-kpi-cyan shadow-kpi-cyan hover:shadow-kpi-cyan-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-kpi-cyan/20 border border-kpi-cyan/30 flex items-center justify-center text-kpi-cyan",
    kind: "int" as const,
    chart: "area" as const,
    stroke: "#06b6d4",
    gradId: "cyan",
  },
  {
    label: "Critical Patients",
    valueKey: "critical_patients" as const,
    trendKey: "critical_patients_trend" as const,
    icon: AlertTriangle,
    accent: "bg-kpi-red shadow-kpi-red hover:shadow-kpi-red-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-kpi-red/20 border border-kpi-red/30 flex items-center justify-center text-kpi-red",
    kind: "int" as const,
    chart: "bar" as const,
    stroke: "#ef4444",
    gradId: "red",
  },
  {
    label: "Staff On Duty",
    valueKey: "staff_on_duty" as const,
    trendKey: "staff_on_duty_trend" as const,
    icon: UserCheck,
    accent: "bg-kpi-green shadow-kpi-green hover:shadow-kpi-green-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-kpi-green/20 border border-kpi-green/30 flex items-center justify-center text-kpi-green",
    kind: "int" as const,
    chart: "area" as const,
    stroke: "#22c55e",
    gradId: "green",
  },
  {
    label: "Revenue Today",
    valueKey: "revenue_today" as const,
    trendKey: "revenue_today_trend" as const,
    icon: DollarSign,
    accent: "bg-kpi-orange shadow-kpi-orange hover:shadow-kpi-orange-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-kpi-orange/20 border border-kpi-orange/30 flex items-center justify-center text-kpi-orange",
    kind: "currency" as const,
    chart: "area" as const,
    stroke: "#f97316",
    gradId: "orange",
  },
] as const;

export default function AdminDashboard() {
  const [kpiData, setKpiData] = useState<HospitalOverviewKpis | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiHover, setKpiHover] = useState<string | null>(null);
  const kpiHasLoadedOnce = useRef(false);

  const [intelData, setIntelData] = useState<PatientIntelResponse | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);
  const [intelLastFetch, setIntelLastFetch] = useState<Date | null>(null);
  const [intelClock, setIntelClock] = useState(0);

  const [pharmacyData, setPharmacyData] = useState<PharmacyIntelResponse | null>(
    null
  );
  const [pharmacyLoading, setPharmacyLoading] = useState(true);
  const [pharmacyLastFetch, setPharmacyLastFetch] = useState<Date | null>(null);
  const [pharmacyStatHover, setPharmacyStatHover] =
    useState<PharmacyStatHover>(null);

  const loadKpis = useCallback(async () => {
    if (!kpiHasLoadedOnce.current) {
      setKpiLoading(true);
    }
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/hospital-overview`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HospitalOverviewKpis;
      setKpiData(data);
      kpiHasLoadedOnce.current = true;
    } catch {
      if (!kpiHasLoadedOnce.current) {
        setKpiData(null);
      }
    } finally {
      setKpiLoading(false);
    }
  }, []);

  const loadIntel = useCallback(async () => {
    setIntelLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/patient-intelligence`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PatientIntelResponse;
      setIntelData(data);
      setIntelLastFetch(new Date());
    } catch {
      setIntelData(null);
    } finally {
      setIntelLoading(false);
    }
  }, []);

  const loadPharmacy = useCallback(async () => {
    setPharmacyLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/pharmacy-intelligence`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PharmacyIntelResponse;
      setPharmacyData(data);
      setPharmacyLastFetch(new Date());
    } catch {
      setPharmacyData(null);
    } finally {
      setPharmacyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    void loadIntel();
  }, [loadIntel]);

  useEffect(() => {
    void loadPharmacy();
  }, [loadPharmacy]);

  useRealtimeEvent(["vitals_updated", "admin_data_changed"], () => {
    void loadKpis();
    void loadIntel();
    void loadPharmacy();
  });

  useEffect(() => {
    const id = window.setInterval(() => setIntelClock((c) => c + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      id="dashboard-content"
      className="admin-overview-theme h-[calc(100dvh-72px)] max-h-[calc(100dvh-72px)] w-full bg-dash-bg px-6 py-3 overflow-hidden flex flex-col gap-3"
    >
      <div className="flex items-center justify-end gap-2 text-tx-secondary text-xs">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-green opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-kpi-green" />
        </span>
        <span>Last updated: just now</span>
      </div>
      {/* KPI row — data from GET /api/hospital-overview */}
      <section className="shrink-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPI_CARD_DEFS.map((k) => {
          const Icon = k.icon;
          const displayValue = formatKpiDisplay(kpiData, k.valueKey, k.kind);
          const seedValue = Number(kpiData?.[k.valueKey] ?? 0);
          const value = Number.isFinite(seedValue) ? seedValue : 0;
          const trendRaw = kpiData?.[k.trendKey];
          const trendStr =
            trendRaw === null || trendRaw === undefined || trendRaw === ""
              ? "N/A"
              : String(trendRaw);
          const trendLine =
            trendStr === "N/A"
              ? "N/A vs yesterday"
              : `${trendStr} vs yesterday`;
          const { title: tipTitle, rows: tipRows } = kpiTooltipContent(
            k.label,
            kpiData
          );
          const showTip =
            !kpiLoading && kpiHover === k.label && tipRows.length > 0;
          const sparkData = makeSparkData(value);
          return (
            <div
              key={k.label}
              className="relative"
              onMouseEnter={() => setKpiHover(k.label)}
              onMouseLeave={() => setKpiHover(null)}
            >
              <div className={`${cardBase} ${k.accent}`}>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={k.iconWrap}>
                      <Icon className="w-4 h-4" aria-hidden />
                    </div>
                    <h3 className="text-tx-secondary text-[10px] font-semibold uppercase tracking-widest">
                      {k.label}
                    </h3>
                  </div>
                  <div
                    className="mb-2 flex min-h-[2.25rem] items-center"
                  >
                  {kpiLoading ? (
                    <div
                      className="h-8 w-24 max-w-full animate-pulse rounded-xl bg-white/8"
                      aria-hidden
                    />
                  ) : (
                    <p
                      className="text-tx-bright font-black text-3xl tabular-nums leading-none"
                    >
                      {displayValue}
                    </p>
                  )}
                </div>
                <p
                  className="inline-flex items-center gap-1 bg-white/8 border border-white/10 rounded-full px-2 py-0.5 text-[10px] font-medium w-fit"
                >
                  <span className={kpiLoading ? "text-tx-secondary" : trendTextClass(trendStr)}>
                    {kpiLoading ? "N/A vs yesterday" : trendLine}
                  </span>
                </p>
              </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-[44%] pointer-events-none">
                <ResponsiveContainer width="100%" height="100%">
                  {k.chart === "bar" ? (
                    <BarChart
                      data={sparkData}
                      margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                      barSize={6}
                    >
                      <Bar
                        dataKey="v"
                        fill="#ef4444"
                        radius={[2, 2, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  ) : (
                    <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient
                          id={`grad-${k.gradId}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor={k.stroke} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={k.stroke} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={k.stroke}
                        strokeWidth={1.5}
                        fill={`url(#grad-${k.gradId})`}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div
                className={`pointer-events-none absolute left-1/2 top-full z-50 mt-2 flex w-[220px] -translate-x-1/2 flex-col items-center transition-opacity duration-200 ${
                  showTip ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden={!showTip}
              >
                <div
                  className="h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent border-b-base-border"
                  aria-hidden
                />
                <div className="-mt-px w-full rounded-2xl border border-base-border bg-base-card px-3 py-2.5 shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
                  <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                    {tipTitle}
                  </p>
                  <div className="space-y-1.5">
                    {tipRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex justify-between gap-2 text-xs leading-snug"
                      >
                        <span className="text-text-secondary">{row.label}</span>
                        <span className="shrink-0 pl-1 text-right font-semibold text-text-primary">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Patient Intelligence — GET /api/patient-intelligence (2-col row for future cards) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-panel border border-white/[0.06] rounded-2xl shadow-panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dash-border">
            <div className="flex items-center gap-3">
              <span className="text-xl" aria-hidden>
                🧠
              </span>
              <h2 className="text-tx-bright font-bold text-lg">Patient Intelligence</h2>
            </div>
            <div className="flex items-center gap-2">
              {intelData ? (
                <span className="whitespace-nowrap text-tx-secondary text-xs">
                  {intelFooterUpdated(intelLastFetch, intelClock)}
                </span>
              ) : null}
              {intelData ? (
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-red opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-kpi-red" />
                </span>
              ) : null}
            </div>
          </div>

          {!intelData && !intelLoading ? (
            <p className="mt-2 text-xs text-text-muted">
              Unable to load. Check admin access and API.
            </p>
          ) : null}
          {intelLoading && !intelData ? (
            <div className="mt-2 h-36 animate-pulse rounded-md bg-base-glow/50" />
          ) : null}

          {intelData ? (
            <div className="h-full grid grid-cols-[200px_1fr_1fr] gap-0 divide-x divide-dash-border">
              <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-dash-border p-0">
                <div className="flex flex-col p-4">
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Total Patients
                  </p>
                  <p className="text-tx-bright font-black text-2xl tabular-nums leading-none">
                    {intelData.total_patients}
                  </p>
                  {(() => {
                    const u = changeVsWeekUi(intelData.change_from_last_week);
                    return (
                      <p className={`text-xs font-medium mt-1 ${u.cls}`}>
                        {u.arrow} {u.tail}
                      </p>
                    );
                  })()}
                </div>
                <div className="flex flex-col p-4">
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Vitals Health
                  </p>
                  <p className="text-kpi-green font-black text-2xl tabular-nums leading-none">
                    {intelData.vitals_health_percentage}%
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-dash-border mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-green"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, intelData.vitals_health_percentage)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col p-4">
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Critical Vitals
                  </p>
                  <p className="text-kpi-red font-black text-2xl tabular-nums leading-none">
                    {intelData.critical_vitals_percentage}%
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-dash-border mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-red"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, intelData.critical_vitals_percentage)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col p-4">
                  <p className="flex items-center gap-1.5">
                    <span className="text-tx-yellow" aria-hidden>
                      ⚠️
                    </span>
                    <span className="text-tx-yellow text-[10px] font-semibold uppercase tracking-wider">
                      At Risk
                    </span>
                  </p>
                  <p className="mt-1 text-tx-bright font-black text-2xl tabular-nums leading-none">
                    {intelData.at_risk_count}
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-dash-border mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-500"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, intelData.at_risk_count)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 flex flex-col gap-2 overflow-hidden">
                <p className="text-kpi-cyan text-xs font-bold uppercase tracking-wider">
                  🤖 AI RISK FORECAST
                </p>
                <div className="text-tx-secondary text-xs leading-relaxed italic overflow-hidden">
                  {(() => {
                    const p = parseAiForecast(intelData.ai_prediction);
                    if (p.rawFallback) {
                      return (
                        <p className="text-tx-secondary text-xs leading-relaxed italic">
                          {p.rawFallback}
                        </p>
                      );
                    }
                    const hasNames = p.names.length > 0;
                    const hasSugg = Boolean(p.suggestion);
                    return (
                      <div className="flex flex-col gap-2">
                        {p.summary ? (
                          <p className="text-tx-secondary text-xs leading-relaxed italic">
                            {p.summary}
                          </p>
                        ) : null}
                        {hasNames ? (
                          <ol className="mt-1 space-y-0.5 text-xs text-tx-primary overflow-hidden">
                            {p.names.map((n, i) => (
                              <li
                                key={`${n}-${i}`}
                                className="flex items-center gap-2 py-0.5 truncate"
                              >
                                <span className="text-tx-secondary">{i + 1}.</span>
                                <span className="truncate">{n}</span>
                              </li>
                            ))}
                          </ol>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="px-5 py-4 flex flex-col gap-2 overflow-hidden">
                <p className="text-tx-secondary text-[10px] font-semibold uppercase tracking-wider mb-1">
                  Suggestion
                </p>
                <div className="bg-kpi-orange/8 border border-kpi-orange/20 rounded-xl p-4">
                  <p className="text-kpi-orange font-semibold text-sm leading-relaxed">
                    {(() => {
                      const p = parseAiForecast(intelData.ai_prediction);
                      return p.suggestion || "Monitor high-risk patients closely and ensure timely intervention if needed.";
                    })()}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="bg-panel border border-white/[0.06] rounded-2xl shadow-panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dash-border">
            <div className="flex items-center gap-3">
              <span className="text-xl" aria-hidden>
                💊
              </span>
              <h2 className="text-tx-bright font-bold text-lg">Pharmacy Intelligence</h2>
            </div>
            <div className="flex items-center gap-2">
              {pharmacyData ? (
                <span className="whitespace-nowrap text-tx-secondary text-xs">
                  {intelFooterUpdated(pharmacyLastFetch, intelClock)}
                </span>
              ) : null}
              {pharmacyData ? (
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-red opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-kpi-red" />
                </span>
              ) : null}
            </div>
          </div>

          {!pharmacyData && !pharmacyLoading ? (
            <p className="mt-3 text-text-muted text-sm">
              Unable to load. Check admin access and API.
            </p>
          ) : null}
          {pharmacyLoading && !pharmacyData ? (
            <div className="mt-3 h-32 animate-pulse rounded-xl bg-base-muted/40" />
          ) : null}

          {pharmacyData ? (
            <div className="h-full grid grid-cols-[1fr_280px] gap-0 divide-x divide-dash-border">
              <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-dash-border">
                <div className="flex flex-col p-4">
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Total medicines
                  </p>
                  <p className="text-tx-bright font-black text-2xl tabular-nums leading-none">
                    {pharmacyData.total_medicines}
                  </p>
                </div>
                <div
                  className="relative flex flex-col p-4 ring-1 ring-kpi-red/20 cursor-default"
                  onMouseEnter={() => setPharmacyStatHover("oos")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                >
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Out of stock
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-kpi-red font-black text-2xl tabular-nums leading-none">
                      {pharmacyData.out_of_stock_count}
                    </p>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-red opacity-70" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-kpi-red" />
                    </span>
                  </div>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "oos"}
                    title="Out of stock"
                    names={pharmacyData.out_of_stock_medicines ?? []}
                  />
                </div>
                <div
                  className="relative flex flex-col p-4 cursor-default"
                  onMouseEnter={() => setPharmacyStatHover("low")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                >
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Low stock
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-kpi-orange font-black text-2xl tabular-nums leading-none">
                      {pharmacyData.low_stock_count}
                    </p>
                    <span className="w-2 h-2 rounded-full bg-kpi-orange" aria-hidden />
                  </div>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "low"}
                    title="Low stock"
                    names={pharmacyData.low_stock_medicines ?? []}
                  />
                </div>
                <div
                  className="relative flex flex-col p-4 cursor-default"
                  onMouseEnter={() => setPharmacyStatHover("soon")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                >
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Expiring soon
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-tx-yellow font-black text-2xl tabular-nums leading-none">
                      {pharmacyData.expiring_soon_count}
                    </p>
                    <span className="w-2 h-2 rounded-full bg-yellow-500" aria-hidden />
                  </div>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "soon"}
                    title="Expiring soon (30d)"
                    names={pharmacyData.expiring_soon_medicines ?? []}
                  />
                </div>
                <div
                  className="relative col-span-2 flex flex-col p-4 cursor-default"
                  onMouseEnter={() => setPharmacyStatHover("expired")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                >
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Expired
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-kpi-red font-black text-2xl tabular-nums leading-none">
                      {pharmacyData.expired_count}
                    </p>
                    <span className="animate-live-pulse w-2 h-2 rounded-full bg-kpi-red" aria-hidden />
                  </div>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "expired"}
                    title="Expired"
                    names={pharmacyData.expired_medicines ?? []}
                  />
                </div>
              </div>

              <div className="px-5 py-4 flex flex-col gap-3 overflow-hidden">
                <div>
                  <p className="text-tx-yellow text-[10px] font-bold uppercase tracking-wider mb-1">
                    ⚠️ Stockout Prediction
                  </p>
                  <p className="text-tx-secondary text-xs leading-relaxed">
                    {pharmacyData.stockout_prediction}
                  </p>
                </div>
                <div>
                  <p className="text-kpi-cyan text-xs font-semibold cursor-pointer hover:text-white transition-colors">
                    🛒 REORDER NOW
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {pharmacyData.medicines_to_reorder.map((m, i) => (
                      <span
                        key={`${m}-${i}`}
                        className="bg-dash-elevated border border-dash-border text-tx-secondary text-[10px] px-2.5 py-1 rounded-lg hover:border-kpi-blue/50 hover:text-tx-primary transition-all duration-150"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-kpi-red text-[10px] font-bold uppercase tracking-wider mb-1">
                    🟥 Expiry Warning
                  </p>
                  <p className="text-tx-secondary text-xs leading-relaxed">
                    {pharmacyData.expiry_warning}
                  </p>
                </div>
                <div>
                  <p className="text-tx-yellow text-[10px] font-bold uppercase tracking-wider mb-1">
                    💡 Suggestion
                  </p>
                  <p className="text-kpi-green text-xs font-medium italic">
                    {pharmacyData.suggestion}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

    </div>
  );
}
