"use client";

import { useState, useEffect } from "react";
import { BedSingle, UserPlus, UserMinus, AlertTriangle } from "lucide-react";
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
  occupied_beds: number;
  occupancy_percentage: number;
  available_beds: number;
  emergency_cases: number;
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

  useEffect(() => {
    let isMounted = true;

    const fetchOverview = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const query = selectedDate ? `?date=${selectedDate}` : "";
        const res = await fetch(`${API_BASE}/api/patients-beds-overview${query}`);
        if (!res.ok) {
          throw new Error("Failed to load patients & beds overview");
        }
        const data: PatientsBedsOverview = await res.json();
        if (isMounted) {
          setOverview(data);
        }
      } catch {
        if (isMounted) {
          setError("Failed to load data");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchOverview();
    const interval = setInterval(fetchOverview, 30000); // refresh every 30s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedDate]);

  const bedsData: BedOccupancyDepartment[] =
    overview?.bed_occupancy_by_department ?? [];
  const admissionsTrend: AdmissionsDischargesPoint[] =
    overview?.admissions_discharges_trend ?? [];

  const totalBeds = overview?.total_capacity ?? 0;
  const totalOccupied = overview?.occupied_beds ?? 0;
  const occupancyRate = overview?.occupancy_percentage ?? 0;
  const availableBeds = overview?.available_beds ?? Math.max(totalBeds - totalOccupied, 0);
  const emergencyCases = overview?.emergency_cases ?? 0;

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-4 gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-semibold text-[#0066cc]">
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
        <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Beds */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <BedSingle
            className="absolute top-4 left-4 text-[#3b82f6]"
            size={24}
          />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Total Capacity</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">
              {totalBeds}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Total hospital beds</p>
        </div>

        {/* Occupied Beds */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <UserPlus
            className="absolute top-4 left-4 text-[#f97316]"
            size={24}
          />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Occupied Beds</p>
            <h3 className="text-4xl font-bold text-[#f97316] mt-3">
              {totalOccupied}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            {Math.round(occupancyRate)}% overall occupancy
          </p>
        </div>

        {/* Available Beds */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <UserMinus
            className="absolute top-4 left-4 text-[#22c55e]"
            size={24}
          />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Available Beds</p>
            <h3 className="text-4xl font-bold text-[#22c55e] mt-3">
              {availableBeds}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Ready for admission</p>
        </div>

        {/* Critical/Emergency */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#ef4444] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <AlertTriangle
            className="absolute top-4 left-4 text-[#ef4444]"
            fill="#fecaca"
            size={24}
          />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Emergency Cases</p>
            <h3 className="text-4xl font-bold text-[#ef4444] mt-3">
              {emergencyCases}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-red-500 font-medium">
            High priority
          </p>
        </div>
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