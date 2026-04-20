"use client";

import React from "react";

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0066cc] dark:bg-[#60a5fa]"
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
    <section className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-wide text-[#0066cc] dark:text-[#60a5fa]">
          {title}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 sm:text-2xl">
            {subtitle}
          </h2>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
            Placeholder insights
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-[#fbfdff] p-5 dark:border-gray-800 dark:bg-gray-950">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{leftTitle}</h3>
          <BulletList items={leftItems} />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-[#fbfdff] p-5 dark:border-gray-800 dark:bg-gray-950">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{rightTitle}</h3>
          <BulletList items={rightItems} />
        </div>
      </div>
    </section>
  );
}

