"use client";

import { useState, useEffect } from "react";
import { mockStaff, mockAttendanceTrend } from "@/lib/mockData";
import { Users, UserX, Clock, Stethoscope } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

export default function HRStaffPage() {
  const [staffData, setStaffData] = useState(mockStaff);

  // Fake real-time updates for staff status
  useEffect(() => {
    const interval = setInterval(() => {
      setStaffData(prev => {
        const newData = [...prev];
        // Randomly change a status for demo purposes
        if (Math.random() > 0.85) {
          const idx = Math.floor(Math.random() * newData.length);
          newData[idx] = { 
            ...newData[idx], 
            status: newData[idx].status === "On Duty" ? "Off Duty" : "On Duty" 
          };
        }
        return newData;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const onDutyCount = staffData.filter(s => s.status === "On Duty").length;
  const offDutyCount = staffData.filter(s => s.status === "Off Duty").length;
  const onLeaveCount = staffData.filter(s => s.status === "On Leave").length;

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-semibold text-[#0066cc]">HR & Staff Overview</h2>
      </div>

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Stethoscope className="absolute top-4 left-4 text-[#22c55e]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Staff On Duty</p>
            <h3 className="text-4xl font-bold text-[#22c55e] mt-3">{onDutyCount}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Currently active in hospital</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#3b82f6] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Clock className="absolute top-4 left-4 text-[#3b82f6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Active Shifts</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">45</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Across all departments</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <UserX className="absolute top-4 left-4 text-[#f97316]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Absent Today</p>
            <h3 className="text-4xl font-bold text-[#f97316] mt-3">3</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Requires cover assignment</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#a855f7] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Users className="absolute top-4 left-4 text-[#a855f7]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">On Leave</p>
            <h3 className="text-4xl font-bold text-[#a855f7] mt-3">{onLeaveCount}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Approved vacations/sick leave</p>
        </div>
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
                  <tr key={person.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-2 text-sm font-medium text-gray-900">{person.name}</td>
                    <td className="py-3 px-2 text-sm text-gray-700">{person.role}</td>
                    <td className="py-3 px-2 text-sm text-gray-500">{person.department}</td>
                    <td className="py-3 px-2 text-right">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-block min-w-[70px] text-center ${
                        person.status === 'On Duty' ? 'bg-green-100 text-green-700' :
                        person.status === 'On Leave' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {person.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart Area */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px] flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">Attendance Trend (Past 5 Days)</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockAttendanceTrend} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 5']} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Area type="monotone" dataKey="present" name="Present" stroke="#22c55e" fillOpacity={1} fill="url(#colorPresent)" />
                <Area type="monotone" dataKey="absent" name="Absent" stroke="#ef4444" fillOpacity={0} />
                <Area type="monotone" dataKey="late" name="Late" stroke="#f97316" fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}