"use client";

import React, { useEffect, useState } from "react";
import { Lightbulb, Check, Minus } from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";

interface Observation {
  id: string;
  text: React.ReactNode;
  status: "success" | "warning" | "critical" | "neutral";
}

interface Action {
  id: string;
  text: string;
}

export default function ExecutiveSummaryCard() {
  const [loading, setLoading] = useState(true);
  const [hospitalData, setHospitalData] = useState<any>(null);
  const [hospitalDataY, setHospitalDataY] = useState<any>(null);
  const [hrData, setHrData] = useState<any>(null);
  const [alertsData, setAlertsData] = useState<any>(null);
  const [pharmacyData, setPharmacyData] = useState<any>(null);
  const [financeData, setFinanceData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split("T")[0];

        const headers = getAuthHeaders();
        const API_BASE = getApiBaseUrl();

        const [hosp, hospY, hr, alerts, pharm, fin] = await Promise.all([
          fetch(`${API_BASE}/api/hospital-overview`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/hospital-overview?date=${yStr}`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/hr-staff-overview`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/alerts-overview`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/pharmacy-overview`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/billing-finance-overview`, { headers }).then(r => r.json())
        ]);

        if (cancelled) return;

        setHospitalData(hosp);
        setHospitalDataY(hospY);
        setHrData(hr);
        setAlertsData(alerts);
        setPharmacyData(pharm);
        setFinanceData(fin);
      } catch (error) {
        console.error("Failed to load executive summary data", error);
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

  // Compute logic
  const icuOcc = hospitalData?.icu_occupancy ?? 0;
  const icuOccY = hospitalDataY?.icu_occupancy ?? 0;
  const absentStaff = hrData?.absent_today ?? 0;
  const warnings = (alertsData?.active_warnings ?? 0) + (alertsData?.critical_emergencies ?? 0);
  const lowStock = pharmacyData?.low_stock_items ?? 0;
  const criticalPatients = hospitalData?.critical_condition_cases ?? 0;
  const outstanding = financeData?.outstanding_balance ?? 0;

  // Generate Observations
  const observations: Observation[] = [];
  const actions: Action[] = [];

  let overallPressure = "normal";

  if (!loading) {
    // ICU
    if (icuOcc > 85) {
      observations.push({ id: "icu", text: "ICU occupancy critically high", status: "critical" });
      actions.push({ id: "icu_act", text: "Prepare additional ICU bed capacity" });
      overallPressure = "high";
    } else if (icuOcc > icuOccY + 5) {
      observations.push({ id: "icu", text: "ICU occupancy increasing steadily", status: "warning" });
      actions.push({ id: "icu_act", text: "Monitor ICU admissions closely" });
      if (overallPressure === "normal") overallPressure = "moderate";
    } else {
      observations.push({ id: "icu", text: "ICU occupancy stable", status: "success" });
    }

    // Staff
    if (absentStaff > 5) {
      observations.push({ id: "staff", text: <><span className="font-semibold">{absentStaff} staff absent today</span> may affect response time</>, status: "warning" });
      actions.push({ id: "staff_act", text: "Reassign staff to high workload departments" });
      if (overallPressure === "normal") overallPressure = "moderate";
    } else {
      observations.push({ id: "staff", text: "Staff attendance is optimal", status: "success" });
    }

    // Warnings
    if (warnings >= 1) {
      observations.push({ id: "warn", text: <><span className="font-semibold">{warnings} system warnings</span> generated today</>, status: "warning" });
      actions.push({ id: "warn_act", text: "Review high-severity alerts and close aging items" });
    } else {
      observations.push({ id: "warn", text: "No system warnings generated today", status: "success" });
    }

    // Pharmacy
    if (lowStock > 0) {
      observations.push({ id: "pharm", text: <><span className="font-semibold">{lowStock} medicines</span> low stock</>, status: "success" });
      if (lowStock > 5) {
         observations[observations.length - 1].status = "warning";
      }
      actions.push({ id: "pharm_act", text: "Reorder critical medicines within 24hrs" });
    } else {
      observations.push({ id: "pharm", text: "Medicine stock levels are optimal", status: "success" });
    }

    // Finance
    if (outstanding > 50000) {
      observations.push({ id: "fin", text: <><span className="font-semibold">Revenue stable</span> but outstanding high</>, status: "success" });
      actions.push({ id: "fin_act", text: "Follow up on high-value outstanding payments" });
    } else {
      observations.push({ id: "fin", text: <><span className="font-semibold">Revenue stable</span> and collections optimal</>, status: "success" });
    }

    // Critical Patients
    if (criticalPatients > 0) {
      observations.push({
        id: "crit",
        text: <><span className="font-semibold">{criticalPatients} Critical patients</span></>,
        status: "critical"
      });
      if (overallPressure !== "high") overallPressure = "moderate";
    }
  }

  const titleText = loading 
    ? "Analyzing hospital data..." 
    : overallPressure === "high" 
      ? "Hospital operating under high pressure"
      : overallPressure === "moderate"
        ? "Hospital operating under moderate pressure"
        : "Hospital operating normally";

  const getIcon = (status: string) => {
    switch (status) {
      case "success": return <Check size={16} className="text-emerald-500 mt-[2px] shrink-0" strokeWidth={2.5} />;
      case "warning": return <Check size={16} className="text-amber-500 mt-[2px] shrink-0" strokeWidth={2.5} />;
      case "critical": return <Check size={16} className="text-rose-600 mt-[2px] shrink-0" strokeWidth={2.5} />;
      default: return <Minus size={16} className="text-gray-400 mt-[2px] shrink-0" strokeWidth={2.5} />;
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-[#fcfcfd] px-6 py-3.5 dark:border-gray-800 dark:bg-gray-950/50">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff4e5] text-[#d97706] dark:bg-[#451a03] dark:text-[#f59e0b]">
            <Lightbulb size={15} strokeWidth={2.5} />
          </div>
          <h2 className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">Executive Summary</h2>
        </div>
        <button className="text-[13px] font-medium text-[#0066cc] hover:underline dark:text-[#60a5fa]">
          View Report &gt;
        </button>
      </div>

      {/* Content */}
      <div className="p-6 bg-[#fffdfa] dark:bg-gray-900">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {titleText}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Observations */}
          <div className="lg:col-span-8">
            <div className="flex items-center gap-4 mb-4">
              <h4 className="text-[14px] font-medium text-gray-700 dark:text-gray-300">Key observations:</h4>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 underline decoration-dashed underline-offset-2 cursor-help">Satisfying test chances</span>
            </div>
            
            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4 dark:bg-gray-800"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6 dark:bg-gray-800"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 dark:bg-gray-800"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                {observations.map((obs) => (
                  <div key={obs.id} className="flex items-start gap-2.5">
                    {getIcon(obs.status)}
                    <p className={`text-[13.5px] leading-snug ${obs.status === 'critical' ? 'text-rose-700 dark:text-rose-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {obs.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Actions */}
          <div className="lg:col-span-4 lg:border-l lg:border-gray-200 lg:pl-8 dark:lg:border-gray-800">
            <h4 className="text-[14px] font-medium text-gray-700 dark:text-gray-300 mb-4">Suggest actions:</h4>
            
            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-full dark:bg-gray-800"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6 dark:bg-gray-800"></div>
              </div>
            ) : (
              <div className="flex flex-col gap-y-4">
                {actions.map((act) => (
                  <div key={act.id} className="flex items-start gap-3">
                    <Check size={16} className="text-emerald-500 mt-[2px] shrink-0" strokeWidth={2.5} />
                    <p className="text-[14px] leading-snug text-gray-700 dark:text-gray-300">
                      {act.text}
                    </p>
                  </div>
                ))}
                {actions.length === 0 && (
                  <p className="text-[14px] text-gray-500 italic">No immediate actions required.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}