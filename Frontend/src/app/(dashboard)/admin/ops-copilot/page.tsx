"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ADMIN_DASHBOARD_REALTIME_EVENTS,
  useRealtimeEvent,
} from "@/hooks/useRealtimeEvent";
import {
  Brain,
  ShieldAlert,
  Bell,
  RefreshCw,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
    .replace(/\/+$/, "")
    .replace(/\/api\/?$/i, "");

type Briefing = {
  id: number;
  title: string;
  risk_category: string;
  what_changed: string;
  why_it_matters: string;
  recommended_actions: string[];
  evidence_links: { label: string; href: string }[];
  status: string;
  created_at: string | null;
};

type DailySummary = {
  occupancy_pct: number;
  occupancy_label: string;
  occupancy_prior_pct: number;
  alerts_today: number;
  alerts_yesterday: number;
  alerts_change_pct: number | null;
  revenue_today_pkr: number;
  revenue_yesterday_pkr: number;
  revenue_change_pct: number | null;
};

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("access_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function statusBadgeClass(s: string) {
  switch (s) {
    case "resolved":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "reviewed":
      return "bg-amber-100 text-amber-900 border-amber-200";
    default:
      return "bg-amber-50 text-amber-800 border-amber-200";
  }
}

export default function OpsCopilotPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [history, setHistory] = useState<Briefing[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastSeenId, setLastSeenId] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = parseInt(localStorage.getItem("opsCopilotLastSeenId") || "0", 10);
    if (!Number.isNaN(v)) setLastSeenId(v);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const h = authHeaders();
      const [latestRes, listRes, sumRes] = await Promise.all([
        fetch(`${API_BASE}/api/ops-copilot/briefings/latest`, { headers: h }),
        fetch(`${API_BASE}/api/ops-copilot/briefings?limit=30`, { headers: h }),
        fetch(`${API_BASE}/api/ops-copilot/daily-summary`, { headers: h }),
      ]);
      if (latestRes.status === 401 || listRes.status === 401) {
        setError("Please sign in as admin to use Ops Copilot.");
        return;
      }
      if (!latestRes.ok || !listRes.ok) {
        throw new Error("Failed to load briefings");
      }
      const latestJson = await latestRes.json();
      const listJson = await listRes.json();
      if (!alive.current) return;
      setBriefing(latestJson.briefing ?? null);
      setHistory(Array.isArray(listJson) ? listJson : []);
      if (sumRes.ok) {
        const sj = await sumRes.json();
        if (alive.current) setSummary(sj);
      }
    } catch {
      if (alive.current) setError("Could not load Ops Copilot data.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useRealtimeEvent(ADMIN_DASHBOARD_REALTIME_EVENTS, loadAll);

  const markSeen = useCallback(() => {
    if (!briefing?.id) return;
    localStorage.setItem("opsCopilotLastSeenId", String(briefing.id));
    setLastSeenId(briefing.id);
  }, [briefing?.id]);

  const hasUnread = Boolean(briefing && briefing.id > lastSeenId);

  const generateBriefing = async () => {
    setGenLoading(true);
    setGenError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ops-copilot/briefings/generate`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      const text = await res.text();
      let detail = text;
      try {
        const j = JSON.parse(text);
        detail = j.detail || text;
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        throw new Error(detail || "Generation failed");
      }
      await loadAll();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenLoading(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/ops-copilot/briefings/${id}/status`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      await loadAll();
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="dashboard-page-shell max-w-7xl">
        <p className="text-sm text-gray-500">Loading Ops Copilot…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page-shell max-w-7xl">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-7xl space-y-6 pb-10">
      {/* Page header strip (matches supervisor mock: strong blue band + title) */}
      <div className="rounded-xl bg-[#0066cc] px-5 py-4 text-white shadow-md sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/30">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">AI Hospital Ops Copilot</h2>
              <p className="text-sm text-blue-100">
                Agentic triage + action plan from live operational signals
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => generateBriefing()}
            disabled={genLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#0066cc] shadow-sm transition hover:bg-blue-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${genLoading ? "animate-spin" : ""}`} />
            {genLoading ? "Generating…" : "Generate new briefing"}
          </button>
        </div>
        {genError && (
          <p className="mt-3 rounded-md bg-white/10 px-3 py-2 text-sm text-white">{genError}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Current briefing */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Current briefing
            </h3>
            {!briefing ? (
              <p className="mt-6 text-sm text-gray-500">
                No briefing yet. Click <strong>Generate new briefing</strong> to run the agent on
                live metrics (requires <code className="rounded bg-gray-100 px-1">OPENAI_API_KEY</code>{" "}
                on the server).
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
                  <h4 className="text-lg font-bold text-gray-900">{briefing.title}</h4>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">What changed</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-700">{briefing.what_changed}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Why it matters</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-700">{briefing.why_it_matters}</p>
                </div>
                <div className="rounded-lg bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
                  <p className="text-xs font-semibold uppercase text-sky-800">Recommended actions</p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-gray-800">
                    {briefing.recommended_actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Evidence</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {briefing.evidence_links.map((ev, i) => (
                      <Link
                        key={i}
                        href={ev.href}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#0066cc] ring-1 ring-blue-100 hover:bg-blue-100"
                      >
                        {ev.label}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* History */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Briefing history
            </h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 font-medium">Briefing</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-gray-500">
                        No history yet.
                      </td>
                    </tr>
                  ) : (
                    history.map((b) => (
                      <tr key={b.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 pr-4 align-top text-gray-600 whitespace-nowrap">
                          {b.created_at
                            ? new Date(b.created_at).toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 pr-4 align-top font-medium text-gray-900">{b.title}</td>
                        <td className="py-3 align-top">
                          <select
                            value={b.status}
                            onChange={(e) => updateStatus(b.id, e.target.value)}
                            className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusBadgeClass(b.status)}`}
                          >
                            <option value="open">Open</option>
                            <option value="resolved">Resolved</option>
                            <option value="reviewed">Reviewed</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          {/* Notification card */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Notification alert
            </h3>
            {hasUnread && briefing ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-2">
                  <Bell className="h-5 w-5 shrink-0 text-amber-700" />
                  <p className="text-sm font-medium text-amber-900">
                    New briefing available: {briefing.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={markSeen}
                  className="mt-3 w-full rounded-lg bg-[#0066cc] py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Mark as read
                </button>
              </div>
            ) : briefing ? (
              <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                You are up to date with the latest briefing.
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                Generate a briefing to receive alerts here.
              </div>
            )}
          </section>

          {/* Daily summary */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Daily summary
              </h3>
              <button type="button" className="text-gray-400 hover:text-gray-600" aria-label="More">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
            {summary ? (
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex justify-between gap-2">
                  <span className="text-gray-600">Occupancy</span>
                  <span className="font-semibold text-gray-900">
                    {summary.occupancy_pct}%{" "}
                    <span className="text-xs font-normal text-gray-500">
                      ({summary.occupancy_label} vs yesterday {summary.occupancy_prior_pct}%)
                    </span>
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-gray-600">Alerts (today)</span>
                  <span
                    className={`font-semibold ${
                      summary.alerts_change_pct != null && summary.alerts_change_pct < 0
                        ? "text-emerald-600"
                        : summary.alerts_change_pct != null && summary.alerts_change_pct > 0
                          ? "text-red-600"
                          : "text-gray-900"
                    }`}
                  >
                    {summary.alerts_today}
                    {summary.alerts_change_pct != null && (
                      <span className="ml-1 text-xs">
                        ({summary.alerts_change_pct > 0 ? "+" : ""}
                        {summary.alerts_change_pct}% vs yesterday)
                      </span>
                    )}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-gray-600">Revenue (paid, today)</span>
                  <span
                    className={`font-semibold ${
                      summary.revenue_change_pct != null && summary.revenue_change_pct >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {summary.revenue_today_pkr.toLocaleString()} PKR
                    {summary.revenue_change_pct != null && (
                      <span className="ml-1 text-xs">
                        ({summary.revenue_change_pct > 0 ? "+" : ""}
                        {summary.revenue_change_pct}%)
                      </span>
                    )}
                  </span>
                </li>
              </ul>
            ) : (
              <p className="mt-4 text-sm text-gray-500">Summary unavailable.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
