"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Users,
  Bed,
  LayoutGrid,
  AlertTriangle,
  UserCheck,
  DollarSign,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useRealtimeEvent } from "@/hooks/useRealtimeEvent";

const cardBase =
  "relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 cursor-default p-4 pb-[48%] bg-white border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 dark:bg-transparent dark:border-0 dark:shadow-none dark:hover:-translate-y-1";

function makeSparkData(value: number) {
  const v = Number.isFinite(value) ? value : 0;
  return Array.from({ length: 14 }, (_, i) => ({
    v: Math.round(v * (0.82 + Math.sin(i * 0.75 + (v % 3)) * 0.16)),
  }));
}

// ── Patient Intelligence: prediction derivation (pure, no new fetch) ──────
type PredictionDirection = "up" | "down" | "stable";
type PredictionPack = {
  current: number;
  trend: number[];
  prediction: number[];
  delta: number;
  direction: PredictionDirection;
  confidence: number;
  explanation: string;
};

function derivePrediction(
  current: number,
  history: number[] | undefined,
  llmExplanation: string | undefined
): PredictionPack {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const trend: number[] =
    history && history.length >= 4
      ? history.slice(-7)
      : [
          +(safeCurrent * 0.7).toFixed(1),
          +(safeCurrent * 0.76).toFixed(1),
          +(safeCurrent * 0.82).toFixed(1),
          +(safeCurrent * 0.88).toFixed(1),
          +(safeCurrent * 0.93).toFixed(1),
          +(safeCurrent * 0.97).toFixed(1),
          +safeCurrent.toFixed(1),
        ];

  const a = trend[trend.length - 2] ?? safeCurrent;
  const b = trend[trend.length - 1] ?? safeCurrent;
  const delta = +(b - a).toFixed(1);
  const direction: PredictionDirection =
    delta > 0.3 ? "up" : delta < -0.3 ? "down" : "stable";

  const prediction = Array.from({ length: 7 }, (_, i) =>
    +(safeCurrent + delta * (1 + i * 0.55)).toFixed(1)
  );

  const confidence = history ? 0.92 : 0.74;
  const explanation =
    llmExplanation ||
    (direction === "up"
      ? "Trend is rising. Prioritize early intervention and closer monitoring for high-risk patients."
      : direction === "down"
      ? "Trend indicates improving stability. Maintain current protocols and watch for outliers."
      : "Trend is stable. Continue routine monitoring; no significant change predicted over the next week.");

  return {
    current: safeCurrent,
    trend,
    prediction,
    delta,
    direction,
    confidence,
    explanation,
  };
}

function miniInsightText(
  kind: "patients" | "vitals" | "critical",
  p: PredictionPack
): string {
  const d3 = p.prediction[2] ?? p.current;
  if (kind === "patients") {
    const verb =
      p.direction === "up" ? "increase" : p.direction === "down" ? "decrease" : "hold";
    return `Expected to ${verb} to ~${Math.round(d3)} in 3 days.`;
  }
  if (kind === "critical") {
    if (p.direction === "up") return `Risk rising; projected ~${d3.toFixed(1)}% in 3 days.`;
    if (p.direction === "down")
      return `Improving; projected ~${d3.toFixed(1)}% in 3 days.`;
    return `Stable; projected ~${d3.toFixed(1)}% in 3 days.`;
  }
  if (p.direction === "down")
    return `Vitals health trending down; projected ~${d3.toFixed(1)}% in 3 days.`;
  if (p.direction === "up")
    return `Vitals health improving; projected ~${d3.toFixed(1)}% in 3 days.`;
  return `Vitals health stable; projected ~${d3.toFixed(1)}% in 3 days.`;
}

function PatientStatModal({
  open,
  onClose,
  title,
  unit,
  accentHex,
  pack,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  unit: string;
  accentHex: string;
  pack: PredictionPack;
}) {
  if (!open) return null;

  const combined = [
    ...pack.trend.map((v, i) => ({
      label: `H${i + 1}`,
      actual: v,
      forecast: undefined as number | undefined,
    })),
    ...pack.prediction.map((v, i) => ({
      label: `+${i + 1}`,
      actual: undefined as number | undefined,
      forecast: v,
    })),
  ];
  if (combined[pack.trend.length - 1]) {
    combined[pack.trend.length - 1].forecast = pack.trend[pack.trend.length - 1];
  }

  const confPct = Math.round(pack.confidence * 100);
  const deltaSign = pack.delta > 0 ? "+" : "";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/35 backdrop-blur-[10px] dark:bg-[rgba(5,7,15,0.82)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-dash-card dark:shadow-panel">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: accentHex, boxShadow: `0 0 10px ${accentHex}80` }}
            />
            <p className="text-gray-900 font-bold text-base dark:text-tx-bright">{title} — Forecast</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:text-gray-900 hover:border-gray-300 transition-all dark:border-white/10 dark:bg-dash-elevated dark:text-tx-secondary dark:hover:text-tx-primary dark:hover:border-white/25"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/[0.06] dark:bg-dash-elevated dark:shadow-none">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-tx-muted">
                Current
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums" style={{ color: accentHex }}>
                {pack.current.toFixed(unit ? 1 : 0)}
                {unit}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/[0.06] dark:bg-dash-elevated dark:shadow-none">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-tx-muted">
                Change (today vs yesterday)
              </p>
              <p className="mt-2 text-lg font-bold tabular-nums text-gray-900 dark:text-tx-bright">
                {deltaSign}
                {pack.delta}
                {unit}
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-tx-secondary">{pack.direction.toUpperCase()}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/[0.06] dark:bg-dash-elevated dark:shadow-none">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-tx-muted">
                Confidence
              </p>
              <p className="mt-2 text-lg font-black tabular-nums text-kpi-green">{confPct}%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dash-border">
                <div
                  className="h-full rounded-full bg-kpi-green"
                  style={{ width: `${confPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.06] dark:bg-dash-elevated dark:shadow-none">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 dark:text-tx-secondary">
                Historical + 7-day projection
              </p>
              <p className="text-[10px] text-gray-500 dark:text-tx-muted">Click outside to close</p>
            </div>
            <div className="mt-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combined} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`pgrad-${accentHex.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={accentHex} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={accentHex} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" hide />
                  <YAxis hide />
                  <ReferenceLine
                    x={combined[pack.trend.length - 1]?.label}
                    stroke="rgba(255,255,255,0.18)"
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke={accentHex}
                    strokeWidth={2}
                    fill={`url(#pgrad-${accentHex.replace("#", "")})`}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    fill="transparent"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "#0d1326",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      fontSize: 11,
                      color: "#e8eeff",
                    }}
                    // Recharts typing is strict; keep formatter permissive.
                    formatter={(v: unknown, name: unknown) => {
                      const num = typeof v === "number" ? v : undefined;
                      const n = String(name ?? "");
                      return [
                        `${typeof num === "number" ? num : "—"}${unit}`,
                        n === "actual" ? "Actual" : "Forecast",
                      ] as const;
                    }}
                    labelStyle={{ color: "#6b82a8" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-kpi-orange/20 bg-kpi-orange/8 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-kpi-orange">
              Decision insight
            </p>
            <p className="mt-2 text-sm leading-relaxed text-tx-primary">{pack.explanation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PharmacyStatModal({
  open,
  onClose,
  title,
  unit,
  accentHex,
  pack,
  helperText,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  unit: string;
  accentHex: string;
  pack: PredictionPack;
  helperText: string;
}) {
  if (!open) return null;
  return (
    <PatientStatModal
      open={open}
      onClose={onClose}
      title={title}
      unit={unit}
      accentHex={accentHex}
      pack={{
        ...pack,
        explanation: helperText || pack.explanation,
      }}
    />
  );
}

export type TotalPatientsBreakdown = {
  in_hospital?: number | null;
  /** Same census definition as in_hospital, for previous calendar day (trend baseline). */
  in_hospital_yesterday?: number | null;
  admitted_today?: number | null;
  discharged_today?: number | null;
  under_observation?: number | null;
  outpatient?: number | null;
};

export type ActiveAdmissionsBreakdown = {
  male?: number | null;
  female?: number | null;
  children?: number | null;
  elderly?: number | null;
};

export type AvailableBedsBreakdown = {
  total_beds?: number | null;
  occupied?: number | null;
  available?: number | null;
  under_maintenance?: number | null;
};

export type CriticalPatientsBreakdown = {
  critical?: number | null;
  emergency?: number | null;
  stable?: number | null;
  under_observation?: number | null;
};

export type StaffOnDutyBreakdown = {
  doctors?: number | null;
  nurses?: number | null;
  admin?: number | null;
  finance?: number | null;
  laboratorians?: number | null;
  receptionists?: number | null;
};

export type RevenueTodayBreakdown = {
  paid?: number | null;
  pending?: number | null;
  total_transactions?: number | null;
  largest_bill?: number | null;
};

export type HospitalOverviewKpis = {
  total_patients?: number | null;
  active_admissions?: number | null;
  available_beds?: number | null;
  critical_patients?: number | null;
  staff_on_duty?: number | null;
  revenue_today?: number | null;
  total_patients_trend?: string | null;
  active_admissions_trend?: string | null;
  available_beds_trend?: string | null;
  critical_patients_trend?: string | null;
  staff_on_duty_trend?: string | null;
  revenue_today_trend?: string | null;
  total_patients_breakdown?: TotalPatientsBreakdown | null;
  active_admissions_breakdown?: ActiveAdmissionsBreakdown | null;
  available_beds_breakdown?: AvailableBedsBreakdown | null;
  critical_patients_breakdown?: CriticalPatientsBreakdown | null;
  staff_on_duty_breakdown?: StaffOnDutyBreakdown | null;
  revenue_today_breakdown?: RevenueTodayBreakdown | null;
};

export type PatientIntelResponse = {
  total_patients: number;
  previous_week_patients: number;
  change_from_last_week: number;
  vitals_health_percentage: number;
  critical_vitals_percentage: number;
  at_risk_count: number;
  top_risk_patients: string;
  ai_prediction:
    | string
    | {
        summary?: string;
        risk_level?: string;
        recommendation?: string;
        generated_by?: string;
      };
};

export type PharmacyIntelResponse = {
  total_medicines: number;
  out_of_stock_count: number;
  low_stock_count: number;
  sufficient_stock_count: number;
  expiring_soon_count: number;
  expired_count: number;
  out_of_stock_medicines?: string[];
  low_stock_medicines?: string[];
  expiring_soon_medicines?: string[];
  expired_medicines?: string[];
  stockout_prediction: string;
  medicines_to_reorder: string[];
  expiry_warning: string;
  suggestion: string;
};

type PharmacyStatHover = "oos" | "low" | "soon" | "expired" | null;

function PharmacyMedicineTooltip({
  open,
  title,
  names,
}: {
  open: boolean;
  title: string;
  names: string[];
}) {
  if (!open) return null;
  const needsScroll = names.length > 10;
  return (
    <div className="absolute left-full top-1/2 z-[60] ml-2 min-w-[180px] max-w-[220px] -translate-y-1/2">
      <div
        className={`pointer-events-auto rounded-2xl border border-brand-blue/30 bg-base-card/90 px-3 py-2 shadow-nav backdrop-blur-md ${
          needsScroll
            ? "max-h-44 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
            : ""
        }`}
      >
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-brand-blue">
          {title}
        </p>
        {names.length === 0 ? (
          <p className="text-[10px] text-text-secondary">None</p>
        ) : (
          <ul className="space-y-0.5 text-[10px] leading-snug text-text-primary">
            {names.map((n, i) => (
              <li key={`${n}-${i}`} className="break-words">
                {n}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatKpiDisplay(
  data: HospitalOverviewKpis | null,
  valueKey: keyof HospitalOverviewKpis,
  kind: "int" | "currency"
): string {
  if (!data) return "—";
  const raw = data[valueKey];
  if (raw === null || raw === undefined) return "—";
  if (kind === "currency") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "—";
    return `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function trendTextClass(trend: string | null | undefined): string {
  const s = (trend ?? "").trim();
  if (!s || s === "N/A") return "text-slate-600 dark:text-tx-secondary";
  if (s.startsWith("+")) return "text-green-700 dark:text-emerald-50";
  if (s.startsWith("-")) return "text-red-700 dark:text-red-100";
  return "text-slate-600 dark:text-tx-secondary";
}

function trendPillClass(trend: string | null | undefined): string {
  const s = (trend ?? "").trim();
  // Light: soft SaaS pills. Dark: translucent glass on KPI gradients (not solid slate).
  const darkNeutral =
    "dark:border dark:border-white/10 dark:bg-white/[0.08] dark:backdrop-blur-sm";
  const darkPositive =
    "dark:border dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:backdrop-blur-sm";
  const darkNegative =
    "dark:border dark:border-red-400/30 dark:bg-red-500/20 dark:backdrop-blur-sm";

  if (!s || s === "N/A")
    return `bg-slate-100 border border-slate-200 ${darkNeutral}`;
  if (s.startsWith("+"))
    return `bg-green-50 border border-green-200 ${darkPositive}`;
  if (s.startsWith("-"))
    return `bg-red-50 border border-red-200 ${darkNegative}`;
  // e.g. "0%" — same as neutral
  return `bg-slate-100 border border-slate-200 ${darkNeutral}`;
}

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatRs(value: number): string {
  return `Rs. ${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function kpiTooltipContent(
  cardLabel: string,
  data: HospitalOverviewKpis | null
): { title: string; rows: { label: string; value: string }[] } {
  const d = data;
  switch (cardLabel) {
    case "Patients today": {
      const b = d?.total_patients_breakdown;
      return {
        title: "Patient Breakdown",
        rows: [
          {
            label: "Patients today (census EOD):",
            value: String(asNum(b?.in_hospital)),
          },
          {
            label: "Patients yesterday (EOD):",
            value: String(asNum(b?.in_hospital_yesterday)),
          },
          { label: "Admitted Today:", value: String(asNum(b?.admitted_today)) },
          { label: "Discharged Today:", value: String(asNum(b?.discharged_today)) },
          { label: "Under Observation:", value: String(asNum(b?.under_observation)) },
          { label: "Outpatient:", value: String(asNum(b?.outpatient)) },
        ],
      };
    }
    case "Active Admissions": {
      const b = d?.active_admissions_breakdown;
      return {
        title: "Admissions Breakdown",
        rows: [
          { label: "Male Patients:", value: String(asNum(b?.male)) },
          { label: "Female Patients:", value: String(asNum(b?.female)) },
          { label: "Children (under 18):", value: String(asNum(b?.children)) },
          { label: "Elderly (60+):", value: String(asNum(b?.elderly)) },
        ],
      };
    }
    case "Available Beds": {
      const b = d?.available_beds_breakdown;
      return {
        title: "Bed Status Breakdown",
        rows: [
          { label: "Total Beds:", value: String(asNum(b?.total_beds)) },
          { label: "Currently Occupied:", value: String(asNum(b?.occupied)) },
          { label: "Available Now:", value: String(asNum(b?.available)) },
          { label: "Under Maintenance:", value: String(asNum(b?.under_maintenance)) },
        ],
      };
    }
    case "Critical Patients": {
      const b = d?.critical_patients_breakdown;
      return {
        title: "Patient Condition Breakdown",
        rows: [
          { label: "🔴 Critical:", value: String(asNum(b?.critical)) },
          { label: "🚨 Emergency:", value: String(asNum(b?.emergency)) },
          { label: "🟡 Under Observation:", value: String(asNum(b?.under_observation)) },
          { label: "🟢 Stable:", value: String(asNum(b?.stable)) },
        ],
      };
    }
    case "Staff On Duty": {
      const b = d?.staff_on_duty_breakdown;
      return {
        title: "Staff Role Breakdown",
        rows: [
          { label: "👨‍⚕️ Doctors:", value: String(asNum(b?.doctors)) },
          { label: "👩‍⚕️ Nurses:", value: String(asNum(b?.nurses)) },
          { label: "🧪 Laboratorians:", value: String(asNum(b?.laboratorians)) },
          { label: "💰 Finance:", value: String(asNum(b?.finance)) },
          { label: "🏥 Receptionists:", value: String(asNum(b?.receptionists)) },
          { label: "⚙️ Admin:", value: String(asNum(b?.admin)) },
        ],
      };
    }
    case "Revenue Today": {
      const b = d?.revenue_today_breakdown;
      return {
        title: "Revenue Breakdown",
        rows: [
          { label: "✅ Paid Amount:", value: formatRs(asNum(b?.paid)) },
          { label: "⏳ Pending Amount:", value: formatRs(asNum(b?.pending)) },
          {
            label: "Total Transactions:",
            value: String(asNum(b?.total_transactions)),
          },
          { label: "Largest Bill:", value: formatRs(asNum(b?.largest_bill)) },
        ],
      };
    }
    default:
      return { title: "", rows: [] };
  }
}

function intelFooterUpdated(at: Date | null, tick: number): string {
  void tick;
  if (!at) return "last updated —";
  const m = Math.floor((Date.now() - at.getTime()) / 60000);
  if (m < 1) return "last updated just now";
  return `last updated ${m} mins ago`;
}

function healthPctClass(pct: number): string {
  if (pct >= 70) return "text-status-success";
  if (pct >= 50) return "text-status-warning";
  return "text-status-danger";
}

function changeVsWeekUi(delta: number): { arrow: string; cls: string; tail: string } {
  if (delta > 0) {
    return { arrow: "↑", cls: "text-status-success", tail: `${delta} vs last week` };
  }
  if (delta < 0) {
    return {
      arrow: "↓",
      cls: "text-status-danger",
      tail: `${Math.abs(delta)} vs last week`,
    };
  }
  return { arrow: "—", cls: "text-text-secondary", tail: "0 vs last week" };
}

type ParsedAiForecast = {
  summary: string;
  names: string[];
  suggestion: string;
  rawFallback: string;
};

function coerceAiPredictionToText(ai: PatientIntelResponse["ai_prediction"]): string {
  if (typeof ai === "string") return ai;
  if (ai && typeof ai === "object") {
    return String(ai.summary ?? ai.recommendation ?? "");
  }
  return "";
}

/** Parses LLM output when it follows SUMMARY: / NAMES: / SUGGESTION: sections. */
function parseAiForecast(text: string): ParsedAiForecast {
  const raw = (text || "").trim();
  if (!raw) {
    return { summary: "", names: [], suggestion: "", rawFallback: "" };
  }

  const reSummary = /SUMMARY\s*:\s*([\s\S]*?)(?=\bNAMES\s*:)/i;
  const reNames = /NAMES\s*:\s*([\s\S]*?)(?=\bSUGGESTION\s*:)/i;
  const reSugg = /SUGGESTION\s*:\s*([\s\S]*)$/i;

  const mS = raw.match(reSummary);
  const mN = raw.match(reNames);
  const mG = raw.match(reSugg);

  if (mS && mN && mG) {
    const summary = mS[1].trim();
    const namesBlock = mN[1].trim();
    const suggestion = mG[1].trim();
    const names: string[] = [];
    for (const line of namesBlock.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      const num = t.match(/^\d+\.\s*(.+)$/);
      if (num) names.push(num[1].trim());
    }
    return { summary, names, suggestion, rawFallback: "" };
  }

  return { summary: "", names: [], suggestion: "", rawFallback: raw };
}

const KPI_CARD_DEFS = [
  {
    label: "Patients today",
    valueKey: "total_patients" as const,
    trendKey: "total_patients_trend" as const,
    icon: Users,
    accent:
      "before:content-[''] before:absolute before:left-0 before:top-0 before:h-[3px] before:w-full before:bg-blue-500 before:pointer-events-none dark:bg-kpi-blue dark:shadow-kpi-blue dark:hover:shadow-kpi-blue-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-blue-600 dark:bg-kpi-blue/20 dark:border-kpi-blue/30 dark:text-kpi-blue",
    kind: "int" as const,
    chart: "area" as const,
    stroke: "#3b82f6",
    gradId: "blue",
  },
  {
    label: "Active Admissions",
    valueKey: "active_admissions" as const,
    trendKey: "active_admissions_trend" as const,
    icon: Bed,
    accent:
      "before:content-[''] before:absolute before:left-0 before:top-0 before:h-[3px] before:w-full before:bg-purple-500 before:pointer-events-none dark:bg-kpi-purple dark:shadow-kpi-purple dark:hover:shadow-kpi-purple-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-purple-600 dark:bg-kpi-purple/20 dark:border-kpi-purple/30 dark:text-kpi-purple",
    kind: "int" as const,
    chart: "area" as const,
    stroke: "#a855f7",
    gradId: "purple",
  },
  {
    label: "Available Beds",
    valueKey: "available_beds" as const,
    trendKey: "available_beds_trend" as const,
    icon: LayoutGrid,
    accent:
      "before:content-[''] before:absolute before:left-0 before:top-0 before:h-[3px] before:w-full before:bg-cyan-500 before:pointer-events-none dark:bg-kpi-cyan dark:shadow-kpi-cyan dark:hover:shadow-kpi-cyan-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-cyan-600 dark:bg-kpi-cyan/20 dark:border-kpi-cyan/30 dark:text-kpi-cyan",
    kind: "int" as const,
    chart: "area" as const,
    stroke: "#06b6d4",
    gradId: "cyan",
  },
  {
    label: "Critical Patients",
    valueKey: "critical_patients" as const,
    trendKey: "critical_patients_trend" as const,
    icon: AlertTriangle,
    accent:
      "before:content-[''] before:absolute before:left-0 before:top-0 before:h-[3px] before:w-full before:bg-red-500 before:pointer-events-none dark:bg-kpi-red dark:shadow-kpi-red dark:hover:shadow-kpi-red-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-red-600 dark:bg-kpi-red/20 dark:border-kpi-red/30 dark:text-kpi-red",
    kind: "int" as const,
    chart: "bar" as const,
    stroke: "#ef4444",
    gradId: "red",
  },
  {
    label: "Staff On Duty",
    valueKey: "staff_on_duty" as const,
    trendKey: "staff_on_duty_trend" as const,
    icon: UserCheck,
    accent:
      "before:content-[''] before:absolute before:left-0 before:top-0 before:h-[3px] before:w-full before:bg-green-500 before:pointer-events-none dark:bg-kpi-green dark:shadow-kpi-green dark:hover:shadow-kpi-green-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-green-600 dark:bg-kpi-green/20 dark:border-kpi-green/30 dark:text-kpi-green",
    kind: "int" as const,
    chart: "area" as const,
    stroke: "#22c55e",
    gradId: "green",
  },
  {
    label: "Revenue Today",
    valueKey: "revenue_today" as const,
    trendKey: "revenue_today_trend" as const,
    icon: DollarSign,
    accent:
      "before:content-[''] before:absolute before:left-0 before:top-0 before:h-[3px] before:w-full before:bg-orange-500 before:pointer-events-none dark:bg-kpi-orange dark:shadow-kpi-orange dark:hover:shadow-kpi-orange-hover",
    iconWrap:
      "w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-orange-600 dark:bg-kpi-orange/20 dark:border-kpi-orange/30 dark:text-kpi-orange",
    kind: "currency" as const,
    chart: "area" as const,
    stroke: "#f97316",
    gradId: "orange",
  },
] as const;

export default function AdminDashboard() {
  const [kpiData, setKpiData] = useState<HospitalOverviewKpis | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiHover, setKpiHover] = useState<string | null>(null);
  const kpiHasLoadedOnce = useRef(false);

  const [intelData, setIntelData] = useState<PatientIntelResponse | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);
  const [intelLastFetch, setIntelLastFetch] = useState<Date | null>(null);
  const [intelClock, setIntelClock] = useState(0);
  const [expandedIntelCard, setExpandedIntelCard] = useState<
    "patients" | "vitals" | "critical" | null
  >(null);

  const [pharmacyData, setPharmacyData] = useState<PharmacyIntelResponse | null>(
    null
  );
  const [pharmacyLoading, setPharmacyLoading] = useState(true);
  const [pharmacyLastFetch, setPharmacyLastFetch] = useState<Date | null>(null);
  const [pharmacyStatHover, setPharmacyStatHover] =
    useState<PharmacyStatHover>(null);
  const [expandedPharmacyCard, setExpandedPharmacyCard] = useState<
    "total" | "oos" | "low" | "soon" | "expired" | null
  >(null);

  const loadKpis = useCallback(async () => {
    if (!kpiHasLoadedOnce.current) {
      setKpiLoading(true);
    }
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/hospital-overview`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HospitalOverviewKpis;
      setKpiData(data);
      kpiHasLoadedOnce.current = true;
    } catch {
      if (!kpiHasLoadedOnce.current) {
        setKpiData(null);
      }
    } finally {
      setKpiLoading(false);
    }
  }, []);

  const loadIntel = useCallback(async () => {
    setIntelLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/patient-intelligence`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PatientIntelResponse;
      setIntelData(data);
      setIntelLastFetch(new Date());
    } catch {
      setIntelData(null);
    } finally {
      setIntelLoading(false);
    }
  }, []);

  const loadPharmacy = useCallback(async () => {
    setPharmacyLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/pharmacy-intelligence`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PharmacyIntelResponse;
      setPharmacyData(data);
      setPharmacyLastFetch(new Date());
    } catch {
      setPharmacyData(null);
    } finally {
      setPharmacyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    void loadIntel();
  }, [loadIntel]);

  useEffect(() => {
    void loadPharmacy();
  }, [loadPharmacy]);

  useRealtimeEvent(["vitals_updated", "admin_data_changed"], () => {
    void loadKpis();
    void loadIntel();
    void loadPharmacy();
  });

  useEffect(() => {
    const id = window.setInterval(() => setIntelClock((c) => c + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      id="dashboard-content"
      className="admin-overview-theme min-h-[calc(100dvh-72px)] w-full bg-gray-50 px-6 py-3 space-y-3 overflow-y-auto text-gray-900 dark:bg-dash-bg dark:text-tx-primary"
    >
      <div className="flex items-center justify-end gap-2 text-slate-400 text-xs dark:text-tx-secondary">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-green opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-kpi-green" />
        </span>
        <span>Last updated: just now</span>
      </div>
      {/* KPI row — data from GET /api/hospital-overview */}
      <section className="shrink-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 bg-transparent">
        {KPI_CARD_DEFS.map((k) => {
          const Icon = k.icon;
          const displayValue = formatKpiDisplay(kpiData, k.valueKey, k.kind);
          const seedValue = Number(kpiData?.[k.valueKey] ?? 0);
          const value = Number.isFinite(seedValue) ? seedValue : 0;
          const trendRaw = kpiData?.[k.trendKey];
          const trendStr =
            trendRaw === null || trendRaw === undefined || trendRaw === ""
              ? "N/A"
              : String(trendRaw);
          const trendLine =
            trendStr === "N/A"
              ? "N/A vs yesterday"
              : `${trendStr} vs yesterday`;
          const { title: tipTitle, rows: tipRows } = kpiTooltipContent(
            k.label,
            kpiData
          );
          const showTip =
            !kpiLoading && kpiHover === k.label && tipRows.length > 0;
          const sparkData = makeSparkData(value);
          return (
            <div
              key={k.label}
              className="relative"
              onMouseEnter={() => setKpiHover(k.label)}
              onMouseLeave={() => setKpiHover(null)}
            >
              <div className={`${cardBase} ${k.accent}`}>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={k.iconWrap}>
                      <Icon className="w-4 h-4" aria-hidden />
                    </div>
                    <h3 className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest dark:text-tx-secondary">
                      {k.label}
                    </h3>
                  </div>
                  <div
                    className="mb-2 flex min-h-[2.25rem] items-center"
                  >
                  {kpiLoading ? (
                    <div
                      className="h-8 w-24 max-w-full animate-pulse rounded-xl bg-slate-100 dark:bg-white/8"
                      aria-hidden
                    />
                  ) : (
                    <p
                      className="text-slate-900 font-black text-3xl tabular-nums leading-none dark:text-tx-bright"
                    >
                      {displayValue}
                    </p>
                  )}
                </div>
                <p
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium w-fit ${trendPillClass(trendStr)}`}
                >
                  <span className={kpiLoading ? "text-slate-600 dark:text-tx-secondary" : trendTextClass(trendStr)}>
                    {kpiLoading ? "N/A vs yesterday" : trendLine}
                  </span>
                </p>
              </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-[44%] pointer-events-none">
                <ResponsiveContainer width="100%" height="100%">
                  {k.chart === "bar" ? (
                    <BarChart
                      data={sparkData}
                      margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                      barSize={6}
                    >
                      <Bar
                        dataKey="v"
                        fill="#ef4444"
                        radius={[2, 2, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  ) : (
                    <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient
                          id={`grad-${k.gradId}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor={k.stroke} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={k.stroke} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={k.stroke}
                        strokeWidth={1.5}
                        fill={`url(#grad-${k.gradId})`}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div
                className={`pointer-events-none absolute left-1/2 top-full z-50 mt-2 flex w-[220px] -translate-x-1/2 flex-col items-center transition-opacity duration-200 ${
                  showTip ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden={!showTip}
              >
                <div
                  className="h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent border-b-base-border"
                  aria-hidden
                />
                <div className="-mt-px w-full rounded-2xl border border-base-border bg-base-card px-3 py-2.5 shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
                  <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                    {tipTitle}
                  </p>
                  <div className="space-y-1.5">
                    {tipRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex justify-between gap-2 text-xs leading-snug"
                      >
                        <span className="text-text-secondary">{row.label}</span>
                        <span className="shrink-0 pl-1 text-right font-semibold text-text-primary">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Patient Intelligence — GET /api/patient-intelligence (2-col row for future cards) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] overflow-hidden dark:bg-panel dark:border-white/[0.06] dark:shadow-panel">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dash-border">
            <div className="flex items-center gap-3">
              <span className="text-xl" aria-hidden>
                🧠
              </span>
              <h2 className="text-tx-bright font-bold text-lg">Patient Intelligence</h2>
            </div>
            <div className="flex items-center gap-2">
              {intelData ? (
                <span className="whitespace-nowrap text-tx-secondary text-xs">
                  {intelFooterUpdated(intelLastFetch, intelClock)}
                </span>
              ) : null}
              {intelData ? (
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-red opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-kpi-red" />
                </span>
              ) : null}
            </div>
          </div>

          {!intelData && !intelLoading ? (
            <p className="mt-2 text-xs text-text-muted">
              Unable to load. Check admin access and API.
            </p>
          ) : null}
          {intelLoading && !intelData ? (
            <div className="mt-2 h-36 animate-pulse rounded-md bg-base-glow/50" />
          ) : null}

          {intelData ? (
            <div className="h-full grid grid-cols-[200px_1fr_1fr] gap-0 divide-x divide-dash-border">
              <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-dash-border p-0">
                <div className="flex flex-col p-4">
                  {(() => {
                    const u = changeVsWeekUi(intelData.change_from_last_week);
                    const pack = derivePrediction(intelData.total_patients, undefined, undefined);
                    return (
                      <div
                        className="group h-full cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedIntelCard("patients")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setExpandedIntelCard("patients");
                        }}
                      >
                        <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                          Total Patients
                        </p>
                        <p className="text-tx-bright font-black text-2xl tabular-nums leading-none">
                          {intelData.total_patients}
                        </p>
                        <p className={`text-xs font-medium mt-1 ${u.cls}`}>
                          {u.arrow} {u.tail}
                        </p>
                        <div className="mt-2 h-10 -mx-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={pack.trend.map((v, i) => ({ x: i, v }))}
                              margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="intel-patients-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.22} />
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="v"
                                stroke="#3b82f6"
                                strokeWidth={1.6}
                                fill="url(#intel-patients-grad)"
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="mt-1 text-[10px] text-tx-secondary">
                          {miniInsightText("patients", pack)}
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex flex-col p-4">
                  {(() => {
                    const pack = derivePrediction(
                      intelData.vitals_health_percentage,
                      undefined,
                      undefined
                    );
                    return (
                      <div
                        className="group h-full cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedIntelCard("vitals")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setExpandedIntelCard("vitals");
                        }}
                      >
                        <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                          Vitals Health
                        </p>
                        <p className="text-kpi-green font-black text-2xl tabular-nums leading-none">
                          {intelData.vitals_health_percentage}%
                        </p>
                        <div className="w-full h-1.5 rounded-full bg-dash-border mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-kpi-green"
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(100, intelData.vitals_health_percentage)
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="mt-2 h-10 -mx-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={pack.trend.map((v, i) => ({ x: i, v }))}
                              margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="intel-vitals-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.22} />
                                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="v"
                                stroke="#22c55e"
                                strokeWidth={1.6}
                                fill="url(#intel-vitals-grad)"
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="mt-1 text-[10px] text-tx-secondary">
                          {miniInsightText("vitals", pack)}
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex flex-col p-4">
                  {(() => {
                    const pack = derivePrediction(
                      intelData.critical_vitals_percentage,
                      undefined,
                      parseAiForecast(coerceAiPredictionToText(intelData.ai_prediction))
                        .summary || undefined
                    );
                    return (
                      <div
                        className="group h-full cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedIntelCard("critical")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setExpandedIntelCard("critical");
                        }}
                      >
                        <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                          Critical Vitals
                        </p>
                        <p className="text-kpi-red font-black text-2xl tabular-nums leading-none">
                          {intelData.critical_vitals_percentage}%
                        </p>
                        <div className="w-full h-1.5 rounded-full bg-dash-border mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-kpi-red"
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(100, intelData.critical_vitals_percentage)
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="mt-2 h-10 -mx-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={pack.trend.map((v, i) => ({ x: i, v }))}
                              margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="intel-critical-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.22} />
                                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="v"
                                stroke="#ef4444"
                                strokeWidth={1.6}
                                fill="url(#intel-critical-grad)"
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="mt-1 text-[10px] text-tx-secondary">
                          {miniInsightText("critical", pack)}
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex flex-col p-4">
                  <p className="flex items-center gap-1.5">
                    <span className="text-tx-yellow" aria-hidden>
                      ⚠️
                    </span>
                    <span className="text-tx-yellow text-[10px] font-semibold uppercase tracking-wider">
                      At Risk
                    </span>
                  </p>
                  <p className="mt-1 text-tx-bright font-black text-2xl tabular-nums leading-none">
                    {intelData.at_risk_count}
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-dash-border mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-500"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, intelData.at_risk_count)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 flex flex-col gap-2 overflow-hidden">
                <p className="text-kpi-cyan text-xs font-bold uppercase tracking-wider">
                  🤖 AI RISK FORECAST
                </p>
                <div className="text-tx-secondary text-xs leading-relaxed italic overflow-hidden">
                  {(() => {
                    const p = parseAiForecast(coerceAiPredictionToText(intelData.ai_prediction));
                    if (p.rawFallback) {
                      return (
                        <p className="text-tx-secondary text-xs leading-relaxed italic">
                          {p.rawFallback}
                        </p>
                      );
                    }
                    const hasNames = p.names.length > 0;
                    const hasSugg = Boolean(p.suggestion);
                    return (
                      <div className="flex flex-col gap-2">
                        {p.summary ? (
                          <p className="text-tx-secondary text-xs leading-relaxed italic">
                            {p.summary}
                          </p>
                        ) : null}
                        {hasNames ? (
                          <ol className="mt-1 space-y-0.5 text-xs text-tx-primary overflow-hidden">
                            {p.names.map((n, i) => (
                              <li
                                key={`${n}-${i}`}
                                className="flex items-center gap-2 py-0.5 truncate"
                              >
                                <span className="text-tx-secondary">{i + 1}.</span>
                                <span className="truncate">{n}</span>
                              </li>
                            ))}
                          </ol>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="px-5 py-4 flex flex-col gap-2 overflow-hidden">
                <p className="text-tx-secondary text-[10px] font-semibold uppercase tracking-wider mb-1">
                  Suggestion
                </p>
                <div className="bg-kpi-orange/8 border border-kpi-orange/20 rounded-xl p-4">
                  <p className="text-kpi-orange font-semibold text-sm leading-relaxed">
                    {(() => {
                      const p = parseAiForecast(coerceAiPredictionToText(intelData.ai_prediction));
                      return p.suggestion || "Monitor high-risk patients closely and ensure timely intervention if needed.";
                    })()}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {intelData ? (
            <>
              <PatientStatModal
                open={expandedIntelCard === "patients"}
                onClose={() => setExpandedIntelCard(null)}
                title="Total Patients"
                unit=""
                accentHex="#3b82f6"
                pack={derivePrediction(intelData.total_patients, undefined, undefined)}
              />
              <PatientStatModal
                open={expandedIntelCard === "vitals"}
                onClose={() => setExpandedIntelCard(null)}
                title="Vitals Health"
                unit="%"
                accentHex="#22c55e"
                pack={derivePrediction(
                  intelData.vitals_health_percentage,
                  undefined,
                  undefined
                )}
              />
              <PatientStatModal
                open={expandedIntelCard === "critical"}
                onClose={() => setExpandedIntelCard(null)}
                title="Critical Vitals"
                unit="%"
                accentHex="#ef4444"
                pack={derivePrediction(
                  intelData.critical_vitals_percentage,
                  undefined,
                  parseAiForecast(coerceAiPredictionToText(intelData.ai_prediction))
                    .summary || undefined
                )}
              />
            </>
          ) : null}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] overflow-hidden dark:bg-panel dark:border-white/[0.06] dark:shadow-panel">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dash-border">
            <div className="flex items-center gap-3">
              <span className="text-xl" aria-hidden>
                💊
              </span>
              <h2 className="text-tx-bright font-bold text-lg">Pharmacy Intelligence</h2>
            </div>
            <div className="flex items-center gap-2">
              {pharmacyData ? (
                <span className="whitespace-nowrap text-tx-secondary text-xs">
                  {intelFooterUpdated(pharmacyLastFetch, intelClock)}
                </span>
              ) : null}
              {pharmacyData ? (
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-red opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-kpi-red" />
                </span>
              ) : null}
            </div>
          </div>

          {!pharmacyData && !pharmacyLoading ? (
            <p className="mt-3 text-text-muted text-sm">
              Unable to load. Check admin access and API.
            </p>
          ) : null}
          {pharmacyLoading && !pharmacyData ? (
            <div className="mt-3 h-32 animate-pulse rounded-xl bg-base-muted/40" />
          ) : null}

          {pharmacyData ? (
            <div className="h-full grid grid-cols-[1fr_280px] gap-0 divide-x divide-dash-border">
              <div className="h-full grid grid-cols-2 grid-rows-3 gap-0 divide-x divide-y divide-dash-border">
                <div
                  className="flex flex-col min-h-0 overflow-hidden p-4 cursor-pointer group"
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedPharmacyCard("total")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setExpandedPharmacyCard("total");
                  }}
                >
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Total medicines
                  </p>
                  <p className="text-tx-bright font-black text-2xl tabular-nums leading-none">
                    {pharmacyData.total_medicines}
                  </p>
                  {(() => {
                    const pack = derivePrediction(pharmacyData.total_medicines, undefined, undefined);
                    const total = Math.max(1, pharmacyData.total_medicines);
                    const oos = Math.max(0, pharmacyData.out_of_stock_count);
                    const low = Math.max(0, pharmacyData.low_stock_count);
                    const soon = Math.max(0, pharmacyData.expiring_soon_count);
                    const expired = Math.max(0, pharmacyData.expired_count);
                    const safe = Math.max(0, total - (oos + low + soon + expired));
                    const pct = (n: number) => Math.max(2, Math.min(100, Math.round((n / total) * 100)));
                    return (
                      <>
                        <div className="mt-2 h-9 min-h-[36px] -mx-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={pack.trend.map((v, i) => ({ x: i, v }))}
                              margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="pharm-total-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.18} />
                                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="v"
                                stroke="#06b6d4"
                                strokeWidth={1.6}
                                fill="url(#pharm-total-grad)"
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-muted">
                              Inventory risk mix
                            </p>
                            <p className="text-[10px] text-tx-secondary tabular-nums">
                              {pct(safe)}% healthy
                            </p>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                            <div className="h-full flex">
                              <span className="h-full bg-emerald-500/70" style={{ width: `${pct(safe)}%` }} />
                              <span className="h-full bg-orange-500/70" style={{ width: `${pct(low)}%` }} />
                              <span className="h-full bg-yellow-500/70" style={{ width: `${pct(soon)}%` }} />
                              <span className="h-full bg-red-500/70" style={{ width: `${pct(oos + expired)}%` }} />
                            </div>
                          </div>
                          <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-tx-secondary">
                            <span className="truncate">Safe {safe}</span>
                            <span className="truncate text-kpi-orange">Low {low}</span>
                            <span className="truncate text-tx-yellow">Soon {soon}</span>
                            <span className="truncate text-kpi-red">Risk {oos + expired}</span>
                          </div>
                        </div>
                        <p className="mt-1 text-[10px] text-tx-secondary">
                          {miniInsightText("patients", pack)}
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div
                  className="relative flex flex-col min-h-0 overflow-hidden p-4 ring-1 ring-kpi-red/20 cursor-pointer group"
                  onMouseEnter={() => setPharmacyStatHover("oos")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedPharmacyCard("oos")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setExpandedPharmacyCard("oos");
                  }}
                >
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Out of stock
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-kpi-red font-black text-2xl tabular-nums leading-none">
                      {pharmacyData.out_of_stock_count}
                    </p>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-red opacity-70" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-kpi-red" />
                    </span>
                  </div>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "oos"}
                    title="Out of stock"
                    names={pharmacyData.out_of_stock_medicines ?? []}
                  />
                  {(() => {
                    const pack = derivePrediction(pharmacyData.out_of_stock_count, undefined, undefined);
                    const top = (pharmacyData.out_of_stock_medicines ?? []).slice(0, 2);
                    return (
                      <>
                        <div className="mt-2 h-9 min-h-[36px] -mx-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={pack.trend.map((v, i) => ({ x: i, v }))}
                              margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="pharm-oos-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
                                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="v"
                                stroke="#ef4444"
                                strokeWidth={1.6}
                                fill="url(#pharm-oos-grad)"
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        {top.length ? (
                          <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                            {top.map((n, i) => (
                              <span
                                key={`${n}-${i}`}
                                className="max-w-[120px] truncate rounded-lg bg-red-500/10 border border-red-500/15 px-2 py-0.5 text-[10px] text-red-300"
                                title={n}
                              >
                                {n}
                              </span>
                            ))}
                            {(pharmacyData.out_of_stock_medicines ?? []).length > 2 ? (
                              <span className="text-[10px] text-tx-secondary">
                                +{(pharmacyData.out_of_stock_medicines ?? []).length - 2} more
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-tx-secondary">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-red-400/70" aria-hidden />
                            Review substitution list and vendor lead-times
                          </div>
                        )}
                        <p className="mt-1 text-[10px] text-tx-secondary">
                          Projected ~{(pack.prediction[2] ?? pack.current).toFixed(0)} out-of-stock in 3 days.
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div
                  className="relative flex flex-col min-h-0 overflow-hidden p-4 cursor-pointer group"
                  onMouseEnter={() => setPharmacyStatHover("low")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedPharmacyCard("low")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setExpandedPharmacyCard("low");
                  }}
                >
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Low stock
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-kpi-orange font-black text-2xl tabular-nums leading-none">
                      {pharmacyData.low_stock_count}
                    </p>
                    <span className="w-2 h-2 rounded-full bg-kpi-orange" aria-hidden />
                  </div>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "low"}
                    title="Low stock"
                    names={pharmacyData.low_stock_medicines ?? []}
                  />
                  {(() => {
                    const pack = derivePrediction(pharmacyData.low_stock_count, undefined, undefined);
                    const top = (pharmacyData.low_stock_medicines ?? []).slice(0, 2);
                    return (
                      <>
                        <div className="mt-2 h-9 min-h-[36px] -mx-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={pack.trend.map((v, i) => ({ x: i, v }))}
                              margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="pharm-low-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.18} />
                                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="v"
                                stroke="#f97316"
                                strokeWidth={1.6}
                                fill="url(#pharm-low-grad)"
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        {top.length ? (
                          <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                            {top.map((n, i) => (
                              <span
                                key={`${n}-${i}`}
                                className="max-w-[120px] truncate rounded-lg bg-orange-500/10 border border-orange-500/15 px-2 py-0.5 text-[10px] text-orange-300"
                                title={n}
                              >
                                {n}
                              </span>
                            ))}
                            {(pharmacyData.low_stock_medicines ?? []).length > 2 ? (
                              <span className="text-[10px] text-tx-secondary">
                                +{(pharmacyData.low_stock_medicines ?? []).length - 2} more
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-tx-secondary">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-orange-400/70" aria-hidden />
                            Bundle reorders to avoid near-term stockouts
                          </div>
                        )}
                        <p className="mt-1 text-[10px] text-tx-secondary">
                          Projected ~{(pack.prediction[2] ?? pack.current).toFixed(0)} low-stock in 3 days.
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div
                  className="relative flex flex-col min-h-0 overflow-hidden p-4 cursor-pointer group"
                  onMouseEnter={() => setPharmacyStatHover("soon")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedPharmacyCard("soon")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setExpandedPharmacyCard("soon");
                  }}
                >
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Expiring soon
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-tx-yellow font-black text-2xl tabular-nums leading-none">
                      {pharmacyData.expiring_soon_count}
                    </p>
                    <span className="w-2 h-2 rounded-full bg-yellow-500" aria-hidden />
                  </div>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "soon"}
                    title="Expiring soon (30d)"
                    names={pharmacyData.expiring_soon_medicines ?? []}
                  />
                  {(() => {
                    const pack = derivePrediction(pharmacyData.expiring_soon_count, undefined, undefined);
                    const top = (pharmacyData.expiring_soon_medicines ?? []).slice(0, 2);
                    return (
                      <>
                        <div className="mt-2 h-9 min-h-[36px] -mx-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={pack.trend.map((v, i) => ({ x: i, v }))}
                              margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="pharm-soon-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.18} />
                                  <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="v"
                                stroke="#eab308"
                                strokeWidth={1.6}
                                fill="url(#pharm-soon-grad)"
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        {top.length ? (
                          <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                            {top.map((n, i) => (
                              <span
                                key={`${n}-${i}`}
                                className="max-w-[120px] truncate rounded-lg bg-yellow-500/10 border border-yellow-500/15 px-2 py-0.5 text-[10px] text-yellow-200"
                                title={n}
                              >
                                {n}
                              </span>
                            ))}
                            {(pharmacyData.expiring_soon_medicines ?? []).length > 2 ? (
                              <span className="text-[10px] text-tx-secondary">
                                +{(pharmacyData.expiring_soon_medicines ?? []).length - 2} more
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-tx-secondary">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-yellow-300/70" aria-hidden />
                            Prioritize FEFO allocation this week
                          </div>
                        )}
                        <p className="mt-1 text-[10px] text-tx-secondary">
                          Review expiry list; projected ~{(pack.prediction[2] ?? pack.current).toFixed(0)} in 3 days.
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div
                  className="relative col-span-2 flex flex-col min-h-0 overflow-hidden p-4 cursor-pointer group"
                  onMouseEnter={() => setPharmacyStatHover("expired")}
                  onMouseLeave={() => setPharmacyStatHover(null)}
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedPharmacyCard("expired")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setExpandedPharmacyCard("expired");
                  }}
                >
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
                    Expired
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-kpi-red font-black text-2xl tabular-nums leading-none">
                      {pharmacyData.expired_count}
                    </p>
                    <span className="animate-live-pulse w-2 h-2 rounded-full bg-kpi-red" aria-hidden />
                  </div>
                  <PharmacyMedicineTooltip
                    open={pharmacyStatHover === "expired"}
                    title="Expired"
                    names={pharmacyData.expired_medicines ?? []}
                  />
                  {(() => {
                    const pack = derivePrediction(pharmacyData.expired_count, undefined, undefined);
                    const top = (pharmacyData.expired_medicines ?? []).slice(0, 2);
                    return (
                      <>
                        <div className="mt-2 h-9 min-h-[36px] -mx-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={pack.trend.map((v, i) => ({ x: i, v }))}
                              margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="pharm-expired-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
                                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="v"
                                stroke="#ef4444"
                                strokeWidth={1.6}
                                fill="url(#pharm-expired-grad)"
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        {top.length ? (
                          <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                            {top.map((n, i) => (
                              <span
                                key={`${n}-${i}`}
                                className="max-w-[160px] truncate rounded-lg bg-red-500/10 border border-red-500/15 px-2 py-0.5 text-[10px] text-red-300"
                                title={n}
                              >
                                {n}
                              </span>
                            ))}
                            {(pharmacyData.expired_medicines ?? []).length > 2 ? (
                              <span className="text-[10px] text-tx-secondary">
                                +{(pharmacyData.expired_medicines ?? []).length - 2} more
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-tx-secondary">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-red-400/70" aria-hidden />
                            Quarantine & log disposal today
                          </div>
                        )}
                        <p className="mt-1 text-[10px] text-tx-secondary">
                          Immediate action: quarantine/dispose; projected ~{(pack.prediction[2] ?? pack.current).toFixed(0)} in 3 days.
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="px-5 py-4 flex flex-col gap-3 overflow-hidden">
                <div>
                  <p className="text-tx-yellow text-[10px] font-bold uppercase tracking-wider mb-1">
                    ⚠️ Stockout Prediction
                  </p>
                  <p className="text-tx-secondary text-xs leading-relaxed">
                    {pharmacyData.stockout_prediction}
                  </p>
                </div>
                <div>
                  <p className="text-kpi-cyan text-xs font-semibold cursor-pointer hover:text-white transition-colors">
                    🛒 REORDER NOW
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {pharmacyData.medicines_to_reorder.map((m, i) => (
                      <span
                        key={`${m}-${i}`}
                        className="bg-dash-elevated border border-dash-border text-tx-secondary text-[10px] px-2.5 py-1 rounded-lg hover:border-kpi-blue/50 hover:text-tx-primary transition-all duration-150"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-kpi-red text-[10px] font-bold uppercase tracking-wider mb-1">
                    🟥 Expiry Warning
                  </p>
                  <p className="text-tx-secondary text-xs leading-relaxed">
                    {pharmacyData.expiry_warning}
                  </p>
                </div>
                <div>
                  <p className="text-tx-yellow text-[10px] font-bold uppercase tracking-wider mb-1">
                    💡 Suggestion
                  </p>
                  <p className="text-kpi-green text-xs font-medium italic">
                    {pharmacyData.suggestion}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {pharmacyData ? (
            <>
              <PharmacyStatModal
                open={expandedPharmacyCard === "total"}
                onClose={() => setExpandedPharmacyCard(null)}
                title="Total medicines"
                unit=""
                accentHex="#06b6d4"
                pack={derivePrediction(pharmacyData.total_medicines, undefined, undefined)}
                helperText="Tracks catalog size changes; increases usually reflect new supply entries, decreases may indicate retirements or formulary changes."
              />
              <PharmacyStatModal
                open={expandedPharmacyCard === "oos"}
                onClose={() => setExpandedPharmacyCard(null)}
                title="Out of stock"
                unit=""
                accentHex="#ef4444"
                pack={derivePrediction(pharmacyData.out_of_stock_count, undefined, undefined)}
                helperText="Escalate immediate procurement for the highest-impact items. Prioritize by clinical criticality and expected consumption."
              />
              <PharmacyStatModal
                open={expandedPharmacyCard === "low"}
                onClose={() => setExpandedPharmacyCard(null)}
                title="Low stock"
                unit=""
                accentHex="#f97316"
                pack={derivePrediction(pharmacyData.low_stock_count, undefined, undefined)}
                helperText="Convert low-stock items into reorder batches. Bundle vendors and align with delivery lead-times to prevent near-term stockouts."
              />
              <PharmacyStatModal
                open={expandedPharmacyCard === "soon"}
                onClose={() => setExpandedPharmacyCard(null)}
                title="Expiring soon (30d)"
                unit=""
                accentHex="#eab308"
                pack={derivePrediction(pharmacyData.expiring_soon_count, undefined, undefined)}
                helperText="Use FEFO allocation and redistribute inventory to high-usage wards. Consider substitutions if demand is lower than expiring supply."
              />
              <PharmacyStatModal
                open={expandedPharmacyCard === "expired"}
                onClose={() => setExpandedPharmacyCard(null)}
                title="Expired"
                unit=""
                accentHex="#ef4444"
                pack={derivePrediction(pharmacyData.expired_count, undefined, undefined)}
                helperText="Quarantine and document expired items; investigate recurring expiry categories and adjust min/max levels to reduce waste."
              />
            </>
          ) : null}
        </div>
      </div>

    </div>
  );
}
