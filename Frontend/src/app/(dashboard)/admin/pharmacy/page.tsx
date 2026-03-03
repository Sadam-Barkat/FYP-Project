"use client";

import { useState, useEffect } from "react";
import { mockPharmacyStock, mockPharmacyTrend } from "@/lib/mockData";
import { Pill, AlertCircle, CheckCircle2, PackageX, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

export default function PharmacyPage() {
  const [stockData, setStockData] = useState(mockPharmacyStock);
  const [trendData, setTrendData] = useState(mockPharmacyTrend);

  // Fake real-time updates for stock changes
  useEffect(() => {
    const interval = setInterval(() => {
      setStockData(prev => prev.map(item => {
        if (Math.random() > 0.8) {
          // Slight depletion
          const newQty = Math.max(0, item.quantity - 1);
          return {
            ...item,
            quantity: newQty,
            status: newQty < item.reorderLevel ? (newQty < 10 ? "Critical" : "Low") : "Good"
          };
        }
        return item;
      }));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const criticalItems = stockData.filter(item => item.status === "Critical").length;
  const lowItems = stockData.filter(item => item.status === "Low").length;

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-semibold text-[#0066cc]">Pharmacy Overview</h2>
      </div>

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#3b82f6] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Pill className="absolute top-4 left-4 text-[#3b82f6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Total Medications</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">3,240</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">In inventory</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <CheckCircle2 className="absolute top-4 left-4 text-[#22c55e]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Healthy Stock</p>
            <h3 className="text-4xl font-bold text-[#22c55e] mt-3">85%</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Above reorder level</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <PackageX className="absolute top-4 left-4 text-[#f97316]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Low Stock Items</p>
            <h3 className="text-4xl font-bold text-[#f97316] mt-3">{lowItems}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-[#f97316] font-medium">Needs reorder</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#ef4444] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <AlertCircle className="absolute top-4 left-4 text-[#ef4444]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Critical Shortage</p>
            <h3 className="text-4xl font-bold text-[#ef4444] mt-3">{criticalItems}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-red-500 font-medium">Action required immediately</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Table Area */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">Critical & Low Stock Inventory</h3>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium px-2">Medication ID</th>
                  <th className="pb-3 font-medium px-2">Name</th>
                  <th className="pb-3 font-medium px-2 text-right">Quantity</th>
                  <th className="pb-3 font-medium px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {stockData.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-2 text-sm text-gray-700">{item.id}</td>
                    <td className="py-3 px-2 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="py-3 px-2 text-sm text-gray-700 text-right">
                      {item.quantity} <span className="text-xs text-gray-500">{item.unit}</span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-block min-w-[70px] ${
                        item.status === 'Good' ? 'bg-green-100 text-green-700' :
                        item.status === 'Low' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700 animate-pulse'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart Area */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
          <h3 className="font-semibold text-gray-800 mb-4">Dispensed vs Received (Monthly)</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="colorDispensed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Area type="monotone" dataKey="dispensed" name="Dispensed" stroke="#f97316" fillOpacity={1} fill="url(#colorDispensed)" />
                <Area type="monotone" dataKey="received" name="Received" stroke="#3b82f6" fillOpacity={1} fill="url(#colorReceived)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}