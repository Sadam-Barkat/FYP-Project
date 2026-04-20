"use client";

import React, { useEffect, useState } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { AlertTriangle, ChevronRight, ChevronDown, Activity, Pill } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

const FAKE_TREND = [
  { value: 12 }, { value: 15 }, { value: 8 }, { value: 20 }, 
  { value: 14 }, { value: 25 }, { value: 18 }, { value: 30 },
  { value: 22 }, { value: 35 }, { value: 28 }, { value: 40 },
  { value: 32 }, { value: 25 }
];

export default function ClinicalRiskCard({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [alertsData, setAlertsData] = useState<any>(null);
  const [hospitalData, setHospitalData] = useState<any>(null);
  const [pharmacyData, setPharmacyData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const headers = getAuthHeaders();
        const API_BASE = getApiBaseUrl();
        
        const [alerts, hosp, pharm] = await Promise.all([
          fetch(`${API_BASE}/api/alerts-overview`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/hospital-overview`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/pharmacy-overview`, { headers }).then(r => r.json())
        ]);

        if (cancelled) return;
        setAlertsData(alerts);
        setHospitalData(hosp);
        setPharmacyData(pharm);
      } catch (error) {
        console.error("Failed to load clinical risk data", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const activeAlerts = (alertsData?.critical_emergencies ?? 0) + (alertsData?.active_warnings ?? 0);
  
  const emergencyWard = hospitalData?.bed_occupancy_by_department?.find((d: any) => d.department === "Emergency") || { occupied: 0, total: 0 };
  const emergencyOccPct = emergencyWard.total > 0 ? Math.round((emergencyWard.occupied / emergencyWard.total) * 100) : 0;
  const emergencyAvail = Math.max(0, emergencyWard.total - emergencyWard.occupied);

  const topLowStock = pharmacyData?.low_stock_medicines?.[0] || { name: "Paracetamol", stock_level: 0, unit: "boxes" };

  return (
    <section className={`rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-800/50">
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={18} className="text-rose-500" strokeWidth={2.5} />
          <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">Clinical Risk Intelligence</h3>
        </div>
        <ChevronRight size={16} className="text-gray-400" />
      </div>

      {/* Main Metric Area */}
      <div className="relative px-5 pt-5 pb-6 border-b border-gray-50 dark:border-gray-800/50 overflow-hidden">
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">Active Clinical Alerts</p>
            <p className="mt-1 text-4xl font-bold text-gray-900 dark:text-gray-100">
              {loading ? "..." : activeAlerts}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-[#f0f5ff] text-[#0066cc] px-2.5 py-1.5 rounded text-[11px] font-semibold dark:bg-[#0b2a52] dark:text-[#60a5fa] cursor-pointer">
            Last 7 days
            <ChevronDown size={12} strokeWidth={3} />
          </div>
        </div>

        {/* Background Area Chart */}
        <div className="absolute bottom-0 left-0 right-0 h-20 opacity-40 pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={FAKE_TREND} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#riskGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sub-section: Risk Factors */}
      <div className="px-5 py-4 flex-1 flex flex-col">
        <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-3">Key Risk Factors</p>
        
        <div className="flex flex-col gap-2.5">
          {/* Row 1: Emergency Ward */}
          <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] px-3.5 py-3 dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[#1d4ed8] text-white shadow-sm">
                <Activity size={14} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                  Emergency ward <span className="ml-1 text-gray-500 font-medium">{loading ? "..." : `${emergencyOccPct}%`}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Fake yellow mini bar chart */}
              <div className="flex items-end gap-[2px] h-4">
                <div className="w-1 h-1.5 bg-amber-300 rounded-sm"></div>
                <div className="w-1 h-2.5 bg-amber-400 rounded-sm"></div>
                <div className="w-1.5 h-4 bg-amber-500 rounded-sm"></div>
              </div>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 w-[100px] text-right">
                {loading ? "..." : `${emergencyAvail} available beds`}
              </p>
            </div>
          </div>

          {/* Row 2: Pharmacy Low Stock */}
          <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] px-3.5 py-3 dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[#1d4ed8] text-white shadow-sm">
                <Pill size={14} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                  {loading ? "..." : topLowStock.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Fake red mini bar chart */}
              <div className="flex items-end gap-[2px] h-4">
                <div className="w-1.5 h-3 bg-rose-500 rounded-sm"></div>
                <div className="w-1 h-4 bg-rose-600 rounded-sm"></div>
                <div className="w-1 h-2 bg-rose-400 rounded-sm"></div>
              </div>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 w-[100px] text-right">
                {loading ? "..." : `${topLowStock.stock_level} ${topLowStock.unit} left`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}