"use client";

import { useState, useEffect } from "react";
import { Users, UserX, Clock, Stethoscope } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { MetricKpiCard, TooltipRow } from "@/components/dashboard/MetricHoverCard";

type StaffRow = {
  name: string;
  role: string;
  department: string;
  status: string;
};

type AttendancePoint = {
  date: string;
  present: number;
  absent: number;
  late: number;
};

type HrStaffOverview = {
  staff_on_duty: number;
  active_shifts: number;
  absent_today: number;
  on_leave: number;
  live_staff_status: StaffRow[];
  attendance_trend: {
    date: string;
    present: number;
    absent: number;
    leave: number;
  }[];
  selected_date: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function HRStaffPage() {
  const [overview, setOverview] = useState<HrStaffOverview | null>(null);
  const [chartData, setChartData] = useState<AttendancePoint[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async (dateValue: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/api/hr-staff-overview?date=${dateValue}`);
      if (!res.ok) {
        throw new Error(`Failed to load HR & Staff data (status ${res.status})`);
      }

      const data: HrStaffOverview = await res.json();
      setOverview(data);

      // Map backend "leave" into chart's "late" series to match UI labels
      const mappedTrend: AttendancePoint[] =
        data.attendance_trend?.map((point) => ({
          date: point.date,
          present: point.present,
          absent: point.absent,
          late: point.leave,
        })) ?? [];
      setChartData(mappedTrend);
    } catch (err: any) {
      console.error("Error fetching HR & Staff overview:", err);
      setError(err.message ?? "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview(selectedDate);

    const interval = setInterval(() => {
      fetchOverview(selectedDate);
    }, 30000); // refresh every 30 seconds

    return () => clearInterval(interval);
  }, [selectedDate]);

  const staffData = overview?.live_staff_status ?? [];
  const onDutyCount = overview?.staff_on_duty ?? 0;
  const onLeaveCount = overview?.on_leave ?? 0;
  const absentToday = overview?.absent_today ?? 0;
  const activeShifts = overview?.active_shifts ?? 0;

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <h2 className="text-3xl font-semibold text-[#0066cc] text-center md:text-left">
          HR & Staff Overview
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor="hr-date" className="text-sm text-gray-600">
            Select date:
          </label>
          <input
            id="hr-date"
            type="date"
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {isLoading && !overview && (
        <p className="text-sm text-gray-500">Loading HR & staff data...</p>
      )}
      {error && (
        <p className="text-sm text-red-500">Failed to load data: {error}</p>
      )}

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#22c55e]"
          icon={<Stethoscope className="absolute top-4 left-4 text-[#22c55e]" size={24} />}
          label="Staff On Duty"
          value={<h3 className="text-4xl font-bold text-[#22c55e] mt-3">{onDutyCount}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Currently active in hospital</p>}
          tooltipTitle="On-duty context"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <TooltipRow label="Active shifts" value={activeShifts} />
            </>
          }
        />

        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#3b82f6]"
          icon={<Clock className="absolute top-4 left-4 text-[#3b82f6]" size={24} />}
          label="Active Shifts"
          value={<h3 className="text-4xl font-bold text-[#3b82f6] mt-3">{activeShifts}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Across all departments</p>}
          tooltipTitle="Shift note"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Active shifts reflect currently scheduled working sessions.
              </p>
            </>
          }
        />

        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#f97316]"
          icon={<UserX className="absolute top-4 left-4 text-[#f97316]" size={24} />}
          label="Absent Today"
          value={<h3 className="text-4xl font-bold text-[#f97316] mt-3">{absentToday}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Requires cover assignment</p>}
          tooltipTitle="Absence context"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <TooltipRow label="On leave" value={onLeaveCount} />
            </>
          }
        />

        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#a855f7]"
          icon={<Users className="absolute top-4 left-4 text-[#a855f7]" size={24} />}
          label="On Leave"
          value={<h3 className="text-4xl font-bold text-[#a855f7] mt-3">{onLeaveCount}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Approved vacations/sick leave</p>}
          tooltipTitle="Leave note"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Leave includes approved vacation and sick leave entries.
              </p>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Table Area */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px] flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">Live Staff Status</h3>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500 sticky top-0 bg-white">
                  <th className="pb-3 font-medium px-2">Name</th>
                  <th className="pb-3 font-medium px-2">Role</th>
                  <th className="pb-3 font-medium px-2">Dept</th>
                  <th className="pb-3 font-medium px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {staffData.map((person) => (
                  <tr
                    key={`${person.name}-${person.department}`}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-2 text-sm font-medium text-gray-900">{person.name}</td>
                    <td className="py-3 px-2 text-sm text-gray-700">{person.role}</td>
                    <td className="py-3 px-2 text-sm text-gray-500">{person.department}</td>
                    <td className="py-3 px-2 text-right">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium inline-block min-w-[70px] text-center ${
                          person.status === "On Duty"
                            ? "bg-green-100 text-green-700"
                            : person.status === "On Leave"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {person.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {staffData.length === 0 && !isLoading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 text-sm text-gray-500 text-center"
                    >
                      No staff records found for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart Area */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px] flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">
            Attendance Trend (Past 5 Days)
          </h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, bottom: 20, left: -20 }}
              >
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="date"
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
                  domain={["dataMin - 1", "dataMax + 2"]}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "10px" }} />
                <Area
                  type="monotone"
                  dataKey="present"
                  name="Present"
                  stroke="#22c55e"
                  fillOpacity={1}
                  fill="url(#colorPresent)"
                />
                <Area
                  type="monotone"
                  dataKey="absent"
                  name="Absent"
                  stroke="#ef4444"
                  fillOpacity={0}
                />
                <Area
                  type="monotone"
                  dataKey="late"
                  name="Late"
                  stroke="#f97316"
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}