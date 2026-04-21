"use client";

export default function AdminDashboard() {
  return (
    <div id="dashboard-content" className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold tracking-wide text-gray-700 dark:text-gray-300 uppercase">
            OVERVIEW
          </p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
            Real Time Intelligent Dashboard
          </h1>
        </div>
      </div>
    </div>
  );
}

