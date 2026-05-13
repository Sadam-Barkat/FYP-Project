"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";
import {
  Users,
  CheckCircle,
  Clock,
  TrendingUp,
  BellRing,
  ChevronDown,
  Activity,
  ArrowLeft,
  Loader2,
} from "lucide-react";

/** Matches admin overview panel cards (light + dark). */
const panelCard =
  "rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] dark:border-white/[0.06] dark:bg-panel dark:shadow-panel";
import { 
  PieChart, Pie, Cell, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer 
} from "recharts";

export default function DoctorAnalyticsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  type RecentDischarge = {
    name: string;
    date: string;
    outcome: string;
  };

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const API_BASE = getApiBaseUrl();
        const headers = getAuthHeaders();
        const res = await fetch(
          `${API_BASE}/api/doctor/analytics`,
          { headers }
        );
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const data = await res.json();
        if (!cancelled) setAnalytics(data);
      } catch (error) {
        console.error("Failed to load doctor analytics:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div
        id="dashboard-content"
        className="admin-overview-theme flex min-h-[calc(100dvh-72px)] w-full items-center justify-center bg-gray-50 px-4 dark:bg-dash-bg"
      >
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-tx-muted">
          <Loader2 className="h-8 w-8 animate-spin text-brand-blue" aria-hidden />
          <p className="text-sm font-medium text-slate-600 dark:text-tx-secondary">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div
        id="dashboard-content"
        className="admin-overview-theme flex min-h-[calc(100dvh-72px)] w-full items-center justify-center bg-gray-50 px-4 dark:bg-dash-bg"
      >
        <p className="text-sm text-slate-500 dark:text-tx-muted">No analytics data available.</p>
      </div>
    );
  }

  const pieData = [
    { name: 'Normal', value: analytics.conditions.normal, color: '#10b981' },
    { name: 'Critical', value: analytics.conditions.critical, color: '#f59e0b' },
    { name: 'Emergency', value: analytics.conditions.emergency, color: '#ef4444' },
  ];

  const chartGridStroke = "#cbd5e1";
  const chartAxisStroke = "#64748b";

  return (
    <div
      id="dashboard-content"
      className="admin-overview-theme min-h-[calc(100dvh-72px)] w-full bg-gray-50 px-4 py-3 text-gray-900 sm:px-6 dark:bg-dash-bg dark:text-tx-primary"
    >
    <div className="dashboard-page-shell max-w-7xl mx-auto">
      {/* Header */}
      <div className={`${panelCard} p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-start`}>
        <button
          onClick={() => router.back()}
          className="mt-0 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:border-brand-blue/35 hover:bg-slate-50 hover:text-slate-900 hover:-translate-y-0.5 sm:mt-0.5 dark:border-white/[0.08] dark:bg-dash-elevated dark:text-tx-secondary dark:hover:bg-white/[0.05] dark:hover:text-tx-bright"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h2 className="text-slate-900 font-semibold tracking-tight text-2xl sm:text-3xl dark:text-tx-bright">
            My Performance Analytics
          </h2>
          <p className="text-slate-600 text-sm mt-1 dark:text-tx-secondary">Overview of treated patients and metrics.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-brand-blue/20 bg-card-blue shadow-card-blue p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between text-white/70 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Treated</span>
            <Users size={18} className="text-sky-300" />
          </div>
          <p className="text-3xl font-bold text-white tabular-nums">{analytics.totalTreated}</p>
        </div>

        <div className="rounded-2xl border border-status-success/20 bg-card-green shadow-card-green p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between text-white/70 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Discharges</span>
            <CheckCircle size={18} className="text-emerald-300" />
          </div>
          <p className="text-3xl font-bold text-white tabular-nums">{analytics.discharges}</p>
        </div>

        <div className="rounded-2xl border border-brand-purple/20 bg-card-purple shadow-card p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between text-white/70 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Recovery</span>
            <Clock size={18} className="text-violet-300" />
          </div>
          <p className="text-3xl font-bold text-white tabular-nums">
            {analytics.avgRecovery} <span className="text-base font-medium text-white/75">days</span>
          </p>
        </div>

        <div className="rounded-2xl border border-status-success/20 bg-card-green shadow-card-green p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between text-white/70 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Recovery Rate</span>
            <TrendingUp size={18} className="text-emerald-300" />
          </div>
          <p className="text-3xl font-bold text-white tabular-nums">{analytics.recoveryRate}%</p>
        </div>

        <div className="rounded-2xl border border-status-warning/20 bg-card-amber shadow-card-amber p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between text-white/70 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Alerts Resolved</span>
            <BellRing size={18} className="text-amber-200" />
          </div>
          <p className="text-3xl font-bold text-white tabular-nums">{analytics.alertsResolved}</p>
        </div>

        <div className="rounded-2xl border border-brand-blue/20 bg-card-teal shadow-card-teal p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between text-white/70 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Condition Split</span>
            <Activity size={18} className="text-cyan-300" />
          </div>
          <div className="flex flex-col gap-1 text-xs font-medium text-white/75 mt-1">
            <div className="flex justify-between"><span className="text-status-success">Normal</span><span className="tabular-nums text-white">{analytics.conditions.normal}%</span></div>
            <div className="flex justify-between"><span className="text-status-warning">Critical</span><span className="tabular-nums text-white">{analytics.conditions.critical}%</span></div>
            <div className="flex justify-between"><span className="text-status-danger">Emergency</span><span className="tabular-nums text-white">{analytics.conditions.emergency}%</span></div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 ${panelCard} p-6 flex flex-col h-[350px]`}>
          <h3 className="font-semibold text-slate-900 dark:text-tx-bright mb-4">Treatment Trend (Last 5 Weeks)</h3>
          <div className="flex-1 w-full chart-doctor-analytics text-slate-400 dark:text-tx-muted [&_.recharts-cartesian-axis-tick-value]:fill-current">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={analytics.treatmentTrend} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                <XAxis dataKey="week" stroke={chartAxisStroke} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={chartAxisStroke} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid rgb(226 232 240)",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.08)",
                    background: "rgba(255,255,255,0.98)",
                  }}
                  labelStyle={{ color: "#334155" }}
                />
                <Line type="monotone" dataKey="count" name="Patients Treated" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${panelCard} p-6 flex flex-col h-[350px]`}>
          <h3 className="font-semibold text-slate-900 dark:text-tx-bright mb-4">Patient Condition Distribution</h3>
          <div className="flex-1 w-full flex items-center justify-center chart-doctor-analytics text-slate-500 dark:text-tx-secondary">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid rgb(226 232 240)",
                    background: "rgba(255,255,255,0.98)",
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Discharges */}
      <div className={`${panelCard} p-6`}>
        <h3 className="font-semibold text-slate-900 dark:text-tx-bright mb-4">Recent Discharges</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-600 bg-slate-50 dark:border-dash-border dark:text-tx-secondary dark:bg-white/[0.04]">
                <th className="py-3 px-4 font-medium uppercase tracking-widest text-xs">Patient Name</th>
                <th className="py-3 px-4 font-medium uppercase tracking-widest text-xs">Discharge Date</th>
                <th className="py-3 px-4 font-medium uppercase tracking-widest text-xs">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentDischarges.map((discharge: RecentDischarge, idx: number) => (
                <tr key={idx} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors duration-150 dark:border-dash-border dark:hover:bg-white/[0.04]">
                  <td className="py-3 px-4 text-sm font-medium text-slate-900 dark:text-tx-bright">{discharge.name}</td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-tx-secondary">{discharge.date}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                      discharge.outcome === 'Recovered' ? 'bg-status-success/10 text-status-success border border-status-success/30' : 'bg-brand-blue/10 text-brand-blue border border-brand-blue/30'
                    }`}>
                      {discharge.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="w-full mt-4 flex items-center justify-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors duration-150 dark:text-tx-secondary dark:hover:text-tx-bright"
        >
          View all discharges <ChevronDown size={16} />
        </button>
      </div>
    </div>
    </div>
  );
}
