"use client";

import React, { useEffect, useState } from "react";
import { Pill, AlertTriangle, BriefcaseMedical, TrendingDown, ChevronRight, Snowflake, Link2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";

const API_BASE = getApiBaseUrl();

export default function PharmacyIntelligenceCard({ className = "" }: { className?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch(`${API_BASE}/api/pharmacy-overview?date=${today}`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (cancelled) return;
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const totalMedicines = data?.total_medicines || 0;
  const lowStockItems = data?.low_stock_items || 0;
  const criticalCount = data?.critical_medicines_count || 0;
  const lowCount = data?.low_stock_medicines_count || 0;
  
  const healthPct = totalMedicines > 0 ? Math.max(0, Math.round(((totalMedicines - lowStockItems) / totalMedicines) * 100)) : 100;
  
  let healthStatus = "Good";
  let healthColorClass = "text-[#16a34a]";
  let healthBadgeClass = "bg-[#2563eb] hover:bg-[#1d4ed8]";
  
  if (healthPct < 50) {
    healthStatus = "Critical";
    healthColorClass = "text-red-600";
    healthBadgeClass = "bg-red-600 hover:bg-red-700";
  } else if (healthPct < 80) {
    healthStatus = "Warning";
    healthColorClass = "text-amber-600";
    healthBadgeClass = "bg-amber-500 hover:bg-amber-600";
  }

  const criticalMed1 = data?.critical_medicines?.[0];
  const criticalMed2 = data?.critical_medicines?.[1];
  const lowMed1 = data?.low_stock_medicines?.[0];
  const lowMed2 = data?.low_stock_medicines?.[1];
  
  const expiryTrend = data?.expiry_trend || [];
  const expiringMedicines = data?.expiring_medicines || [];

  const comparison = data?.comparison_data || {
    current_7_days: { critical_drugs: 0, low_stock_drugs: 0 },
    previous_7_days: { critical_drugs: 0, low_stock_drugs: 0 },
    last_7_days_avg: { critical_drugs: 0, low_stock_drugs: 0 }
  };

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return { pct: 0, dir: 'flat' };
    const diff = current - previous;
    const pct = Math.abs(Math.round((diff / previous) * 100));
    return { pct, dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' };
  };

  const critChange = calcChange(comparison.current_7_days.critical_drugs, comparison.previous_7_days.critical_drugs);
  const lowChange = calcChange(comparison.current_7_days.low_stock_drugs, comparison.previous_7_days.low_stock_drugs);

  const totalAvg = comparison.last_7_days_avg.critical_drugs + comparison.last_7_days_avg.low_stock_drugs;
  const totalPrev = comparison.previous_7_days.critical_drugs + comparison.previous_7_days.low_stock_drugs;
  const totalChange = calcChange(totalAvg, totalPrev);

  return (
    <section
      className={[
        "rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 flex flex-col",
        className,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#0066cc] dark:text-[#60a5fa]">
            <Pill size={20} strokeWidth={2} aria-hidden />
          </span>
          <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">Pharmacy Intelligence</h3>
        </div>
        <span className="flex items-center text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:text-[#0066cc] cursor-pointer transition-colors">
          Inventory Health <ChevronRight size={14} className="ml-0.5" />
        </span>
      </div>

      <div className="flex flex-col flex-1 p-6">
        {/* Top Section */}
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[16px] font-medium text-gray-900 dark:text-gray-100">
              Inventory Health: <span className={`${healthColorClass} font-semibold`}>{loading ? "..." : `${healthPct}%`}</span>
            </p>
            <p className="mt-1 text-[14px] text-gray-600 dark:text-gray-400">{loading ? "..." : healthStatus}</p>
          </div>
          <button className={`flex items-center gap-1.5 rounded-full ${healthBadgeClass} px-4 py-1.5 text-white shadow-sm transition-colors`}>
            <Snowflake size={14} />
            <span className="text-[13px] font-medium">{loading ? "..." : healthStatus}</span>
          </button>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-[14px] text-gray-700 dark:text-gray-300">
              <span className="text-[#16a34a] font-semibold text-[16px] mr-1">{loading ? "-" : lowStockItems}</span>
              Below Safe Stock Level
            </p>
            <div className="mt-2 flex items-center text-[14px] font-medium">
              <span className="text-red-600">{criticalCount} Critical</span>
              <span className="mx-3 text-gray-300 dark:text-gray-700">|</span>
              <span className="text-amber-600">{lowCount} Low</span>
            </div>
          </div>
          
          <div className="h-20 w-48 relative flex flex-col">
            {loading && expiryTrend.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                Loading...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expiryTrend} margin={{ top: 0, right: 0, left: -30, bottom: -5 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} tickCount={3} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }} 
                    contentStyle={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <ReferenceLine y={6} stroke="#ef4444" strokeDasharray="3 3" />
                  <Bar dataKey="expiring_count" fill="#22c55e" radius={[2, 2, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="my-6 border-t border-gray-100 dark:border-gray-800 border-dashed" />

        {/* Middle Section */}
        <div className="grid grid-cols-2 gap-6">
          {/* Critical */}
          <div>
            <p className="text-[14px] font-medium text-gray-900 dark:text-gray-100 mb-3">
              Critical Medicines: <span className="text-red-600">{criticalCount}</span>
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <BriefcaseMedical size={16} className="text-red-700 shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate w-20">{criticalMed1?.medicine_name || "N/A"}</span>
                    <div className="w-16 h-2.5 bg-gray-100 dark:bg-gray-800 rounded-sm overflow-hidden flex">
                      <div className="w-1/4 bg-amber-300 h-full" />
                      <div className="w-1/2 bg-amber-400 h-full" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-amber-600 mt-1">
                    <span>&gt;10 days</span>
                    <span className="text-gray-500 dark:text-gray-400">&gt;7 days overdue</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Low Stock */}
          <div>
            <p className="text-[14px] font-medium text-gray-900 dark:text-gray-100 mb-3">
              Low Stock: <span className="text-[#16a34a]">{lowCount}</span>
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <BriefcaseMedical size={16} className="text-amber-600 shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate w-16">{lowMed1?.medicine_name || "N/A"}</span>
                    <span className="text-gray-600 dark:text-gray-400">{lowMed1?.current_stock || 0} remaining</span>
                  </div>
                  <div className="flex justify-between items-center text-[12px] text-gray-500 mt-1">
                    <span>{lowMed2?.current_stock || 0} remaining</span>
                    <span>{lowMed2?.current_stock || 0} remaining</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="my-6 border-t border-gray-100 dark:border-gray-800 border-dashed" />

        {/* Expiring Soon */}
        <div>
          <p className="text-[14px] font-medium text-gray-900 dark:text-gray-100 mb-3">
            Expiring Soon:
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {expiringMedicines.slice(0, 4).map((med: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <BriefcaseMedical size={14} className={idx % 2 === 0 ? "text-amber-600" : "text-amber-500"} />
                  <span className="font-medium text-gray-800 dark:text-gray-200">{med.medicine_name}</span>
                </div>
                <span className={med.days_left < 10 ? "text-amber-600 font-medium" : "text-amber-600"}>
                  {idx > 1 ? "Exp. in " : ""}{med.days_left} days
                </span>
              </div>
            ))}
            {expiringMedicines.length === 0 && !loading && (
               <div className="text-[13px] text-gray-500">No medicines expiring soon</div>
            )}
          </div>
        </div>

        {/* Insights */}
        <div className="mt-6 space-y-3">
          <div className="flex gap-2.5 text-[13px] text-gray-700 dark:text-gray-300">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p>
              <span className="font-medium">{lowStockItems}</span> medicines below safe stock level; <span className="font-medium">{criticalCount}</span> critical are overdue by more than 7 days.
            </p>
          </div>
          <div className="flex gap-2.5 text-[13px] text-gray-700 dark:text-gray-300">
            <BriefcaseMedical size={16} className="text-[#16a34a] shrink-0 mt-0.5" />
            <p>
              {criticalCount > 0 ? (
                <>Prioritize restocking of critical medicines {criticalMed1?.medicine_name}{criticalMed2 ? ` and ${criticalMed2.medicine_name}` : ""}. </>
              ) : lowCount > 0 ? (
                <>Consider restocking low stock medicines like {lowMed1?.medicine_name}{lowMed2 ? ` and ${lowMed2.medicine_name}` : ""}. </>
              ) : (
                <>Stock levels are currently stable. </>
              )}
              {expiringMedicines.length > 0 && (
                <>Review expiring inventory of {expiringMedicines[0]?.medicine_name}{expiringMedicines[1] ? ` and ${expiringMedicines[1].medicine_name}` : ""} within 24 hours.</>
              )}
            </p>
          </div>
        </div>

        {/* Bottom Comparison */}
        <div className="mt-6 rounded-xl bg-[#f8fafc] border border-gray-100 dark:bg-gray-950 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Last 7 Days <span className="font-normal">(Average)</span></th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Current 7 Days</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Previous 7 Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              <tr>
                <td className="px-4 py-3">
                  <span className="text-red-600 font-medium text-[14px] mr-1.5">{comparison.last_7_days_avg.critical_drugs}</span>
                  <span className="text-gray-800 dark:text-gray-200">Critical Drugs</span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {comparison.current_7_days.critical_drugs} 
                  <span className={`ml-2 text-[12px] ${critChange.dir === 'down' ? 'text-[#16a34a]' : critChange.dir === 'up' ? 'text-red-600' : 'text-gray-500'}`}>
                    {critChange.dir === 'down' ? '↓' : critChange.dir === 'up' ? '↑' : '-'} {critChange.pct}%
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {comparison.previous_7_days.critical_drugs}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <span className="text-amber-600 font-medium text-[14px] mr-1.5">{comparison.last_7_days_avg.low_stock_drugs}</span>
                  <span className="text-gray-800 dark:text-gray-200">Low Stock Drugs</span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {comparison.current_7_days.low_stock_drugs}
                  <span className={`ml-2 text-[12px] ${lowChange.dir === 'down' ? 'text-[#16a34a]' : lowChange.dir === 'up' ? 'text-amber-600' : 'text-gray-500'}`}>
                    {lowChange.dir === 'down' ? '↓' : lowChange.dir === 'up' ? '↑' : '-'} {lowChange.pct}%
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {comparison.previous_7_days.low_stock_drugs}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="bg-white dark:bg-gray-900 px-4 py-3 flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800">
            <Link2 size={14} className="text-[#3b82f6] shrink-0" />
            <span>
              Critical and low stock drugs averaged {totalAvg}, down 40% compared to last week.
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
