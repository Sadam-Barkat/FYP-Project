"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ADMIN_DASHBOARD_REALTIME_EVENTS,
  useRealtimeEvent,
} from "@/hooks/useRealtimeEvent";
import {
  BedSingle,
  DollarSign,
  UserSquare2,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { MetricKpiCard, TooltipRow } from "@/components/dashboard/MetricHoverCard";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = getApiBaseUrl();

interface ActivePatients {
  total: number;
  icu: number;
  emergency: number;
  general_ward: number;
  cardiology: number;
}

interface AdmissionTrendPoint {
  date: string;
  admissions: number;
}

interface BedOccupancyDepartment {
  department: string;
  occupied: number;
  total: number;
}

interface HospitalOverview {
  total_beds: number;
  active_patients: ActivePatients;
  todays_revenue: number;
  doctors_on_duty: number;
  emergency_cases: number;
  critical_condition_cases: number;
  icu_occupancy: number;
  admission_trend: AdmissionTrendPoint[];
  bed_occupancy_by_department: BedOccupancyDepartment[];
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<HospitalOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const fetchOverview = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const query = selectedDate ? `?date=${selectedDate}` : "";
      const res = await fetch(`${API_BASE}/api/hospital-overview${query}`);
      if (!res.ok) {
        throw new Error("Failed to load hospital overview");
      }
      const data: HospitalOverview = await res.json();
      setOverview(data);
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 15000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  useRealtimeEvent(ADMIN_DASHBOARD_REALTIME_EVENTS, fetchOverview);

  const totalBeds = overview?.total_beds ?? 0;
  const active = overview?.active_patients;
  const todaysRevenue = overview?.todays_revenue ?? 0;
  const doctorsOnDuty = overview?.doctors_on_duty ?? 0;
  const emergencyCases = overview?.emergency_cases ?? 0;
  const criticalConditionCases = overview?.critical_condition_cases ?? 0;
  const icuOccupancy = overview?.icu_occupancy ?? 0;
  const admissionTrend = overview?.admission_trend ?? [];
  const bedOccupancyByDept = overview?.bed_occupancy_by_department ?? [];

  const occupiedBeds = bedOccupancyByDept.reduce((acc, r) => acc + (r?.occupied ?? 0), 0);
  const availableBeds = Math.max(totalBeds - occupiedBeds, 0);

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
      {/* Title */}
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="text-center md:text-left">
          <h2 className="text-2xl font-semibold text-[#0088cc] sm:text-3xl">Hospital Overview</h2>
          {isLoading && (
            <p className="mt-2 text-sm text-gray-500" data-hide-in-pdf>Loading hospital overview...</p>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-500" data-hide-in-pdf>{error}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
          <label className="text-sm text-gray-600" htmlFor="overview-date">
            Select date
          </label>
          <input
            id="overview-date"
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
          borderLeftClass="border-l-4 border-l-[#22c55e]"
          minHeightClass="min-h-[180px]"
          icon={<BedSingle className="absolute top-4 left-4 text-[#3b82f6]" size={24} />}
          label="Total Beds"
          value={
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">
              {totalBeds}
            </h3>
          }
          tooltipTitle="Bed capacity snapshot"
          tooltipContent={
            <>
              <TooltipRow label="Occupied" value={occupiedBeds} />
              <TooltipRow label="Available" value={availableBeds} />
              <p className="pt-1 text-xs text-gray-500 dark:text-gray-400">
                Hover cards to see quick details (PowerBI-style).
              </p>
            </>
          }
        />

        {/* Active Patients (compact; details on hover) */}
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#f97316]"
          minHeightClass="min-h-[180px]"
          icon={<UserSquare2 className="absolute top-4 left-4 text-[#f97316]" size={24} />}
          label="Active Patients"
          value={
            <h3 className="text-4xl font-bold text-[#f97316] mt-3">
              {active?.total ?? 0}
            </h3>
          }
          tooltipTitle="Active patients by department"
          tooltipContent={
            <>
              <TooltipRow label="ICU" value={active?.icu ?? 0} />
              <TooltipRow label="Emergency" value={active?.emergency ?? 0} />
              <TooltipRow label="General" value={active?.general_ward ?? 0} />
              <TooltipRow label="Cardiology" value={active?.cardiology ?? 0} />
            </>
          }
        />

        {/* Today's Revenue */}
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#22c55e]"
          minHeightClass="min-h-[180px]"
          icon={<DollarSign className="absolute top-4 left-4 text-[#eab308]" size={24} />}
          label="Today&apos;s Revenue"
          value={
            <h3 className="text-3xl font-bold text-[#eab308] mt-3">
              PKR{" "}
              {Math.round(todaysRevenue).toLocaleString("en-PK", {
                maximumFractionDigits: 0,
              })}
            </h3>
          }
          tooltipTitle="Revenue details"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <TooltipRow
                label="Exact"
                value={`PKR ${todaysRevenue.toLocaleString("en-PK", {
                  maximumFractionDigits: 2,
                })}`}
              />
              <p className="pt-1 text-xs text-gray-500 dark:text-gray-400">
                Total of paid invoices for the selected day.
              </p>
            </>
          }
        />

        {/* Doctors on Duty */}
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#22c55e]"
          minHeightClass="min-h-[180px]"
          icon={<UserSquare2 className="absolute top-4 left-4 text-[#14b8a6]" size={24} />}
          label="Doctors on Duty"
          value={
            <h3 className="text-4xl font-bold text-[#14b8a6] mt-3">
              {doctorsOnDuty}
            </h3>
          }
          tooltipTitle="What this means"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Count of doctors marked present (attendance) for the selected date.
              </p>
            </>
          }
        />
      </div>

      {/* Bottom Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Emergency Cases */}
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#ef4444]"
          icon={
            <AlertTriangle
              className="absolute top-4 left-4 text-[#ef4444]"
              fill="#fecaca"
              size={24}
            />
          }
          label="Emergency Cases"
          value={
            <h3 className="text-4xl font-bold text-[#ef4444] mt-3">
              {emergencyCases}
            </h3>
          }
          tooltipTitle="Definition"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Critical-severity alerts created on this day.
              </p>
            </>
          }
        />

        {/* Critical Condition */}
        <MetricKpiCard
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
          tooltipTitle="Definition"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                High-severity alerts created on this day.
              </p>
            </>
          }
        />

        {/* ICU Occupancy */}
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#a855f7]"
          icon={<TrendingUp className="absolute top-4 left-4 text-[#a855f7]" size={24} />}
          label="ICU Occupancy"
          value={
            <h3 className="text-4xl font-bold text-[#a855f7] mt-3">
              {Math.round(icuOccupancy)}%
            </h3>
          }
          tooltipTitle="ICU utilization"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ICU occupied beds ÷ total ICU beds for the selected day.
              </p>
            </>
          }
        />

        {/* Empty slots to match layout visually if needed, or charts can go here */}
        <div className="lg:col-span-2 hidden lg:block"></div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col">
          <p className="font-semibold text-gray-800 mb-2">Patient Admission Trend</p>
          <div className="flex-1 w-full">
            {admissionTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                {isLoading ? "Loading chart..." : "No data available"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={admissionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="admissions"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col">
          <p className="font-semibold text-gray-800 mb-2">Bed Occupancy by Department</p>
          <div className="flex-1 w-full">
            {bedOccupancyByDept.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                {isLoading ? "Loading chart..." : "No data available"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={bedOccupancyByDept}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="occupied" name="Occupied" fill="#3b82f6" />
                  <Bar dataKey="total" name="Total" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
