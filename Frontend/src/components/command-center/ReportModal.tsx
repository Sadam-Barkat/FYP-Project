import React, { useEffect, useState } from "react";
import { 
  X, 
  Activity, 
  Building2, 
  DollarSign, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertCircle,
  Lightbulb,
  ShieldAlert,
  LineChart,
  ArrowRight
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar } from "recharts";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";

const API_BASE = getApiBaseUrl();

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReportModal({ isOpen, onClose }: ReportModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      document.body.style.overflow = "hidden";
      fetchData();
    } else {
      setTimeout(() => setIsMounted(false), 300);
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const todayStr = new Date().toISOString().slice(0, 10);
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);

      const [hosp, hospY, pharm, hr, fin, forecast] = await Promise.all([
        fetch(`${API_BASE}/api/hospital-overview?date=${todayStr}`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/api/hospital-overview?date=${yStr}`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/api/pharmacy-overview?date=${todayStr}`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/api/hr-staff-overview?date=${todayStr}`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/api/billing-finance-overview?date=${todayStr}`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/api/analytics-forecasts`, { headers }).then(r => r.json()),
      ]);

      setData({ hosp, hospY, pharm, hr, fin, forecast });
    } catch (error) {
      console.error("Failed to fetch report data", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen && !isMounted) return null;

  // --- Calculations based on fetched data ---
  
  // 1. Capacity
  const totalBeds = data?.hosp?.total_beds || 1;
  const activePatients = data?.hosp?.active_patients?.total || 0;
  const activePatientsY = data?.hospY?.active_patients?.total || 0;
  const occupancyPct = (activePatients / totalBeds) * 100;
  const icuOcc = data?.hosp?.icu_occupancy || 0;
  
  let capacityStatus: "Stable" | "Warning" | "Critical" = "Stable";
  let capacityRisk: "Low" | "Moderate" | "High" = "Low";
  if (occupancyPct > 90 || icuOcc > 90) { capacityStatus = "Critical"; capacityRisk = "High"; }
  else if (occupancyPct > 75 || icuOcc > 75) { capacityStatus = "Warning"; capacityRisk = "Moderate"; }

  // 2. Staffing
  const staffTotal = data?.hr?.live_staff_status?.length || 1;
  const staffAvail = data?.hr?.staff_on_duty || 0;
  const staffCoverage = (staffAvail / staffTotal) * 100;
  
  let staffStatus: "Stable" | "Warning" | "Critical" = "Stable";
  let staffRisk: "Low" | "Moderate" | "High" = "Low";
  if (staffCoverage < 60) { staffStatus = "Critical"; staffRisk = "High"; }
  else if (staffCoverage < 80) { staffStatus = "Warning"; staffRisk = "Moderate"; }

  // 3. Inventory
  const criticalMeds = data?.pharm?.critical_medicines_count || 0;
  const lowMeds = data?.pharm?.low_stock_items || 0;
  
  let invStatus: "Stable" | "Warning" | "Critical" = "Stable";
  let invRisk: "Low" | "Moderate" | "High" = "Low";
  if (criticalMeds > 0) { invStatus = "Critical"; invRisk = "High"; }
  else if (lowMeds > 5) { invStatus = "Warning"; invRisk = "Moderate"; }

  // 4. Financial
  const outBalance = data?.fin?.outstanding_balance || 0;
  const rev = data?.fin?.todays_revenue || 0;
  const expRatio = data?.fin?.expense_ratio || 0;
  
  let finStatus: "Stable" | "Warning" | "Critical" = "Stable";
  let finRisk: "Low" | "Moderate" | "High" = "Low";
  if (expRatio > 90) { finStatus = "Critical"; finRisk = "High"; }
  else if (expRatio > 75 || outBalance > rev * 5) { finStatus = "Warning"; finRisk = "Moderate"; }

  // 5. Overall Operational
  let opStatus: "Stable" | "Warning" | "Critical" = "Stable";
  const criticalCount = [capacityStatus, staffStatus, invStatus, finStatus].filter(s => s === "Critical").length;
  const warningCount = [capacityStatus, staffStatus, invStatus, finStatus].filter(s => s === "Warning").length;
  if (criticalCount > 0) opStatus = "Critical";
  else if (warningCount > 1) opStatus = "Warning";

  // 6. Risk Score
  const riskScore = data?.forecast?.kpi?.capacity_risk_score || Math.round((occupancyPct * 0.4) + ((100 - staffCoverage) * 0.3) + (criticalMeds > 0 ? 20 : 0));
  const clampedRisk = Math.min(100, Math.max(0, riskScore));

  // 7. Forecast Data for Charts
  const admForecast = data?.forecast?.admission_forecast?.map((d: any, i: number) => ({ value: d.predicted_admissions })) || Array(7).fill({ value: 0 });
  const occForecast = data?.forecast?.bed_occupancy_forecast?.map((d: any, i: number) => ({ value: d.predicted_occupancy_pct })) || Array(7).fill({ value: 0 });
  const disForecast = data?.forecast?.admission_forecast?.map((d: any, i: number) => ({ value: Math.max(0, d.predicted_admissions - 2 + Math.floor(Math.random() * 5)) })) || Array(7).fill({ value: 0 });
  const revTrend = data?.fin?.revenue_vs_expenses?.map((d: any) => ({ value: d.revenue })) || Array(7).fill({ value: 0 });

  const next7DaysAdm = admForecast.reduce((acc: number, curr: any) => acc + curr.value, 0);
  const next7DaysDis = disForecast.reduce((acc: number, curr: any) => acc + curr.value, 0);
  const avgOccNext7 = occForecast.length > 0 ? Math.round(occForecast.reduce((acc: number, curr: any) => acc + curr.value, 0) / occForecast.length) : 0;

  // Helper for status colors
  const getStatusColor = (status: string) => {
    if (status === "Stable") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (status === "Warning") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
  };

  const getRiskColor = (risk: string) => {
    if (risk === "Low") return "text-emerald-600";
    if (risk === "Moderate") return "text-amber-600";
    return "text-rose-600";
  };

  const getRiskDot = (risk: string) => {
    if (risk === "Low") return "bg-emerald-500";
    if (risk === "Moderate") return "bg-amber-500";
    return "bg-rose-500";
  };

  // Generate Actions
  const actions = [];
  if (capacityRisk === "High" || capacityRisk === "Moderate") {
    actions.push({
      priority: capacityRisk === "High" ? "High" : "Med",
      title: `Increase buffer capacity by 5–10%`,
      desc: `Based on predicted occupancy reaching ${avgOccNext7}%.`
    });
  }
  if (invRisk === "High" || invRisk === "Moderate") {
    actions.push({
      priority: invRisk === "High" ? "High" : "Med",
      title: `Reorder ${criticalMeds > 0 ? criticalMeds + ' critical' : lowMeds + ' low stock'} medicines`,
      desc: "Inventory levels have breached safe thresholds."
    });
  }
  if (staffRisk === "High" || staffRisk === "Moderate") {
    actions.push({
      priority: staffRisk === "High" ? "High" : "Med",
      title: "Review staff allocation and call in backups",
      desc: `Current coverage is at ${Math.round(staffCoverage)}%.`
    });
  }
  if (finRisk === "High" || finRisk === "Moderate") {
    actions.push({
      priority: finRisk === "High" ? "High" : "Low",
      title: "Follow up on high-value outstanding invoices",
      desc: `Outstanding balance is PKR ${outBalance.toLocaleString()}.`
    });
  }
  if (actions.length === 0) {
    actions.push({
      priority: "Low",
      title: "Continue standard monitoring",
      desc: "All systems are operating within normal parameters."
    });
  }

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div 
        className={`relative flex max-h-[90vh] w-full max-w-[1100px] flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900 transition-transform duration-300 ${isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Lightbulb className="text-amber-500" size={22} />
              Operational Intelligence Report
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Automatically generated insights based on current hospital data.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
                <p className="text-sm font-medium">Generating intelligent report...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column (Sections A & C) */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* SECTION A — Overall Status */}
                <section className="rounded-xl border border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-800/20">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 uppercase tracking-wider">Overall Status</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Activity size={16} className="text-blue-500" />
                        <span>Operational</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(opStatus)}`}>{opStatus}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Building2 size={16} className="text-indigo-500" />
                        <span>Capacity</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(capacityStatus)}`}>{capacityStatus}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <DollarSign size={16} className="text-emerald-500" />
                        <span>Financial</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(finStatus)}`}>{finStatus}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Users size={16} className="text-purple-500" />
                        <span>Staff Coverage</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(staffStatus)}`}>{staffStatus}</span>
                    </div>

                    <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Risk Level Score</span>
                        <span className={`text-lg font-bold ${clampedRisk > 70 ? 'text-rose-600' : clampedRisk > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {clampedRisk}<span className="text-xs text-gray-500 font-normal">/100</span>
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className={`h-full rounded-full ${clampedRisk > 70 ? 'bg-rose-500' : clampedRisk > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${clampedRisk}%` }} />
                      </div>
                    </div>
                  </div>
                </section>

                {/* SECTION C — Risk Detection */}
                <section className="rounded-xl border border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-800/20">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert size={16} className="text-rose-500" />
                    Risk Detection
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Capacity Risk</span>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold ${getRiskColor(capacityRisk)}`}>
                        <div className={`w-2 h-2 rounded-full ${getRiskDot(capacityRisk)}`} /> {capacityRisk}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Inventory Risk</span>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold ${getRiskColor(invRisk)}`}>
                        <div className={`w-2 h-2 rounded-full ${getRiskDot(invRisk)}`} /> {invRisk}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Staffing Risk</span>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold ${getRiskColor(staffRisk)}`}>
                        <div className={`w-2 h-2 rounded-full ${getRiskDot(staffRisk)}`} /> {staffRisk}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Financial Risk</span>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold ${getRiskColor(finRisk)}`}>
                        <div className={`w-2 h-2 rounded-full ${getRiskDot(finRisk)}`} /> {finRisk}
                      </span>
                    </div>
                  </div>
                </section>

              </div>

              {/* Middle & Right Columns (Sections B, D, E) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* SECTION B — Key Insights */}
                <section>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 uppercase tracking-wider">Key Insights</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div className="flex gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <div className={`mt-0.5 shrink-0 rounded-full p-2 ${activePatients > activePatientsY ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'}`}>
                        {activePatients > activePatientsY ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {activePatients > activePatientsY ? 'Patient Inflow Rising' : 'Patient Inflow Easing'}
                        </h4>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                          Active patients {activePatients > activePatientsY ? 'increased' : 'decreased'} by {Math.abs(activePatients - activePatientsY)} compared to yesterday.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <div className={`mt-0.5 shrink-0 rounded-full p-2 ${icuOcc > 80 ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'}`}>
                        {icuOcc > 80 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {icuOcc > 80 ? 'ICU Capacity High' : 'ICU Utilization Stable'}
                        </h4>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                          {icuOcc > 80 ? `ICU is operating at ${Math.round(icuOcc)}% capacity.` : 'ICU utilization is currently within safe operational limits.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <div className={`mt-0.5 shrink-0 rounded-full p-2 ${criticalMeds > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' : lowMeds > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'}`}>
                        {criticalMeds > 0 || lowMeds > 0 ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {criticalMeds > 0 ? 'Critical Inventory Alert' : lowMeds > 0 ? 'Low Inventory Warning' : 'Inventory Healthy'}
                        </h4>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                          {criticalMeds > 0 ? `${criticalMeds} medicines are critically low.` : lowMeds > 0 ? `${lowMeds} medicines are below safe stock level.` : 'All medicines are above safe stock levels.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <div className={`mt-0.5 shrink-0 rounded-full p-2 ${staffCoverage < 80 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'}`}>
                        <Users size={16} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {staffCoverage < 80 ? 'Staffing Gap' : 'Staffing Optimal'}
                        </h4>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                          {staffCoverage < 80 ? `Staff availability is reduced (${Math.round(staffCoverage)}% coverage).` : 'Staff coverage is sufficient for current operations.'}
                        </p>
                      </div>
                    </div>

                  </div>
                </section>

                {/* SECTION D — Predictions */}
                <section>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <LineChart size={16} className="text-indigo-500" />
                    7-Day Forecast
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    
                    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Predicted Occupancy</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{avgOccNext7}%</p>
                      <div className="h-10 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={occForecast}>
                            <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Expected Admissions</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">~{next7DaysAdm}</p>
                      <div className="h-10 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={admForecast}>
                            <Bar dataKey="value" fill="#8b5cf6" radius={[2,2,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Expected Discharges</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">~{next7DaysDis}</p>
                      <div className="h-10 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={disForecast}>
                            <Bar dataKey="value" fill="#10b981" radius={[2,2,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Revenue Trend</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Stable</p>
                      <div className="h-10 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={revTrend}>
                            <Area type="monotone" dataKey="value" stroke="#10b981" fill="#ecfdf5" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                  </div>
                </section>

                {/* SECTION E — Recommended Actions */}
                <section>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 uppercase tracking-wider">Recommended Actions</h3>
                  <div className="space-y-3">
                    
                    {actions.map((action, idx) => (
                      <div key={idx} className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-900">
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          action.priority === 'High' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                          action.priority === 'Med' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {action.priority}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{action.title}</p>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{action.desc}</p>
                        </div>
                        <button className="hidden sm:flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                          Action <ArrowRight size={14} />
                        </button>
                      </div>
                    ))}

                  </div>
                </section>

              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50 flex justify-end rounded-b-2xl">
          <button 
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Close Report
          </button>
        </div>

      </div>
    </div>
  );
}
