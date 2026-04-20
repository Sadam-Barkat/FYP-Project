"use client";

import React, { useEffect, useState } from "react";
import { Pill, ThumbsUp } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";

const API_BASE = getApiBaseUrl();

function Diamond({ className }: { className: string }) {
  return <span className={["mt-1.5 h-1.5 w-1.5 rotate-45 rounded-[1px] shrink-0", className].join(" ")} aria-hidden />;
}

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
  // Calculate a fake "health" percentage based on low stock vs total
  const healthPct = totalMedicines > 0 ? Math.max(0, Math.round(((totalMedicines - lowStockItems) / totalMedicines) * 100)) : 100;
  
  // Get top 2 low stock medicines for the display
  const lowStockList = data?.low_stock_medicines || [];
  const med1 = lowStockList[0];
  const med2 = lowStockList[1];
  
  // Expiry trend data for the bar chart
  const expiryTrend = data?.expiry_trend || [];
  const expiringSoon = data?.expiring_soon || 0;

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
        <span className="text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:text-[#0066cc] cursor-pointer">
          Inventory Health ›
        </span>
      </div>

      <div className="flex flex-col flex-1 p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[15px] font-medium text-gray-700 dark:text-gray-300">
              Inventory Health: <span className="text-[#16a34a] font-semibold">{loading ? "..." : `${healthPct}%`}</span>
            </p>
            <p className="mt-1 text-[13px] text-gray-600 dark:text-gray-400">Good</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] px-3 py-1 text-white shadow-sm">
            <span className="text-white">✱</span>
            <span className="text-xs font-medium">Good</span>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[13px] text-gray-600 dark:text-gray-400">
            <span className="text-[#16a34a] font-semibold text-[15px] mr-1">{loading ? "-" : lowStockItems}</span>
            medicines below safe stock level
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-6">
            {/* Med 1 */}
            <div className="flex items-center gap-3">
              <span className="text-3xl font-light text-gray-800 dark:text-gray-200">
                {med1 ? med1.current_stock : "0"}
              </span>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-gray-800 dark:text-gray-200 truncate max-w-[90px]">
                  {med1 ? med1.medicine_name : "N/A"}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {med1 ? `${med1.current_stock} remaining` : "0 remaining"}
                </span>
              </div>
            </div>
            
            {/* Divider */}
            <div className="w-px h-8 bg-gray-200 dark:bg-gray-800" />

            {/* Med 2 */}
            <div className="flex items-center gap-3">
              <span className="text-3xl font-light text-gray-800 dark:text-gray-200">
                {med2 ? med2.current_stock : "0"}
              </span>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-gray-800 dark:text-gray-200 truncate max-w-[90px]">
                  {med2 ? med2.medicine_name : "N/A"}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {med2 ? `${med2.current_stock} remaining` : "0 remaining"}
                </span>
              </div>
            </div>
          </div>

          {/* Real mini bar chart for Expiry Trend */}
          <div className="h-16 w-36 ml-auto relative flex flex-col">
            {loading && expiryTrend.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                Loading...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expiryTrend} margin={{ top: 0, right: 0, left: -30, bottom: -5 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickCount={3} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }} 
                    contentStyle={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Bar dataKey="expiring_count" fill="#22c55e" radius={[2, 2, 0, 0]} name="Expiring" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-5">
          <p className="text-[13px] text-gray-700 dark:text-gray-300">
            Expiring soon: <span className="text-[#16a34a] font-medium">{expiringSoon} medicines</span>
          </p>
          <div className="mt-3 flex gap-2 items-start">
            <Diamond className="bg-[#f59e0b]" />
            <p className="text-[12px] text-gray-600 dark:text-gray-400">
              Review expiring inventory and reorder critical medicines within 24 hours.
            </p>
          </div>
        </div>

        <div className="mt-auto pt-5">
          <div className="flex items-center gap-3 rounded-xl bg-[#f8fafc] px-4 py-3 text-[12px] text-gray-700 dark:bg-gray-950 dark:text-gray-300">
            <ThumbsUp size={14} className="text-[#3b82f6]" />
            <span>Maintain critical stock levels and ensure timely restocking.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
