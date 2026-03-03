"use client";

import { useState, useEffect } from "react";
import { mockBedsData, mockAdmissionsTrend } from "@/lib/mockData";
import { BedSingle, UserPlus, UserMinus, AlertTriangle, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

export default function PatientsBedsPage() {
  const [bedsData, setBedsData] = useState(mockBedsData);
  const [admissionsTrend, setAdmissionsTrend] = useState(mockAdmissionsTrend);
  
  // Fake real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setBedsData(prev => prev.map(dept => {
        if (Math.random() > 0.7) {
          const change = Math.random() > 0.5 ? 1 : -1;
          const newOccupied = Math.max(0, Math.min(dept.total, dept.occupied + change));
          return { ...dept, occupied: newOccupied };
        }
        return dept;
      }));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const totalBeds = bedsData.reduce((acc, curr) => acc + curr.total, 0);
  const totalOccupied = bedsData.reduce((acc, curr) => acc + curr.occupied, 0);
  const occupancyRate = Math.round((totalOccupied / totalBeds) * 100);

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-semibold text-[#0066cc]">Patients & Beds Overview</h2>
      </div>

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Beds */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <BedSingle className="absolute top-4 left-4 text-[#3b82f6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Total Capacity</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">{totalBeds}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Total hospital beds</p>
        </div>

        {/* Occupied Beds */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <UserPlus className="absolute top-4 left-4 text-[#f97316]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Occupied Beds</p>
            <h3 className="text-4xl font-bold text-[#f97316] mt-3">{totalOccupied}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">{occupancyRate}% overall occupancy</p>
        </div>

        {/* Available Beds */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <UserMinus className="absolute top-4 left-4 text-[#22c55e]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Available Beds</p>
            <h3 className="text-4xl font-bold text-[#22c55e] mt-3">{totalBeds - totalOccupied}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Ready for admission</p>
        </div>

        {/* Critical/Emergency */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#ef4444] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <AlertTriangle className="absolute top-4 left-4 text-[#ef4444]" fill="#fecaca" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Emergency Cases</p>
            <h3 className="text-4xl font-bold text-[#ef4444] mt-3">7</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-red-500 font-medium">High priority</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">Bed Occupancy by Department</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bedsData} margin={{ top: 5, right: 20, bottom: 25, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="department" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="occupied" name="Occupied" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" name="Total Capacity" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">Admissions & Discharges Trend (Past Week)</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={admissionsTrend} margin={{ top: 5, right: 20, bottom: 25, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="admissions" name="Admissions" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="discharges" name="Discharges" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}