"use client";

import ExecutiveSummaryCard from "@/components/command-center/ExecutiveSummaryCard";
import InsightPanel from "@/components/command-center/InsightPanel";
import CoreHospitalKpisCard from "@/components/command-center/CoreHospitalKpisCard";
import CapacityIntelligenceCard from "@/components/command-center/CapacityIntelligenceCard";
import PharmacyIntelligenceCard from "@/components/command-center/PharmacyIntelligenceCard";
import ClinicalRiskCard from "@/components/command-center/ClinicalRiskCard";
import StaffIntelligenceCard from "@/components/command-center/StaffIntelligenceCard";
import FinancialIntelligenceCard from "@/components/command-center/FinancialIntelligenceCard";
import ForecastIntelligenceCard from "@/components/command-center/ForecastIntelligenceCard";

export default function AdminDashboard() {
  return (
    <div id="dashboard-content" className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Overview</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
            Real Time Intelligent Dashboard
          </h1>
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

        <ForecastIntelligenceCard className="h-full" />
      </section>
    </div>
  );
}

