"use client";

import ExecutiveSummaryCard from "@/components/command-center/ExecutiveSummaryCard";
import InsightPanel from "@/components/command-center/InsightPanel";
import CoreHospitalKpisCard from "@/components/command-center/CoreHospitalKpisCard";
import CapacityIntelligenceCard from "@/components/command-center/CapacityIntelligenceCard";
import PharmacyIntelligenceCard from "@/components/command-center/PharmacyIntelligenceCard";
import ClinicalRiskCard from "@/components/command-center/ClinicalRiskCard";
import StaffIntelligenceCard from "@/components/command-center/StaffIntelligenceCard";
import FinancialIntelligenceCard from "@/components/command-center/FinancialIntelligenceCard";

export default function AdminDashboard() {
  return (
    <div id="dashboard-content" className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400">Overview</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100 sm:text-3xl">
            Hospital Command Center
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Intelligent operational summary across all modules (placeholders for now).
          </p>
        </div>
      </div>

      {/* SECTION A — Executive Intelligence Summary */}
      <ExecutiveSummaryCard />

      {/* SECTION B + C + D — KPIs, Capacity, Pharmacy (3-up row like reference) */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 items-stretch">
        <CoreHospitalKpisCard className="h-full" />

        <CapacityIntelligenceCard className="h-full" />

        <PharmacyIntelligenceCard className="h-full" />
      </section>

      {/* SECTION E + F + G + H — Bottom 4 Intelligence Cards (1 row on large screens) */}
      <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 items-stretch">
        <ClinicalRiskCard className="h-full" />

        <StaffIntelligenceCard className="h-full" />

        <FinancialIntelligenceCard className="h-full" />

        <InsightPanel title="Forecast Intelligence" chartLabel="Next 7 days" className="h-full">
          <div className="flex-1 flex flex-col gap-3 mt-1">
            <div className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 flex justify-between items-center">
              <p className="text-[13px] text-gray-500 dark:text-gray-400">Capacity Risk</p>
              <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">6.7</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 flex justify-between items-center">
              <p className="text-[13px] text-gray-500 dark:text-gray-400">Predicted Adm.</p>
              <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">48</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 flex justify-between items-center">
              <p className="text-[13px] text-gray-500 dark:text-gray-400">Predicted Occ.</p>
              <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">67%</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-gray-100 bg-[#fbfdff] p-3 text-[12px] text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 leading-snug">
            Moderate capacity risk; expected to increase slightly based on recent intake trends.
          </div>
        </InsightPanel>
      </section>
    </div>
  );
}

