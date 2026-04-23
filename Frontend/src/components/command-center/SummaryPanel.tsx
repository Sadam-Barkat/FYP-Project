"use client";

import React from "react";

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm text-text-primary">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue shadow-glow-blue"
            aria-hidden
          />
          <span className="min-w-0">{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SummaryPanel({
  title,
  subtitle,
  leftTitle,
  rightTitle,
  leftItems,
  rightItems,
}: {
  title: string;
  subtitle: string;
  leftTitle: string;
  rightTitle: string;
  leftItems: string[];
  rightItems: string[];
}) {
  return (
    <section className="rounded-2xl border border-base-border bg-base-card/70 p-7 shadow-card backdrop-blur-md hover:-translate-y-1 transition-all duration-200">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-widest text-brand-blue uppercase">
          {title}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold text-text-bright sm:text-2xl">
            {subtitle}
          </h2>
          <span className="rounded-full border border-base-border bg-base-muted/30 px-3 py-1 text-xs font-medium text-text-secondary">
            Placeholder insights
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-base-border bg-base-muted/30 p-5">
          <h3 className="text-sm font-semibold text-text-bright">{leftTitle}</h3>
          <BulletList items={leftItems} />
        </div>

        <div className="rounded-2xl border border-base-border bg-base-muted/30 p-5">
          <h3 className="text-sm font-semibold text-text-bright">{rightTitle}</h3>
          <BulletList items={rightItems} />
        </div>
      </div>
    </section>
  );
}

