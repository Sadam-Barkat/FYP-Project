"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type DetailListItem = {
  primary: string;
  secondary?: string;
  badge?: string;
};

export type DetailSection = {
  title: string;
  accent?: "green" | "red" | "yellow" | "blue" | "orange" | "neutral";
  items: DetailListItem[];
};

export type DetailBlock = {
  heading?: string;
  sections: DetailSection[];
};

export type DetailTableColumn = {
  key: string;
  label: string;
};

export type DetailTablePayload = {
  /** Optional section label above this table */
  caption?: string;
  columns: DetailTableColumn[];
  rows: Record<string, string | number | boolean | null | undefined>[];
};

export type DetailModalPayload = {
  title: string;
  subtitle?: string;
  loading?: boolean;
  /** Primary single table */
  table?: DetailTablePayload;
  /** Multiple stacked tables (e.g. invoices + trend) */
  tables?: DetailTablePayload[];
  blocks: DetailBlock[];
};

function accentChipCls(accent: DetailSection["accent"], dark: boolean): string {
  if (dark) {
    switch (accent) {
      case "green":
        return "border-kpi-green/30 bg-kpi-green/10 text-kpi-green";
      case "red":
        return "border-kpi-red/30 bg-kpi-red/10 text-kpi-red";
      case "yellow":
        return "border-tx-yellow/30 bg-yellow-500/10 text-tx-yellow";
      case "blue":
        return "border-kpi-blue/30 bg-kpi-blue/10 text-kpi-blue";
      case "orange":
        return "border-kpi-orange/30 bg-kpi-orange/10 text-kpi-orange";
      default:
        return "border-white/10 bg-white/[0.04] text-tx-secondary";
    }
  }
  switch (accent) {
    case "green":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "red":
      return "border-red-200 bg-red-50 text-red-800";
    case "yellow":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "blue":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "orange":
      return "border-orange-200 bg-orange-50 text-orange-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function cellText(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number" && !Number.isFinite(v)) return "—";
  const s = String(v);
  return s.length > 0 ? s : "—";
}

type Props = {
  open: boolean;
  payload: DetailModalPayload | null;
  htmlIsDark: boolean;
  onClose: () => void;
};

export function DashboardDetailModal({ open, payload, htmlIsDark, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !payload || typeof document === "undefined") return null;

  const backdrop = htmlIsDark
    ? "bg-black/65 backdrop-blur-[2px]"
    : "bg-slate-900/35 backdrop-blur-[2px]";
  const shell = htmlIsDark
    ? "border border-white/10 bg-[#0c1222] shadow-[0_16px_64px_rgba(0,0,0,0.55)] text-tx-primary"
    : "border border-slate-200 bg-white shadow-[0_16px_64px_rgba(15,23,42,0.12)] text-slate-900";

  const wide = Boolean(payload.table || (payload.tables && payload.tables.length > 0));
  const maxW = wide ? "max-w-5xl" : "max-w-lg";

  const tableSections: DetailTablePayload[] =
    payload.tables && payload.tables.length > 0
      ? payload.tables
      : payload.table
        ? [payload.table]
        : [];

  return createPortal(
    <div className={`fixed inset-0 z-[100100] flex items-center justify-center p-4 ${backdrop}`}>
      <div
        role="presentation"
        className="absolute inset-0"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-detail-modal-title"
        className={`relative z-[100101] flex max-h-[min(85vh,calc(100vh-32px))] w-full ${maxW} flex-col overflow-hidden rounded-2xl ${shell}`}
      >
        <header
          className={
            htmlIsDark
              ? "flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4"
              : "flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4"
          }
        >
          <div className="min-w-0 pr-8">
            <h2 id="dashboard-detail-modal-title" className="text-sm font-semibold uppercase tracking-wide">
              {payload.title}
            </h2>
            {payload.subtitle ? (
              <p className={`mt-1 text-xs leading-snug ${htmlIsDark ? "text-tx-muted" : "text-slate-500"}`}>
                {payload.subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            className={`shrink-0 rounded-xl p-1.5 transition-colors ${
              htmlIsDark
                ? "text-tx-muted hover:bg-white/[0.06] hover:text-tx-primary"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-800"
            }`}
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden flex flex-col">
          {payload.loading ? (
            <div className="flex flex-1 items-center justify-center px-6 py-16">
              <p className={`text-sm ${htmlIsDark ? "text-tx-muted" : "text-slate-500"}`}>Loading…</p>
            </div>
          ) : tableSections.length > 0 ? (
            <div
              className={`min-h-0 flex-1 overflow-auto px-3 py-3 [scrollbar-width:thin] ${
                htmlIsDark ? "bg-[#0a0f1a]" : "bg-slate-50/80"
              }`}
            >
              <div className="space-y-6">
                {tableSections.map((tbl, tIdx) => (
                  <div key={tIdx}>
                    {tbl.caption ? (
                      <p
                        className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${
                          htmlIsDark ? "text-kpi-cyan" : "text-blue-700"
                        }`}
                      >
                        {tbl.caption}
                      </p>
                    ) : null}
                    <div className="inline-block min-w-full align-middle">
                      <table className="min-w-full border-collapse text-left text-[11px]">
                        <thead
                          className={`sticky top-0 z-10 shadow-sm ${
                            htmlIsDark ? "bg-[#111827] text-tx-muted" : "bg-white text-slate-600"
                          }`}
                        >
                          <tr>
                            {tbl.columns.map((c) => (
                              <th
                                key={c.key}
                                className={`whitespace-nowrap border-b px-2 py-2 font-semibold uppercase tracking-wide ${
                                  htmlIsDark ? "border-white/10" : "border-slate-200"
                                }`}
                              >
                                {c.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tbl.rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={Math.max(1, tbl.columns.length)}
                                className={`px-3 py-8 text-center ${
                                  htmlIsDark ? "text-tx-muted" : "text-slate-500"
                                }`}
                              >
                                No rows to display.
                              </td>
                            </tr>
                          ) : (
                            tbl.rows.map((row, ri) => (
                              <tr
                                key={ri}
                                className={
                                  htmlIsDark
                                    ? "border-b border-white/[0.06] odd:bg-white/[0.02] hover:bg-white/[0.04]"
                                    : "border-b border-slate-200/80 odd:bg-white hover:bg-slate-100/80"
                                }
                              >
                                {tbl.columns.map((c) => (
                                  <td
                                    key={c.key}
                                    className={`max-w-[220px] whitespace-normal break-words px-2 py-2 align-top tabular-nums ${
                                      htmlIsDark ? "text-tx-primary" : "text-slate-800"
                                    }`}
                                  >
                                    {cellText(row[c.key])}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin] space-y-5">
              {payload.blocks.map((block, bi) => (
                <section key={`b-${bi}`} className="space-y-3">
                  {block.heading ? (
                    <h3
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        htmlIsDark ? "text-kpi-cyan" : "text-blue-700"
                      }`}
                    >
                      {block.heading}
                    </h3>
                  ) : null}
                  {block.sections.map((sec, si) => (
                    <div
                      key={`${bi}-s-${si}`}
                      className="rounded-xl overflow-hidden border border-dash-border/50 dark:border-white/[0.08]"
                    >
                      <div
                        className={`flex items-start justify-between gap-2 px-3 py-2 text-[11px] font-semibold ${
                          htmlIsDark ? "bg-white/[0.03] text-tx-primary" : "bg-slate-50 text-slate-800"
                        }`}
                      >
                        <span>{sec.title}</span>
                      </div>
                      <ul className="divide-y divide-dash-border/40 dark:divide-white/[0.06]">
                        {sec.items.length === 0 ? (
                          <li
                            className={`px-3 py-3 text-[11px] ${htmlIsDark ? "text-tx-muted" : "text-slate-500"}`}
                          >
                            No records in this section.
                          </li>
                        ) : (
                          sec.items.map((it, ii) => (
                            <li
                              key={`${bi}-${si}-${ii}`}
                              className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 ${
                                htmlIsDark ? "bg-transparent" : "bg-white"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-medium">{it.primary}</p>
                                {it.secondary ? (
                                  <p
                                    className={`mt-0.5 truncate text-[10px] ${
                                      htmlIsDark ? "text-tx-muted" : "text-slate-500"
                                    }`}
                                  >
                                    {it.secondary}
                                  </p>
                                ) : null}
                              </div>
                              {it.badge ? (
                                <span
                                  className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase shrink-0 ${accentChipCls(
                                    sec.accent,
                                    htmlIsDark,
                                  )}`}
                                >
                                  {it.badge}
                                </span>
                              ) : null}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
