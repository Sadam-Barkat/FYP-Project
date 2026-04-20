"use client";

import React from "react";

type TrendTone = "up" | "down" | "flat";

export default function KpiCard({
  title,
  value,
  description,
  trend = { tone: "flat", text: "—" },
  accent = "blue",
}: {
  title: string;
  value: string;
  description: string;
  trend?: { tone: TrendTone; text: string };
  accent?: "blue" | "green" | "amber" | "rose" | "violet";
}) {
  const accentMap: Record<string, { ring: string; dot: string; value: string }> = {
    blue: {
      ring: "ring-blue-100 dark:ring-blue-950/40",
      dot: "bg-blue-500",
      value: "text-[#0066cc] dark:text-[#60a5fa]",
    },
    green: {
      ring: "ring-emerald-100 dark:ring-emerald-950/40",
      dot: "bg-emerald-500",
      value: "text-emerald-700 dark:text-emerald-300",
    },
    amber: {
      ring: "ring-amber-100 dark:ring-amber-950/40",
      dot: "bg-amber-500",
      value: "text-amber-700 dark:text-amber-300",
    },
    rose: {
      ring: "ring-rose-100 dark:ring-rose-950/40",
      dot: "bg-rose-500",
      value: "text-rose-700 dark:text-rose-300",
    },
    violet: {
      ring: "ring-violet-100 dark:ring-violet-950/40",
      dot: "bg-violet-500",
      value: "text-violet-700 dark:text-violet-300",
    },
  };

  const a = accentMap[accent] ?? accentMap.blue;

  const trendToneClasses =
    trend.tone === "up"
      ? "text-emerald-700 bg-emerald-50 border-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900/60"
      : trend.tone === "down"
        ? "text-rose-700 bg-rose-50 border-rose-100 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-900/60"
        : "text-gray-600 bg-gray-50 border-gray-100 dark:text-gray-300 dark:bg-gray-900/40 dark:border-gray-800";

  return (
    <div
      className={[
        "rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ring-1 ring-transparent transition-colors dark:border-gray-800 dark:bg-gray-900",
        a.ring,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</p>
          <p className={["mt-2 text-3xl font-semibold tracking-tight", a.value].join(" ")}>{value}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className={["inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs", trendToneClasses].join(" ")}>
            <span className={["h-1.5 w-1.5 rounded-full", a.dot].join(" ")} aria-hidden />
            <span className="font-medium">{trend.text}</span>
          </div>
          <div className="hidden h-8 w-14 rounded-lg border border-gray-100 bg-[#f7fbff] dark:border-gray-800 dark:bg-gray-950 xl:block" />
        </div>
      </div>
    </div>
  );
}

