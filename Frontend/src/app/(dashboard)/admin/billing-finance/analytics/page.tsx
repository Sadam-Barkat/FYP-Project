"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, DollarSign, FileText, AlertCircle, Banknote } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { MetricKpiCard, TooltipRow } from "@/components/dashboard/MetricHoverCard";
import {
  ADMIN_DASHBOARD_REALTIME_EVENTS,
  useRealtimeEvent,
} from "@/hooks/useRealtimeEvent";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";

type Invoice = {
  invoice_id: string;
  patient: string;
  date: string;
  amount: number;
  status: string;
  description?: string;
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

const API_BASE = getApiBaseUrl();

function formatToK(amount: number): string {
  if (!amount || isNaN(amount)) return "0K";
  return `${Math.round(amount / 1000)}K`;
}

export default function BillingFinanceAnalyticsPage() {
  const [overview, setOverview] = useState<BillingFinanceOverview | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(
        `${API_BASE}/api/billing-finance-overview?date=${selectedDate}`,
        { headers: getAuthHeaders() },
      );
      if (!res.ok) {
        throw new Error(`Failed to load overview (status ${res.status})`);
      }
      const data: BillingFinanceOverview = await res.json();
      setOverview(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchOverview();
    const id = setInterval(fetchOverview, 60000);
    return () => clearInterval(id);
  }, [fetchOverview]);

  useRealtimeEvent(ADMIN_DASHBOARD_REALTIME_EVENTS, fetchOverview);

  const invoices = overview?.recent_invoices ?? [];
  const revenueTrend = overview?.revenue_vs_expenses ?? [];

  return (
    <div
      id="dashboard-content"
      className="dashboard-page-shell max-w-5xl pb-8 transition-colors sm:pb-12"
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/admin/billing-finance"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0066cc] hover:underline dark:text-[#60a5fa] mb-2"
          >
            <ArrowLeft size={16} aria-hidden />
            Back to billing workspace
          </Link>
          <h2 className="text-2xl font-semibold text-[#1e40af] dark:text-[#60a5fa] sm:text-3xl">
            Revenue & reports
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            KPIs and trends use finance-confirmed (paid) amounts for the selected report date.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-sm text-gray-600 dark:text-gray-400" htmlFor="billing-analytics-date">
            Report date
          </label>
          <input
            id="billing-analytics-date"
            type="date"
            className="border border-gray-200 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {isLoading && !overview && (
        <p className="text-sm text-gray-500 mb-4">Loading analytics…</p>
      )}
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#22c55e]"
          icon={<DollarSign className="absolute top-4 left-4 text-[#22c55e]" size={24} />}
          label="Today&apos;s Revenue"
          value={<h3 className="text-4xl font-bold text-[#22c55e] mt-3">{formatToK(overview?.todays_revenue ?? 0)}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Paid invoices on date</p>}
          tooltipTitle="Revenue"
          tooltipContent={
            <>
              <TooltipRow label="Date" value={selectedDate} />
              <TooltipRow label="Exact" value={`PKR ${(overview?.todays_revenue ?? 0).toLocaleString("en-PK")}`} />
            </>
          }
        />
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#f97316]"
          icon={<AlertCircle className="absolute top-4 left-4 text-[#f97316]" size={24} />}
          label="Outstanding"
          value={<h3 className="text-4xl font-bold text-[#f97316] mt-3">{formatToK(overview?.outstanding_balance ?? 0)}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Pending up to this date</p>}
          tooltipTitle="Outstanding"
          tooltipContent={
            <>
              <TooltipRow label="Date" value={selectedDate} />
              <TooltipRow label="Exact" value={`PKR ${(overview?.outstanding_balance ?? 0).toLocaleString("en-PK")}`} />
            </>
          }
        />
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#3b82f6]"
          icon={<FileText className="absolute top-4 left-4 text-[#3b82f6]" size={24} />}
          label="Insurance claims"
          value={<h3 className="text-4xl font-bold text-[#3b82f6] mt-3">{overview?.insurance_claims ?? 0}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">On selected date</p>}
          tooltipTitle="Claims"
          tooltipContent={<TooltipRow label="Date" value={selectedDate} />}
        />
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#a855f7]"
          icon={<Banknote className="absolute top-4 left-4 text-[#a855f7]" size={24} />}
          label="Est. expenses"
          value={<h3 className="text-4xl font-bold text-[#a855f7] mt-3">{formatToK(overview?.todays_expenses ?? 0)}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Approx. 30% of revenue</p>}
          tooltipTitle="Expenses"
          tooltipContent={
            <TooltipRow label="Exact" value={`PKR ${(overview?.todays_expenses ?? 0).toLocaleString("en-PK")}`} />
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Recent invoices</h3>
          <div className="overflow-x-auto max-h-[min(24rem,50vh)] overflow-y-auto rounded-md border border-gray-100 dark:border-gray-700">
            <table className="w-full text-left text-sm border-collapse min-w-[520px]">
              <thead className="sticky top-0 z-[1] bg-gray-50 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-600">
                <tr className="text-gray-500">
                  <th className="py-2 px-2 font-medium">Invoice</th>
                  <th className="py-2 px-2 font-medium">Patient</th>
                  <th className="py-2 px-2 font-medium">Date</th>
                  <th className="py-2 px-2 font-medium">Description</th>
                  <th className="py-2 px-2 font-medium text-right">Amount</th>
                  <th className="py-2 px-2 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoice_id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 px-2 font-mono text-gray-700 dark:text-gray-200">{inv.invoice_id}</td>
                    <td className="py-2 px-2 font-medium text-gray-900 dark:text-gray-100">{inv.patient}</td>
                    <td className="py-2 px-2 text-gray-500">{inv.date}</td>
                    <td className="py-2 px-2 text-gray-600 dark:text-gray-300 max-w-[160px] truncate" title={inv.description}>
                      {inv.description || "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-medium">PKR {inv.amount.toLocaleString()}</td>
                    <td className="py-2 px-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.status.toLowerCase() === "paid"
                            ? "bg-green-100 text-green-700"
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
                    <td colSpan={6} className="py-6 text-center text-gray-500">
                      No invoices in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-[min(24rem,50vh)] lg:h-[400px]">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Revenue vs expenses</h3>
          <div className="flex-1 w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={revenueTrend} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "8px" }} />
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
