"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  AlertTriangle,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { MetricKpiCard, TooltipRow } from "@/components/dashboard/MetricHoverCard";
import {
  ADMIN_DASHBOARD_REALTIME_EVENTS,
  useRealtimeEvent,
} from "@/hooks/useRealtimeEvent";

type AdmissionForecastPoint = {
  date: string;
  predicted_count: number;
  band_low?: number;
  band_high?: number;
};

type RevenueForecastPoint = {
  date: string;
  predicted_revenue: number;
  band_low?: number;
  band_high?: number;
};

type OccupancyForecastPoint = {
  date: string;
  predicted_occupancy_pct: number;
  band_low?: number;
  band_high?: number;
};

type Insight = {
  severity: string;
  title: string;
  detail: string;
  metric: string;
};

type AnalyticsKpi = {
  admissions_trailing_7d?: number;
  admissions_prior_7d?: number;
  admissions_wow_change_pct?: number | null;
  admissions_forecast_7d_sum?: number;
  revenue_trailing_7d_pkr?: number;
  revenue_prior_7d_pkr?: number;
  revenue_wow_change_pct?: number | null;
  revenue_forecast_7d_sum_pkr?: number;
  bed_occupancy_now_pct?: number;
  bed_occupancy_avg_7d_pct?: number;
  bed_occupancy_forecast_avg_7d_pct?: number;
  vitals_high_acuity_pct?: number;
  alerts_7d_total?: number;
  capacity_risk_score_0_100?: number;
  capacity_risk_label?: string;
};

type ForecastEngine = {
  horizon_days?: number;
  history_days?: number;
  methods?: Record<string, string>;
  uncertainty?: string;
};

type AnalyticsForecasts = {
  admission_trend: { date: string; count: number }[];
  admission_forecast: AdmissionForecastPoint[];
  revenue_trend: { date: string; revenue: number }[];
  revenue_forecast: RevenueForecastPoint[];
  bed_occupancy_trend: { date: string; occupancy_pct: number }[];
  bed_occupancy_forecast: OccupancyForecastPoint[];
  alert_trend: { date: string; critical: number; warning: number; total: number }[];
  condition_distribution: { normal: number; critical: number; emergency: number };
  total_beds: number;
  ward_admissions_7d?: { ward: string; count: number }[];
  kpi?: AnalyticsKpi;
  insights?: Insight[];
  forecast_engine?: ForecastEngine;
};

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
    .replace(/\/+$/, "")
    .replace(/\/api\/?$/i, "");

const CONDITION_COLORS = ["#22c55e", "#f97316", "#ef4444"];

function DeltaBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) {
    return <span className="text-xs text-gray-400">No prior-week baseline</span>;
  }
  const isUp = pct > 0;
  const isFlat = pct === 0;
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  const cls = isFlat
    ? "text-gray-500"
    : isUp
      ? "text-emerald-600"
      : "text-amber-700";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {isUp ? "+" : ""}
      {pct}% vs prior week
    </span>
  );
}

function TooltipActualForecast(props: {
  formatActual?: (v: number) => string;
  formatForecast?: (v: number) => string;
  [key: string]: unknown;
}) {
  const {
    active,
    payload,
    label,
    formatActual = (v: number) => String(v),
    formatForecast = (v: number) => String(v),
  } = props as {
    active?: boolean;
    payload?: readonly { name?: string; value?: number | null; payload?: Record<string, unknown> }[];
    label?: string | number;
    formatActual?: (v: number) => string;
    formatForecast?: (v: number) => string;
  };
  if (!active || !payload?.length || label == null) return null;
  const actualEntry = payload.find((p) => p.name === "Actual");
  const forecastEntry = payload.find((p) => p.name === "Forecast");
  const lowEntry = payload.find((p) => p.name === "Band low");
  const highEntry = payload.find((p) => p.name === "Band high");
  const actualVal =
    actualEntry?.value ??
    actualEntry?.payload?.count ??
    actualEntry?.payload?.revenue ??
    actualEntry?.payload?.occupancy_pct;
  const forecastVal = forecastEntry?.value ?? forecastEntry?.payload?.predicted;
  const actual = typeof actualVal === "number" ? actualVal : null;
  const forecast = typeof forecastVal === "number" ? forecastVal : null;
  const lo = typeof lowEntry?.value === "number" ? lowEntry.value : null;
  const hi = typeof highEntry?.value === "number" ? highEntry.value : null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-gray-800">{label}</p>
      <p className="text-blue-600">Actual: {actual != null ? formatActual(actual) : "—"}</p>
      <p className="text-emerald-600">Forecast: {forecast != null ? formatForecast(forecast) : "—"}</p>
      {lo != null && hi != null && (
        <p className="mt-1 text-xs text-gray-500">
          Uncertainty band: {formatForecast(lo)} – {formatForecast(hi)}
        </p>
      )}
    </div>
  );
}

function insightStyles(severity: string) {
  switch (severity) {
    case "critical":
      return {
        border: "border-l-red-500",
        bg: "bg-red-50/80",
        icon: <ShieldAlert className="h-5 w-5 text-red-600" />,
      };
    case "warning":
      return {
        border: "border-l-amber-500",
        bg: "bg-amber-50/80",
        icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
      };
    default:
      return {
        border: "border-l-sky-500",
        bg: "bg-sky-50/70",
        icon: <Info className="h-5 w-5 text-sky-600" />,
      };
  }
}

function riskTone(label?: string) {
  const l = (label || "").toLowerCase();
  if (l === "high") return "text-red-700 bg-red-50 border-red-200";
  if (l === "moderate") return "text-amber-800 bg-amber-50 border-amber-200";
  return "text-emerald-800 bg-emerald-50 border-emerald-200";
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsForecasts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/analytics-forecasts`);
      if (!res.ok) throw new Error("Failed to load analytics");
      const json: AnalyticsForecasts = await res.json();
      if (!alive.current) return;
      setData(json);
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (alive.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useRealtimeEvent(ADMIN_DASHBOARD_REALTIME_EVENTS, fetchData);

  if (isLoading && !data) {
    return (
      <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-[#0066cc] sm:text-3xl">
            Intelligent Analytics &amp; Forecasts
          </h2>
        </div>
        <p className="text-sm text-gray-500">Loading operational intelligence layer…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-[#0066cc] sm:text-3xl">
            Intelligent Analytics &amp; Forecasts
          </h2>
        </div>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const kpi = data.kpi;
  const insights = data.insights ?? [];
  const engine = data.forecast_engine;
  const wards = data.ward_admissions_7d ?? [];

  const admissionCombined = [
    ...data.admission_trend.map((t) => ({
      date: t.date.slice(5),
      count: t.count,
      predicted: null as number | null,
      bandLow: null as number | null,
      bandHigh: null as number | null,
    })),
    ...data.admission_forecast.map((f) => ({
      date: f.date.slice(5),
      count: null as number | null,
      predicted: f.predicted_count,
      bandLow: f.band_low ?? null,
      bandHigh: f.band_high ?? null,
    })),
  ];

  const revenueCombined = [
    ...data.revenue_trend.map((t) => ({
      date: t.date.slice(5),
      revenue: t.revenue,
      predicted: null as number | null,
      bandLow: null as number | null,
      bandHigh: null as number | null,
    })),
    ...data.revenue_forecast.map((f) => ({
      date: f.date.slice(5),
      revenue: null as number | null,
      predicted: f.predicted_revenue,
      bandLow: f.band_low ?? null,
      bandHigh: f.band_high ?? null,
    })),
  ];

  const occupancyCombined = [
    ...data.bed_occupancy_trend.map((t) => ({
      date: t.date.slice(5),
      occupancy_pct: t.occupancy_pct,
      predicted: null as number | null,
      bandLow: null as number | null,
      bandHigh: null as number | null,
    })),
    ...data.bed_occupancy_forecast.map((f) => ({
      date: f.date.slice(5),
      occupancy_pct: null as number | null,
      predicted: f.predicted_occupancy_pct,
      bandLow: f.band_low ?? null,
      bandHigh: f.band_high ?? null,
    })),
  ];

  const conditionPie = [
    { name: "Normal", value: data.condition_distribution.normal, color: CONDITION_COLORS[0] },
    { name: "Critical", value: data.condition_distribution.critical, color: CONDITION_COLORS[1] },
    { name: "Emergency", value: data.condition_distribution.emergency, color: CONDITION_COLORS[2] },
  ].filter((d) => d.value > 0);

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-7xl space-y-8">
      {/* Hero */}
      <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/40 px-5 py-6 shadow-sm sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-sky-800 shadow-sm ring-1 ring-sky-100">
              <Brain className="h-3.5 w-3.5" />
              Operational intelligence (non-clinical)
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#0066cc] sm:text-3xl">
              Intelligent Analytics &amp; Forecasts
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
              This page combines <strong>live hospital data</strong> with{" "}
              <strong>trend extrapolation</strong>, <strong>uncertainty bands</strong>, and{" "}
              <strong>rule-based insights</strong> (capacity, acuity, revenue momentum, alerts).
              Forecasts support planning and supervisor review—they are{" "}
              <strong>not</strong> a substitute for clinical judgment.
            </p>
          </div>
          <div
            className={`shrink-0 rounded-xl border px-4 py-3 text-center sm:min-w-[140px] ${riskTone(kpi?.capacity_risk_label)}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">Capacity risk</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {kpi?.capacity_risk_score_0_100 ?? "—"}
            </p>
            <p className="text-xs font-semibold">{kpi?.capacity_risk_label ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Methodology */}
      {engine && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Activity className="h-4 w-4 text-sky-600" />
            How the “intelligence” is produced
          </h3>
          <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-gray-600 sm:text-sm">
            <li>
              History window: <strong>{engine.history_days ?? 14} days</strong> · Forecast horizon:{" "}
              <strong>{engine.horizon_days ?? 7} days</strong>
            </li>
            {engine.methods && (
              <li>
                Models per metric: admissions{" "}
                <code className="rounded bg-gray-100 px-1 text-[11px]">
                  {engine.methods.admissions}
                </code>
                , revenue{" "}
                <code className="rounded bg-gray-100 px-1 text-[11px]">{engine.methods.revenue}</code>
                , occupancy{" "}
                <code className="rounded bg-gray-100 px-1 text-[11px]">
                  {engine.methods.bed_occupancy_pct}
                </code>
              </li>
            )}
            {engine.uncertainty && <li>{engine.uncertainty}</li>}
          </ul>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Admissions</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
            {kpi?.admissions_trailing_7d ?? "—"}
            <span className="text-sm font-normal text-gray-400"> / 7d</span>
          </p>
          <div className="mt-2">
            <DeltaBadge pct={kpi?.admissions_wow_change_pct ?? null} />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Next 7d forecast sum: ~{kpi?.admissions_forecast_7d_sum ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Paid revenue</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
            {(kpi?.revenue_trailing_7d_pkr ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span className="text-sm font-normal text-gray-400"> PKR</span>
          </p>
          <div className="mt-2">
            <DeltaBadge pct={kpi?.revenue_wow_change_pct ?? null} />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Forecast 7d sum: ~{(kpi?.revenue_forecast_7d_sum_pkr ?? 0).toLocaleString()} PKR
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Bed occupancy</p>
          <p className="mt-1 text-2xl font-bold text-violet-700 tabular-nums">
            {kpi?.bed_occupancy_now_pct != null ? `${kpi.bed_occupancy_now_pct}%` : "—"}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Trailing 7d avg: {kpi?.bed_occupancy_avg_7d_pct ?? "—"}% · Forecast avg:{" "}
            {kpi?.bed_occupancy_forecast_avg_7d_pct ?? "—"}%
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Vitals acuity</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
            {kpi?.vitals_high_acuity_pct != null ? `${kpi.vitals_high_acuity_pct}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-gray-500">Critical + emergency share of classified vitals</p>
          <p className="mt-2 text-xs text-gray-500">Alerts (7d): {kpi?.alerts_7d_total ?? "—"}</p>
        </div>
      </div>

      {/* Original summary cards (beds + vitals) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#3b82f6]"
          icon={null}
          label="Total Beds"
          value={<p className="mt-2 text-2xl font-bold text-[#3b82f6]">{data.total_beds}</p>}
          tooltipTitle="Definition"
          tooltipContent={<TooltipRow label="Meaning" value="Registered bed capacity" />}
          minHeightClass="min-h-[100px]"
          showChevron={false}
        />
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#22c55e]"
          icon={null}
          label="Normal (Vitals)"
          value={
            <p className="mt-2 text-2xl font-bold text-[#22c55e]">{data.condition_distribution.normal}</p>
          }
          tooltipTitle="Definition"
          tooltipContent={<TooltipRow label="Stable classification" value="From latest vital readings" />}
          minHeightClass="min-h-[100px]"
          showChevron={false}
        />
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#f97316]"
          icon={null}
          label="Critical / Emergency"
          value={
            <p className="mt-2 text-2xl font-bold text-[#f97316]">
              {data.condition_distribution.critical + data.condition_distribution.emergency}
            </p>
          }
          tooltipTitle="Breakdown"
          tooltipContent={
            <>
              <TooltipRow label="Critical" value={data.condition_distribution.critical} />
              <TooltipRow label="Emergency" value={data.condition_distribution.emergency} />
            </>
          }
          minHeightClass="min-h-[100px]"
          showChevron={false}
        />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Automated insights</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {insights.map((ins, idx) => {
              const st = insightStyles(ins.severity);
              return (
                <div
                  key={`${ins.metric}-${idx}`}
                  className={`flex gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm ${st.border} border-l-4 ${st.bg}`}
                >
                  <div className="shrink-0 pt-0.5">{st.icon}</div>
                  <div>
                    <p className="font-semibold text-gray-900">{ins.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">{ins.detail}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-gray-400">
                      signal: {ins.metric}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ward demand */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-1 font-semibold text-gray-800">Ward demand (admissions, last 7 days)</h3>
        <p className="mb-4 text-xs text-gray-500">
          Shows where new admissions concentrated—useful for staffing and supplies.
        </p>
        {wards.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart
                data={wards}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#6b7280" />
                <YAxis
                  type="category"
                  dataKey="ward"
                  width={100}
                  tick={{ fontSize: 11 }}
                  stroke="#6b7280"
                />
                <Tooltip />
                <Bar dataKey="count" name="Admissions" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No ward-level admissions in the last 7 days yet.</p>
        )}
      </div>

      {/* Admissions chart */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-1 font-semibold text-gray-800">Admissions — actual vs forecast</h3>
        <p className="mb-4 text-xs text-gray-500">
          Dashed line = projected counts; light lines = heuristic uncertainty band.
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={admissionCombined} margin={{ top: 8, right: 12, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" allowDecimals />
              <Tooltip content={(props) => <TooltipActualForecast {...props} />} />
              <Legend />
              <Line type="monotone" dataKey="bandLow" name="Band low" stroke="#86efac" dot={false} strokeWidth={1} connectNulls />
              <Line type="monotone" dataKey="bandHigh" name="Band high" stroke="#86efac" dot={false} strokeWidth={1} connectNulls />
              <Line type="monotone" dataKey="count" name="Actual" stroke="#2563eb" dot={{ r: 3 }} strokeWidth={2} connectNulls />
              <Line
                type="monotone"
                dataKey="predicted"
                name="Forecast"
                stroke="#16a34a"
                strokeDasharray="6 4"
                dot={{ r: 3 }}
                strokeWidth={2}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-1 font-semibold text-gray-800">Paid revenue — actual vs forecast (PKR)</h3>
        <p className="mb-4 text-xs text-gray-500">Based on posted paid billings by day.</p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={revenueCombined} margin={{ top: 8, right: 12, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
              <Tooltip
                content={(props) => (
                  <TooltipActualForecast
                    {...props}
                    formatActual={(v) => v.toLocaleString()}
                    formatForecast={(v) => v.toLocaleString()}
                  />
                )}
              />
              <Legend />
              <Line type="monotone" dataKey="bandLow" name="Band low" stroke="#a7f3d0" dot={false} strokeWidth={1} connectNulls />
              <Line type="monotone" dataKey="bandHigh" name="Band high" stroke="#a7f3d0" dot={false} strokeWidth={1} connectNulls />
              <Line type="monotone" dataKey="revenue" name="Actual" stroke="#2563eb" dot={{ r: 3 }} strokeWidth={2} connectNulls />
              <Line
                type="monotone"
                dataKey="predicted"
                name="Forecast"
                stroke="#16a34a"
                strokeDasharray="6 4"
                dot={{ r: 3 }}
                strokeWidth={2}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <h3 className="mb-1 font-semibold text-gray-800">Bed occupancy % — actual vs forecast</h3>
          <p className="mb-4 text-xs text-gray-500">
            Reference lines at 75% (watch) and 85% (stress). Forecast is operational projection only.
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={occupancyCombined} margin={{ top: 8, right: 12, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" domain={[0, 100]} />
                <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "75%", fill: "#b45309", fontSize: 10 }} />
                <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "85%", fill: "#b91c1c", fontSize: 10 }} />
                <Tooltip
                  content={(props) => (
                    <TooltipActualForecast
                      {...props}
                      formatActual={(v) => `${v}%`}
                      formatForecast={(v) => `${v}%`}
                    />
                  )}
                />
                <Legend />
                <Line type="monotone" dataKey="bandLow" name="Band low" stroke="#ddd6fe" dot={false} strokeWidth={1} connectNulls />
                <Line type="monotone" dataKey="bandHigh" name="Band high" stroke="#ddd6fe" dot={false} strokeWidth={1} connectNulls />
                <Line type="monotone" dataKey="occupancy_pct" name="Actual %" stroke="#7c3aed" dot={{ r: 2 }} strokeWidth={2} connectNulls />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  name="Forecast %"
                  stroke="#ea580c"
                  strokeDasharray="6 4"
                  dot={{ r: 2 }}
                  strokeWidth={2}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <h3 className="mb-1 font-semibold text-gray-800">Vitals condition mix</h3>
          <p className="mb-4 text-xs text-gray-500">Distribution of latest classified vital records.</p>
          <div className="h-64 w-full">
            {conditionPie.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={conditionPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {conditionPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-gray-500">
                No classified vitals yet
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-1 font-semibold text-gray-800">Alert load (last 7 days)</h3>
        <p className="mb-4 text-xs text-gray-500">Critical vs warning-tier alerts created per day.</p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart
              data={data.alert_trend.map((t) => ({ ...t, date: t.date.slice(5) }))}
              margin={{ top: 8, right: 8, bottom: 8, left: -8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Bar dataKey="critical" name="Critical" fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Bar dataKey="warning" name="Warning" fill="#f97316" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
