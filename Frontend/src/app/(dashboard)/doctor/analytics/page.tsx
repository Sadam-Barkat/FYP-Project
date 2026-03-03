"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { mockDoctorAnalytics } from "@/lib/mockData";
import { 
  Users, CheckCircle, Clock, TrendingUp, 
  BellRing, ChevronDown, Activity, ArrowLeft
} from "lucide-react";
import { 
  PieChart, Pie, Cell, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer 
} from "recharts";

export default function DoctorAnalyticsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState(mockDoctorAnalytics);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnalytics((prev) => ({
        ...prev,
        totalTreated: prev.totalTreated + (Math.random() > 0.8 ? 1 : 0),
        discharges: prev.discharges + (Math.random() > 0.8 ? 1 : 0),
        alertsResolved: prev.alertsResolved + (Math.random() > 0.7 ? 1 : 0),
      }));
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  const pieData = [
    { name: 'Normal', value: analytics.conditions.normal, color: '#10b981' },
    { name: 'Critical', value: analytics.conditions.critical, color: '#f59e0b' },
    { name: 'Emergency', value: analytics.conditions.emergency, color: '#ef4444' },
  ];

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-gray-200 pb-4">
        <button 
          onClick={() => router.back()}
          className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors mt-1"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-3xl font-semibold text-[#1e40af]">My Performance Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">Overview of treated patients and metrics.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Treated</span>
            <Users size={18} className="text-[#1e40af]" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.totalTreated}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Discharges</span>
            <CheckCircle size={18} className="text-[#10b981]" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.discharges}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Recovery</span>
            <Clock size={18} className="text-[#8b5cf6]" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {analytics.avgRecovery} <span className="text-base font-medium text-gray-500">days</span>
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Recovery Rate</span>
            <TrendingUp size={18} className="text-[#10b981]" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.recoveryRate}%</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Alerts Resolved</span>
            <BellRing size={18} className="text-[#f59e0b]" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.alertsResolved}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Condition Split</span>
            <Activity size={18} className="text-[#0ea5e9]" />
          </div>
          <div className="flex flex-col gap-1 text-xs font-medium text-gray-600 mt-1">
            <div className="flex justify-between"><span className="text-[#10b981]">Normal</span><span>{analytics.conditions.normal}%</span></div>
            <div className="flex justify-between"><span className="text-[#f59e0b]">Critical</span><span>{analytics.conditions.critical}%</span></div>
            <div className="flex justify-between"><span className="text-[#ef4444]">Emergency</span><span>{analytics.conditions.emergency}%</span></div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-[350px]">
          <h3 className="font-semibold text-gray-800 mb-4">Treatment Trend (Last 5 Weeks)</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={analytics.treatmentTrend} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="week" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="count" name="Patients Treated" stroke="#1e40af" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-[350px]">
          <h3 className="font-semibold text-gray-800 mb-4">Patient Condition Distribution</h3>
          <div className="flex-1 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Discharges */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Recent Discharges</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-sm text-gray-500">
                <th className="py-3 px-4 font-medium">Patient Name</th>
                <th className="py-3 px-4 font-medium">Discharge Date</th>
                <th className="py-3 px-4 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentDischarges.map((discharge, idx) => (
                <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{discharge.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{discharge.date}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                      discharge.outcome === 'Recovered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {discharge.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="w-full mt-4 flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          View all discharges <ChevronDown size={16} />
        </button>
      </div>
    </div>
  );
}
