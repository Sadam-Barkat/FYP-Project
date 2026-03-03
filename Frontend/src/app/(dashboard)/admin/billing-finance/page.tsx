"use client";

import { useState, useEffect } from "react";
import { mockInvoices, mockRevenueTrend } from "@/lib/mockData";
import { DollarSign, FileText, Activity, AlertCircle, Banknote } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

export default function BillingFinancePage() {
  const [invoices, setInvoices] = useState(mockInvoices);

  // Fake real-time updates for invoices
  useEffect(() => {
    const interval = setInterval(() => {
      setInvoices(prev => {
        const newInvoices = [...prev];
        // Randomly "pay" a pending invoice
        const pendingIndex = newInvoices.findIndex(inv => inv.status === "Pending");
        if (pendingIndex !== -1 && Math.random() > 0.8) {
          newInvoices[pendingIndex] = { ...newInvoices[pendingIndex], status: "Paid" };
        }
        return newInvoices;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-semibold text-[#0066cc]">Billing & Finance Overview</h2>
      </div>

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <DollarSign className="absolute top-4 left-4 text-[#22c55e]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Today's Revenue</p>
            <h3 className="text-4xl font-bold text-[#22c55e] mt-3">85K</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">+12% vs yesterday</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <AlertCircle className="absolute top-4 left-4 text-[#f97316]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Outstanding Balance</p>
            <h3 className="text-4xl font-bold text-[#f97316] mt-3">320K</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">From 45 patients</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#3b82f6] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <FileText className="absolute top-4 left-4 text-[#3b82f6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Insurance Claims</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">28</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Pending approval</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#a855f7] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Banknote className="absolute top-4 left-4 text-[#a855f7]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Today's Expenses</p>
            <h3 className="text-4xl font-bold text-[#a855f7] mt-3">42K</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Operational costs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Table Area */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Invoices</h3>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium px-2">Invoice ID</th>
                  <th className="pb-3 font-medium px-2">Patient</th>
                  <th className="pb-3 font-medium px-2">Date</th>
                  <th className="pb-3 font-medium px-2 text-right">Amount</th>
                  <th className="pb-3 font-medium px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-2 text-sm text-gray-700 font-mono">{inv.id}</td>
                    <td className="py-3 px-2 text-sm font-medium text-gray-900">{inv.patient}</td>
                    <td className="py-3 px-2 text-sm text-gray-500">{inv.date}</td>
                    <td className="py-3 px-2 text-sm font-semibold text-gray-700 text-right">{inv.amount}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-block min-w-[70px] ${
                        inv.status === 'Paid' ? 'bg-green-100 text-green-700' :
                        inv.status === 'Insurance' ? 'bg-blue-100 text-blue-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {inv.status}
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
          <h3 className="font-semibold text-gray-800 mb-4">Revenue vs Expenses</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockRevenueTrend} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}