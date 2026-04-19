"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign, FileText, AlertCircle, Banknote } from "lucide-react";
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

type ServiceSignal = {
  id: number;
  patient_id: number;
  patient_name: string;
  signal_type: string;
  reference_id: number | null;
  detail: string | null;
  created_at: string | null;
};

type PendingCharge = {
  id: number;
  patient_id: number;
  patient_name: string;
  amount: number;
  description: string;
  date: string | null;
};

const API_BASE = getApiBaseUrl();

function formatToK(amount: number): string {
  if (!amount || isNaN(amount)) return "0K";
  return `${Math.round(amount / 1000)}K`;
}

export default function BillingFinancePage() {
  const [overview, setOverview] = useState<BillingFinanceOverview | null>(null);
  const [signals, setSignals] = useState<ServiceSignal[]>([]);
  const [pending, setPending] = useState<PendingCharge[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [chargePatientId, setChargePatientId] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeSignalIds, setChargeSignalIds] = useState<number[]>([]);
  const [chargeSubmitting, setChargeSubmitting] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const fetchOverview = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const url = `${API_BASE}/api/billing-finance-overview?date=${selectedDate}`;
      const res = await fetch(url, { headers: getAuthHeaders() });

      if (!res.ok) {
        throw new Error(`Failed to load billing & finance data (status ${res.status})`);
      }

      const data: BillingFinanceOverview = await res.json();
      setOverview(data);
    } catch (err: unknown) {
      console.error("Error fetching billing & finance overview:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  const fetchSignalsAndPending = useCallback(async () => {
    try {
      const [sigRes, pendRes] = await Promise.all([
        fetch(`${API_BASE}/api/billing-service-signals`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/api/billing-pending-charges`, { headers: getAuthHeaders() }),
      ]);
      if (sigRes.ok) {
        const s = await sigRes.json();
        setSignals(Array.isArray(s) ? s : []);
      }
      if (pendRes.ok) {
        const p = await pendRes.json();
        setPending(Array.isArray(p) ? p : []);
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await fetchOverview();
    await fetchSignalsAndPending();
  }, [fetchOverview, fetchSignalsAndPending]);

  useEffect(() => {
    refreshAll();

    const interval = setInterval(() => {
      refreshAll();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshAll]);

  useRealtimeEvent(ADMIN_DASHBOARD_REALTIME_EVENTS, refreshAll);

  const toggleSignalForCharge = (id: number) => {
    setChargeSignalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submitCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    const pid = parseInt(chargePatientId, 10);
    const amt = parseFloat(chargeAmount);
    if (!pid || pid < 1 || !chargeDescription.trim() || !amt || amt <= 0) return;
    setChargeSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing-charges`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          patient_id: pid,
          amount: amt,
          description: chargeDescription.trim(),
          signal_ids: chargeSignalIds.length ? chargeSignalIds : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Failed to add charge");
      }
      setChargePatientId("");
      setChargeAmount("");
      setChargeDescription("");
      setChargeSignalIds([]);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add charge");
    } finally {
      setChargeSubmitting(false);
    }
  };

  const markPaid = async (billingId: number) => {
    setMarkingPaidId(billingId);
    try {
      const res = await fetch(`${API_BASE}/api/billing-charges/${billingId}/mark-paid`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ payment_method: paymentMethod }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Failed to mark paid");
      }
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark paid");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const invoices = overview?.recent_invoices ?? [];
  const revenueTrend = overview?.revenue_vs_expenses ?? [];

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
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
        <p className="text-sm text-red-500 mb-4">Failed to load data: {error}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Clinical service queue</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Discharge, lab completed, and consultation events (no amounts). Add charges below, then mark payment received.
          </p>
          <div className="overflow-x-auto max-h-56 overflow-y-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-2 pr-2">Patient</th>
                  <th className="pb-2 pr-2">Type</th>
                  <th className="pb-2">Detail</th>
                  <th className="pb-2 w-10">Link</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-2">
                      {s.patient_name}{" "}
                      <span className="text-gray-400">#{s.patient_id}</span>
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">{s.signal_type}</td>
                    <td className="py-2 text-gray-600 dark:text-gray-300 text-xs max-w-[200px] truncate" title={s.detail || ""}>
                      {s.detail || "—"}
                    </td>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={chargeSignalIds.includes(s.id)}
                        onChange={() => toggleSignalForCharge(s.id)}
                        title="Resolve when posting the charge below"
                        aria-label={`Link signal ${s.id}`}
                      />
                    </td>
                  </tr>
                ))}
                {signals.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-gray-500 text-center">
                      No open service signals.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Add charge (pending until paid)</h3>
          <form onSubmit={submitCharge} className="space-y-3 text-sm">
            <div>
              <label className="block text-gray-600 dark:text-gray-400 mb-1">Patient ID</label>
              <input
                type="number"
                min={1}
                className="w-full border border-gray-200 rounded-md px-3 py-2 dark:bg-gray-900 dark:border-gray-600"
                value={chargePatientId}
                onChange={(e) => setChargePatientId(e.target.value)}
                placeholder="e.g. 12"
                required
              />
            </div>
            <div>
              <label className="block text-gray-600 dark:text-gray-400 mb-1">Amount (PKR)</label>
              <input
                type="number"
                step="0.01"
                min={0.01}
                className="w-full border border-gray-200 rounded-md px-3 py-2 dark:bg-gray-900 dark:border-gray-600"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-md px-3 py-2 dark:bg-gray-900 dark:border-gray-600"
                value={chargeDescription}
                onChange={(e) => setChargeDescription(e.target.value)}
                placeholder="e.g. Bed stay 3d, CBC lab, consultation"
                required
              />
            </div>
            <button
              type="submit"
              disabled={chargeSubmitting}
              className="w-full bg-[#0066cc] text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {chargeSubmitting ? "Saving…" : "Create pending charge"}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Pending charges — confirm payment</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="text-gray-600 dark:text-gray-400">Payment method</label>
            <input
              type="text"
              className="border border-gray-200 rounded-md px-2 py-1 w-36 dark:bg-gray-900 dark:border-gray-600"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="cash / card / …"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2">Patient</th>
                <th className="pb-2">Description</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2">
                    {row.patient_name} <span className="text-gray-400">#{row.patient_id}</span>
                  </td>
                  <td className="py-2 text-gray-700 dark:text-gray-200">{row.description || "—"}</td>
                  <td className="py-2 text-right font-medium">PKR {row.amount.toLocaleString()}</td>
                  <td className="py-2 text-center">
                    <button
                      type="button"
                      onClick={() => markPaid(row.id)}
                      disabled={markingPaidId === row.id}
                      className="px-3 py-1 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-60"
                    >
                      {markingPaidId === row.id ? "…" : "Mark paid"}
                    </button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-500">
                    No pending charges.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3 dark:text-gray-400">
          Today&apos;s revenue and charts below count only rows marked paid here (finance-confirmed).
        </p>
      </div>

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#22c55e]"
          icon={<DollarSign className="absolute top-4 left-4 text-[#22c55e]" size={24} />}
          label="Today&apos;s Revenue"
          value={<h3 className="text-4xl font-bold text-[#22c55e] mt-3">{formatToK(overview?.todays_revenue ?? 0)}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Based on paid invoices</p>}
          tooltipTitle="Revenue details"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <TooltipRow
                label="Exact"
                value={`PKR ${(overview?.todays_revenue ?? 0).toLocaleString("en-PK")}`}
              />
            </>
          }
        />

        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#f97316]"
          icon={<AlertCircle className="absolute top-4 left-4 text-[#f97316]" size={24} />}
          label="Outstanding Balance"
          value={<h3 className="text-4xl font-bold text-[#f97316] mt-3">{formatToK(overview?.outstanding_balance ?? 0)}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Pending payments up to this date</p>}
          tooltipTitle="Outstanding balance"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <TooltipRow
                label="Exact"
                value={`PKR ${(overview?.outstanding_balance ?? 0).toLocaleString("en-PK")}`}
              />
            </>
          }
        />

        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#3b82f6]"
          icon={<FileText className="absolute top-4 left-4 text-[#3b82f6]" size={24} />}
          label="Insurance Claims"
          value={<h3 className="text-4xl font-bold text-[#3b82f6] mt-3">{overview?.insurance_claims ?? 0}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">On selected date</p>}
          tooltipTitle="Claims note"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This count reflects claim entries created on the selected day.
              </p>
            </>
          }
        />

        <MetricKpiCard
          borderLeftClass="border-l-4 border-l-[#a855f7]"
          icon={<Banknote className="absolute top-4 left-4 text-[#a855f7]" size={24} />}
          label="Today&apos;s Expenses"
          value={<h3 className="text-4xl font-bold text-[#a855f7] mt-3">{formatToK(overview?.todays_expenses ?? 0)}</h3>}
          footnote={<p className="text-xs text-gray-500 dark:text-gray-400">Approx. 30% of revenue</p>}
          tooltipTitle="Expenses details"
          tooltipContent={
            <>
              <TooltipRow label="Selected date" value={selectedDate} />
              <TooltipRow
                label="Exact"
                value={`PKR ${(overview?.todays_expenses ?? 0).toLocaleString("en-PK")}`}
              />
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Table Area */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden flex flex-col dark:bg-gray-800 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Recent Invoices</h3>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium px-2">Invoice ID</th>
                  <th className="pb-3 font-medium px-2">Patient</th>
                  <th className="pb-3 font-medium px-2">Date</th>
                  <th className="pb-3 font-medium px-2">Description</th>
                  <th className="pb-3 font-medium px-2 text-right">Amount</th>
                  <th className="pb-3 font-medium px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoice_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-2 text-sm text-gray-700 font-mono dark:text-gray-200">{inv.invoice_id}</td>
                    <td className="py-3 px-2 text-sm font-medium text-gray-900 dark:text-gray-100">{inv.patient}</td>
                    <td className="py-3 px-2 text-sm text-gray-500">{inv.date}</td>
                    <td className="py-3 px-2 text-sm text-gray-600 max-w-[180px] truncate dark:text-gray-300" title={inv.description}>
                      {inv.description || "—"}
                    </td>
                    <td className="py-3 px-2 text-sm font-semibold text-gray-700 text-right dark:text-gray-200">
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
                    <td colSpan={6} className="py-4 text-sm text-gray-500 text-center">
                      No invoices found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart Area */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[400px] dark:bg-gray-800 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Revenue vs Expenses</h3>
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
