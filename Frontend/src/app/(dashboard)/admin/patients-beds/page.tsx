"use client";

import { useState, useEffect, useCallback } from "react";
import { BedSingle, UserPlus, UserMinus, AlertTriangle, Users } from "lucide-react";
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

interface BedOccupancyDepartment {
  department: string;
  occupied: number;
  total: number;
}

interface AdmissionsDischargesPoint {
  day: string;
  admissions: number;
  discharges: number;
}

interface PatientsBedsOverview {
  total_capacity: number;
  total_patients: number;
  occupied_beds: number;
  occupancy_percentage: number;
  available_beds: number;
  emergency_cases: number;
  critical_condition_cases: number;
  bed_occupancy_by_department: BedOccupancyDepartment[];
  admissions_discharges_trend: AdmissionsDischargesPoint[];
  selected_date: string;
}

export default function PatientsBedsPage() {
  const [overview, setOverview] = useState<PatientsBedsOverview | null>(null);
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
      const res = await fetch(`${API_BASE}/api/patients-beds-overview${query}`);
      if (!res.ok) {
        throw new Error("Failed to load patients & beds overview");
      }
      const data: PatientsBedsOverview = await res.json();
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

  useRealtimeEvent("patients_updated", fetchOverview);

  const bedsData: BedOccupancyDepartment[] =
    overview?.bed_occupancy_by_department ?? [];
  const admissionsTrend: AdmissionsDischargesPoint[] =
    overview?.admissions_discharges_trend ?? [];

  const totalBeds = overview?.total_capacity ?? 0;
  const totalPatients = overview?.total_patients ?? 0;
  const totalOccupied = overview?.occupied_beds ?? 0;
  const occupancyRate = overview?.occupancy_percentage ?? 0;
  const availableBeds = overview?.available_beds ?? Math.max(totalBeds - totalOccupied, 0);
  const emergencyCases = overview?.emergency_cases ?? 0;
  const criticalConditionCases = overview?.critical_condition_cases ?? 0;

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="text-center md:text-left">
          <h2 className="text-2xl font-semibold text-[#0066cc] sm:text-3xl">
            Patients & Beds Overview
          </h2>
          {isLoading && (
            <p className="mt-2 text-sm text-gray-500">
              Loading patients & beds data...
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-500">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
          <label
            className="text-sm text-gray-600"
            htmlFor="patients-beds-date"
          >
            Select date
          </label>
          <input
            id="patients-beds-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-[#3b82f6]"
          />
        </div>
      </div>

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
        {/* Total Patients — tooltips align start so they are not clipped by main overflow-x-hidden / sidebar edge */}
        <MetricKpiCard
          tooltipAlign="start"
          borderLeftClass="border-l-4 border-l-[#6366f1]"
          icon={<Users className="absolute top-4 left-4 text-[#6366f1]" size={24} />}
          label="Total Patients"
          value={<h3 className="text-4xl font-bold text-[#6366f1] mt-3">{totalPatients}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Registered in system</p>}
          tooltipTitle="Patients snapshot"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <TooltipRow label="Emergency cases" value={emergencyCases} />
              <TooltipRow label="Critical condition" value={criticalConditionCases} />
            </>
          }
        />

        {/* Total Beds */}
        <MetricKpiCard
          tooltipAlign="start"
          borderLeftClass="border-l-4 border-l-[#22c55e]"
          icon={<BedSingle className="absolute top-4 left-4 text-[#3b82f6]" size={24} />}
          label="Total Capacity"
          value={<h3 className="text-4xl font-bold text-[#3b82f6] mt-3">{totalBeds}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Total hospital beds</p>}
          tooltipTitle="Capacity breakdown"
          tooltipContent={
            <>
              <TooltipRow label="Occupied" value={totalOccupied} />
              <TooltipRow label="Available" value={availableBeds} />
              <TooltipRow label="Occupancy" value={`${Math.round(occupancyRate)}%`} />
            </>
          }
        />

        {/* Occupied Beds */}
        <MetricKpiCard
          tooltipAlign="start"
          borderLeftClass="border-l-4 border-l-[#f97316]"
          icon={<UserPlus className="absolute top-4 left-4 text-[#f97316]" size={24} />}
          label="Occupied Beds"
          value={<h3 className="text-4xl font-bold text-[#f97316] mt-3">{totalOccupied}</h3>}
          footnote={
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round(occupancyRate)}% overall occupancy
            </p>
          }
          tooltipTitle="Occupancy note"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Occupancy is computed as occupied ÷ total capacity.
              </p>
            </>
          }
        />

        {/* Available Beds */}
        <MetricKpiCard
          tooltipAlign="start"
          borderLeftClass="border-l-4 border-l-[#22c55e]"
          icon={<UserMinus className="absolute top-4 left-4 text-[#22c55e]" size={24} />}
          label="Available Beds"
          value={<h3 className="text-4xl font-bold text-[#22c55e] mt-3">{availableBeds}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Ready for admission</p>}
          tooltipTitle="Availability"
          tooltipContent={
            <>
              <TooltipRow label="Total capacity" value={totalBeds} />
              <TooltipRow label="Occupied" value={totalOccupied} />
            </>
          }
        />

        {/* Emergency Cases */}
        <MetricKpiCard
          tooltipAlign="start"
          borderLeftClass="border-l-4 border-l-[#ef4444]"
          icon={
            <AlertTriangle
              className="absolute top-4 left-4 text-[#ef4444]"
              fill="#fecaca"
              size={24}
            />
          }
          label="Emergency Cases"
          value={<h3 className="text-4xl font-bold text-[#ef4444] mt-3">{emergencyCases}</h3>}
          footnote={
            <p className="text-xs text-gray-500 mt-4 text-red-500 font-medium">
              High priority
            </p>
          }
          tooltipTitle="Definition"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Emergency cases represent patients flagged as urgent for this day.
              </p>
            </>
          }
        />

        {/* Critical Condition */}
        <MetricKpiCard
          tooltipAlign="start"
          borderLeftClass="border-l-4 border-l-[#f59e0b]"
          icon={
            <AlertTriangle
              className="absolute top-4 left-4 text-[#f59e0b]"
              fill="#fef3c7"
              size={24}
            />
          }
          label="Critical Condition"
          value={
            <h3 className="text-4xl font-bold text-[#f59e0b] mt-3">
              {criticalConditionCases}
            </h3>
          }
          footnote={
            <p className="text-xs text-gray-500 mt-4 text-amber-600 font-medium">
              Monitor closely
            </p>
          }
          tooltipTitle="Definition"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Critical condition indicates cases needing close monitoring.
              </p>
            </>
          }
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">
            Bed Occupancy by Department
          </h3>
          <div className="flex-1 w-full">
            {bedsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                {isLoading ? "Loading chart..." : "No data available"}
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
              >
                <BarChart
                  data={bedsData}
                  margin={{ top: 5, right: 20, bottom: 25, left: -20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e7eb"
                  />
                  <XAxis
                    dataKey="department"
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
                  <Bar
                    dataKey="occupied"
                    name="Occupied"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="total"
                    name="Total Capacity"
                    fill="#e5e7eb"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">
            Admissions & Discharges Trend (Past Week)
          </h3>
          <div className="flex-1 w-full">
            {admissionsTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                {isLoading ? "Loading chart..." : "No data available"}
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
              >
                <LineChart
                  data={admissionsTrend}
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
                    dataKey="admissions"
                    name="Admissions"
                    stroke="#f97316"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="discharges"
                    name="Discharges"
                    stroke="#22c55e"
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