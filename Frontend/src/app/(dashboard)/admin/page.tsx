"use client";

/** Admin landing — compact colorful title only (top left). */
export default function AdminDashboard() {
  return (
    <div id="dashboard-content" className="mx-auto w-full max-w-[1500px]">
      <h1 className="bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500 bg-clip-text py-1 text-left text-lg font-semibold tracking-tight text-transparent sm:text-xl dark:from-sky-400 dark:via-violet-400 dark:to-fuchsia-400">
        Real-time intelligent healthcare dashboard
      </h1>
    </div>
  );
}
