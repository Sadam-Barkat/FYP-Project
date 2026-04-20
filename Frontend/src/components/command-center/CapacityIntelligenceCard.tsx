"use client";

import React from "react";
import { Activity, Clock, TrendingUp } from "lucide-react";

function Diamond({ className }: { className: string }) {
  return <span className={["mt-1.5 h-2 w-2 rotate-45 rounded-sm", className].join(" ")} aria-hidden />;
}

function FakeLineChart() {
  return (
    <div className="relative h-44 w-full overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950">
      {/* subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#fbfdff] dark:from-gray-950 dark:via-gray-950 dark:to-gray-950" />

      {/* grid */}
      <div className="absolute inset-0 opacity-60">
        <div className="h-full w-full bg-[linear-gradient(to_right,rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:48px_48px] dark:opacity-30" />
      </div>

      {/* axes labels */}
      <div className="absolute left-3 top-3 text-xs font-medium text-gray-700 dark:text-gray-200">
        Admissions - Discharges
      </div>
      <div className="absolute left-3 bottom-3 flex gap-5 text-[11px] text-gray-500 dark:text-gray-400">
        <span>7 days</span>
        <span>5 days</span>
        <span>3 days</span>
        <span>Today</span>
      </div>
      <div className="absolute left-2 top-10 flex h-[104px] flex-col justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>5.0%</span>
        <span>4.0%</span>
        <span>3.0%</span>
      </div>

      {/* lines */}
      <svg className="absolute inset-0" viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden>
        <polyline
          points="10,120 80,90 150,110 220,70 300,95 380,60 460,80 540,35 590,30"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3.2"
        />
        <polyline
          points="10,150 80,130 150,140 220,100 300,120 380,90 460,105 540,55 590,35"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3.2"
          opacity="0.9"
        />
      </svg>
    </div>
  );
}

export default function CapacityIntelligenceCard({ className = "" }: { className?: string }) {
  return (
    <section
      className={[
        "rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900",
        className,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#e6f2ff] text-[#0066cc] dark:bg-[#0b2a52] dark:text-[#60a5fa]">
            <Activity size={18} aria-hidden />
          </span>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Capacity Intelligence</h3>
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Past 7 days</span>
      </div>

      <div className="p-6">
        <FakeLineChart />

        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-200">
          <div className="flex gap-3">
            <Diamond className="bg-amber-500" />
            <p>Admissions and discharge stable this week</p>
          </div>
          <div className="flex gap-3">
            <Diamond className="bg-rose-500" />
            <p>Emergency department utilization increasing faster than other departments.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-[#fbfdff] px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          <span className="inline-flex items-center gap-2">
            <Clock size={14} aria-hidden className="text-gray-500 dark:text-gray-400" />
            <span className="font-medium">Avidit</span>
            <span className="text-gray-400">·</span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp size={14} aria-hidden className="text-gray-500 dark:text-gray-400" />
              Alerts:
            </span>
          </span>
          <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
            ROSS 3 at risk
          </span>
          <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
            Monitor
          </span>
        </div>
      </div>
    </section>
  );
}

