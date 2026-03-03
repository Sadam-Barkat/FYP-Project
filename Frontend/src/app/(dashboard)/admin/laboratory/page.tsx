"use client";

import { useState, useEffect } from "react";
import { mockLabTests, mockLabTrend } from "@/lib/mockData";
import { TestTube2, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

export default function LaboratoryPage() {
  const [labTests, setLabTests] = useState(mockLabTests);

  // Fake real-time updates for lab tests completed/pending
  useEffect(() => {
    const interval = setInterval(() => {
      setLabTests(prev => prev.map(test => {
        if (Math.random() > 0.7 && test.pending > 0) {
          return {
            ...test,
            pending: test.pending - 1,
            completed: test.completed + 1
          };
        } else if (Math.random() > 0.9) {
          return {
            ...test,
            pending: test.pending + 1
          };
        }
        return test;
      }));
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const totalPending = labTests.reduce((acc, curr) => acc + curr.pending, 0);
  const totalCompleted = labTests.reduce((acc, curr) => acc + curr.completed, 0);

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-semibold text-[#0066cc]">Laboratory Overview</h2>
      </div>

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Clock className="absolute top-4 left-4 text-[#f97316]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Pending Tests</p>
            <h3 className="text-4xl font-bold text-[#f97316] mt-3">{totalPending}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4 animate-pulse">Processing in lab...</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <CheckCircle className="absolute top-4 left-4 text-[#22c55e]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Completed Today</p>
            <h3 className="text-4xl font-bold text-[#22c55e] mt-3">{totalCompleted}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Results delivered</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#3b82f6] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <TestTube2 className="absolute top-4 left-4 text-[#3b82f6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Active Technicians</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">8</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">On duty currently</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#ef4444] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <AlertTriangle className="absolute top-4 left-4 text-[#ef4444]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Critical Results</p>
            <h3 className="text-4xl font-bold text-[#ef4444] mt-3">4</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-red-500 font-medium">Require immediate doctor review</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Test Types Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">Daily Test Volume by Category</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={labTests} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="type" type="category" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Trend Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">Weekly Result Trends (Normal vs Abnormal)</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockLabTrend} margin={{ top: 5, right: 20, bottom: 25, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="normal" name="Normal Results" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="abnormal" name="Abnormal Results" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}