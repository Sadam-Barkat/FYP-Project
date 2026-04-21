"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Users,
  Bed,
  LayoutGrid,
  AlertTriangle,
  UserCheck,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Eye,
  Siren,
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
  heart_rate?: number | null;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  temperature?: number | null;
  spo2?: number | null;
  respiratory_rate?: number | null;
  recorded_at?: string | null;
};

export type PatientIntelLab = {
  test_name?: string | null;
  result_value?: string | null;
  status?: string | null;
  collected_at?: string | null;
} | null;

export type PatientIntelPrediction = {
  news2_score?: number | null;
  risk_level?: string | null;
  deterioration_risk?: string | null;
  predicted_condition_24h?: string | null;
  estimated_discharge?: string | null;
  ai_risk_flag?: boolean | null;
};

export type PatientIntelRow = {
  patient_id: number;
  name: string;
  age: number;
  gender: string;
  blood_group: string;
  ward: string;
  bed_number: string;
  admission_date: string | null;
  assigned_doctor: string;
  assigned_nurse: string;
  condition_level: string;
  vitals: PatientIntelVitals;
  latest_lab: PatientIntelLab;
  prediction: PatientIntelPrediction;
};

export type PatientIntelSummary = {
  total_patients: number;
  critical_count: number;
  emergency_count: number;
  stable_count: number;
  observation_count: number;
  discharged_today: number;
};

export type PatientIntelResponse = {
  summary: PatientIntelSummary;
  patients: PatientIntelRow[];
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

function conditionNorm(c: string): string {
  return (c || "").toLowerCase().trim();
}

function news2BarColor(score: number): string {
  if (score >= 7) return "bg-[#ef4444]";
  if (score >= 5) return "bg-[#f59e0b]";
  return "bg-[#10b981]";
}

function deteriorationUi(risk: string): { icon: string; cls: string } {
  const r = (risk || "").trim();
  if (r === "LIKELY TO DETERIORATE") {
    return { icon: "🔴", cls: "text-[#ef4444]" };
  }
  if (r === "MONITOR CLOSELY") {
    return { icon: "🟡", cls: "text-[#f59e0b]" };
  }
  return { icon: "🟢", cls: "text-[#10b981]" };
}

function conditionBadgeClass(c: string): string {
  const x = conditionNorm(c);
  if (x === "critical") return "bg-[#ef4444]/20 text-[#ef4444]";
  if (x === "emergency")
    return "animate-pulse bg-[#7f1d1d]/40 text-[#fecaca] ring-1 ring-[#ef4444]";
  if (x === "stable") return "bg-[#10b981]/20 text-[#10b981]";
  if (x === "observation") return "bg-[#f59e0b]/20 text-[#f59e0b]";
  return "bg-[#1e3a5f] text-[#94a3b8]";
}

function intelRowClass(p: PatientIntelRow): string {
  const parts = [
    "border-l-4 transition-colors hover:bg-[#1e3a5f]/60",
    p.prediction?.ai_risk_flag ? "border-l-[#ef4444]" : "border-l-transparent",
  ];
  const rl = (p.prediction?.risk_level ?? "").toUpperCase();
  if (rl === "HIGH") parts.push("bg-[#ef4444]/15");
  else if (rl === "MEDIUM") parts.push("bg-[#f59e0b]/12");
  return parts.join(" ");
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
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [intelSearch, setIntelSearch] = useState("");
  const [intelCondFilter, setIntelCondFilter] = useState<string>("all");
  const [intelWardFilter, setIntelWardFilter] = useState<string>("all");
  const [intelSort, setIntelSort] = useState<"risk" | "admission" | "name">(
    "risk"
  );
  const [intelModal, setIntelModal] = useState<PatientIntelRow | null>(null);
  const [intelModalTab, setIntelModalTab] = useState(0);
  const [intelAlertConfirm, setIntelAlertConfirm] = useState<number | null>(
    null
  );
  const [intelAlertPosting, setIntelAlertPosting] = useState(false);

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

  useRealtimeEvent(
    ["vitals_updated", "patient_intelligence_updated", "admin_data_changed"],
    () => {
      void loadKpis();
      void loadIntel();
    }
  );

  const intelWards = useMemo(() => {
    const w = new Set<string>();
    for (const p of intelData?.patients ?? []) {
      if (p.ward) w.add(p.ward);
    }
    return Array.from(w).sort();
  }, [intelData]);

  const intelFilteredPatients = useMemo(() => {
    let rows = [...(intelData?.patients ?? [])];
    const q = intelSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (intelCondFilter !== "all") {
      rows = rows.filter(
        (p) => conditionNorm(p.condition_level) === intelCondFilter
      );
    }
    if (intelWardFilter !== "all") {
      rows = rows.filter((p) => p.ward === intelWardFilter);
    }
    if (intelSort === "risk") {
      rows.sort(
        (a, b) =>
          (b.prediction?.news2_score ?? 0) - (a.prediction?.news2_score ?? 0)
      );
    } else if (intelSort === "admission") {
      rows.sort((a, b) => {
        const da = a.admission_date ?? "";
        const db = b.admission_date ?? "";
        return db.localeCompare(da);
      });
    } else {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    }
    return rows;
  }, [
    intelData,
    intelSearch,
    intelCondFilter,
    intelWardFilter,
    intelSort,
  ]);

  const intelAnyAiRisk =
    (intelData?.patients ?? []).some((p) => p.prediction?.ai_risk_flag) ??
    false;

  async function postIntelAlert(patientId: number) {
    setIntelAlertPosting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/alerts`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ patient_id: patientId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setIntelAlertConfirm(null);
      await loadIntel();
    } catch {
      // keep modal open; user can retry
    } finally {
      setIntelAlertPosting(false);
    }
  }

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
        <div className="flex flex-col gap-3 border-b border-[#1e3a5f]/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg" aria-hidden>
                🧠
              </span>
              <h2 className="text-base font-semibold text-[#00b4d8] sm:text-lg">
                Patient Intelligence
              </h2>
              {intelAnyAiRisk ? (
                <span className="relative flex h-3 w-3" title="AI risk flag active">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ef4444] opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-[#ef4444]" />
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-[#94a3b8]">
              Real-time patient monitoring and prediction
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="rounded-md bg-[#ef4444]/15 px-2 py-1 text-[11px] text-[#fecaca]">
              🔴 Critical: {intelData?.summary?.critical_count ?? "—"}
            </span>
            <span className="rounded-md bg-[#7f1d1d]/30 px-2 py-1 text-[11px] text-[#fecaca]">
              🚨 Emergency: {intelData?.summary?.emergency_count ?? "—"}
            </span>
            <span className="rounded-md bg-[#f59e0b]/15 px-2 py-1 text-[11px] text-[#fde68a]">
              🟡 Observation: {intelData?.summary?.observation_count ?? "—"}
            </span>
            <span className="rounded-md bg-[#10b981]/15 px-2 py-1 text-[11px] text-[#bbf7d0]">
              🟢 Stable: {intelData?.summary?.stable_count ?? "—"}
            </span>
            <button
              type="button"
              aria-expanded={intelExpanded}
              onClick={() => setIntelExpanded((v) => !v)}
              className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1e3a5f] text-[#00b4d8] transition-colors hover:border-[#00b4d8] hover:bg-[#00b4d8]/10"
              aria-label={intelExpanded ? "Collapse" : "Expand"}
            >
              {intelExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
            intelExpanded ? "max-h-[4000px]" : "max-h-0"
          }`}
        >
          <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
            {!intelData && !intelLoading ? (
              <p className="text-sm text-[#94a3b8]">
                Unable to load patient intelligence. Check admin access and API
                connection.
              </p>
            ) : null}

            {intelLoading && !intelData ? (
              <div className="h-32 animate-pulse rounded-lg bg-[#1e3a5f]/60" />
            ) : null}

            {intelData ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ["Total", intelData.summary.total_patients],
                    ["Critical", intelData.summary.critical_count],
                    ["Emergency", intelData.summary.emergency_count],
                    ["Observation", intelData.summary.observation_count],
                    ["Stable", intelData.summary.stable_count],
                    ["Discharged Today", intelData.summary.discharged_today],
                  ].map(([label, val]) => (
                    <div
                      key={String(label)}
                      className="rounded-lg border border-[#1e3a5f] bg-[#0a0f1e]/80 px-3 py-2 text-center"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide text-[#94a3b8]">
                        {label}
                      </p>
                      <p className="mt-1 text-lg font-bold text-[#ffffff]">
                        {val as number}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                  <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94a3b8]">
                      Search
                    </label>
                    <input
                      type="search"
                      value={intelSearch}
                      onChange={(e) => setIntelSearch(e.target.value)}
                      placeholder="Patient name…"
                      className="w-full rounded-lg border border-[#1e3a5f] bg-[#0a0f1e] px-3 py-2 text-sm text-[#ffffff] outline-none ring-[#00b4d8] focus:border-[#00b4d8] focus:ring-1"
                    />
                  </div>
                  <div className="w-full min-w-[140px] lg:w-44">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94a3b8]">
                      Condition
                    </label>
                    <select
                      value={intelCondFilter}
                      onChange={(e) => setIntelCondFilter(e.target.value)}
                      className="w-full rounded-lg border border-[#1e3a5f] bg-[#0a0f1e] px-3 py-2 text-sm text-[#ffffff] outline-none focus:border-[#00b4d8]"
                    >
                      <option value="all">All</option>
                      <option value="critical">Critical</option>
                      <option value="emergency">Emergency</option>
                      <option value="stable">Stable</option>
                      <option value="observation">Observation</option>
                    </select>
                  </div>
                  <div className="w-full min-w-[140px] lg:w-44">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94a3b8]">
                      Ward
                    </label>
                    <select
                      value={intelWardFilter}
                      onChange={(e) => setIntelWardFilter(e.target.value)}
                      className="w-full rounded-lg border border-[#1e3a5f] bg-[#0a0f1e] px-3 py-2 text-sm text-[#ffffff] outline-none focus:border-[#00b4d8]"
                    >
                      <option value="all">All Wards</option>
                      {intelWards.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full min-w-[180px] lg:w-56">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94a3b8]">
                      Sort by
                    </label>
                    <select
                      value={intelSort}
                      onChange={(e) =>
                        setIntelSort(
                          e.target.value as "risk" | "admission" | "name"
                        )
                      }
                      className="w-full rounded-lg border border-[#1e3a5f] bg-[#0a0f1e] px-3 py-2 text-sm text-[#ffffff] outline-none focus:border-[#00b4d8]"
                    >
                      <option value="risk">Risk Score (High → Low)</option>
                      <option value="admission">Admission Date</option>
                      <option value="name">Name</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-[#1e3a5f]">
                  <table className="min-w-[960px] w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#1e3a5f] bg-[#0a0f1e]/90 text-xs text-[#94a3b8]">
                        <th className="px-2 py-2 font-medium">#</th>
                        <th className="px-2 py-2 font-medium">Patient</th>
                        <th className="px-2 py-2 font-medium">Age / Gender</th>
                        <th className="px-2 py-2 font-medium">Ward / Bed</th>
                        <th className="px-2 py-2 font-medium">Doctor</th>
                        <th className="px-2 py-2 font-medium">Condition</th>
                        <th className="px-2 py-2 font-medium">NEWS2</th>
                        <th className="px-2 py-2 font-medium">Prediction</th>
                        <th className="px-2 py-2 font-medium">Est. Discharge</th>
                        <th className="px-2 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intelFilteredPatients.map((p, idx) => {
                        const score = p.prediction?.news2_score ?? 0;
                        const barW = Math.min(
                          100,
                          Math.round((Number(score) / 12) * 100)
                        );
                        const dui = deteriorationUi(
                          p.prediction?.deterioration_risk ?? ""
                        );
                        return (
                          <tr
                            key={p.patient_id}
                            className={`border-b border-[#1e3a5f]/50 ${intelRowClass(p)}`}
                          >
                            <td className="px-2 py-2 text-[#94a3b8]">
                              {idx + 1}
                            </td>
                            <td className="px-2 py-2 font-medium text-[#ffffff]">
                              {p.name}
                            </td>
                            <td className="px-2 py-2 text-[#94a3b8]">
                              {p.age} / {p.gender}
                            </td>
                            <td className="px-2 py-2 text-[#94a3b8]">
                              {p.ward} / {p.bed_number}
                            </td>
                            <td className="max-w-[140px] truncate px-2 py-2 text-[#94a3b8]">
                              {p.assigned_doctor || "—"}
                            </td>
                            <td className="px-2 py-2">
                              <span
                                className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${conditionBadgeClass(p.condition_level)}`}
                              >
                                {p.condition_level}
                              </span>
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[#ffffff]">
                                  {score}
                                </span>
                                <div className="h-2 w-14 overflow-hidden rounded-full bg-[#1e3a5f]">
                                  <div
                                    className={`h-full rounded-full ${news2BarColor(score)}`}
                                    style={{ width: `${barW}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="max-w-[200px] px-2 py-2">
                              <span
                                className={`inline-flex items-center gap-1 text-xs ${dui.cls}`}
                              >
                                <span>{dui.icon}</span>
                                <span className="leading-snug">
                                  {p.prediction?.deterioration_risk}
                                </span>
                              </span>
                            </td>
                            <td className="px-2 py-2 text-[#94a3b8]">
                              {p.prediction?.estimated_discharge ?? "—"}
                            </td>
                            <td className="space-x-1 px-2 py-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setIntelModal(p);
                                  setIntelModalTab(0);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#1e3a5f] text-[#00b4d8] hover:bg-[#00b4d8]/10"
                                aria-label="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {p.prediction?.ai_risk_flag ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setIntelAlertConfirm(p.patient_id)
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#ef4444]/50 text-[#ef4444] hover:bg-[#ef4444]/10"
                                  aria-label="Create urgent alert"
                                >
                                  <Siren className="h-4 w-4" />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {intelFilteredPatients.length === 0 ? (
                    <p className="border-t border-[#1e3a5f] px-4 py-6 text-center text-sm text-[#94a3b8]">
                      No patients match the current filters.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {intelModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setIntelModal(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#00b4d8] bg-[#0d1b2a] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#1e3a5f] px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-[#00b4d8]">
                  Patient detail
                </p>
                <p className="text-lg font-semibold text-[#ffffff]">
                  {intelModal.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIntelModal(null)}
                className="rounded-md px-2 py-1 text-sm text-[#94a3b8] hover:bg-[#1e3a5f] hover:text-[#ffffff]"
              >
                Close
              </button>
            </div>
            <div className="flex gap-1 border-b border-[#1e3a5f] px-2 pt-2">
              {(
                [
                  "Patient Info",
                  "Latest Vitals",
                  "Prediction",
                  "Latest Lab",
                ] as const
              ).map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setIntelModalTab(i)}
                  className={`rounded-t-md px-3 py-2 text-xs font-semibold transition-colors ${
                    intelModalTab === i
                      ? "bg-[#0a0f1e] text-[#00b4d8]"
                      : "text-[#94a3b8] hover:text-[#ffffff]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-3 px-4 py-4 text-sm">
              {intelModalTab === 0 ? (
                <div className="space-y-2 text-[#94a3b8]">
                  <p>
                    <span className="text-[#94a3b8]">Full name: </span>
                    <span className="font-semibold text-[#ffffff]">
                      {intelModal.name}
                    </span>
                  </p>
                  <p>
                    Age / Gender / Blood:{" "}
                    <span className="text-[#ffffff]">
                      {intelModal.age} / {intelModal.gender} /{" "}
                      {intelModal.blood_group || "—"}
                    </span>
                  </p>
                  <p>
                    Ward / Bed:{" "}
                    <span className="text-[#ffffff]">
                      {intelModal.ward} / {intelModal.bed_number}
                    </span>
                  </p>
                  <p>
                    Admission:{" "}
                    <span className="text-[#ffffff]">
                      {intelModal.admission_date
                        ? new Date(
                            intelModal.admission_date
                          ).toLocaleString()
                        : "—"}
                    </span>
                  </p>
                  <p>
                    Doctor:{" "}
                    <span className="text-[#ffffff]">
                      {intelModal.assigned_doctor || "—"}
                    </span>
                  </p>
                  <p>
                    Nurse:{" "}
                    <span className="text-[#ffffff]">
                      {intelModal.assigned_nurse || "—"}
                    </span>
                  </p>
                </div>
              ) : null}
              {intelModalTab === 1 ? (
                <div className="space-y-2">
                  {(() => {
                    const v = intelModal.vitals;
                    const hr = v?.heart_rate;
                    const sys = v?.systolic_bp;
                    const dia = v?.diastolic_bp;
                    const hrOk =
                      hr != null && hr >= 60 && hr <= 100;
                    const bpOk =
                      sys != null &&
                      dia != null &&
                      sys >= 90 &&
                      sys <= 129 &&
                      dia >= 60 &&
                      dia <= 84;
                    const t = v?.temperature;
                    const tOk =
                      t != null && t >= 36.1 && t <= 37.2;
                    const sp = v?.spo2;
                    const spOk = sp != null && sp >= 95 && sp <= 100;
                    const rr = v?.respiratory_rate;
                    const rrOk = rr != null && rr >= 12 && rr <= 20;
                    return (
                      <>
                        <p className={hrOk ? "text-[#10b981]" : "text-[#ef4444]"}>
                          Heart Rate: {hr ?? "—"} bpm{" "}
                          <span className="text-[#94a3b8]">
                            (normal: 60–100)
                          </span>
                        </p>
                        <p className={bpOk ? "text-[#10b981]" : "text-[#ef4444]"}>
                          Blood Pressure: {sys ?? "—"}/{dia ?? "—"} mmHg
                        </p>
                        <p className={tOk ? "text-[#10b981]" : "text-[#ef4444]"}>
                          Temperature: {t ?? "—"}°C{" "}
                          <span className="text-[#94a3b8]">
                            (normal: 36.1–37.2)
                          </span>
                        </p>
                        <p className={spOk ? "text-[#10b981]" : "text-[#ef4444]"}>
                          SpO2: {sp ?? "—"}%{" "}
                          <span className="text-[#94a3b8]">
                            (normal: 95–100)
                          </span>
                        </p>
                        <p className={rrOk ? "text-[#10b981]" : "text-[#ef4444]"}>
                          Respiratory Rate: {rr ?? "—"} /min{" "}
                          <span className="text-[#94a3b8]">
                            (normal: 12–20)
                          </span>
                        </p>
                        <p className="text-[#94a3b8]">
                          Recorded:{" "}
                          <span className="text-[#ffffff]">
                            {v?.recorded_at
                              ? new Date(v.recorded_at).toLocaleString()
                              : "—"}
                          </span>
                        </p>
                      </>
                    );
                  })()}
                </div>
              ) : null}
              {intelModalTab === 2 ? (
                <div className="space-y-2 text-[#94a3b8]">
                  <p>
                    NEWS2:{" "}
                    <span className="font-semibold text-[#ffffff]">
                      {intelModal.prediction?.news2_score ?? 0}/12
                    </span>
                  </p>
                  <p>
                    Risk level:{" "}
                    <span className="text-[#ffffff]">
                      {intelModal.prediction?.risk_level}
                    </span>
                  </p>
                  <p>
                    Deterioration:{" "}
                    <span className="text-[#ffffff]">
                      {intelModal.prediction?.deterioration_risk}
                    </span>
                  </p>
                  <p>
                    Predicted (24h):{" "}
                    <span className="text-[#ffffff]">
                      {intelModal.prediction?.predicted_condition_24h}
                    </span>
                  </p>
                  <p>
                    Est. discharge:{" "}
                    <span className="text-[#ffffff]">
                      {intelModal.prediction?.estimated_discharge}
                    </span>
                  </p>
                  <p>
                    ⚠️ AI risk flag:{" "}
                    <span className="font-semibold text-[#ffffff]">
                      {intelModal.prediction?.ai_risk_flag ? "YES" : "NO"}
                    </span>
                  </p>
                </div>
              ) : null}
              {intelModalTab === 3 ? (
                <div className="text-[#94a3b8]">
                  {intelModal.latest_lab ? (
                    <div className="space-y-2">
                      <p>
                        Test:{" "}
                        <span className="text-[#ffffff]">
                          {intelModal.latest_lab.test_name}
                        </span>
                      </p>
                      <p>
                        Result:{" "}
                        <span className="text-[#ffffff]">
                          {intelModal.latest_lab.result_value}
                        </span>
                      </p>
                      <p>
                        Status:{" "}
                        <span className="text-[#ffffff]">
                          {intelModal.latest_lab.status}
                        </span>
                      </p>
                      <p>
                        Collected:{" "}
                        <span className="text-[#ffffff]">
                          {intelModal.latest_lab.collected_at
                            ? new Date(
                                intelModal.latest_lab.collected_at
                              ).toLocaleString()
                            : "—"}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p>No lab results yet</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {intelAlertConfirm != null ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl border border-[#00b4d8] bg-[#0d1b2a] p-5 shadow-xl">
            <p className="text-sm font-semibold text-[#ffffff]">
              Create urgent alert for this patient?
            </p>
            <p className="mt-2 text-xs text-[#94a3b8]">
              This will notify staff via the alerts system (critical severity).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIntelAlertConfirm(null)}
                className="rounded-lg border border-[#1e3a5f] px-3 py-2 text-sm text-[#94a3b8] hover:bg-[#1e3a5f]"
                disabled={intelAlertPosting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void postIntelAlert(intelAlertConfirm)}
                disabled={intelAlertPosting}
                className="rounded-lg bg-[#ef4444] px-3 py-2 text-sm font-semibold text-white hover:bg-[#dc2626] disabled:opacity-50"
              >
                {intelAlertPosting ? "Sending…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
