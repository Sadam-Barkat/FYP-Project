"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Users,
  Bed,
  LayoutGrid,
  AlertTriangle,
  UserCheck,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useRealtimeEvent } from "@/hooks/useRealtimeEvent";

const cardBase =
  "rounded-xl border border-[#1e3a5f] bg-[#0d1b2a] p-4 transition-all hover:border-[#00b4d8] sm:p-5";

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

function formatDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
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
  const [now, setNow] = useState<Date>(() => new Date());
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [kpiData, setKpiData] = useState<HospitalOverviewKpis | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const kpiHasLoadedOnce = useRef(false);

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
      setLastUpdated(new Date());
      kpiHasLoadedOnce.current = true;
    } catch {
      if (!kpiHasLoadedOnce.current) {
        setKpiData(null);
      }
    } finally {
      setKpiLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  useRealtimeEvent("admin_data_changed", () => {
    void loadKpis();
  });

  const handleRefreshClick = useCallback(() => {
    void loadKpis();
  }, [loadKpis]);

  // TODO: Replace with real API data
  const riskRows = [
    { name: "A. Khan", ward: "ICU-A", risk: "High" as const, score: 88 },
    { name: "S. Malik", ward: "Med-3", risk: "Medium" as const, score: 54 },
    { name: "R. Noor", ward: "Surg-2", risk: "Low" as const, score: 22 },
  ];

  // TODO: Replace with real API data
  const alerts = [
    {
      level: "danger" as const,
      text: "Bed capacity in ICU-A exceeded threshold (92%).",
      time: "10:14 AM",
    },
    {
      level: "warn" as const,
      text: "Pharmacy restock pending for 3 high-use items.",
      time: "09:41 AM",
    },
    {
      level: "warn" as const,
      text: "OR-2 turnaround time above average.",
      time: "08:55 AM",
    },
  ];

  // TODO: Replace with real API data
  const revenueForecast = [
    { day: "Mon", amount: 42 },
    { day: "Tue", amount: 38 },
    { day: "Wed", amount: 51 },
    { day: "Thu", amount: 45 },
    { day: "Fri", amount: 58 },
    { day: "Sat", amount: 33 },
    { day: "Sun", amount: 29 },
  ];

  // TODO: Replace with real API data
  const medicineStock = [
    { name: "Amoxicillin 500mg", status: "In Stock" as const },
    { name: "Insulin Lispro", status: "Low" as const },
    { name: "Saline 0.9% 1L", status: "Out" as const },
  ];

  // TODO: Replace with real API data
  const deteriorationRows = [
    {
      name: "J. Ahmed",
      status: "Stable — Med",
      score: 62,
      predicted: "High (48h)",
    },
    {
      name: "L. Fatima",
      status: "Post-op",
      score: 71,
      predicted: "Critical (24h)",
    },
  ];

  // TODO: Replace with real API data
  const copilotBullets = [
    "Shift two nurses from Med-2 to ICU-A between 2–6 PM based on predicted admissions.",
    "Consider early discharge review for 4 patients in Surg-1 to free beds for incoming trauma.",
    "Stock for broad-spectrum antibiotics trending low vs. next 48h demand forecast.",
  ];

  // TODO: Replace with real API data
  const doctorWorkload = [
    { name: "Dr. Hassan", patients: 14 },
    { name: "Dr. Ayesha", patients: 11 },
    { name: "Dr. Imran", patients: 9 },
  ];

  // TODO: Replace with real API data
  const nurseWorkload = [
    { name: "N. Sana", patients: 8 },
    { name: "N. Bilal", patients: 10 },
    { name: "N. Hira", patients: 7 },
  ];

  // TODO: Replace with real API data
  const pendingPayments = [
    { patient: "M. Raza", amount: "$1,240", status: "Pending" as const },
    { patient: "K. Ali", amount: "$860", status: "Partial" as const },
    { patient: "Z. Iqbal", amount: "$2,100", status: "Overdue" as const },
  ];

  function riskBadge(risk: "High" | "Medium" | "Low") {
    const map = {
      High: { bg: "bg-[#ef4444]/20", text: "text-[#ef4444]", label: "High" },
      Medium: {
        bg: "bg-[#f59e0b]/20",
        text: "text-[#f59e0b]",
        label: "Medium",
      },
      Low: { bg: "bg-[#10b981]/20", text: "text-[#10b981]", label: "Low" },
    };
    const m = map[risk];
    const dot =
      risk === "High" ? "🔴" : risk === "Medium" ? "🟡" : "🟢";
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${m.bg} ${m.text}`}
      >
        <span aria-hidden>{dot}</span>
        {m.label}
      </span>
    );
  }

  return (
    <div
      id="dashboard-content"
      className="min-h-full w-full max-w-[1600px] space-y-5 bg-[#0a0f1e] p-4 text-[#ffffff] sm:space-y-6 sm:p-6"
    >
      {/* Top header bar */}
      <header className="flex flex-col gap-4 rounded-xl border border-[#1e3a5f] bg-[#0d1b2a] px-4 py-4 transition-all hover:border-[#00b4d8] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="text-left text-sm font-semibold text-[#ffffff] sm:text-base">
          Gilkari Hospital — Intelligent Dashboard
        </div>
        <div className="text-center text-sm text-[#94a3b8] sm:flex-1 sm:text-base">
          <span className="font-medium text-[#00b4d8]">{formatDateTime(now)}</span>
        </div>
        <div className="flex items-center justify-end gap-3 text-sm text-[#94a3b8]">
          <span className="hidden text-right sm:inline">
            Last Updated:{" "}
            <span className="font-medium text-[#ffffff]">
              {formatDateTime(lastUpdated)}
            </span>
          </span>
          <span className="text-right sm:hidden">
            Updated:{" "}
            <span className="text-[#ffffff]">
              {lastUpdated.toLocaleTimeString()}
            </span>
          </span>
          <button
            type="button"
            onClick={handleRefreshClick}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#1e3a5f] bg-[#0a0f1e] text-[#00b4d8] transition-all hover:border-[#00b4d8] hover:bg-[#00b4d8]/10"
            aria-label="Refresh last updated time"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

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
          return (
            <div key={k.label} className={cardBase}>
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
          );
        })}
      </section>

      {/* Row 2: risk | beds | alerts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-10">
        <div className={`lg:col-span-4 ${cardBase}`}>
          <h2 className="mb-4 text-sm font-semibold text-[#00b4d8]">
            Patient Risk Scorecard
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#1e3a5f] text-[#94a3b8]">
                  <th className="pb-2 pr-2 font-medium">Patient Name</th>
                  <th className="pb-2 pr-2 font-medium">Ward</th>
                  <th className="pb-2 pr-2 font-medium">Risk Level</th>
                  <th className="pb-2 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="text-[#ffffff]">
                {riskRows.map((r) => (
                  <tr key={r.name} className="border-b border-[#1e3a5f]/60">
                    <td className="py-2 pr-2">{r.name}</td>
                    <td className="py-2 pr-2 text-[#94a3b8]">{r.ward}</td>
                    <td className="py-2 pr-2">{riskBadge(r.risk)}</td>
                    <td className="py-2 font-semibold text-[#00b4d8]">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`lg:col-span-3 ${cardBase}`}>
          <h2 className="mb-4 text-sm font-semibold text-[#00b4d8]">
            Bed Occupancy
          </h2>
          <div className="flex flex-col items-center justify-center py-2">
            <div
              className="relative h-44 w-44 shrink-0 rounded-full p-2"
              style={{
                background:
                  "conic-gradient(#00b4d8 0deg 259.2deg, #1e3a5f 259.2deg 360deg)",
              }}
              aria-label="Bed occupancy 72 percent"
            >
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0d1b2a]">
                <span className="text-3xl font-bold text-[#ffffff]">72%</span>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-[#94a3b8]">
              Mock occupancy — placeholder visualization
            </p>
          </div>
        </div>

        <div className={`lg:col-span-3 ${cardBase}`}>
          <h2 className="mb-4 text-sm font-semibold text-[#00b4d8]">
            Active Alerts
          </h2>
          <ul className="space-y-3">
            {alerts.map((a, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-lg border border-[#1e3a5f]/80 bg-[#0a0f1e]/50 p-3"
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    a.level === "danger" ? "bg-[#ef4444]" : "bg-[#f59e0b]"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#ffffff]">{a.text}</p>
                  <p className="mt-1 text-xs text-[#94a3b8]">{a.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Row 3: revenue chart | medicine */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-10">
        <div className={`min-w-0 lg:col-span-6 ${cardBase}`}>
          <h2 className="mb-4 text-sm font-semibold text-[#00b4d8]">
            Revenue Forecast — Next 7 Days
          </h2>
          <div className="h-[288px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart
                data={revenueForecast}
                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  axisLine={{ stroke: "#1e3a5f" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  axisLine={{ stroke: "#1e3a5f" }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,180,216,0.08)" }}
                  contentStyle={{
                    backgroundColor: "#0d1b2a",
                    border: "1px solid #1e3a5f",
                    borderRadius: "8px",
                    color: "#ffffff",
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Bar dataKey="amount" fill="#00b4d8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`lg:col-span-4 ${cardBase}`}>
          <h2 className="mb-4 text-sm font-semibold text-[#00b4d8]">
            Medicine Stock Status
          </h2>
          <ul className="space-y-3">
            {medicineStock.map((m) => (
              <li
                key={m.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1e3a5f]/80 bg-[#0a0f1e]/50 px-3 py-2"
              >
                <span className="text-sm text-[#ffffff]">{m.name}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                    m.status === "In Stock"
                      ? "bg-[#10b981]/20 text-[#10b981]"
                      : m.status === "Low"
                        ? "bg-[#f59e0b]/20 text-[#f59e0b]"
                        : "bg-[#ef4444]/20 text-[#ef4444]"
                  }`}
                >
                  {m.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Row 4: deterioration | copilot */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cardBase}>
          <h2 className="mb-1 text-sm font-semibold text-[#00b4d8]">
            Deterioration Prediction
          </h2>
          <p className="mb-4 text-xs text-[#94a3b8]">
            Patients likely to become critical in 24–48 hrs
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#1e3a5f] text-[#94a3b8]">
                  <th className="pb-2 pr-2 font-medium">Patient Name</th>
                  <th className="pb-2 pr-2 font-medium">Current Status</th>
                  <th className="pb-2 pr-2 font-medium">Risk Score</th>
                  <th className="pb-2 font-medium">Predicted Risk</th>
                </tr>
              </thead>
              <tbody>
                {deteriorationRows.map((r) => (
                  <tr key={r.name} className="border-b border-[#1e3a5f]/60">
                    <td className="py-2 pr-2 text-[#ffffff]">{r.name}</td>
                    <td className="py-2 pr-2 text-[#94a3b8]">{r.status}</td>
                    <td className="py-2 pr-2 font-semibold text-[#f59e0b]">
                      {r.score}
                    </td>
                    <td className="py-2 text-[#ef4444]">{r.predicted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div
          className={`${cardBase} border-[#00b4d8]/50 shadow-[0_0_20px_rgba(0,180,216,0.25)] hover:border-[#00b4d8]`}
        >
          <h2 className="mb-4 text-sm font-semibold text-[#00b4d8]">
            🤖 AI Recommendations
          </h2>
          <ul className="list-disc space-y-3 pl-5 text-sm text-[#94a3b8] marker:text-[#00b4d8]">
            {copilotBullets.map((b, i) => (
              <li key={i} className="pl-1">
                <span className="text-[#ffffff]">{b}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-6 w-full rounded-lg border border-[#00b4d8]/60 bg-[#00b4d8]/10 py-2.5 text-sm font-semibold text-[#00b4d8] transition-all hover:bg-[#00b4d8]/20"
          >
            Regenerate
          </button>
        </div>
      </section>

      {/* Row 5: doctor | nurse | payments */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={cardBase}>
          <h2 className="mb-4 text-sm font-semibold text-[#00b4d8]">
            Doctor Workload
          </h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f] text-[#94a3b8]">
                <th className="pb-2 font-medium">Doctor Name</th>
                <th className="pb-2 text-right font-medium">Patients Assigned</th>
              </tr>
            </thead>
            <tbody>
              {doctorWorkload.map((d) => (
                <tr key={d.name} className="border-b border-[#1e3a5f]/60">
                  <td className="py-2 text-[#ffffff]">{d.name}</td>
                  <td className="py-2 text-right font-semibold text-[#00b4d8]">
                    {d.patients}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={cardBase}>
          <h2 className="mb-4 text-sm font-semibold text-[#00b4d8]">
            Nurse Workload
          </h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f] text-[#94a3b8]">
                <th className="pb-2 font-medium">Nurse Name</th>
                <th className="pb-2 text-right font-medium">Patients Assigned</th>
              </tr>
            </thead>
            <tbody>
              {nurseWorkload.map((n) => (
                <tr key={n.name} className="border-b border-[#1e3a5f]/60">
                  <td className="py-2 text-[#ffffff]">{n.name}</td>
                  <td className="py-2 text-right font-semibold text-[#00b4d8]">
                    {n.patients}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={cardBase}>
          <h2 className="mb-4 text-sm font-semibold text-[#00b4d8]">
            Pending Payments
          </h2>
          <ul className="space-y-3">
            {pendingPayments.map((p) => (
              <li
                key={p.patient}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1e3a5f]/80 bg-[#0a0f1e]/50 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-[#ffffff]">{p.patient}</p>
                  <p className="text-xs text-[#94a3b8]">{p.amount}</p>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                    p.status === "Pending"
                      ? "bg-[#f59e0b]/20 text-[#f59e0b]"
                      : p.status === "Partial"
                        ? "bg-sky-500/20 text-sky-400"
                        : "bg-[#ef4444]/20 text-[#ef4444]"
                  }`}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
