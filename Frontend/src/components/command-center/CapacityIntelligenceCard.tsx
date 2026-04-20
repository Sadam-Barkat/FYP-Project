"use client";

import React, { useEffect, useState } from "react";
import { Building2, Activity } from "lucide-react";
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
  const [occupancyRate, setOccupancyRate] = useState<number>(0);
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
        
        setOccupancyRate(json.occupancy_rate || 0);

        // Format dates for the X-axis
        const trend = (json.admissions_discharges_trend || []).map((item: any) => {
          return {
            ...item,
            displayDate: item.day || item.date, // Use the 'day' string provided by the backend
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

  // Calculate insights dynamically
  let totalAdm = 0;
  let totalDis = 0;
  data.forEach((d) => {
    totalAdm += d.admissions || 0;
    totalDis += d.discharges || 0;
  });

  let insight1 = "Admissions and discharges are relatively balanced this week.";
  if (totalAdm > totalDis * 1.1 && totalAdm > 0) {
    insight1 = "Admissions are outpacing discharges this week. Prepare for potential bed shortages.";
  } else if (totalDis > totalAdm * 1.1 && totalDis > 0) {
    insight1 = "Discharges exceed admissions, freeing up bed capacity across departments.";
  }

  let insight2 = "Hospital capacity is within normal operating limits.";
  let alertText = "Normal Operations";
  if (occupancyRate > 90) {
    insight2 = "Critical capacity alert: Operating at near-maximum capacity. Consider diverting non-emergency admissions.";
    alertText = "Capacity Critical";
  } else if (occupancyRate > 75) {
    insight2 = "High capacity utilization. Monitor bed turnover closely to avoid bottlenecks.";
    alertText = "Capacity Warning";
  }

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

        <div className="h-44 w-full relative mt-2">
          {loading && data.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
              Loading chart...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <ComposedChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAdmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
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
                  tickFormatter={(val) => `${val}.0%`}
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
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }} 
                  activeDot={{ r: 5 }} 
                  name="Discharges"
                />
                <Line 
                  type="monotone" 
                  dataKey="admissions" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }} 
                  activeDot={{ r: 5 }} 
                  name="Admissions"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-4 space-y-3 pt-4 text-[13px] text-gray-700 dark:border-gray-800 dark:text-gray-200 border-t border-dashed border-gray-200">
          <div className="flex gap-3 items-start">
            <InsightDiamond color="#f59e0b" />
            <p>{insight1}</p>
          </div>
          <div className="flex gap-3 items-start">
            <InsightDiamond color="#10b981" />
            <p>{insight2}</p>
          </div>
        </div>

        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f8fafc] px-4 py-3 text-[13px] text-gray-700 dark:bg-gray-950 dark:text-gray-300">
            <span className="inline-flex items-center gap-2">
              <Activity size={16} aria-hidden className="text-[#3b82f6]" />
              <span className="font-medium">System Alert:</span>
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${occupancyRate > 75 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-[#e2e8f0] text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
              {alertText}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
