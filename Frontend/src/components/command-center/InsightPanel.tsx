"use client";

import React from "react";
import TrendPlaceholder from "@/components/command-center/TrendPlaceholder";

export default function InsightPanel({
  title,
  rightSlot,
  children,
  chartLabel,
  className = "",
}: {
  title: string;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
  chartLabel?: string;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-2xl border border-base-border bg-base-card/70 p-6 shadow-card backdrop-blur-md hover:-translate-y-1 transition-all duration-200",
        className,
      ].join(" ")}
    >
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text-bright">{title}</h3>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </header>

      <div className="mt-4 space-y-4">
        <TrendPlaceholder label={chartLabel ?? "Chart"} className="h-36" />

        {children ? (
          <div className="rounded-xl border border-base-border bg-base-muted/30 p-4 text-sm text-text-primary">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}

