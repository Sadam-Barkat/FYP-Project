"use client";

import SummaryPanel from "@/components/command-center/SummaryPanel";
import KpiCard from "@/components/command-center/KpiCard";
import InsightPanel from "@/components/command-center/InsightPanel";

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
      <SummaryPanel
        title="Executive Summary"
        subtitle="Hospital operational status overview"
        leftTitle="Key Observations"
        rightTitle="Recommended Actions"
        leftItems={[
          "ICU occupancy increasing steadily",
          "7 staff absent today may affect response time",
          "20 system warnings generated today",
          "Revenue stable but outstanding payments remain high",
        ]}
        rightItems={[
          "Prepare additional ICU bed capacity",
          "Reassign staff to high-workload departments",
          "Reorder critical medicines within 24 hours",
          "Review high-severity alerts and close aging items",
        ]}
      />

      {/* SECTION B — Core Hospital KPIs */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Core Hospital KPIs</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">Placeholder values</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard title="Bed Occupancy" value="69%" trend={{ tone: "up", text: "+1%" }} description="Across all wards (placeholder)" accent="amber" />
          <KpiCard title="Active Patients" value="320" trend={{ tone: "flat", text: "0%" }} description="Currently admitted (placeholder)" accent="blue" />
          <KpiCard title="ICU Occupancy" value="72%" trend={{ tone: "down", text: "-4%" }} description="ICU utilization (placeholder)" accent="violet" />
          <KpiCard title="Critical Patients" value="18" trend={{ tone: "up", text: "+2" }} description="High severity cases (placeholder)" accent="rose" />
          <KpiCard title="Today’s Revenue" value="PKR 25,150" trend={{ tone: "flat", text: "Stable" }} description="Paid billings only (placeholder)" accent="green" />
          <KpiCard title="Staff Available" value="42 / 49" trend={{ tone: "down", text: "7 absent" }} description="On duty now (placeholder)" accent="blue" />
        </div>
      </section>

      {/* SECTION C — Capacity + SECTION D — Pharmacy */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InsightPanel title="Capacity Intelligence" chartLabel="Past 7 days">
          <p className="font-medium text-gray-900 dark:text-gray-100">Insight (placeholder)</p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
            Admissions and discharges stable this week. Emergency utilization is rising faster than other departments.
          </p>
        </InsightPanel>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <header className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Pharmacy Intelligence</h3>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
              Inventory Health: 92%
            </span>
          </header>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Inventory Health</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">92%</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Overall stock status</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Low Stock Medicines</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">4</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Below safe threshold</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Critical Shortage</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">2</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Immediate reorder</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-100 bg-[#fbfdff] p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
            2 medicines below safe stock level.
          </div>
        </section>
      </section>

      {/* SECTION E — Clinical Risk + SECTION F — Staff */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <header className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Clinical Risk Intelligence</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Placeholder indicators</span>
          </header>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Critical alerts</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">3</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Abnormal lab trends</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">5</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Emergency cases</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">2</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-gray-100 bg-[#fbfdff] p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
            Critical patients concentrated in Emergency and ICU. Prioritize review of high-severity alerts.
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <header className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Staff Intelligence</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Placeholder indicators</span>
          </header>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Staff on duty</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">22</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Absent staff</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">7</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Shift coverage</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Good</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-gray-100 bg-[#fbfdff] p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
            Coverage sufficient overall; monitor evening shift coverage for Emergency and ICU.
          </div>
        </section>
      </section>

      {/* SECTION G — Financial + SECTION H — Forecast */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <header className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Financial Intelligence</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Placeholder indicators</span>
          </header>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Revenue today</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">PKR 25.1k</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Outstanding payments</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">PKR 28k</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Expense ratio</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">41%</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-gray-100 bg-[#fbfdff] p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
            Revenue stable but outstanding payments are elevated; prioritize clearing aged pending bills.
          </div>
        </section>

        <InsightPanel title="Forecast Intelligence" chartLabel="Next 7 days">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs text-gray-500 dark:text-gray-400">Capacity Risk Score</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">6.7 (Moderate)</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs text-gray-500 dark:text-gray-400">Predicted Admissions</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">48</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs text-gray-500 dark:text-gray-400">Predicted Occupancy</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">67%</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">
            Moderate capacity risk; expected to increase slightly based on recent intake trends.
          </p>
        </InsightPanel>
      </section>
    </div>
  );
}

