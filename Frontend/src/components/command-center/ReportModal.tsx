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

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData?: any;
}

// Dummy mini chart data
const dummyTrend1 = Array.from({ length: 7 }, () => ({ value: 60 + Math.random() * 20 }));
const dummyTrend2 = Array.from({ length: 7 }, () => ({ value: 40 + Math.random() * 30 }));
const dummyTrend3 = Array.from({ length: 7 }, () => ({ value: 80 + Math.random() * 10 }));

export default function ReportModal({ isOpen, onClose, reportData }: ReportModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      document.body.style.overflow = "hidden";
    } else {
      setTimeout(() => setIsMounted(false), 300);
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen && !isMounted) return null;

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
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Stable</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Building2 size={16} className="text-indigo-500" />
                      <span>Capacity</span>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Warning</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <DollarSign size={16} className="text-emerald-500" />
                      <span>Financial</span>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Stable</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Users size={16} className="text-purple-500" />
                      <span>Staff Coverage</span>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Warning</span>
                  </div>

                  <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Risk Level Score</span>
                      <span className="text-lg font-bold text-amber-600">42<span className="text-xs text-gray-500 font-normal">/100</span></span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: '42%' }} />
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
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                      <div className="w-2 h-2 rounded-full bg-amber-500" /> Moderate
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Inventory Risk</span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" /> Low
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Staffing Risk</span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                      <div className="w-2 h-2 rounded-full bg-amber-500" /> Medium
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Financial Risk</span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                      <div className="w-2 h-2 rounded-full bg-amber-500" /> Moderate
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
                    <div className="mt-0.5 shrink-0 rounded-full bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Bed Occupancy Rising</h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Bed occupancy increased by 6% compared to yesterday.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="mt-0.5 shrink-0 rounded-full bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">ICU Utilization Stable</h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">ICU utilization is currently within safe operational limits.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="mt-0.5 shrink-0 rounded-full bg-amber-50 p-2 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                      <AlertCircle size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Inventory Alert</h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">2 critical medicines are currently below safe stock level.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="mt-0.5 shrink-0 rounded-full bg-amber-50 p-2 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                      <Users size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Staffing Gap</h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Staff availability is slightly reduced in the evening shift.</p>
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
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">82%</p>
                    <div className="h-10 w-full mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dummyTrend1}>
                          <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Expected Admissions</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">~145</p>
                    <div className="h-10 w-full mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dummyTrend2}>
                          <Bar dataKey="value" fill="#8b5cf6" radius={[2,2,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Expected Discharges</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">~130</p>
                    <div className="h-10 w-full mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dummyTrend2}>
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
                        <AreaChart data={dummyTrend3}>
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
                  
                  <div className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-900">
                    <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">High</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Increase ICU buffer capacity by 5–10%</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Based on rising high-risk patient influx.</p>
                    </div>
                    <button className="hidden sm:flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                      Action <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-900">
                    <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">High</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Reorder 2 critical medicines within 24 hours</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Inventory levels have breached safe thresholds.</p>
                    </div>
                    <button className="hidden sm:flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                      Action <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-900">
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Med</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Review staff allocation for emergency department</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Evening shift shows a slight coverage gap.</p>
                    </div>
                    <button className="hidden sm:flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                      Action <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-900">
                    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">Low</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Follow up on high-value outstanding invoices</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">To maintain healthy cash flow ratio.</p>
                    </div>
                    <button className="hidden sm:flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                      Action <ArrowRight size={14} />
                    </button>
                  </div>

                </div>
              </section>

            </div>
          </div>
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
