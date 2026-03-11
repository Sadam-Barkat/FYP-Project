"use client";

import { useState, useEffect } from "react";
import { DollarSign, FileText, AlertCircle, Banknote } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type Invoice = {
  invoice_id: string;
  patient: string;
  date: string;
  amount: number;
  status: string;
};

type RevenueVsExpensesPoint = {
  day: string;
  revenue: number;
  expenses: number;
};

type BillingFinanceOverview = {
  todays_revenue: number;
  outstanding_balance: number;
  insurance_claims: number;
  todays_expenses: number;
  recent_invoices: Invoice[];
  revenue_vs_expenses: RevenueVsExpensesPoint[];
  selected_date: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function formatToK(amount: number): string {
  if (!amount || isNaN(amount)) return "0K";
  return `${Math.round(amount / 1000)}K`;
}

export default function BillingFinancePage() {
  const [overview, setOverview] = useState<BillingFinanceOverview | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async (dateValue: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const url = `${API_BASE}/api/billing-finance-overview?date=${dateValue}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Failed to load billing & finance data (status ${res.status})`);
      }

      const data: BillingFinanceOverview = await res.json();
      setOverview(data);
    } catch (err: any) {
      console.error("Error fetching billing & finance overview:", err);
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

  const invoices = overview?.recent_invoices ?? [];
  const revenueTrend = overview?.revenue_vs_expenses ?? [];

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <h2 className="text-3xl font-semibold text-[#0066cc] text-center md:text-left">
          Billing & Finance Overview
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="billing-date">
            Select date:
          </label>
          <input
            id="billing-date"
            type="date"
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {isLoading && !overview && (
        <p className="text-sm text-gray-500">Loading billing & finance data...</p>
      )}
      {error && (
        <p className="text-sm text-red-500">Failed to load data: {error}</p>
      )}

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <DollarSign className="absolute top-4 left-4 text-[#22c55e]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Today&apos;s Revenue</p>
            <h3 className="text-4xl font-bold text-[#22c55e] mt-3">
              {formatToK(overview?.todays_revenue ?? 0)}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Based on paid invoices</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <AlertCircle className="absolute top-4 left-4 text-[#f97316]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Outstanding Balance</p>
            <h3 className="text-4xl font-bold text-[#f97316] mt-3">
              {formatToK(overview?.outstanding_balance ?? 0)}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Pending payments up to this date</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#3b82f6] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <FileText className="absolute top-4 left-4 text-[#3b82f6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Insurance Claims</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">
              {overview?.insurance_claims ?? 0}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">On selected date</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#a855f7] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Banknote className="absolute top-4 left-4 text-[#a855f7]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Today&apos;s Expenses</p>
            <h3 className="text-4xl font-bold text-[#a855f7] mt-3">
              {formatToK(overview?.todays_expenses ?? 0)}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Approx. 30% of revenue</p>
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
                  <tr key={inv.invoice_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-2 text-sm text-gray-700 font-mono">{inv.invoice_id}</td>
                    <td className="py-3 px-2 text-sm font-medium text-gray-900">{inv.patient}</td>
                    <td className="py-3 px-2 text-sm text-gray-500">{inv.date}</td>
                    <td className="py-3 px-2 text-sm font-semibold text-gray-700 text-right">
                      PKR {inv.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium inline-block min-w-[70px] ${
                          inv.status.toLowerCase() === "paid"
                            ? "bg-green-100 text-green-700"
                            : inv.status.toLowerCase().includes("insurance")
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="py-4 text-sm text-gray-500 text-center">
                      No invoices found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart Area */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
          <h3 className="font-semibold text-gray-800 mb-4">Revenue vs Expenses</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart
                data={revenueTrend}
                margin={{ top: 10, right: 10, bottom: 20, left: -20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
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
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "10px" }} />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}