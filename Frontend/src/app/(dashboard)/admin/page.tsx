"use client";

/**
 * Admin landing — Power BI–style report header: clear hierarchy, neutral palette,
 * single accent (Microsoft / Power BI inspired blues + subtle gold bar).
 */
export default function AdminDashboard() {
  return (
    <div id="dashboard-content" className="mx-auto w-full max-w-[1500px]">
      <header className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
        <div className="flex gap-0 sm:gap-4">
          <div
            className="w-1 shrink-0 rounded-l-lg bg-[#FFB900] dark:bg-[#F2C811]"
            aria-hidden
          />
          <div className="min-w-0 flex-1 px-5 py-5 sm:px-6 sm:py-6">
            <h1 className="text-xl font-semibold tracking-tight text-[#252423] dark:text-gray-100 sm:text-2xl">
              Real-time intelligent healthcare dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#605E5C] dark:text-gray-400">
              Live operational view — hospital-wide metrics and workflows in one place.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-4 text-xs font-medium text-[#605E5C] dark:border-gray-800 dark:text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#0078D4]" aria-hidden />
                Connected workspace
              </span>
              <span className="hidden sm:inline text-gray-300 dark:text-gray-600">|</span>
              <span>Metrics refresh automatically while you work</span>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
