"use client";

import React, { useEffect, useState } from "react";
import { Building2, Activity, ChevronRight } from "lucide-react";
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
  Legend,
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
  const [comparison, setComparison] = useState<any>({
    current_adm: 0,
    current_dis: 0,
    prev_adm: 0,
    prev_dis: 0,
    total_capacity: 100,
  });

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

        const totalCap = json.total_capacity || 100;
        let currentAdm = 0;
        let currentDis = 0;

        // Format dates for the X-axis and calculate percentages
        const trend = (json.admissions_discharges_trend || []).map((item: any) => {
          currentAdm += item.admissions || 0;
          currentDis += item.discharges || 0;
          return {
            ...item,
            displayDate: item.day || item.date,
            admPct: totalCap > 0 ? ((item.admissions || 0) / totalCap) * 100 : 0,
            disPct: totalCap > 0 ? ((item.discharges || 0) / totalCap) * 100 : 0,
          };
        });
        
        setData(trend);
        setComparison({
          current_adm: currentAdm,
          current_dis: currentDis,
          prev_adm: json.previous_7_days_admissions || 0,
          prev_dis: json.previous_7_days_discharges || 0,
          total_capacity: totalCap,
        });

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

  const totalCap = comparison.total_capacity || 100;
  
  // Calculate percentages for the bottom table
  const curAdmPct = totalCap > 0 ? ((comparison.current_adm / totalCap) * 100).toFixed(1) : "0.0";
  const curDisPct = totalCap > 0 ? ((comparison.current_dis / totalCap) * 100).toFixed(1) : "0.0";
  const prevAdmPct = totalCap > 0 ? ((comparison.prev_adm / totalCap) * 100).toFixed(1) : "0.0";
  const prevDisPct = totalCap > 0 ? ((comparison.prev_dis / totalCap) * 100).toFixed(1) : "0.0";

  // Calculate percentage changes
  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return { pct: 0, dir: 'flat' };
    const diff = current - previous;
    const pct = Math.abs(Math.round((diff / previous) * 100));
    return { pct, dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' };
  };

  const admChange = calcChange(comparison.current_adm, comparison.prev_adm);
  const disChange = calcChange(comparison.current_dis, comparison.prev_dis);

  // Calculate insights dynamically
  let insight1 = "Admissions and discharges are relatively balanced this week.";
  let insight1Color = "#10b981"; // Green by default
  
  if (comparison.current_dis > comparison.current_adm && comparison.current_adm > 0) {
    const exceedPct = Math.round(((comparison.current_dis - comparison.current_adm) / comparison.current_adm) * 100);
    insight1 = `+${exceedPct}% Discharges exceeded admissions by ${exceedPct}%, freeing up bed capacity across departments.`;
    insight1Color = "#f59e0b"; // Orange
  } else if (comparison.current_adm > comparison.current_dis && comparison.current_dis > 0) {
    const exceedPct = Math.round(((comparison.current_adm - comparison.current_dis) / comparison.current_dis) * 100);
    insight1 = `+${exceedPct}% Admissions exceeded discharges by ${exceedPct}%, increasing bed capacity pressure.`;
    insight1Color = "#ef4444"; // Red
  }

  // Find peak occupancy day
  let peakDay = "this week";
  let maxAdm = -1;
  data.forEach(d => {
    if (d.admissions > maxAdm) {
      maxAdm = d.admissions;
      peakDay = d.displayDate;
    }
  });

  let insight2 = `Hospital capacity is within normal operating limits.`;
  if (occupancyRate > 0) {
    insight2 = `Hospital capacity reached ${Math.round(occupancyRate)}% bed occupancy after recent admissions.`;
  }
  
  let alertText = "Normal Operations";
  if (occupancyRate > 90) {
    alertText = "Capacity Critical";
  } else if (occupancyRate > 75) {
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
        <span className="flex items-center text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:text-[#0066cc] cursor-pointer transition-colors">
          Past 7 Days <ChevronRight size={14} className="ml-0.5" />
        </span>
      </div>

      <div className="flex flex-col flex-1 p-6">
        <h4 className="text-[15px] font-medium text-gray-900 dark:text-gray-100 mb-4">
          Admissions - Discharges trend
        </h4>

        <div className="h-48 w-full relative mt-2">
          {loading && data.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
              Loading chart...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <ComposedChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorDischarges" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
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
                  tickFormatter={(val) => `${val.toFixed(1)}%`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '13px' }}
                  labelStyle={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}
                  formatter={(value: number | undefined) => [`${(value || 0).toFixed(1)}%`, undefined]}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="plainline" 
                  iconSize={14}
                  wrapperStyle={{ fontSize: '12px', color: '#4b5563', paddingTop: '10px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="disPct" 
                  stroke="none" 
                  fillOpacity={1} 
                  fill="url(#colorDischarges)" 
                />
                <Line 
                  type="monotone" 
                  dataKey="admPct" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }} 
                  activeDot={{ r: 5 }} 
                  name="Admissions"
                />
                <Line 
                  type="monotone" 
                  dataKey="disPct" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }} 
                  activeDot={{ r: 5 }} 
                  name="Discharges"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-2 space-y-3 pt-4 text-[13px] text-gray-700 dark:border-gray-800 dark:text-gray-200 border-t border-dashed border-gray-200">
          <div className="flex gap-3 items-start">
            <InsightDiamond color={insight1Color} />
            <p>
              {insight1.startsWith('+') ? (
                <>
                  <span className="font-semibold text-[#f59e0b]">{insight1.split(' ')[0]}</span> {insight1.substring(insight1.indexOf(' ') + 1)}
                </>
              ) : (
                insight1
              )}
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <InsightDiamond color="#10b981" />
            <p>{insight2}</p>
          </div>
        </div>

        <div className="mt-5">
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

        {/* Bottom Comparison */}
        <div className="mt-5 rounded-xl bg-[#f8fafc] border border-gray-100 dark:bg-gray-950 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Current 7 Days</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Previous 7 Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  <span className="text-[#0066cc] dark:text-[#60a5fa] font-semibold text-[15px] mr-1.5">{curAdmPct}%</span>
                  <span className="text-gray-800 dark:text-gray-200">Admissions</span>
                  <span className={`ml-2 text-[12px] ${admChange.dir === 'down' ? 'text-[#16a34a]' : admChange.dir === 'up' ? 'text-[#16a34a]' : 'text-gray-500'}`}>
                    {admChange.dir === 'down' ? '↓' : admChange.dir === 'up' ? '↑' : ''}{admChange.dir !== 'flat' ? '+' : ''}{admChange.pct}%
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  <span className="text-amber-600 font-semibold text-[15px] mr-1.5">{prevAdmPct}%</span>
                  <span className="text-gray-800 dark:text-gray-200">Admissions</span>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  <span className="text-gray-900 dark:text-gray-100 font-semibold text-[15px] mr-1.5">{curDisPct}%</span>
                  <span className="text-gray-800 dark:text-gray-200">Discharges</span>
                  <span className={`ml-2 text-[12px] ${disChange.dir === 'down' ? 'text-[#16a34a]' : disChange.dir === 'up' ? 'text-[#16a34a]' : 'text-gray-500'}`}>
                    {disChange.dir === 'down' ? '↓' : disChange.dir === 'up' ? '↑' : ''}{disChange.dir !== 'flat' ? '+' : ''}{disChange.pct}%
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  <span className="text-gray-600 dark:text-gray-400 font-semibold text-[15px] mr-1.5">{prevDisPct}%</span>
                  <span className="text-gray-800 dark:text-gray-200">Discharges</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="bg-white dark:bg-gray-900 px-4 py-3 flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800">
            <Activity size={14} className="text-[#3b82f6] shrink-0" />
            <span>
              Admissions {admChange.dir === 'up' ? 'increased' : admChange.dir === 'down' ? 'decreased' : 'changed'} {admChange.pct}%, discharges {disChange.dir === 'up' ? 'surged' : disChange.dir === 'down' ? 'dropped' : 'changed'} {disChange.pct}% compared to last week.
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
