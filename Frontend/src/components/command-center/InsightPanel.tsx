"use client";

import React from "react";
import TrendPlaceholder from "@/components/command-center/TrendPlaceholder";

export default function InsightPanel({
  title,
  rightSlot,
  children,
  chartLabel,
}: {
  title: string;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
  chartLabel?: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </header>

      <div className="mt-4 space-y-4">
        <TrendPlaceholder label={chartLabel ?? "Chart"} className="h-36" />

        {children ? (
          <div className="rounded-xl border border-gray-100 bg-[#fbfdff] p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}

