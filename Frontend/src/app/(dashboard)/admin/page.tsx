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

export type PatientIntelVitalsChange = {
  heart_rate: string;
  bp: string;
  spo2: string;
  temp: string;
};

export type PatientIntelPatient = {
  name: string;
  age: number;
  gender: string;
  ward: string;
  condition_level: string;
  vitals: PatientIntelVitals;
  vitals_change: PatientIntelVitalsChange;
  prediction: string;
};

export type PatientIntelResponse = {
  high_risk_count: number;
  patients: PatientIntelPatient[];
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

function intelFooterUpdated(at: Date | null, tick: number): string {
  void tick;
  if (!at) return "last updated —";
  const m = Math.floor((Date.now() - at.getTime()) / 60000);
  if (m < 1) return "last updated just now";
  return `last updated ${m} mins ago`;
}

function conditionBadgeClass(level: string): string {
  const x = (level || "").toLowerCase().trim();
  if (x === "critical") return "bg-[#ef4444]/20 text-[#fecaca] ring-1 ring-[#ef4444]/40";
  if (x === "emergency")
    return "bg-[#7f1d1d]/50 text-[#fecaca] ring-1 ring-[#991b1b]";
  if (x === "stable") return "bg-[#10b981]/20 text-[#bbf7d0]";
  if (x === "observation") return "bg-[#f59e0b]/20 text-[#fde68a]";
  return "bg-[#1e3a5f] text-[#94a3b8]";
}

type VitalKind = "hr" | "bp" | "spo2" | "temp";

function vitalsArrowClass(kind: VitalKind, dir: string): string {
  const d = (dir || "").toUpperCase();
  if (d === "STABLE") return "text-[#94a3b8]";
  if (kind === "spo2") {
    return d === "UP" ? "text-[#10b981]" : "text-[#ef4444]";
  }
  return d === "UP" ? "text-[#ef4444]" : "text-[#10b981]";
}

function vitalsArrowSymbol(dir: string): string {
  const d = (dir || "").toUpperCase();
  if (d === "UP") return "↑";
  if (d === "DOWN") return "↓";
  return "—";
}

function predictionTextClass(text: string): string {
  const t = (text || "").toLowerCase();
  if (/(risk|failure|critical|deteriorat)/.test(t)) return "text-[#ef4444]";
  if (/(monitor|watch|concern)/.test(t)) return "text-[#f59e0b]";
  if (/(stable|improving)/.test(t)) return "text-[#10b981]";
  return "text-[#94a3b8]";
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

      {/* Patient Risk Intelligence — GET /api/patient-intelligence (width = 2 KPI cards on xl) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="min-h-[11rem] rounded-xl border border-[#1e3a5f] bg-[#0d1b2a] p-4 shadow-lg transition-colors hover:border-[#00b4d8] xl:col-span-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#1e3a5f]/80 pb-2 text-sm">
            <span className="text-[#00b4d8]" aria-hidden>
              🧠
            </span>
            <span className="font-semibold text-[#00b4d8]">Patient Risk Intelligence</span>
            <span className="text-[#64748b]" aria-hidden>
              |
            </span>
            <span className="text-xs text-[#fecaca]">
              🔴 {intelData?.high_risk_count ?? "—"} High Risk
            </span>
          </div>

          <div className="mt-3 space-y-0">
            {!intelData && !intelLoading ? (
              <p className="text-xs text-[#94a3b8]">
                Unable to load. Check admin access and API connection.
              </p>
            ) : null}
            {intelLoading && !intelData ? (
              <div className="h-24 animate-pulse rounded-md bg-[#1e3a5f]/50" />
            ) : null}

            {intelData?.patients?.length === 0 && !intelLoading ? (
              <p className="text-xs text-[#94a3b8]">No ranked patients yet.</p>
            ) : null}

            {intelData?.patients?.map((p, idx) => {
              const vc = p.vitals_change;
              const v = p.vitals;
              const sep = "text-[#475569]";
              return (
                <div
                  key={`${p.name}-${idx}`}
                  className={`space-y-1 py-2 ${idx > 0 ? "border-t border-[#1e3a5f]" : ""}`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs leading-snug">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${conditionBadgeClass(p.condition_level)}`}
                    >
                      {p.condition_level}
                    </span>
                    <span className="text-sm font-medium text-[#ffffff]">{p.name}</span>
                    <span className={sep}>—</span>
                    <span className="text-[#94a3b8]">{p.ward || "—"}</span>
                    <span className={sep}>—</span>
                    <span className="text-[#94a3b8]">
                      {`${p.age}/${p.gender || "—"}`}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#94a3b8]">
                    <span className="text-[#64748b]">Vitals:</span>{" "}
                    <span className={vitalsArrowClass("hr", vc.heart_rate)}>
                      HR:{v.heart_rate}
                      {vitalsArrowSymbol(vc.heart_rate)}
                    </span>
                    <span className="text-[#475569]"> | </span>
                    <span className={vitalsArrowClass("bp", vc.bp)}>
                      BP:{v.systolic_bp}/{v.diastolic_bp}
                      {vitalsArrowSymbol(vc.bp)}
                    </span>
                    <span className="text-[#475569]"> | </span>
                    <span className={vitalsArrowClass("spo2", vc.spo2)}>
                      SpO2:{v.spo2}%
                      {vitalsArrowSymbol(vc.spo2)}
                    </span>
                    <span className="text-[#475569]"> | </span>
                    <span className={vitalsArrowClass("temp", vc.temp)}>
                      Temp:{v.temperature}°C
                      {vitalsArrowSymbol(vc.temp)}
                    </span>
                  </p>
                  <p className={`text-[11px] leading-snug ${predictionTextClass(p.prediction)}`}>
                    <span className="text-[#94a3b8]" aria-hidden>
                      💬{" "}
                    </span>
                    &quot;{p.prediction}&quot;
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-[#1e3a5f]/80 pt-2 text-[10px] text-[#64748b]">
            <span>Powered by NEWS2 + AI</span>
            <span className="text-[#94a3b8]">{intelFooterUpdated(intelLastFetch, intelClock)}</span>
          </div>
        </div>
      </section>

    </div>
  );
}
