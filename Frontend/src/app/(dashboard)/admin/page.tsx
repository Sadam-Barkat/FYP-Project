"use client";

import { useEffect, useState } from "react";
import {
  BedSingle,
  DollarSign,
  UserSquare2,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

  useEffect(() => {
    let isMounted = true;

    const fetchOverview = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const query = selectedDate ? `?date=${selectedDate}` : "";
        const res = await fetch(`${API_BASE}/api/hospital-overview${query}`);
        if (!res.ok) {
          throw new Error("Failed to load hospital overview");
        }
        const data: HospitalOverview = await res.json();
        if (isMounted) {
          setOverview(data);
        }
      } catch (err) {
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
    const interval = setInterval(fetchOverview, 15000); // refresh every 15 seconds for selected date

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedDate]);

  const totalBeds = overview?.total_beds ?? 0;
  const active = overview?.active_patients;
  const todaysRevenue = overview?.todays_revenue ?? 0;
  const doctorsOnDuty = overview?.doctors_on_duty ?? 0;
  const emergencyCases = overview?.emergency_cases ?? 0;
  const icuOccupancy = overview?.icu_occupancy ?? 0;
  const admissionTrend = overview?.admission_trend ?? [];
  const bedOccupancyByDept = overview?.bed_occupancy_by_department ?? [];

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-4 gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-semibold text-[#0088cc]">Hospital Overview</h2>
          {isLoading && (
            <p className="mt-2 text-sm text-gray-500" data-hide-in-pdf>Loading hospital overview...</p>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-500" data-hide-in-pdf>{error}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
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
        {/* Total Beds */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[180px]">
          <BedSingle className="absolute top-4 left-4 text-[#3b82f6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Total Beds</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">
              {totalBeds}
            </h3>
          </div>
          <ChevronDown className="text-gray-300 mt-4" size={20} data-hide-in-pdf aria-hidden />
        </div>

        {/* Active Patients Details (Expanded) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 min-h-[180px] flex flex-col relative">
          <h3 className="text-[#22c55e] font-semibold text-lg mb-3">
            Active Patients Details
          </h3>
          <ul className="space-y-1.5 text-sm text-gray-700 flex-1">
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
              Total active patients: {active?.total ?? 0}
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
              ICU: {active?.icu ?? 0} patients
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
              Emergency: {active?.emergency ?? 0} patients
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
              General ward: {active?.general_ward ?? 0} patients
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
              Cardiology: {active?.cardiology ?? 0} patients
            </li>
          </ul>
          <p className="text-xs text-gray-400 italic text-center mt-2 cursor-pointer hover:text-gray-600" data-hide-in-pdf>
            Click to collapse
          </p>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[180px]">
          <DollarSign className="absolute top-4 left-4 text-[#eab308]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Today&apos;s Revenue</p>
            <h3 className="text-3xl font-bold text-[#eab308] mt-3">
              PKR{" "}
              {Math.round(todaysRevenue).toLocaleString("en-PK", {
                maximumFractionDigits: 0,
              })}
            </h3>
          </div>
          <ChevronDown className="text-gray-300 mt-4 cursor-pointer hover:text-gray-400" size={20} data-hide-in-pdf aria-hidden />
        </div>

        {/* Doctors on Duty */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[180px]">
          <UserSquare2 className="absolute top-4 left-4 text-[#14b8a6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Doctors on Duty</p>
            <h3 className="text-4xl font-bold text-[#14b8a6] mt-3">
              {doctorsOnDuty}
            </h3>
          </div>
          <ChevronDown className="text-gray-300 mt-4 cursor-pointer hover:text-gray-400" size={20} data-hide-in-pdf aria-hidden />
        </div>
      </div>

      {/* Bottom Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Emergency Cases */}
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
          <ChevronDown className="text-gray-300 mt-4 cursor-pointer hover:text-gray-400" size={20} data-hide-in-pdf aria-hidden />
        </div>

        {/* ICU Occupancy */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#a855f7] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <TrendingUp className="absolute top-4 left-4 text-[#a855f7]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">ICU Occupancy</p>
            <h3 className="text-4xl font-bold text-[#a855f7] mt-3">
              {Math.round(icuOccupancy)}%
            </h3>
          </div>
          <ChevronDown className="text-gray-300 mt-4 cursor-pointer hover:text-gray-400" size={20} data-hide-in-pdf aria-hidden />
        </div>

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
