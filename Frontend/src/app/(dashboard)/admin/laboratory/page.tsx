"use client";

import { useState, useEffect, useCallback } from "react";
import { TestTube2, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useRealtimeEvent } from "@/hooks/useRealtimeEvent";
import { MetricKpiCard, TooltipRow } from "@/components/dashboard/MetricHoverCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface DailyCategoryVolume {
  category: string;
  completed: number;
  pending: number;
}

interface WeeklyResultPoint {
  day: string;
  normal: number;
  abnormal: number;
}

interface LaboratoryOverview {
  pending_tests: number;
  completed_today: number;
  active_technicians: number;
  critical_results: number;
  daily_test_volume_by_category: DailyCategoryVolume[];
  weekly_result_trends: WeeklyResultPoint[];
  selected_date: string;
}

export default function LaboratoryPage() {
  const [overview, setOverview] = useState<LaboratoryOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const fetchOverview = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const query = selectedDate ? `?date=${selectedDate}` : "";
      const res = await fetch(`${API_BASE}/api/laboratory-overview${query}`);
      if (!res.ok) {
        throw new Error("Failed to load laboratory overview");
      }
      const data: LaboratoryOverview = await res.json();
      setOverview(data);
    } catch {
      setError("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useRealtimeEvent("laboratory_updated", fetchOverview);

  const pendingTests = overview?.pending_tests ?? 0;
  const completedToday = overview?.completed_today ?? 0;
  const activeTechnicians = overview?.active_technicians ?? 0;
  const criticalResults = overview?.critical_results ?? 0;

  const labTests: DailyCategoryVolume[] =
    overview?.daily_test_volume_by_category ?? [];
  const trendData: WeeklyResultPoint[] =
    overview?.weekly_result_trends ?? [];

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
      <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-6 gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-semibold text-[#0066cc]">
            Laboratory Overview
          </h2>
          {isLoading && (
            <p className="mt-2 text-sm text-gray-500">
              Loading laboratory data...
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-500">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="laboratory-date"
            className="text-sm text-gray-600"
          >
            Select date
          </label>
          <input
            id="laboratory-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-[#3b82f6]"
          />
        </div>
      </div>

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#f97316]"
          icon={<Clock className="absolute top-4 left-4 text-[#f97316]" size={24} />}
          label="Pending Tests"
          value={<h3 className="text-4xl font-bold text-[#f97316] mt-3">{pendingTests}</h3>}
          footnote={
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 animate-pulse">
              Processing in lab...
            </p>
          }
          tooltipTitle="Pending definition"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pending tests are created but not yet marked completed.
              </p>
            </>
          }
        />

        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#22c55e]"
          icon={<CheckCircle className="absolute top-4 left-4 text-[#22c55e]" size={24} />}
          label="Completed Today"
          value={<h3 className="text-4xl font-bold text-[#22c55e] mt-3">{completedToday}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Results delivered</p>}
          tooltipTitle="Completed definition"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Completed tests are those with results recorded on this day.
              </p>
            </>
          }
        />

        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#3b82f6]"
          icon={<TestTube2 className="absolute top-4 left-4 text-[#3b82f6]" size={24} />}
          label="Active Technicians"
          value={<h3 className="text-4xl font-bold text-[#3b82f6] mt-3">{activeTechnicians}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400 mt-4">On duty currently</p>}
          tooltipTitle="Staffing"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Active technicians represent lab staff marked on duty.
              </p>
            </>
          }
        />

        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#ef4444]"
          icon={<AlertTriangle className="absolute top-4 left-4 text-[#ef4444]" size={24} />}
          label="Critical Results"
          value={<h3 className="text-4xl font-bold text-[#ef4444] mt-3">{criticalResults}</h3>}
          footnote={
            <p className="text-xs text-gray-500 mt-4 text-red-500 font-medium">
              Require immediate doctor review
            </p>
          }
          tooltipTitle="Why it matters"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Critical results are flagged abnormal and should be reviewed quickly.
              </p>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Test Types Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">
            Daily Test Volume by Category
          </h3>
          <div className="flex-1 w-full">
            {labTests.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                {isLoading ? "Loading chart..." : "No data available"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={labTests}
                  layout="vertical"
                  margin={{ top: 5, right: 30, bottom: 5, left: 30 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e5e7eb"
                  />
                  <XAxis
                    type="number"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="category"
                    type="category"
                    stroke="#4b5563"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      boxShadow:
                        "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "20px" }} />
                  <Bar
                    dataKey="completed"
                    name="Completed"
                    stackId="a"
                    fill="#22c55e"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="pending"
                    name="Pending"
                    stackId="a"
                    fill="#f97316"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Weekly Trend Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">
            Weekly Result Trends (Normal vs Abnormal)
          </h3>
          <div className="flex-1 w-full">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                {isLoading ? "Loading chart..." : "No data available"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 5, right: 20, bottom: 25, left: -20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e7eb"
                  />
                  <XAxis
                    dataKey="day"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      boxShadow:
                        "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "20px" }} />
                  <Line
                    type="monotone"
                    dataKey="normal"
                    name="Normal Results"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="abnormal"
                    name="Abnormal Results"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}