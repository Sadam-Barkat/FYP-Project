"use client";

import React from "react";

export default function TrendPlaceholder({
  label = "Trend",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative h-24 w-full overflow-hidden rounded-lg border border-gray-100 bg-gradient-to-b from-white to-[#f7fbff] shadow-sm dark:border-gray-800 dark:from-gray-900 dark:to-gray-950",
        className,
      ].join(" ")}
      aria-label={`${label} placeholder`}
    >
      <div className="absolute inset-0 opacity-[0.55] dark:opacity-[0.35]">
        <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0%,rgba(0,102,204,0.10)_25%,transparent_50%,rgba(0,102,204,0.10)_75%,transparent_100%)] [background-size:220px_100%] animate-[shimmer_2.6s_linear_infinite]" />
      </div>
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium">{label}</span>
        <span className="rounded-md bg-white/70 px-2 py-0.5 text-[11px] text-gray-600 shadow-sm dark:bg-gray-900/70 dark:text-gray-300">
          Placeholder
        </span>
      </div>
    </div>
  );
}

