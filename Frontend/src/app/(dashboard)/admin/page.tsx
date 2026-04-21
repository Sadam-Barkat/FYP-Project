"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Users,
  Bed,
  LayoutGrid,
  AlertTriangle,
  UserCheck,
  DollarSign,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
} from "recharts";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useRealtimeEvent } from "@/hooks/useRealtimeEvent";

const cardBase =
  "rounded-xl border border-[#1e3a5f] bg-[#0d1b2a] p-4 transition-all hover:border-[#00b4d8] sm:p-5";

export type TotalPatientsBreakdown = {
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

export type PatientIntelVitals = {
  heart_rate: number;
  systolic_bp: number;
  diastolic_bp: number;
  temperature: number;
  spo2: number;
  respiratory_rate: number;
};

export type PatientIntelVitalsTrend = {
  heart_rate_trend: string;
  bp_trend: string;
  spo2_trend: string;
  temp_trend: string;
};

export type PatientIntelPatient = {
  patient_id: number;
  name: string;
  age: number;
  gender: string;
  ward: string;
  condition_level: string;
  news2_score: number;
  risk_level: string;
  trend: string;
  vitals: PatientIntelVitals;
  vitals_trend: PatientIntelVitalsTrend;
  predicted_condition_24h: string;
  estimated_discharge: string;
};

export type PatientIntelSummary = {
  total_active_patients: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
};

export type RiskScoreTrendPoint = {
  label: string;
  news2_score: number;
  recorded_at: string;
};

export type RiskScoreTrend = {
  patient_name: string;
  points: RiskScoreTrendPoint[];
  current_score: number;
  score_delta: number;
};

export type PatientIntelResponse = {
  summary: PatientIntelSummary;
  patients: PatientIntelPatient[];
  risk_score_trend: RiskScoreTrend;
};

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
  if (!s || s === "N/A") return "text-[#94a3b8]";
  if (s.startsWith("+")) return "text-[#10b981]";
  if (s.startsWith("-")) return "text-[#ef4444]";
  return "text-[#94a3b8]";
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
    case "Total Patients Today": {
      const b = d?.total_patients_breakdown;
      return {
        title: "Patient Breakdown",
        rows: [
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

function riskBadgeLabel(level: string): string {
  const rl = (level || "").toUpperCase();
  if (rl === "HIGH") return "🔴 HIGH";
  if (rl === "MEDIUM") return "🟡 MEDIUM";
  return "🟢 LOW";
}

function intelTrendUi(trend: string): { sym: string; cls: string } {
  const t = (trend || "").trim();
  if (t === "WORSENING") return { sym: "↑", cls: "text-[#ef4444]" };
  if (t === "MONITOR") return { sym: "→", cls: "text-[#f59e0b]" };
  return { sym: "↓", cls: "text-[#10b981]" };
}

function predictionSnippet(predicted: string): string {
  const p = (predicted || "").trim();
  if (p === "CRITICAL") return "Critical in 24h";
  if (p === "HIGH RISK") return "High risk watch";
  return "Stable outlook";
}

function intelLastUpdatedLabel(at: Date | null, tick: number): string {
  void tick;
  if (!at) return "last: —";
  const m = Math.floor((Date.now() - at.getTime()) / 60000);
  if (m < 1) return "last: just now";
  return `last: ${m}m ago`;
}

function vitalInRangeClass(
  kind: "hr" | "bp" | "temp" | "spo2" | "rr",
  v: PatientIntelVitals
): string {
  const ok =
    kind === "hr"
      ? v.heart_rate >= 60 && v.heart_rate <= 100
      : kind === "bp"
        ? v.systolic_bp >= 90 && v.systolic_bp <= 120
        : kind === "temp"
          ? v.temperature >= 36.1 && v.temperature <= 37.2
          : kind === "spo2"
            ? v.spo2 >= 95
            : v.respiratory_rate >= 12 && v.respiratory_rate <= 20;
  return ok ? "text-[#10b981]" : "text-[#ef4444]";
}

const KPI_CARD_DEFS = [
  {
    label: "Total Patients Today",
    valueKey: "total_patients" as const,
    trendKey: "total_patients_trend" as const,
    icon: Users,
    accent: "text-[#00b4d8]",
    iconWrap: "bg-[#00b4d8]/15 text-[#00b4d8]",
    kind: "int" as const,
  },
  {
    label: "Active Admissions",
    valueKey: "active_admissions" as const,
    trendKey: "active_admissions_trend" as const,
    icon: Bed,
    accent: "text-sky-400",
    iconWrap: "bg-sky-500/15 text-sky-400",
    kind: "int" as const,
  },
  {
    label: "Available Beds",
    valueKey: "available_beds" as const,
    trendKey: "available_beds_trend" as const,
    icon: LayoutGrid,
    accent: "text-[#10b981]",
    iconWrap: "bg-[#10b981]/15 text-[#10b981]",
    kind: "int" as const,
  },
  {
    label: "Critical Patients",
    valueKey: "critical_patients" as const,
    trendKey: "critical_patients_trend" as const,
    icon: AlertTriangle,
    accent: "text-[#ef4444]",
    iconWrap: "bg-[#ef4444]/15 text-[#ef4444]",
    kind: "int" as const,
  },
  {
    label: "Staff On Duty",
    valueKey: "staff_on_duty" as const,
    trendKey: "staff_on_duty_trend" as const,
    icon: UserCheck,
    accent: "text-violet-400",
    iconWrap: "bg-violet-500/15 text-violet-400",
    kind: "int" as const,
  },
  {
    label: "Revenue Today",
    valueKey: "revenue_today" as const,
    trendKey: "revenue_today_trend" as const,
    icon: DollarSign,
    accent: "text-[#f59e0b]",
    iconWrap: "bg-[#f59e0b]/15 text-[#f59e0b]",
    kind: "currency" as const,
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

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    void loadIntel();
  }, [loadIntel]);

  useRealtimeEvent(["vitals_updated", "admin_data_changed"], () => {
    void loadKpis();
    void loadIntel();
  });

  useEffect(() => {
    const id = window.setInterval(() => setIntelClock((c) => c + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const intelRiskBarData = useMemo(() => {
    const s = intelData?.summary;
    if (!s) return [];
    return [
      { name: "High", value: s.high_risk_count, fill: "#ef4444" },
      { name: "Med", value: s.medium_risk_count, fill: "#f59e0b" },
      { name: "Low", value: s.low_risk_count, fill: "#10b981" },
    ];
  }, [intelData]);

  return (
    <div
      id="dashboard-content"
      className="min-h-full w-full max-w-[1600px] space-y-5 bg-[#0a0f1e] p-4 text-[#ffffff] sm:space-y-6 sm:p-6"
    >
      {/* KPI row — data from GET /api/hospital-overview */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KPI_CARD_DEFS.map((k) => {
          const Icon = k.icon;
          const displayValue = formatKpiDisplay(kpiData, k.valueKey, k.kind);
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
          return (
            <div
              key={k.label}
              className="relative"
              onMouseEnter={() => setKpiHover(k.label)}
              onMouseLeave={() => setKpiHover(null)}
            >
              <div className={cardBase}>
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${k.iconWrap}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                </div>
                <h3 className="mt-3 text-xs font-semibold leading-snug text-[#00b4d8]">
                  {k.label}
                </h3>
                <div className="mt-3 flex min-h-[2.5rem] items-center justify-center">
                  {kpiLoading ? (
                    <div
                      className="h-10 w-28 max-w-full animate-pulse rounded-md bg-[#1e3a5f]"
                      aria-hidden
                    />
                  ) : (
                    <p
                      className={`text-center text-3xl font-bold tracking-tight ${k.accent}`}
                    >
                      {displayValue}
                    </p>
                  )}
                </div>
                <p
                  className={`mt-3 text-center text-xs font-medium ${trendTextClass(
                    kpiLoading ? "N/A" : trendStr
                  )}`}
                >
                  {kpiLoading ? "N/A vs yesterday" : trendLine}
                </p>
              </div>

              <div
                className={`pointer-events-none absolute left-1/2 top-full z-50 mt-2 flex w-[220px] -translate-x-1/2 flex-col items-center transition-opacity duration-200 ${
                  showTip ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden={!showTip}
              >
                <div
                  className="h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent border-b-[#00b4d8]"
                  aria-hidden
                />
                <div className="-mt-px w-full rounded-xl border border-[#00b4d8] bg-[#0d1b2a] px-3 py-2.5 shadow-lg">
                  <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[#00b4d8]">
                    {tipTitle}
                  </p>
                  <div className="space-y-1.5">
                    {tipRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex justify-between gap-2 text-xs leading-snug"
                      >
                        <span className="text-[#94a3b8]">{row.label}</span>
                        <span className="shrink-0 pl-1 text-right font-semibold text-[#ffffff]">
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

      {/* Patient Intelligence — GET /api/patient-intelligence */}
      <section className="rounded-xl border border-[#1e3a5f] bg-[#0d1b2a] shadow-lg transition-all hover:border-[#00b4d8]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e3a5f]/80 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-lg" aria-hidden>
              🧠
            </span>
            <h2 className="text-base font-semibold text-[#00b4d8] sm:text-lg">
              Patient Intelligence
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#fecaca]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#ef4444]" />
              <span className="font-medium text-[#ffffff]">
                {intelData?.summary?.high_risk_count ?? "—"}
              </span>
              <span className="text-[#94a3b8]">High Risk</span>
            </span>
          </div>
          <p className="text-xs text-[#94a3b8]">
            {intelLastUpdatedLabel(intelLastFetch, intelClock)}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          {!intelData && !intelLoading ? (
            <p className="text-sm text-[#94a3b8]">
              Unable to load patient intelligence. Check admin access and API
              connection.
            </p>
          ) : null}
          {intelLoading && !intelData ? (
            <div className="h-48 animate-pulse rounded-lg bg-[#1e3a5f]/60" />
          ) : null}

          {intelData ? (
            <div className="grid min-h-[260px] grid-cols-1 gap-0 lg:grid-cols-[1fr_1.8fr_1.2fr]">
              {/* Risk summary */}
              <div className="flex flex-col gap-3 border-[#1e3a5f] py-2 pr-0 lg:border-r lg:py-0 lg:pr-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#00b4d8]">
                  Risk summary
                </p>
                <div className="space-y-2">
                  <div className="rounded-lg border border-[#1e3a5f] bg-[#0a0f1e]/80 px-3 py-2">
                    <p className="text-2xl font-bold text-[#ffffff]">
                      {intelData.summary.total_active_patients}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-[#94a3b8]">
                      Total active patients
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#1e3a5f] bg-[#0a0f1e]/80 px-3 py-2">
                    <p className="text-lg font-bold text-[#fecaca]">
                      🔴 High Risk: {intelData.summary.high_risk_count}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#1e3a5f] bg-[#0a0f1e]/80 px-3 py-2">
                    <p className="text-lg font-bold text-[#fde68a]">
                      🟡 Medium Risk: {intelData.summary.medium_risk_count}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#1e3a5f] bg-[#0a0f1e]/80 px-3 py-2">
                    <p className="text-lg font-bold text-[#bbf7d0]">
                      🟢 Low Risk: {intelData.summary.low_risk_count}
                    </p>
                  </div>
                </div>
                <div className="mt-1 h-36 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={intelRiskBarData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "#1e3a5f" }} />
                      <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "#1e3a5f" }} />
                      <Tooltip
                        cursor={{ fill: "rgba(30,58,95,0.35)" }}
                        contentStyle={{
                          backgroundColor: "#0d1b2a",
                          border: "1px solid #00b4d8",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#fff",
                        }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
                        {intelRiskBarData.map((e) => (
                          <Cell key={e.name} fill={e.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top 5 */}
              <div className="flex flex-col border-[#1e3a5f] py-2 lg:border-r lg:px-4 lg:py-0">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#00b4d8]">
                  Top 5 patients
                </p>
                <div className="min-h-0 flex-1 space-y-0">
                  {intelData.patients.length === 0 ? (
                    <p className="text-sm text-[#94a3b8]">No active admissions with vitals.</p>
                  ) : (
                    intelData.patients.map((p) => {
                      const tr = intelTrendUi(p.trend);
                      return (
                        <div
                          key={p.patient_id}
                          className="group relative border-b border-[#1e3a5f]/50 px-2 py-2 text-xs transition-colors last:border-b-0 hover:bg-[#1e3a5f]"
                        >
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug sm:text-xs">
                            <span className="shrink-0 font-semibold text-[#94a3b8]">
                              {riskBadgeLabel(p.risk_level)}
                            </span>
                            <span className="min-w-0 font-medium text-[#ffffff]">
                              {p.name}
                            </span>
                            <span className="text-[#94a3b8]">—</span>
                            <span className="text-[#94a3b8]">{p.ward || "—"}</span>
                            <span className="text-[#94a3b8]">—</span>
                            <span className="text-[#ffffff]">
                              Score: {p.news2_score}/12
                            </span>
                            <span className={`shrink-0 font-bold ${tr.cls}`} title={p.trend}>
                              {tr.sym}
                            </span>
                            <span className="text-[#64748b]">—</span>
                            <span className="text-[#94a3b8]">
                              {predictionSnippet(p.predicted_condition_24h)}
                            </span>
                          </div>
                          <div className="pointer-events-none invisible absolute left-2 top-full z-50 mt-1 w-[min(100%,280px)] rounded-lg border border-[#00b4d8] bg-[#0a0f1e] p-3 text-[11px] opacity-0 shadow-xl transition-opacity group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 sm:left-auto sm:right-0 sm:w-72">
                            <p className="font-semibold text-[#00b4d8]">Vitals snapshot</p>
                            <p className="mt-1 text-[#94a3b8]">
                              Age {p.age}, {p.gender || "—"} · Ward {p.ward || "—"}
                            </p>
                            <ul className="mt-2 space-y-1 text-[#ffffff]">
                              <li className={vitalInRangeClass("hr", p.vitals)}>
                                HR: {p.vitals.heart_rate} bpm{" "}
                                <span className="text-[#64748b]">(60–100)</span>
                              </li>
                              <li className={vitalInRangeClass("bp", p.vitals)}>
                                BP: {p.vitals.systolic_bp}/{p.vitals.diastolic_bp}{" "}
                                <span className="text-[#64748b]">(sys 90–120)</span>
                              </li>
                              <li className={vitalInRangeClass("temp", p.vitals)}>
                                Temp: {p.vitals.temperature}°C{" "}
                                <span className="text-[#64748b]">(36.1–37.2)</span>
                              </li>
                              <li className={vitalInRangeClass("spo2", p.vitals)}>
                                SpO2: {p.vitals.spo2}%{" "}
                                <span className="text-[#64748b]">(≥95)</span>
                              </li>
                              <li className={vitalInRangeClass("rr", p.vitals)}>
                                RR: {p.vitals.respiratory_rate}/min{" "}
                                <span className="text-[#64748b]">(12–20)</span>
                              </li>
                            </ul>
                            <p className="mt-2 text-[#94a3b8]">
                              Predicted (24h):{" "}
                              <span className="font-medium text-[#ffffff]">
                                {p.predicted_condition_24h}
                              </span>
                            </p>
                            <p className="text-[#94a3b8]">
                              Est. discharge:{" "}
                              <span className="font-medium text-[#ffffff]">
                                {p.estimated_discharge}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* NEWS2 trend top-1 */}
              <div className="flex flex-col py-2 pl-0 lg:pl-4 lg:py-0">
                {(() => {
                  const rt = intelData.risk_score_trend;
                  const pts = (rt?.points ?? []).map((x, i) => ({
                    ...x,
                    idx: i,
                    t: x.label || `#${i + 1}`,
                  }));
                  const delta = rt?.score_delta ?? 0;
                  const lineColor =
                    delta > 0 ? "#ef4444" : delta < 0 ? "#10b981" : "#00b4d8";
                  const name = rt?.patient_name || "—";
                  return (
                    <>
                      <p className="mb-1 line-clamp-2 text-[10px] font-semibold uppercase tracking-wider text-[#00b4d8]">
                        Risk Score Trend — {name}
                      </p>
                      {pts.length === 0 ? (
                        <p className="text-sm text-[#94a3b8]">No vitals history for top patient.</p>
                      ) : (
                        <>
                          <div className="h-40 w-full min-w-0 flex-1">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={pts} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                                <XAxis dataKey="t" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={{ stroke: "#1e3a5f" }} />
                                <YAxis domain={[0, 12]} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "#1e3a5f" }} />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#0d1b2a",
                                    border: "1px solid #00b4d8",
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                    color: "#fff",
                                  }}
                                />
                                <Line type="monotone" dataKey="news2_score" stroke={lineColor} strokeWidth={2} dot={{ r: 3, fill: lineColor }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-2 space-y-0.5 text-xs text-[#94a3b8]">
                            <p>
                              Current score:{" "}
                              <span className="font-semibold text-[#ffffff]">
                                {rt?.current_score ?? 0}/12
                              </span>
                            </p>
                            <p>
                              Change from last reading:{" "}
                              <span
                                className={
                                  delta > 0
                                    ? "font-semibold text-[#ef4444]"
                                    : delta < 0
                                      ? "font-semibold text-[#10b981]"
                                      : "font-semibold text-[#ffffff]"
                                }
                              >
                                {delta > 0 ? `+${delta}` : delta === 0 ? "0" : `${delta}`}
                              </span>
                            </p>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </div>
      </section>

    </div>
  );
}
