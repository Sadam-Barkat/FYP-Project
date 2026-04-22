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
        className={`pointer-events-auto rounded-lg border border-[#00b4d8] bg-[#0d1b2a] px-2.5 py-2 shadow-lg ${
          needsScroll
            ? "max-h-44 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
            : ""
        }`}
      >
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#00b4d8]">
          {title}
        </p>
        {names.length === 0 ? (
          <p className="text-[10px] text-[#94a3b8]">None</p>
        ) : (
          <ul className="space-y-0.5 text-[10px] leading-snug text-[#e2e8f0]">
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
  if (pct >= 70) return "text-[#10b981]";
  if (pct >= 50) return "text-[#f59e0b]";
  return "text-[#ef4444]";
}

function changeVsWeekUi(delta: number): { arrow: string; cls: string; tail: string } {
  if (delta > 0) {
    return { arrow: "↑", cls: "text-[#10b981]", tail: `${delta} vs last week` };
  }
  if (delta < 0) {
    return {
      arrow: "↓",
      cls: "text-[#ef4444]",
      tail: `${Math.abs(delta)} vs last week`,
    };
  }
  return { arrow: "—", cls: "text-[#94a3b8]", tail: "0 vs last week" };
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

      {/* Patient Intelligence — GET /api/patient-intelligence (2-col row for future cards) */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="flex max-h-[240px] flex-col overflow-hidden rounded-xl border border-[#1e3a5f] bg-[#0d1b2a] p-4 text-xs shadow-lg transition-colors hover:border-[#00b4d8]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1e3a5f] pb-2.5">
            <h2 className="text-xs font-semibold text-[#00b4d8]">
              🧠 Patient Intelligence
            </h2>
            <div className="flex items-center gap-2.5">
              {intelData ? (
                <span className="whitespace-nowrap text-[10px] text-[#94a3b8]">
                  {intelFooterUpdated(intelLastFetch, intelClock)}
                </span>
              ) : null}
              {intelData && intelData.at_risk_count > 0 ? (
                <span
                  className="relative flex h-2.5 w-2.5 shrink-0"
                  title="Patients at elevated risk (NEWS2)"
                  aria-hidden
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ef4444] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                </span>
              ) : intelData ? (
                <span className="text-sm leading-none text-[#ef4444]" aria-hidden>
                  🔴
                </span>
              ) : null}
            </div>
          </div>

          {!intelData && !intelLoading ? (
            <p className="mt-2 text-xs text-[#94a3b8]">
              Unable to load. Check admin access and API.
            </p>
          ) : null}
          {intelLoading && !intelData ? (
            <div className="mt-2 h-36 animate-pulse rounded-md bg-[#1e3a5f]/50" />
          ) : null}

          {intelData ? (
            <div className="mt-2 flex min-h-0 flex-1 gap-3 overflow-hidden">
              <div className="min-w-0 flex-[1.05] shrink-0 border-r border-[#1e3a5f] pr-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex min-h-[4.5rem] flex-col justify-between rounded-md border border-[#1e3a5f]/90 bg-[#0a1524]/95 px-2.5 py-2">
                    <p className="text-[9px] font-medium uppercase leading-tight tracking-wide text-[#94a3b8]">
                      Total Patients
                    </p>
                    <p className="text-lg font-bold leading-none text-white">
                      {intelData.total_patients}
                    </p>
                    {(() => {
                      const u = changeVsWeekUi(intelData.change_from_last_week);
                      return (
                        <p className={`text-[9px] leading-tight ${u.cls}`}>
                          {u.arrow} {u.tail}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex min-h-[4.5rem] flex-col rounded-md border border-[#1e3a5f]/90 bg-[#0a1524]/95 px-2.5 py-2">
                    <p className="text-[9px] font-medium uppercase leading-tight tracking-wide text-[#94a3b8]">
                      Vitals Health
                    </p>
                    <p
                      className={`mt-auto text-base font-bold leading-none ${healthPctClass(
                        intelData.vitals_health_percentage
                      )}`}
                    >
                      {intelData.vitals_health_percentage}%
                    </p>
                  </div>
                  <div className="flex min-h-[4.5rem] flex-col rounded-md border border-[#1e3a5f]/90 bg-[#0a1524]/95 px-2.5 py-2">
                    <p className="text-[9px] font-medium uppercase leading-tight tracking-wide text-[#94a3b8]">
                      Critical Vitals
                    </p>
                    <p className="mt-auto text-base font-bold leading-none text-[#ef4444]">
                      {intelData.critical_vitals_percentage}%
                    </p>
                  </div>
                  <div className="flex min-h-[4.5rem] flex-col rounded-md border border-[#1e3a5f]/90 bg-[#0a1524]/95 px-2.5 py-2">
                    <p className="text-[9px] font-medium uppercase leading-tight tracking-wide text-[#94a3b8]">
                      ⚠️ At Risk
                    </p>
                    <p className="mt-auto text-base font-bold leading-none text-[#f97316]">
                      {intelData.at_risk_count}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-[0.95] flex-col pl-2">
                <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#00b4d8]">
                  🤖 AI Risk Forecast
                </p>
                <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden border-l-2 border-[#00b4d8] pl-3">
                  {(() => {
                    const p = parseAiForecast(intelData.ai_prediction);
                    if (p.rawFallback) {
                      return (
                        <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                          <p className="text-[10px] italic leading-snug text-white">
                            {p.rawFallback}
                          </p>
                        </div>
                      );
                    }
                    const hasNames = p.names.length > 0;
                    const hasSugg = Boolean(p.suggestion);
                    return (
                      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                        {p.summary ? (
                          <p className="shrink-0 text-[10px] italic leading-snug text-white">
                            {p.summary}
                          </p>
                        ) : null}
                        {hasNames && hasSugg ? (
                          <div className="flex min-h-0 flex-1 flex-row gap-3 overflow-hidden">
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-[#1e3a5f]/80 pr-2">
                              <p className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                                Patients
                              </p>
                              <div className="mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
                                <ol className="list-decimal space-y-0.5 pl-3.5 text-[10px] leading-snug text-[#e2e8f0] marker:text-[#64748b]">
                                  {p.names.map((n, i) => (
                                    <li key={`${n}-${i}`} className="pl-0.5">
                                      {n}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                              <p className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-[#64748b]">
                                Suggestion
                              </p>
                              <div className="mt-1 min-h-0 flex-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
                                <p className="text-[10px] font-medium leading-snug text-[#fde68a]">
                                  {p.suggestion}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : hasNames ? (
                          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <p className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                              Patients
                            </p>
                            <div className="mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
                              <ol className="list-decimal space-y-0.5 pl-3.5 text-[10px] leading-snug text-[#e2e8f0] marker:text-[#64748b]">
                                {p.names.map((n, i) => (
                                  <li key={`${n}-${i}`} className="pl-0.5">
                                    {n}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        ) : hasSugg ? (
                          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <p className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-[#64748b]">
                              Suggestion
                            </p>
                            <div className="mt-1 min-h-0 flex-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
                              <p className="text-[10px] font-medium leading-snug text-[#fde68a]">
                                {p.suggestion}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex max-h-[220px] flex-col overflow-x-visible overflow-y-hidden rounded-xl border border-[#1e3a5f] bg-[#0d1b2a] p-3 text-xs shadow-lg transition-colors hover:border-[#00b4d8]">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#1e3a5f] pb-2">
            <h2 className="text-xs font-semibold text-[#00b4d8]">
              💊 Pharmacy Intelligence
            </h2>
            <div className="flex items-center gap-2">
              {pharmacyData ? (
                <span className="whitespace-nowrap text-[10px] text-[#94a3b8]">
                  {intelFooterUpdated(pharmacyLastFetch, intelClock)}
                </span>
              ) : null}
              {pharmacyData &&
              (pharmacyData.out_of_stock_count > 0 ||
                pharmacyData.expiring_soon_count > 0) ? (
                <span
                  className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500"
                  title="Stock or expiry attention needed"
                  aria-hidden
                />
              ) : null}
            </div>
          </div>

          {!pharmacyData && !pharmacyLoading ? (
            <p className="mt-2 text-[10px] text-[#94a3b8]">
              Unable to load. Check admin access and API.
            </p>
          ) : null}
          {pharmacyLoading && !pharmacyData ? (
            <div className="mt-2 h-32 animate-pulse rounded-md bg-[#1e3a5f]/50" />
          ) : null}

          {pharmacyData ? (
            <div className="mt-2 flex min-h-0 flex-1 gap-0 overflow-visible">
              <div className="w-[40%] min-h-0 shrink-0 space-y-2 overflow-visible border-r border-[#1e3a5f] pr-2">
                <div>
                  <p className="text-[10px] uppercase text-[#94a3b8]">
                    Total medicines
                  </p>
                  <p className="text-lg font-bold text-white">
                    {pharmacyData.total_medicines}
                  </p>
                </div>
                <div
                  className="relative cursor-default"
                  onMouseEnter={() => setPharmacyStatHover("oos")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                >
                  <p className="text-[10px] uppercase text-[#94a3b8]">
                    Out of stock
                  </p>
                  <p className="text-lg font-bold text-[#ef4444]">
                    {pharmacyData.out_of_stock_count}{" "}
                    <span className="text-sm" aria-hidden>
                      🔴
                    </span>
                  </p>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "oos"}
                    title="Out of stock"
                    names={pharmacyData.out_of_stock_medicines ?? []}
                  />
                </div>
                <div
                  className="relative cursor-default"
                  onMouseEnter={() => setPharmacyStatHover("low")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                >
                  <p className="text-[10px] uppercase text-[#94a3b8]">
                    Low stock
                  </p>
                  <p className="text-lg font-bold text-[#f97316]">
                    {pharmacyData.low_stock_count}{" "}
                    <span className="text-sm" aria-hidden>
                      🟠
                    </span>
                  </p>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "low"}
                    title="Low stock"
                    names={pharmacyData.low_stock_medicines ?? []}
                  />
                </div>
                <div
                  className="relative cursor-default"
                  onMouseEnter={() => setPharmacyStatHover("soon")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                >
                  <p className="text-[10px] uppercase text-[#94a3b8]">
                    Expiring soon
                  </p>
                  <p className="text-lg font-bold text-[#f59e0b]">
                    {pharmacyData.expiring_soon_count}{" "}
                    <span className="text-sm" aria-hidden>
                      🟡
                    </span>
                  </p>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "soon"}
                    title="Expiring soon (30d)"
                    names={pharmacyData.expiring_soon_medicines ?? []}
                  />
                </div>
                <div
                  className="relative cursor-default"
                  onMouseEnter={() => setPharmacyStatHover("expired")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                >
                  <p className="text-[10px] uppercase text-[#94a3b8]">
                    Expired
                  </p>
                  <p className="text-lg font-bold text-[#ef4444]">
                    {pharmacyData.expired_count}{" "}
                    <span className="text-sm" aria-hidden>
                      🔴
                    </span>
                  </p>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "expired"}
                    title="Expired"
                    names={pharmacyData.expired_medicines ?? []}
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-2 overflow-y-auto pl-3 pr-0.5 [scrollbar-width:thin]">
                <div>
                  <p className="text-[9px] font-semibold uppercase text-[#f97316]">
                    ⚠️ Stockout prediction
                  </p>
                  <p className="text-[10px] italic leading-snug text-white">
                    {pharmacyData.stockout_prediction}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase text-[#00b4d8]">
                    🛒 Reorder now
                  </p>
                  {pharmacyData.medicines_to_reorder.length > 0 ? (
                    <div className="mt-0.5">
                      {pharmacyData.medicines_to_reorder.map((m, i) => (
                        <span
                          key={`${m}-${i}`}
                          className="mb-1 mr-1 inline-block rounded-full bg-[#1e3a5f] px-2 py-0.5 text-[9px] text-white"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#10b981]">✅ All stocked</p>
                  )}
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase text-[#f59e0b]">
                    📅 Expiry warning
                  </p>
                  <p className="text-[10px] italic leading-snug text-white">
                    {pharmacyData.expiry_warning}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase text-[#10b981]">
                    💡 Suggestion
                  </p>
                  <p className="text-[10px] font-medium italic leading-snug text-[#10b981]">
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
