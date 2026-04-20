"use client";

import React, { useEffect, useState } from "react";
import { Building2, PieChart } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  ComposedChart,
} from "recharts";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";

const API_BASE = getApiBaseUrl();

function InsightDiamond({ color }: { color: string }) {
  return (
    <span 
      className="mt-1.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center rotate-45 rounded-[1px]" 
      style={{ backgroundColor: color }} 
      aria-hidden
    >
      <span className="h-1 w-1 rounded-full bg-white dark:bg-gray-900" />
    </span>
  );
}

export default function CapacityIntelligenceCard({ className = "" }: { className?: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch(`${API_BASE}/api/patients-beds-overview?date=${today}`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (cancelled) return;
        
        // Format dates for the X-axis
        const trend = (json.admissions_discharges_trend || []).map((item: any) => {
          const d = new Date(item.date);
          return {
            ...item,
            displayDate: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`,
          };
        });
        setData(trend);
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
            <Building2 size={20} strokeWidth={2} aria-hidden />
          </span>
          <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">Capacity Intelligence</h3>
        </div>
        <span className="text-[13px] font-medium text-gray-600 dark:text-gray-400">Past 7 days</span>
      </div>

      <div className="flex flex-col flex-1 p-6">
        <h4 className="text-[15px] font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Admissions - Discharges trend
        </h4>

        <div className="h-44 w-full relative">
          {loading && data.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
              Loading chart...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAdmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis 
                  dataKey="displayDate" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6b7280' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6b7280' }} 
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '13px' }}
                  labelStyle={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="admissions" 
                  stroke="none" 
                  fillOpacity={1} 
                  fill="url(#colorAdmissions)" 
                />
                <Line 
                  type="monotone" 
                  dataKey="discharges" 
                  stroke="#0ea5e9" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: "#0ea5e9", strokeWidth: 0 }} 
                  activeDot={{ r: 5 }} 
                  name="Discharges"
                />
                <Line 
                  type="monotone" 
                  dataKey="admissions" 
                  stroke="#d97706" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: "#d97706", strokeWidth: 0 }} 
                  activeDot={{ r: 5 }} 
                  name="Admissions"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-6 space-y-3 pt-4 text-[13px] text-gray-700 dark:border-gray-800 dark:text-gray-200 border-t border-dashed border-gray-200">
          <div className="flex gap-3 items-start">
            <InsightDiamond color="#d97706" />
            <p>Admissions and discharge stable this week</p>
          </div>
          <div className="flex gap-3 items-start">
            <InsightDiamond color="#0ea5e9" />
            <p>Emergency department utilization increasing faster than other departments.</p>
          </div>
        </div>

        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f8fafc] px-4 py-3 text-[13px] text-gray-700 dark:bg-gray-950 dark:text-gray-300">
            <span className="inline-flex items-center gap-2">
              <PieChart size={16} aria-hidden className="text-[#3b82f6]" />
              <span className="font-medium">Audit - Alerts:</span>
            </span>
            <span className="rounded-full bg-[#e2e8f0] px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              ROSS 3r rest anagett
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
