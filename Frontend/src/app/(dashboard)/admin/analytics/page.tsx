"use client";

import { useState, useEffect } from "react";
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
} from "recharts";

type AnalyticsForecasts = {
  admission_trend: { date: string; count: number }[];
  admission_forecast: { date: string; predicted_count: number }[];
  revenue_trend: { date: string; revenue: number }[];
  revenue_forecast: { date: string; predicted_revenue: number }[];
  bed_occupancy_trend: { date: string; occupancy_pct: number }[];
  bed_occupancy_forecast: { date: string; predicted_occupancy_pct: number }[];
  alert_trend: { date: string; critical: number; warning: number; total: number }[];
  condition_distribution: { normal: number; critical: number; emergency: number };
  total_beds: number;
};

const API_BASE_RAW = process.env.NEXT_PUBLIC_API_URL || "https://fyp-project-production-61f7.up.railway.app";
const API_BASE = API_BASE_RAW.replace(/\/+$/, "").replace(/\/api\/?$/, "");

const CONDITION_COLORS = ["#22c55e", "#f97316", "#ef4444"];

function TooltipActualForecast(props: {
  formatActual?: (v: number) => string;
  formatForecast?: (v: number) => string;
  // Recharts passes many fields; keep this intentionally permissive for build safety.
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
  // Use series value by name so both Actual and Forecast show regardless of which line is hovered
  const actualEntry = payload.find((p) => p.name === "Actual");
  const forecastEntry = payload.find((p) => p.name === "Forecast");
  const actualVal = actualEntry?.value ?? actualEntry?.payload?.count ?? actualEntry?.payload?.revenue ?? actualEntry?.payload?.occupancy_pct;
  const forecastVal = forecastEntry?.value ?? forecastEntry?.payload?.predicted;
  const actual = typeof actualVal === "number" ? actualVal : null;
  const forecast = typeof forecastVal === "number" ? forecastVal : null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-800 mb-1">{label}</p>
      <p className="text-[#3b82f6]">Actual: {actual != null ? formatActual(actual) : "—"}</p>
      <p className="text-[#22c55e]">Forecast: {forecast != null ? formatForecast(forecast) : "—"}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsForecasts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setError(null);
        const res = await fetch(`${API_BASE}/api/analytics-forecasts`);
        if (!res.ok) throw new Error("Failed to load analytics");
        const json: AnalyticsForecasts = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (isLoading && !data) {
    return (
      <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-[#0066cc] sm:text-3xl">Analytics & Forecasts</h2>
        </div>
        <p className="text-sm text-gray-500">Loading predictive trends...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-[#0066cc] sm:text-3xl">Analytics & Forecasts</h2>
        </div>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const admissionCombined = [
    ...data.admission_trend.map((t) => ({ date: t.date.slice(5), count: t.count, predicted: null as number | null })),
    ...data.admission_forecast.map((f) => ({ date: f.date.slice(5), count: null as number | null, predicted: f.predicted_count })),
  ];
  const revenueCombined = [
    ...data.revenue_trend.map((t) => ({ date: t.date.slice(5), revenue: t.revenue, predicted: null as number | null })),
    ...data.revenue_forecast.map((f) => ({ date: f.date.slice(5), revenue: null as number | null, predicted: f.predicted_revenue })),
  ];
  const occupancyCombined = [
    ...data.bed_occupancy_trend.map((t) => ({ date: t.date.slice(5), occupancy_pct: t.occupancy_pct, predicted: null as number | null })),
    ...data.bed_occupancy_forecast.map((f) => ({ date: f.date.slice(5), occupancy_pct: null as number | null, predicted: f.predicted_occupancy_pct })),
  ];
  const conditionPie = [
    { name: "Normal", value: data.condition_distribution.normal, color: CONDITION_COLORS[0] },
    { name: "Critical", value: data.condition_distribution.critical, color: CONDITION_COLORS[1] },
    { name: "Emergency", value: data.condition_distribution.emergency, color: CONDITION_COLORS[2] },
  ].filter((d) => d.value > 0);

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-semibold text-[#0066cc] sm:text-3xl">Analytics & Forecasts</h2>
        <p className="mt-1 text-sm text-gray-500">Predictive trends from hospital data</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#3b82f6] p-4">
          <p className="text-gray-600 text-sm font-medium">Total Beds</p>
          <p className="text-2xl font-bold text-[#3b82f6]">{data.total_beds}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-4">
          <p className="text-gray-600 text-sm font-medium">Normal (Vitals)</p>
          <p className="text-2xl font-bold text-[#22c55e]">{data.condition_distribution.normal}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-4">
          <p className="text-gray-600 text-sm font-medium">Critical / Emergency</p>
          <p className="text-2xl font-bold text-[#f97316]">
            {data.condition_distribution.critical + data.condition_distribution.emergency}
          </p>
        </div>
      </div>

      {/* Admission trend + forecast */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 font-semibold text-gray-800">Admissions — Trend & Forecast</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={admissionCombined} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
              <Tooltip
                content={(props) => <TooltipActualForecast {...props} />}
              />
              <Legend />
              <Line type="monotone" dataKey="count" name="Actual" stroke="#3b82f6" dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="predicted" name="Forecast" stroke="#22c55e" strokeDasharray="5 5" dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue trend + forecast */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Revenue — Trend & Forecast (PKR)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={revenueCombined} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
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
              <Line type="monotone" dataKey="revenue" name="Actual" stroke="#3b82f6" dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="predicted" name="Forecast" stroke="#22c55e" strokeDasharray="5 5" dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bed occupancy trend + forecast */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Bed Occupancy % — Trend & Forecast</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={occupancyCombined} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" domain={[0, 100]} />
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
                <Line type="monotone" dataKey="occupancy_pct" name="Actual %" stroke="#8b5cf6" dot={{ r: 2 }} connectNulls />
                <Line type="monotone" dataKey="predicted" name="Forecast %" stroke="#f97316" strokeDasharray="5 5" dot={{ r: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Condition distribution */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Condition Distribution (Vitals)</h3>
          <div className="h-56 w-full">
            {conditionPie.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={conditionPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
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
              <p className="text-sm text-gray-500 flex items-center justify-center h-full">No condition data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Alert trend */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Alert Trend (Last 7 Days)</h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={data.alert_trend.map((t) => ({ ...t, date: t.date.slice(5) }))} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
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
