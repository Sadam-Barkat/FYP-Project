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
  const accentMap: Record<string, { surface: string; dot: string; value: string }> = {
    blue: {
      surface: "bg-card-blue shadow-card-blue border-brand-blue/20",
      dot: "bg-brand-blue",
      value: "text-text-bright",
    },
    green: {
      surface: "bg-card-green shadow-card-green border-status-success/20",
      dot: "bg-status-success",
      value: "text-text-bright",
    },
    amber: {
      surface: "bg-card-amber shadow-card-amber border-status-warning/20",
      dot: "bg-status-warning",
      value: "text-text-bright",
    },
    rose: {
      surface: "bg-card-red shadow-card-red border-status-danger/20",
      dot: "bg-status-danger",
      value: "text-text-bright",
    },
    violet: {
      surface: "bg-card-purple shadow-card border-brand-purple/20",
      dot: "bg-brand-purple",
      value: "text-text-bright",
    },
  };

  const a = accentMap[accent] ?? accentMap.blue;

  const trendToneClasses =
    trend.tone === "up"
      ? "text-status-success bg-status-success/10 border-status-success/30"
      : trend.tone === "down"
        ? "text-status-danger bg-status-danger/10 border-status-danger/30"
        : "text-text-secondary bg-base-muted/30 border-base-border";

  return (
    <div
      className={[
        "rounded-2xl border p-5 shadow-card backdrop-blur-md transition-all duration-200 hover:-translate-y-1",
        "bg-base-card/70 border-base-border hover:bg-base-hover",
        a.surface,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-text-secondary text-xs font-medium uppercase tracking-widest">{title}</p>
          <p className={["mt-2 text-3xl font-bold tracking-tight tabular-nums", a.value].join(" ")}>{value}</p>
          <p className="mt-1 text-text-secondary text-xs">{description}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className={["inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium", trendToneClasses].join(" ")}>
            <span className={["h-1.5 w-1.5 rounded-full", a.dot].join(" ")} aria-hidden />
            <span className="font-medium">{trend.text}</span>
          </div>
          <div className="hidden h-8 w-14 rounded-lg border border-base-border bg-base-muted/30 xl:block" />
        </div>
      </div>
    </div>
  );
}

