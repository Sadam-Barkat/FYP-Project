"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Bell, Clock, Activity } from "lucide-react";
import { useRealtimeEvent } from "@/hooks/useRealtimeEvent";

type AlertFeedItem = {
  id: number;
  short_id: string;
  patient_id: number | null;
  type: string;
  message: string;
  severity: string;
  department: string;
  created_at: string | null;
  is_resolved: boolean;
};

type AlertsOverview = {
  critical_emergencies: number;
  active_warnings: number;
  avg_response_time_minutes: number;
  avg_response_time_prev_minutes: number;
  resolved_today: number;
  alerts_feed: AlertFeedItem[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function severityToUiType(severity: string): "danger" | "warning" | "info" {
  if (severity === "critical") return "danger";
  if (severity === "high" || severity === "medium") return "warning";
  return "info";
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  // Show the exact local time when the alert was created,
  // to match the doctor's notification behaviour.
  return d.toLocaleString();
}

export default function AlertsPage() {
  const [overview, setOverview] = useState<AlertsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/alerts-overview`);
      if (!res.ok) throw new Error("Failed to load alerts");
      const data: AlertsOverview = await res.json();
      setOverview(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useRealtimeEvent("vitals_updated", () => {
    fetchOverview();
  });

  const handleAcknowledge = async (alertId: number) => {
    setAcknowledgingId(alertId);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${alertId}/acknowledge`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Acknowledge failed");
      await fetchOverview();
    } catch {
      setError("Failed to acknowledge alert");
    } finally {
      setAcknowledgingId(null);
    }
  };

  const critical_emergencies = overview?.critical_emergencies ?? 0;
  const active_warnings = overview?.active_warnings ?? 0;
  const avgResponse = overview?.avg_response_time_minutes ?? 0;
  const avgPrev = overview?.avg_response_time_prev_minutes ?? 0;
  const resolvedToday = overview?.resolved_today ?? 0;
  const diffStr = avgPrev > 0 ? `${(avgResponse - avgPrev).toFixed(1)}m vs yesterday` : "—";
  const alerts = overview?.alerts_feed ?? [];

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-semibold text-[#0066cc]">Alerts & Monitoring</h2>
      </div>

      {isLoading && !overview && (
        <p className="text-sm text-gray-500">Loading alerts...</p>
      )}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#ef4444] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <AlertTriangle className="absolute top-4 left-4 text-[#ef4444]" fill="#fecaca" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Critical Emergencies</p>
            <h3 className="text-4xl font-bold text-[#ef4444] mt-3 animate-pulse">{critical_emergencies}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-red-500 font-medium">Requires immediate action</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Bell className="absolute top-4 left-4 text-[#f97316]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Active Warnings</p>
            <h3 className="text-4xl font-bold text-[#f97316] mt-3">{active_warnings}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Monitor closely</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#3b82f6] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Clock className="absolute top-4 left-4 text-[#3b82f6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Avg Response Time</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">{avgResponse.toFixed(1)}m</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">{diffStr}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Activity className="absolute top-4 left-4 text-[#22c55e]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Resolved Today</p>
            <h3 className="text-4xl font-bold text-[#22c55e] mt-3">{resolvedToday}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Issues cleared</p>
        </div>
      </div>

      {/* Main Alerts List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-8">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <h3 className="text-xl font-semibold text-gray-800">Real-Time Alerts Feed</h3>
          <span className="bg-[#e6f2ff] text-[#0066cc] text-xs font-bold px-3 py-1 rounded-full flex items-center">
            <span className="w-2 h-2 rounded-full bg-[#0066cc] animate-ping mr-2"></span>
            Live Monitoring
          </span>
        </div>

        <div className="max-h-[480px] overflow-y-auto space-y-4 pr-1">
          {alerts.length === 0 && !isLoading ? (
            <p className="text-center text-gray-500 py-8">No active alerts currently.</p>
          ) : (
            alerts.map((alert) => {
              const uiType = severityToUiType(alert.severity);
              return (
                <div
                  key={alert.id}
                  className={`p-5 rounded-lg border-l-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md ${
                    uiType === "danger" ? "border-l-[#ef4444] bg-[#fef2f2]" :
                    uiType === "warning" ? "border-l-[#f97316] bg-[#fff7ed]" :
                    "border-l-[#3b82f6] bg-[#eff6ff]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 rounded-full p-2 ${
                      uiType === "danger" ? "bg-red-200 text-red-700" :
                      uiType === "warning" ? "bg-orange-200 text-orange-700" :
                      "bg-blue-200 text-blue-700"
                    }`}>
                      {uiType === "danger" ? <AlertTriangle size={20} /> :
                       uiType === "warning" ? <Bell size={20} /> :
                       <Activity size={20} />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{alert.message}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium text-gray-700">Department:</span> {alert.department}
                        <span className="mx-2">•</span>
                        <span className="font-medium text-gray-700">ID:</span> {alert.short_id}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 border-gray-200/50 pt-3 sm:pt-0">
                    <span className="text-sm font-medium text-gray-500 flex items-center">
                      <Clock size={14} className="mr-1" />
                      {formatTimeAgo(alert.created_at)}
                    </span>
                    <button
                      onClick={() => !alert.is_resolved && handleAcknowledge(alert.id)}
                      disabled={alert.is_resolved || acknowledgingId === alert.id}
                      className={`text-sm font-medium px-3 py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        uiType === "danger" ? "text-red-700 hover:bg-red-200" :
                        uiType === "warning" ? "text-orange-700 hover:bg-orange-200" :
                        "text-blue-700 hover:bg-blue-200"
                      }`}
                    >
                      {alert.is_resolved ? "Resolved" : acknowledgingId === alert.id ? "..." : "Acknowledge"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
