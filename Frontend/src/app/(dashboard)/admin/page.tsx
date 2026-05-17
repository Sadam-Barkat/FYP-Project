"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import useSWR from "swr";
import { createPortal } from "react-dom";
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
import { useHtmlDarkClass } from "@/components/theme/ThemeProvider";
import type {
  DetailListItem,
  DetailModalPayload,
  DetailSection,
  DetailTablePayload,
} from "@/components/dashboard/DashboardDetailModal";
import { useDashboardDetailModal } from "@/contexts/DashboardDetailModalContext";

const fetcher = async (url: string) => {
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

function apiUrl(path: string, summaryOnly = false): string {
  const base = `${getApiBaseUrl()}${path}`;
  if (!summaryOnly) return base;
  return `${base}${path.includes("?") ? "&" : "?"}summary_only=true`;
}

/** Dashboard card: load summary on mount; fetch full payload only when opening a drill-down. */
function useLazyDashboardCard<T>(
  path: string,
  onSuccess: () => void,
) {
  const summaryUrl = apiUrl(path, true);
  const fullUrl = apiUrl(path, false);
  const detailRef = useRef<T | null>(null);
  const { data, isLoading, mutate } = useSWR<T>(summaryUrl, fetcher, {
    refreshInterval: 60000,
    onSuccess,
  });
  const ensureDetail = useCallback(async (): Promise<T> => {
    if (detailRef.current) return detailRef.current;
    const full = (await fetcher(fullUrl)) as T;
    detailRef.current = full;
    return full;
  }, [fullUrl]);
  const refresh = useCallback(() => {
    detailRef.current = null;
    void mutate();
  }, [mutate]);
  return { data, isLoading, mutate: refresh, ensureDetail };
}

function SkeletonCard() {
  return (
    <div className="h-[300px] grid grid-cols-[160px_1fr_180px] divide-x divide-dash-border overflow-hidden">
      {/* Col 1: 4 Stats */}
      <div className="grid grid-rows-4 divide-y divide-dash-border">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col justify-center px-3 py-2">
            <div className="h-2 w-16 bg-dash-border/30 rounded animate-pulse mb-2" />
            <div className="h-5 w-10 bg-dash-border/30 rounded animate-pulse" />
            <div className="w-full h-1 rounded-full bg-dash-border mt-2 overflow-hidden">
              <div className="h-full w-1/2 bg-dash-border/40 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      {/* Col 2: Chart */}
      <div className="flex flex-col px-4 py-3">
        <div className="h-2 w-32 bg-dash-border/30 rounded animate-pulse mb-4" />
        <div className="flex-1 bg-dash-border/10 rounded-xl animate-pulse" />
        <div className="h-2 w-24 bg-dash-border/30 rounded animate-pulse mt-4" />
      </div>
      {/* Col 3: Suggestions */}
      <div className="flex flex-col px-4 py-3 bg-white/[0.01]">
        <div className="h-2 w-20 bg-dash-border/30 rounded animate-pulse mb-3" />
        <div className="flex-1 bg-dash-border/10 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

const cardBase =
  "relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 cursor-default p-4 pb-[48%] bg-white border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 dark:bg-transparent dark:border-0 dark:shadow-none dark:hover:-translate-y-1";

/** Hover panels branch on `<html class="dark">`; `insightOpenCls` hints click-to-expand details across cards. */
const insightOpenCls =
  "cursor-pointer select-none rounded-md transition-colors hover:bg-slate-100/90 dark:hover:bg-white/[0.045] active:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-kpi-blue/35";

function patientIntelHoverPanelCls(htmlIsDark: boolean): string {
  if (!htmlIsDark) {
    return "rounded-xl border border-slate-200 !bg-white p-2.5 shadow-[0_4px_20px_rgba(15,23,42,0.08)]";
  }
  return "rounded-xl border border-white/10 bg-[#0d1424] p-2.5 shadow-panel";
}

function makeSparkData(value: number) {
  const v = Number.isFinite(value) ? value : 0;
  return Array.from({ length: 14 }, (_, i) => ({
    v: Math.round(v * (0.82 + Math.sin(i * 0.75 + (v % 3)) * 0.16)),
  }));
}

// ── Detail modal payloads (billing / beds / staff forecast / pharmacy) ────

function staffKindLabel(kind: string | undefined): string {
  if (kind === "doctor") return "Doctor";
  if (kind === "nurse") return "Nurse";
  return "Staff";
}

function countKindBreakdown(rows: Array<{ kind?: string } | undefined | null>): {
  doctors: number;
  nurses: number;
  other: number;
} {
  let doctors = 0;
  let nurses = 0;
  let other = 0;
  for (const r of rows ?? []) {
    if (!r) continue;
    if (r.kind === "doctor") doctors++;
    else if (r.kind === "nurse") nurses++;
    else other++;
  }
  return { doctors, nurses, other };
}

function rosterRowToDetailItem(p: {
  name?: string;
  role?: string;
  department?: string;
  kind?: string;
}): DetailListItem {
  return {
    primary: String(p?.name ?? "—"),
    secondary: [p?.role, p?.department].filter(Boolean).join(" · ") || undefined,
    badge: staffKindLabel(p?.kind),
  };
}

function pharmacyDemandForecastModalPayload(pharmacyData: Record<string, unknown>): DetailModalPayload {
  const fc = Array.isArray(pharmacyData.demand_forecast)
    ? (pharmacyData.demand_forecast as Record<string, unknown>[])
    : [];
  const rows = fc.slice(0, 7).map((row) => ({
    date: String(row.date ?? ""),
    predicted_prescriptions: Number(row.predicted_prescriptions ?? 0),
  }));
  return {
    title: "Prescription forecast (next 7 days)",
    subtitle: "Daily predicted volume",
    table: {
      caption: "Forecast by date",
      columns: [
        { key: "date", label: "Date" },
        { key: "predicted_prescriptions", label: "Pred. Rx" },
      ],
      rows,
    },
    blocks: [],
  };
}

/** Roster modal columns — aligned with Staff & Attendance (readable, no raw DB ids, no clinical scoring jargon in headers). */
const INPATIENT_ROSTER_MODAL_COLS = [
  { key: "patient", label: "Patient" },
  { key: "demographics", label: "Demographics" },
  { key: "admitted", label: "Admitted" },
  { key: "bed", label: "Bed" },
  { key: "reason", label: "Reason" },
  { key: "status", label: "Status" },
] as const;

function formatInpatientAdmissionDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return String(iso).slice(0, 10);
  }
}

function mapInpatientRosterModalRow(r: ActiveInpatientRosterRow): Record<string, string> {
  const agePart = r.age != null && Number.isFinite(Number(r.age)) ? String(r.age) : "—";
  const genderPart = (r.gender || "").trim() || "—";
  const blood = (r.blood_group || "").trim();
  const demographics = blood ? `${agePart} · ${genderPart} · ${blood}` : `${agePart} · ${genderPart}`;
  const reasonRaw = (r.reason_for_admission || "—").trim() || "—";
  const reason = reasonRaw.length > 100 ? `${reasonRaw.slice(0, 97)}…` : reasonRaw;
  const vitals = r.has_abnormal_vital ? "Vitals review" : "Vitals OK";
  const label = (r.ml_risk_label || "—").trim() || "—";
  const pct = Math.round(Number(r.ml_risk_pct ?? 0));
  const status = `${vitals} · ${label} (${pct}%)`;
  const bed =
    r.bed_id != null && Number(r.bed_id) > 0 ? `Bed ${r.bed_id}` : "—";
  return {
    patient: (r.name || "—").trim() || "—",
    demographics,
    admitted: formatInpatientAdmissionDate(r.admission_date),
    bed,
    reason,
    status,
  };
}

function patientIntelRosterTablePayload(
  intel: PatientIntelResponse,
  filter: "all" | "healthy" | "critical_vitals" | "at_risk" | "ml_deterioration_24h",
  title: string,
): DetailModalPayload {
  const roster = intel.active_inpatient_roster ?? [];
  const rosterHasLatestVitals = (r: ActiveInpatientRosterRow) =>
    r.heart_rate != null ||
    r.spo2 != null ||
    r.temperature != null ||
    r.blood_pressure_sys != null ||
    r.respiratory_rate != null;

  let rows: ActiveInpatientRosterRow[] = roster;
  let healthySubtitleExtra = "";
  if (filter === "healthy") {
    const hasPerPatientTotals = roster.some((r) => (r.vital_field_total_count ?? 0) > 0);
    if (hasPerPatientTotals) {
      const withChecks = roster.filter((r) => (r.vital_field_total_count ?? 0) > 0);
      const fullyInRange = withChecks.filter((r) => !r.has_abnormal_vital);
      if (fullyInRange.length > 0) {
        rows = fullyInRange;
      } else {
        rows = [...withChecks].sort((a, b) => {
          const ta = Math.max(1, a.vital_field_total_count ?? 1);
          const tb = Math.max(1, b.vital_field_total_count ?? 1);
          const ra = (a.vital_field_normal_count ?? 0) / ta;
          const rb = (b.vital_field_normal_count ?? 0) / tb;
          return rb - ra;
        });
        healthySubtitleExtra =
          " — no one has every recorded vital in range; sorted by share of readings in range";
      }
    } else {
      rows = roster.filter((r) => rosterHasLatestVitals(r) && !r.has_abnormal_vital);
    }
    // Ward % mixes all readings; strict rows can still be empty. Never show an empty roster here.
    if (rows.length === 0 && roster.length > 0) {
      const vitalScore = (r: ActiveInpatientRosterRow) => {
        const t = r.vital_field_total_count ?? 0;
        if (t > 0) return (r.vital_field_normal_count ?? 0) / t;
        if (rosterHasLatestVitals(r)) return r.has_abnormal_vital ? 0 : 1;
        return -1;
      };
      rows = [...roster].sort((a, b) => vitalScore(b) - vitalScore(a));
      healthySubtitleExtra =
        " — sorted by each patient's latest vitals in range (same basis as the ward %)";
    }
  } else if (filter === "critical_vitals") {
    rows = roster.filter((r) => r.has_abnormal_vital);
  } else if (filter === "at_risk") {
    rows = roster.filter((r) => {
      const n = Number(r.news2_score ?? 0);
      return n >= 5;
    });
  } else if (filter === "ml_deterioration_24h") {
    const fullHigh =
      intel.ml_forecast_high_risk_24h && intel.ml_forecast_high_risk_24h.length > 0
        ? intel.ml_forecast_high_risk_24h
        : (intel.ml_forecast ?? []).filter((p) =>
            ["high", "critical"].includes(String(p.risk_label ?? "").toLowerCase()),
          );
    const ids = new Set(
      fullHigh.map((p) => Number(p.patient_id)).filter((id) => Number.isFinite(id) && id > 0),
    );
    rows = roster.filter((r) => ids.has(Number(r.patient_id)));
  }
  const mapped = rows.map((r) => mapInpatientRosterModalRow(r)) as unknown as Record<
    string,
    string | number | boolean | null | undefined
  >[];

  const subtitle =
    roster.length === 0
      ? "No inpatient roster in this response — try refreshing."
      : `${mapped.length} inpatient${mapped.length === 1 ? "" : "s"}${filter === "healthy" ? healthySubtitleExtra : ""}`;

  return {
    title,
    subtitle,
    table: {
      caption: `Inpatients (${mapped.length})`,
      columns: INPATIENT_ROSTER_MODAL_COLS.map((c) => ({ key: c.key, label: c.label })),
      rows: mapped,
    },
    blocks: [],
  };
}

function patientIntelSingleRowTable(intel: PatientIntelResponse, patientId: number): DetailModalPayload {
  const roster = intel.active_inpatient_roster ?? [];
  const row = roster.find((r) => r.patient_id === patientId);
  const mapped = row
    ? ([mapInpatientRosterModalRow(row)] as unknown as Record<string, string | number | boolean | null | undefined>[])
    : [];
  return {
    title: "Patient detail",
    subtitle: row
      ? `${row.name} · admitted ${formatInpatientAdmissionDate(row.admission_date)}`
      : "Not on the current inpatient roster.",
    table: {
      caption: row ? "Inpatient (1)" : undefined,
      columns: INPATIENT_ROSTER_MODAL_COLS.map((c) => ({ key: c.key, label: c.label })),
      rows: mapped,
    },
    blocks: [],
  };
}

function staffForecastFullModalPayload(staffData: Record<string, unknown>): DetailModalPayload {
  const details = Array.isArray(staffData.attendance_forecast_details)
    ? (staffData.attendance_forecast_details as Record<string, unknown>[])
    : [];
  const trend = Array.isArray(staffData.attendance_trend)
    ? (staffData.attendance_trend as { present?: number; absent?: number; leave?: number }[])
    : [];
  let tp = 0;
  let ta = 0;
  let tl = 0;
  for (const r of trend) {
    tp += Number(r.present ?? 0);
    ta += Number(r.absent ?? 0);
    tl += Number(r.leave ?? 0);
  }
  const rows: Record<string, string | number | boolean | null | undefined>[] = [];
  for (const d of details) {
    const iso = String(d.date ?? "");
    const shortLabel = iso.length >= 10 ? iso.slice(5) : iso;
    const absent = (Array.isArray(d.absent_staff) ? d.absent_staff : []) as Array<{
      kind?: string;
      name?: string;
      role?: string;
      department?: string;
    }>;
    const leave = (Array.isArray(d.leave_staff) ? d.leave_staff : []) as Array<{
      kind?: string;
      name?: string;
      role?: string;
      department?: string;
    }>;
    for (const s of absent) {
      rows.push({
        forecast_date: shortLabel,
        full_date: iso,
        status: "Absent",
        name: s.name ?? "",
        role: s.role ?? "",
        department: s.department ?? "",
        kind: s.kind ?? "",
      });
    }
    for (const s of leave) {
      rows.push({
        forecast_date: shortLabel,
        full_date: iso,
        status: "On leave",
        name: s.name ?? "",
        role: s.role ?? "",
        department: s.department ?? "",
        kind: s.kind ?? "",
      });
    }
  }
  return {
    title: "Next 7 days forecast — roster",
    subtitle: `Chart totals: ${tp} present · ${ta} absent · ${tl} on leave · ${rows.length} named slots`,
    table: {
      columns: [
        { key: "full_date", label: "ISO date" },
        { key: "forecast_date", label: "MM-DD" },
        { key: "status", label: "Status" },
        { key: "kind", label: "Kind" },
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "department", label: "Dept" },
      ],
      rows,
    },
    blocks: [],
  };
}

function bedsWardDepartmentTable(d: PatientsBedsOverview, caption: string): DetailTablePayload {
  const deps = d.bed_occupancy_by_department ?? [];
  return {
    caption,
    columns: [
      { key: "department", label: "Ward" },
      { key: "occupied", label: "Occupied" },
      { key: "total", label: "Total" },
      { key: "free", label: "Free" },
      { key: "pct", label: "Occupancy" },
    ],
    rows: deps.map((dep) => {
      const occ = Number(dep.occupied ?? 0);
      const tot = Number(dep.total ?? 0);
      const free = Math.max(0, tot - occ);
      return {
        department: dep.department ?? "—",
        occupied: occ,
        total: tot,
        free,
        pct: `${Math.round((occ / Math.max(1, tot)) * 100)}%`,
      };
    }),
  };
}

function bedsAdmissionsTrendTable(d: PatientsBedsOverview): DetailTablePayload {
  const trend = d.admissions_discharges_trend ?? [];
  return {
    caption: "Admissions vs discharges (7 days)",
    columns: [
      { key: "day", label: "Day" },
      { key: "admissions", label: "Admissions" },
      { key: "discharges", label: "Discharges" },
      { key: "net", label: "Net" },
    ],
    rows: trend.map((row) => {
      const a = Number(row.admissions ?? 0);
      const dis = Number(row.discharges ?? 0);
      return {
        day: String(row.day ?? "—"),
        admissions: a,
        discharges: dis,
        net: a - dis,
      };
    }),
  };
}

function bedsInpatientRosterModalPayload(d: PatientsBedsOverview, title: string): DetailModalPayload {
  const roster = d.active_inpatient_roster ?? [];
  const mapped = roster.map((r) => mapInpatientRosterModalRow(r)) as Record<
    string,
    string | number | boolean | null | undefined
  >[];
  return {
    title,
    subtitle:
      mapped.length === 0
        ? "No inpatients on this date."
        : `${mapped.length} inpatient${mapped.length === 1 ? "" : "s"}`,
    table: {
      caption: `Inpatients (${mapped.length})`,
      columns: INPATIENT_ROSTER_MODAL_COLS.map((c) => ({ key: c.key, label: c.label })),
      rows: mapped,
    },
    blocks: [],
  };
}

function bedsCapacityModalPayload(d: PatientsBedsOverview): DetailModalPayload {
  return {
    title: "Total capacity",
    subtitle: `${d.total_capacity ?? 0} beds · ${Number(d.occupancy_percentage ?? 0).toFixed(1)}% occupied · ${d.available_beds ?? 0} free`,
    tables: [bedsWardDepartmentTable(d, "Ward capacity"), bedsAdmissionsTrendTable(d)],
    blocks: [],
  };
}

function bedsOccupiedModalPayload(d: PatientsBedsOverview): DetailModalPayload {
  const roster = d.active_inpatient_roster ?? [];
  if (roster.length > 0) {
    return bedsInpatientRosterModalPayload(d, "Occupied beds — inpatient roster");
  }
  return {
    title: "Occupied beds",
    subtitle: `${d.occupied_beds ?? 0} occupied across wards`,
    tables: [bedsWardDepartmentTable(d, "Ward occupancy")],
    blocks: [],
  };
}

function bedsFreeModalPayload(d: PatientsBedsOverview): DetailModalPayload {
  const deps = d.bed_occupancy_by_department ?? [];
  const rows = deps.map((dep) => {
    const occ = Number(dep.occupied ?? 0);
    const tot = Number(dep.total ?? 0);
    const free = Math.max(0, tot - occ);
    return {
      ward: dep.department ?? "—",
      free,
      total: tot,
      status: free === 0 ? "Full" : free <= 2 ? "Low" : "Available",
    };
  });
  return {
    title: "Free beds",
    subtitle: `${d.available_beds ?? 0} free of ${d.total_capacity ?? 0} total (${d.available_beds_status ?? 0} marked available in system)`,
    tables: [
      {
        caption: "Free capacity by ward",
        columns: [
          { key: "ward", label: "Ward" },
          { key: "free", label: "Free beds" },
          { key: "total", label: "Total" },
          { key: "status", label: "Status" },
        ],
        rows,
      },
      bedsAdmissionsTrendTable(d),
    ],
    blocks: [],
  };
}

function bedsEmergencyModalPayload(d: PatientsBedsOverview): DetailModalPayload {
  const ml = (d.ml_shortage_risk ?? {}) as Record<string, unknown>;
  return {
    title: "Emergency & critical cases",
    subtitle: `${d.emergency_cases ?? 0} emergency · ${d.critical_condition_cases ?? 0} critical severity today`,
    blocks: [
      {
        sections: [
          {
            title: "Alert counts (selected date)",
            accent: "red",
            items: [
              {
                primary: "Critical-severity alerts",
                badge: String(d.emergency_cases ?? 0),
              },
              {
                primary: "High-severity alerts",
                badge: String(d.critical_condition_cases ?? 0),
              },
              {
                primary: "Occupied / capacity",
                secondary: `${d.occupied_beds ?? 0} / ${d.total_capacity ?? 0}`,
              },
              {
                primary: "Free beds remaining",
                secondary: String(d.available_beds ?? 0),
              },
            ],
          },
          {
            title: "ML bed shortage risk",
            accent: "orange",
            items: [
              {
                primary: String(ml.risk_label ?? "—"),
                secondary: `7-day predicted admissions: ${Math.round(Number(ml.predicted_admissions_7d_total ?? 0))}`,
                badge:
                  typeof ml.risk_pct === "number" ? `${ml.risk_pct}%` : undefined,
              },
            ],
          },
        ],
      },
    ],
  };
}

function bedsAdmissionsForecastModalPayload(bedsData: Record<string, unknown>): DetailModalPayload {
  const fc = Array.isArray(bedsData.ml_next_7_days_forecast)
    ? (bedsData.ml_next_7_days_forecast as Record<string, unknown>[])
    : [];
  const rows = fc.map((row) => ({
    date: String(row.date ?? ""),
    predicted_admissions: Number(row.predicted_admissions ?? 0).toFixed(2),
    shortage_probability: `${Math.round(Number(row.shortage_probability ?? 0) * 100)}%`,
    estimated_occupancy_pct: Number(row.estimated_occupancy_pct ?? 0).toFixed(1),
    estimated_occupied_beds: Math.round(Number(row.estimated_occupied_beds ?? 0)),
  }));
  return {
    title: "Forecasted admissions (ML)",
    subtitle: "Per-day model outputs",
    table: {
      columns: [
        { key: "date", label: "Date" },
        { key: "predicted_admissions", label: "Pred. admissions" },
        { key: "shortage_probability", label: "Shortage prob." },
        { key: "estimated_occupancy_pct", label: "Est. occ. %" },
        { key: "estimated_occupied_beds", label: "Est. beds" },
      ],
      rows,
    },
    blocks: [],
  };
}

function labIntelTooltipPanelCls(
  htmlIsDark: boolean,
  position: "top" | "bottom" = "top",
): string {
  const pos = position === "bottom" ? "bottom-0" : "top-0";
  return `absolute left-full ${pos} z-[9999] ml-1 w-44 ${patientIntelHoverPanelCls(htmlIsDark)} hidden group-hover:block pointer-events-none`;
}

function labCategoryBreakdownModal(
  d: LaboratoryOverview,
  mode: "pending" | "completed",
): DetailModalPayload {
  const cats = d.daily_test_volume_by_category ?? [];
  const rows = cats
    .map((c) => ({
      category: c.category ?? "—",
      count: mode === "pending" ? Number(c.pending ?? 0) : Number(c.completed ?? 0),
      total: Number(c.pending ?? 0) + Number(c.completed ?? 0),
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = rows.reduce((s, r) => s + r.count, 0);
  return {
    title: mode === "pending" ? "Pending tests" : "Completed today",
    subtitle: `${total} test(s) across ${rows.length} categor${rows.length === 1 ? "y" : "ies"}`,
    table: {
      caption: mode === "pending" ? "Pending by category" : "Completed by category",
      columns: [
        { key: "category", label: "Category" },
        { key: "count", label: mode === "pending" ? "Pending" : "Completed" },
        { key: "total", label: "Total (day)" },
      ],
      rows,
    },
    blocks: [],
  };
}

function labCriticalModalPayload(d: LaboratoryOverview): DetailModalPayload {
  const atRisk = d.ml_abnormal_at_risk ?? [];
  const tableRows = atRisk.map((r) => ({
    patient: r.patient_name,
    test: r.test_name,
    category: r.category,
    abnormal_probability: `${Math.round((r.abnormal_probability ?? 0) * 100)}%`,
  }));
  return {
    title: "Critical & abnormal results",
    subtitle: `${d.critical_results ?? 0} critical today · ${atRisk.length} pending flagged by ML`,
    ...(tableRows.length > 0
      ? {
          table: {
            caption: "ML abnormal risk (pending tests)",
            columns: [
              { key: "patient", label: "Patient" },
              { key: "test", label: "Test" },
              { key: "category", label: "Category" },
              { key: "abnormal_probability", label: "Abnormal prob." },
            ],
            rows: tableRows,
          },
        }
      : {}),
    blocks: [
      {
        sections: [
          {
            title: "Today's critical flags",
            accent: "red",
            items: [
              { primary: "Critical result count", badge: String(d.critical_results ?? 0) },
              {
                primary: "Physician review",
                secondary: "Critical values in today's laboratory results",
              },
            ],
          },
        ],
      },
    ],
  };
}

function labTechniciansModalPayload(d: LaboratoryOverview): DetailModalPayload {
  const pending = d.pending_tests ?? 0;
  const techs = Math.max(1, d.active_technicians ?? 1);
  const load = Math.round(pending / techs);
  const rows = (d.daily_test_volume_by_category ?? [])
    .map((c) => ({
      category: c.category ?? "—",
      pending: Number(c.pending ?? 0),
      est_per_tech: (Number(c.pending ?? 0) / techs).toFixed(1),
    }))
    .filter((r) => r.pending > 0)
    .sort((a, b) => b.pending - a.pending);
  return {
    title: "Active technicians · capacity",
    subtitle: `${techs} technician(s) · ${load} pending tests per tech`,
    table: {
      caption: "Pending load by category",
      columns: [
        { key: "category", label: "Category" },
        { key: "pending", label: "Pending" },
        { key: "est_per_tech", label: "Est. / tech" },
      ],
      rows,
    },
    blocks: [
      {
        sections: [
          {
            title: "Workload",
            accent: load >= 5 ? "orange" : "green",
            items: [
              { primary: "Pending tests", badge: String(pending) },
              { primary: "Active technicians", badge: String(techs) },
              {
                primary: "Load per technician",
                secondary:
                  load >= 5 ? "High — consider extra shifts" : "Within normal range",
              },
            ],
          },
        ],
      },
    ],
  };
}

function labBacklogForecastModalPayload(d: LaboratoryOverview): DetailModalPayload {
  const fc = d.ml_next_7_days_forecast ?? [];
  const rows = fc.map((f) => ({
    date: f.date,
    day_name: f.day_name ?? "—",
    backlog_risk: f.backlog_risk ? "Yes" : "No",
    risk_probability: `${Math.round((f.risk_probability ?? 0) * 100)}%`,
  }));
  const highDays = fc.filter((f) => f.backlog_risk).length;
  const avgPct =
    fc.length > 0
      ? Math.round(
          (fc.reduce((s, f) => s + (f.risk_probability ?? 0), 0) / fc.length) * 100,
        )
      : 0;
  return {
    title: "Lab backlog forecast (next 7 days)",
    subtitle: `${highDays} high-risk day(s) · ${avgPct}% average backlog probability`,
    table: {
      caption: "ML backlog model — daily forecast",
      columns: [
        { key: "date", label: "Date" },
        { key: "day_name", label: "Day" },
        { key: "backlog_risk", label: "Backlog risk" },
        { key: "risk_probability", label: "Probability" },
      ],
      rows,
    },
    blocks: [],
  };
}

function financeInvoiceTable(financeData: Record<string, unknown>): DetailTablePayload {
  const inv = Array.isArray(financeData.recent_invoices)
    ? (financeData.recent_invoices as Record<string, unknown>[])
    : [];
  const rows = inv.map((x) => ({
    invoice_id: String(x.invoice_id ?? x.id ?? ""),
    patient: String(x.patient ?? x.patient_name ?? ""),
    date: String(x.date ?? ""),
    amount: Number(x.amount ?? 0),
    status: String(x.status ?? ""),
    description: String(x.description ?? ""),
  }));
  return {
    caption: "Recent invoices (rolling window)",
    columns: [
      { key: "invoice_id", label: "Invoice" },
      { key: "patient", label: "Patient" },
      { key: "date", label: "When" },
      { key: "amount", label: "Amount" },
      { key: "status", label: "Status" },
      { key: "description", label: "Notes" },
    ],
    rows,
  };
}

function financeTrendTable(financeData: Record<string, unknown>): DetailTablePayload {
  const trend = Array.isArray(financeData.revenue_vs_expenses)
    ? (financeData.revenue_vs_expenses as Record<string, unknown>[])
    : [];
  const rows = trend.map((row) => ({
    day: String(row.day ?? ""),
    revenue: Number(row.revenue ?? 0),
    expenses: Number(row.expenses ?? 0),
  }));
  return {
    caption: "Revenue vs expenses (last 7 slices)",
    columns: [
      { key: "day", label: "Day" },
      { key: "revenue", label: "Revenue" },
      { key: "expenses", label: "Expenses" },
    ],
    rows,
  };
}

function financeSnapshotModalPayload(
  financeData: Record<string, unknown>,
  focus: "revenue" | "outstanding" | "expenses" | "net",
): DetailModalPayload {
  const revenue = Number(financeData?.todays_revenue ?? 0);
  const outstanding = Number(financeData?.outstanding_balance ?? 0);
  const expenses = Number(financeData?.todays_expenses ?? 0);
  const net = revenue - expenses;

  if (focus === "expenses") {
    return {
      title: "Expenses · trend detail",
      subtitle: `Today's expenses snapshot: ₨${expenses.toFixed(2)}`,
      tables: [financeTrendTable(financeData)],
      blocks: [],
    };
  }

  const invTableAll = financeInvoiceTable(financeData);
  const invTablePaid = financeInvoiceTable({
    ...financeData,
    recent_invoices: Array.isArray(financeData.recent_invoices)
      ? financeData.recent_invoices.filter((x: any) => String(x.status || "").toLowerCase() === "paid")
      : []
  });
  const invTablePending = financeInvoiceTable({
    ...financeData,
    recent_invoices: Array.isArray(financeData.recent_invoices)
      ? financeData.recent_invoices.filter((x: any) => String(x.status || "").toLowerCase() === "pending")
      : []
  });
  const trendTable = financeTrendTable(financeData);

  if (focus === "revenue") {
    return {
      title: "Today's revenue · billing lines",
      subtitle: `Recorded revenue: ₨${revenue.toFixed(2)}`,
      tables: [invTablePaid, trendTable],
      blocks: [],
    };
  }
  if (focus === "outstanding") {
    return {
      title: "Outstanding balance · invoices",
      subtitle: `Outstanding: ₨${outstanding.toFixed(2)}`,
      tables: [invTablePending],
      blocks: [],
    };
  }
  return {
    title: "Net profit · context",
    subtitle: `Rev ₨${revenue.toFixed(2)} · Exp ₨${expenses.toFixed(2)} · Net ₨${net.toFixed(2)}`,
    tables: [invTablePaid, trendTable],
    blocks: [],
  };
}

function financeForecastModalPayload(financeData: Record<string, unknown>): DetailModalPayload {
  const pts = Array.isArray(financeData?.ml_revenue_forecast)
    ? (financeData.ml_revenue_forecast as any[])
    : [];
  const totalPredRevenue = pts.reduce(
    (s, p) => s + Number(p?.predicted_revenue ?? 0),
    0
  );
  const totalPredExpenses = totalPredRevenue * 0.3;
  const totalPredNet = totalPredRevenue - totalPredExpenses;
  const avgPredRevenue = totalPredRevenue / Math.max(1, pts.length);

  const rows = pts.map((p) => {
    const rev = Number(p?.predicted_revenue ?? 0);
    return {
      date: String(p?.date ?? ""),
      revenue: Number(rev.toFixed(2)),
      expenses: Number((rev * 0.3).toFixed(2)),
      net: Number((rev * 0.7).toFixed(2)),
    };
  });

  const forecastTable: DetailTablePayload = {
    caption: "Predicted Daily Totals (Next 7 Days)",
    columns: [
      { key: "date", label: "Date" },
      { key: "revenue", label: "Predicted Revenue" },
      { key: "expenses", label: "Estimated Expenses" },
      { key: "net", label: "Predicted Net" },
    ],
    rows,
  };

  return {
    title: "Revenue Forecast · next 7 days",
    subtitle: `Total Rev ₨${totalPredRevenue.toFixed(2)} · Exp ₨${totalPredExpenses.toFixed(2)} · Net ₨${totalPredNet.toFixed(2)} (Avg/day: ₨${avgPredRevenue.toFixed(2)})`,
    tables: [forecastTable],
    blocks: [],
  };
}

type LiveStaffRow = { name?: string; role?: string; department?: string; status?: string };

function staffLiveRows(staffData: HrStaffOverview): LiveStaffRow[] {
  return (staffData.live_staff_status ?? []) as LiveStaffRow[];
}

function staffStatusSlice(rows: LiveStaffRow[], status: string, limit = 4): LiveStaffRow[] {
  return rows.filter((s) => s.status === status).slice(0, limit);
}

function staffDeptBreakdown(
  rows: LiveStaffRow[],
  status: string,
  limit = 4,
): { dept: string; count: number }[] {
  const map = new Map<string, number>();
  rows
    .filter((s) => s.status === status)
    .forEach((s) => {
      const d = (s.department && String(s.department).trim()) || "Unassigned";
      map.set(d, (map.get(d) ?? 0) + 1);
    });
  return [...map.entries()]
    .map(([dept, count]) => ({ dept, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function staffIntelTooltipPanelCls(htmlIsDark: boolean): string {
  return `absolute left-full z-[9999] ml-1 w-44 ${patientIntelHoverPanelCls(htmlIsDark)} hidden group-hover:block pointer-events-none`;
}

function liveStaffStatusModalPayload(
  title: string,
  subtitle: string,
  rows: Array<{ name?: string; role?: string; department?: string; status?: string }>,
): DetailModalPayload {
  const classify = (role: string) => {
    const r = (role ?? "").toLowerCase();
    if (r.includes("doctor") || r.includes("dr.")) return "doctor";
    if (r.includes("nurse")) return "nurse";
    return "other";
  };
  const d = countKindBreakdown(
    rows.map((r) => ({ ...r, kind: classify(String(r.role ?? "")) })),
  );
  const tableRows = rows.map((r) => ({
    name: r.name ?? "",
    role: r.role ?? "",
    department: r.department ?? "",
    status: r.status ?? "",
    kind: classify(String(r.role ?? "")),
  }));
  return {
    title,
    subtitle: `${subtitle} · doctors ${d.doctors}, nurses ${d.nurses}, other ${d.other}`,
    table: {
      caption: `Roster (${rows.length})`,
      columns: [
        { key: "name", label: "Name" },
        { key: "kind", label: "Kind" },
        { key: "role", label: "Role" },
        { key: "department", label: "Dept" },
        { key: "status", label: "Status" },
      ],
      rows: tableRows,
    },
    blocks: [],
  };
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
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-3">
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

export type ActiveInpatientRosterRow = {
  patient_id: number;
  name: string;
  age: number | null;
  gender: string;
  blood_group?: string | null;
  contact: string;
  address: string;
  admission_date: string | null;
  reason_for_admission: string;
  bed_id: number;
  news2_score: number;
  heart_rate: number | null;
  spo2: number | null;
  temperature: number | null;
  blood_pressure_sys: number | null;
  blood_pressure_dia: number | null;
  respiratory_rate: number | null;
  ml_risk_label: string;
  ml_risk_pct: number;
  has_abnormal_vital: boolean;
  /** Non-null latest vitals counted vs in-range (same basis as ward vitals health %). */
  vital_field_normal_count?: number;
  vital_field_total_count?: number;
};

export type PatientIntelResponse = {
  total_patients: number;
  previous_week_patients: number;
  change_from_last_week: number;
  vitals_health_percentage: number;
  critical_vitals_percentage: number;
  at_risk_count: number;
  top_risk_patients: string;
  active_inpatient_roster?: ActiveInpatientRosterRow[];
  ml_forecast?: Array<{
    patient_id: number;
    name: string;
    risk_prob: number;
    risk_pct: number;
    risk_label: string;
  }>;
  ml_high_risk_24h_count?: number;
  /** All inpatients at/above ML "high" threshold (matches `ml_high_risk_24h_count`). */
  ml_forecast_high_risk_24h?: Array<{
    patient_id: number;
    name: string;
    risk_prob: number;
    risk_pct: number;
    risk_label: string;
  }>;
  ml_risk_summary?: Array<{
    patient_id: number;
    name: string;
    ml_risk_label: string;
    ml_risk_pct: number;
    news2_score: number;
  }>;
  ai_prediction:
    | string
    | {
        summary?: string;
        risk_level?: string;
        recommendation?: string;
        generated_by?: string;
      };
};

export type PharmacyMLAtRisk = {
  medicine_name: string;
  quantity: number;
  days_of_stock: number;
  stockout_probability: number;
};

export type PharmacyDemandForecast = {
  date: string;
  predicted_prescriptions: number;
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
  safe_medicines?: string[];
  stockout_prediction: string;
  medicines_to_reorder: string[];
  expiry_warning: string;
  suggestion: string;
  // ML model outputs
  ml_at_risk_medicines?: PharmacyMLAtRisk[];
  demand_forecast?: PharmacyDemandForecast[];
  ml_model_stockout?: string;
  ml_model_demand?: string;
  generated_by?: string;
  ml_available?: boolean;
};

export type FinanceBillingOverview = {
  todays_revenue?: number;
  outstanding_balance?: number;
  insurance_claims?: number;
  todays_expenses?: number;
  recent_invoices?: Array<Record<string, unknown>>;
  revenue_vs_expenses?: Array<{ day?: string; revenue?: number; expenses?: number }>;
  ml_revenue_forecast?: Array<{ date?: string; predicted_revenue?: number }>;
  ml_revenue_risk_level?: string;
  ml_collection_risk?: { risk_pct?: number; risk_label?: string };
  selected_date?: string;
};

export type PatientsBedsOverview = {
  total_capacity?: number;
  total_patients?: number;
  occupied_beds?: number;
  occupancy_percentage?: number;
  available_beds?: number;
  available_beds_status?: number;
  maintenance_beds?: number;
  emergency_cases?: number;
  critical_condition_cases?: number;
  bed_occupancy_by_department?: Array<{ department?: string; occupied?: number; total?: number }>;
  admissions_discharges_trend?: Array<Record<string, unknown>>;
  previous_7_days_admissions?: number;
  previous_7_days_discharges?: number;
  ml_next_7_days_forecast?: Array<Record<string, unknown>>;
  ml_shortage_risk?: Record<string, unknown>;
  active_inpatient_roster?: ActiveInpatientRosterRow[];
  selected_date?: string;
};

export type HrStaffOverview = {
  staff_on_duty?: number;
  active_shifts?: number;
  absent_today?: number;
  on_leave?: number;
  live_staff_status?: Array<Record<string, unknown>>;
  attendance_trend?: Array<{ present?: number; absent?: number; leave?: number }>;
  attendance_forecast_details?: Array<Record<string, unknown>>;
  understaffing_risk?: Record<string, unknown>;
  selected_date?: string;
};

export type LabBacklogForecastPoint = {
  date: string;
  backlog_risk: boolean;
  risk_probability: number;
  day_name?: string;
};

export type LabAbnormalAtRisk = {
  patient_name: string;
  test_name: string;
  category: string;
  abnormal_probability: number;
};

export type LaboratoryOverview = {
  pending_tests?: number;
  completed_today?: number;
  active_technicians?: number;
  critical_results?: number;
  daily_test_volume_by_category?: Array<{ category?: string; completed?: number; pending?: number }>;
  weekly_result_trends?: Array<{ day?: string; normal?: number; abnormal?: number }>;
  ml_next_7_days_forecast?: LabBacklogForecastPoint[];
  ml_backlog_risk?: {
    risk_prob?: number;
    risk_pct?: number;
    risk_label?: string;
    ml_available?: boolean;
    ml_model_backlog?: string;
    ml_model_abnormal?: string;
  };
  ml_abnormal_at_risk?: LabAbnormalAtRisk[];
  ml_available?: boolean;
  selected_date?: string;
};

function pharmacyMedicineNameTable(title: string, names: string[], emptySubtitle: string): DetailModalPayload {
  const list = names ?? [];
  return {
    title,
    subtitle: list.length === 0 ? emptySubtitle : `${list.length} item(s)`,
    table: {
      columns: [
        { key: "n", label: "#" },
        { key: "medicine", label: "Medicine" },
      ],
      rows: list.map((medicine, i) => ({ n: i + 1, medicine })),
    },
    blocks: [],
  };
}

function pharmacyStockBreakdown(pharmacyData: PharmacyIntelResponse) {
  const total = Math.max(1, pharmacyData.total_medicines);
  const oos = pharmacyData.out_of_stock_count ?? 0;
  const low = pharmacyData.low_stock_count ?? 0;
  const soon = pharmacyData.expiring_soon_count ?? 0;
  const expired = pharmacyData.expired_count ?? 0;
  const safe = Math.max(0, total - oos - low - soon - expired);
  const healthPct = Math.round((safe / total) * 100);
  const share = (n: number) => `${Math.round((n / total) * 100)}%`;
  return { total, oos, low, soon, expired, safe, healthPct, share };
}

function pharmacyCategorySection(
  label: string,
  names: string[],
  accent: DetailSection["accent"],
): DetailSection {
  return {
    title: `${label} (${names.length})`,
    accent,
    items:
      names.length === 0
        ? [{ primary: "None in this category" }]
        : names.map((name) => ({ primary: name })),
  };
}

function pharmacyInventorySnapshotTable(pharmacyData: PharmacyIntelResponse): DetailModalPayload {
  const safe = pharmacyData.safe_medicines ?? [];
  const low = pharmacyData.low_stock_medicines ?? [];
  const oos = pharmacyData.out_of_stock_medicines ?? [];
  const soon = pharmacyData.expiring_soon_medicines ?? [];
  const expired = pharmacyData.expired_medicines ?? [];

  return {
    title: "Total Medicines",
    subtitle: "Medicine names by stock category",
    blocks: [
      {
        sections: [
          pharmacyCategorySection("✓ Safe", safe, "green"),
          pharmacyCategorySection("⚠ Low stock", low, "orange"),
          pharmacyCategorySection("✗ Out of stock", oos, "red"),
          pharmacyCategorySection("⏳ Expiring soon (30d)", soon, "yellow"),
          pharmacyCategorySection("💀 Expired", expired, "neutral"),
        ],
      },
    ],
  };
}

function pharmacyMlAtRiskTable(pharmacyData: PharmacyIntelResponse): DetailModalPayload {
  const atRisk = pharmacyData.ml_at_risk_medicines ?? [];
  if (atRisk.length > 0) {
    return {
      title: "ML at-risk medicines (7 days)",
      subtitle: `${atRisk.length} item(s)`,
      table: {
        columns: [
          { key: "n", label: "#" },
          { key: "medicine_name", label: "Medicine" },
          { key: "quantity", label: "Qty" },
          { key: "days_of_stock", label: "Days stock" },
          { key: "stockout_pct", label: "Stockout %" },
        ],
        rows: atRisk.map((m, i) => ({
          n: i + 1,
          medicine_name: m.medicine_name,
          quantity: m.quantity,
          days_of_stock: m.days_of_stock,
          stockout_pct: Math.round((m.stockout_probability ?? 0) * 100),
        })),
      },
      blocks: [],
    };
  }
  const reorder = pharmacyData.medicines_to_reorder ?? [];
  return {
    title: "Reorder list (no ML rows)",
    subtitle: `${reorder.length} item(s)`,
    table: {
      columns: [
        { key: "n", label: "#" },
        { key: "medicine", label: "Medicine" },
      ],
      rows: reorder.map((medicine, i) => ({ n: i + 1, medicine })),
    },
    blocks: [],
  };
}

function pharmacyMlAtRiskSingleRow(row: PharmacyMLAtRisk): DetailModalPayload {
  return {
    title: row.medicine_name,
    subtitle: "ML 7-day stockout model",
    table: {
      columns: [
        { key: "field", label: "Field" },
        { key: "value", label: "Value" },
      ],
      rows: [
        { field: "Quantity", value: String(row.quantity) },
        { field: "Days of stock", value: String(row.days_of_stock) },
        { field: "Stockout probability", value: `${Math.round((row.stockout_probability ?? 0) * 100)}%` },
      ],
    },
    blocks: [],
  };
}

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
    const n = Number(raw);
    if (!Number.isFinite(n)) return "—";

  let formatted = "";
  if (n >= 1_000_000) {
    formatted = (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  } else if (n >= 1_000) {
    formatted = (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  } else {
    if (kind === "currency") {
      formatted = n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    } else {
      formatted = n.toLocaleString();
    }
  }

  return kind === "currency" ? `$${formatted}` : formatted;
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

type PatientMlSuggestion = {
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  suggestion: string;
};

function derivePatientMlSuggestion(data: PatientIntelResponse): PatientMlSuggestion {
  const forecast = data.ml_forecast ?? [];
  const criticalCount = forecast.filter((p) => (p.risk_label || "").toLowerCase() === "critical").length;
  const highCount = forecast.filter((p) => (p.risk_label || "").toLowerCase() === "high").length;
  const moderateCount = forecast.filter((p) => {
    const label = (p.risk_label || "").toLowerCase();
    return label === "moderate" || label === "medium";
  }).length;
  const mlHighRiskCount =
    typeof data.ml_high_risk_24h_count === "number"
      ? data.ml_high_risk_24h_count
      : criticalCount + highCount;
  const topRiskPct = forecast.reduce((max, p) => Math.max(max, Number(p.risk_pct ?? 0)), 0);

  if (criticalCount > 0 || topRiskPct >= 90 || data.critical_vitals_percentage >= 85) {
    return {
      riskLevel: "Critical",
      suggestion: `ML flags ${Math.max(criticalCount, mlHighRiskCount)} critical/high-risk patient${Math.max(criticalCount, mlHighRiskCount) === 1 ? "" : "s"}. Review top-risk patients now, verify latest vitals, and prepare urgent intervention.`,
    };
  }

  if (highCount > 0 || mlHighRiskCount > 0 || data.critical_vitals_percentage >= 60) {
    return {
      riskLevel: "High",
      suggestion: `ML predicts ${mlHighRiskCount} patient${mlHighRiskCount === 1 ? "" : "s"} may deteriorate in 24h. Prioritize bedside review, repeat vitals, and alert assigned doctors/nurses.`,
    };
  }

  if (moderateCount > 0 || data.at_risk_count > 0 || data.vitals_health_percentage < 70) {
    return {
      riskLevel: "Medium",
      suggestion: `ML shows moderate risk pressure. Monitor ${data.at_risk_count} at-risk patient${data.at_risk_count === 1 ? "" : "s"}, keep vitals updated, and escalate if scores rise.`,
    };
  }

  return {
    riskLevel: "Low",
    suggestion: "ML forecast is stable. Continue routine monitoring and keep latest vitals updated for early risk detection.",
  };
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
      "before:content-[''] before:absolute before:left-0 before:top-0 before:h-[3px] before:w-full before:bg-red-500 before:pointer-events-none after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[3px] after:bg-red-500 after:pointer-events-none dark:bg-kpi-red dark:shadow-kpi-red dark:hover:shadow-kpi-red-hover",
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
  const htmlIsDark = useHtmlDarkClass();
  const { openDetail, openDetailAsync } = useDashboardDetailModal();

  const [kpiHover, setKpiHover] = useState<string | null>(null);
  const [intelClock, setIntelClock] = useState(0);
  const [expandedIntelCard, setExpandedIntelCard] = useState<"patients" | "vitals" | "critical" | null>(null);
  const [pharmacyStatHover, setPharmacyStatHover] = useState<PharmacyStatHover>(null);
  const bedForecastChartRef = useRef<HTMLDivElement | null>(null);

  const [kpiLastFetch, setKpiLastFetch] = useState<Date | null>(null);
  const { data: kpiData, isLoading: kpiLoading, mutate: mutateKpi } = useSWR<HospitalOverviewKpis>(
    apiUrl("/api/hospital-overview", true),
    fetcher,
    { refreshInterval: 60000, onSuccess: () => setKpiLastFetch(new Date()) }
  );

  const [intelLastFetch, setIntelLastFetch] = useState<Date | null>(null);
  const {
    data: intelData,
    isLoading: intelLoading,
    mutate: mutateIntel,
    ensureDetail: ensureIntelDetail,
  } = useLazyDashboardCard<PatientIntelResponse>("/api/patient-intelligence", () =>
    setIntelLastFetch(new Date()),
  );

  const [pharmacyLastFetch, setPharmacyLastFetch] = useState<Date | null>(null);
  const {
    data: pharmacyData,
    isLoading: pharmacyLoading,
    mutate: mutatePharmacy,
    ensureDetail: ensurePharmacyDetail,
  } = useLazyDashboardCard<PharmacyIntelResponse>("/api/pharmacy-intelligence", () =>
    setPharmacyLastFetch(new Date()),
  );

  const [financeLastFetch, setFinanceLastFetch] = useState<Date | null>(null);
  const {
    data: financeData,
    isLoading: financeLoading,
    mutate: mutateFinance,
    ensureDetail: ensureFinanceDetail,
  } = useLazyDashboardCard<FinanceBillingOverview>("/api/billing-finance-overview", () =>
    setFinanceLastFetch(new Date()),
  );

  const [bedsLastFetch, setBedsLastFetch] = useState<Date | null>(null);
  const {
    data: bedsData,
    isLoading: bedsLoading,
    mutate: mutateBeds,
    ensureDetail: ensureBedsDetail,
  } = useLazyDashboardCard<PatientsBedsOverview>("/api/patients-beds-overview", () =>
    setBedsLastFetch(new Date()),
  );

  const [staffLastFetch, setStaffLastFetch] = useState<Date | null>(null);
  const {
    data: staffData,
    isLoading: staffLoading,
    mutate: mutateStaff,
    ensureDetail: ensureStaffDetail,
  } = useLazyDashboardCard<HrStaffOverview>("/api/hr-staff-overview", () =>
    setStaffLastFetch(new Date()),
  );

  const [labLastFetch, setLabLastFetch] = useState<Date | null>(null);
  const {
    data: labData,
    isLoading: labLoading,
    mutate: mutateLab,
    ensureDetail: ensureLabDetail,
  } = useLazyDashboardCard<LaboratoryOverview>("/api/laboratory-overview", () =>
    setLabLastFetch(new Date()),
  );

  const openIntelDetail = useCallback(
    (
      builder: (d: PatientIntelResponse) => DetailModalPayload,
      loading?: { title?: string; subtitle?: string },
    ) => {
      void openDetailAsync(async () => {
        const d = await ensureIntelDetail();
        return builder(d);
      }, loading);
    },
    [ensureIntelDetail, openDetailAsync],
  );

  const openPharmacyDetail = useCallback(
    (
      builder: (d: PharmacyIntelResponse) => DetailModalPayload,
      loading?: { title?: string; subtitle?: string },
    ) => {
      void openDetailAsync(async () => {
        const d = await ensurePharmacyDetail();
        return builder(d);
      }, loading);
    },
    [ensurePharmacyDetail, openDetailAsync],
  );

  const openFinanceDetail = useCallback(
    (
      builder: (d: FinanceBillingOverview) => DetailModalPayload,
      loading?: { title?: string; subtitle?: string },
    ) => {
      void openDetailAsync(async () => {
        const d = await ensureFinanceDetail();
        return builder(d);
      }, loading);
    },
    [ensureFinanceDetail, openDetailAsync],
  );

  const openBedsDetail = useCallback(
    (
      builder: (d: PatientsBedsOverview) => DetailModalPayload,
      loading?: { title?: string; subtitle?: string },
    ) => {
      void openDetailAsync(async () => {
        const d = await ensureBedsDetail();
        return builder(d);
      }, loading);
    },
    [ensureBedsDetail, openDetailAsync],
  );

  const openStaffDetail = useCallback(
    (
      builder: (d: HrStaffOverview) => DetailModalPayload,
      loading?: { title?: string; subtitle?: string },
    ) => {
      void openDetailAsync(async () => {
        const d = await ensureStaffDetail();
        return builder(d);
      }, loading);
    },
    [ensureStaffDetail, openDetailAsync],
  );

  const openLabDetail = useCallback(
    (
      builder: (d: LaboratoryOverview) => DetailModalPayload,
      loading?: { title?: string; subtitle?: string },
    ) => {
      void openDetailAsync(async () => {
        const d = await ensureLabDetail();
        return builder(d);
      }, loading);
    },
    [ensureLabDetail, openDetailAsync],
  );

  useRealtimeEvent(["vitals_updated", "admin_data_changed"], () => {
    void mutateKpi();
    void mutateIntel();
    void mutatePharmacy();
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
          const displayValue = formatKpiDisplay(kpiData || null, k.valueKey, k.kind);
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
            kpiData || null
          );
          const showTip =
            !kpiLoading && !!kpiData && kpiHover === k.label && tipRows.length > 0;
          const sparkData = makeSparkData(value);
          const isActuallyLoading = kpiLoading && !kpiData;
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
                  {isActuallyLoading ? (
                    <div
                      className="h-8 w-24 max-w-full animate-pulse rounded-xl bg-slate-100 dark:bg-white/8"
                      aria-hidden
                    />
                  ) : !kpiData ? (
                    <p className="text-slate-400 font-medium text-sm dark:text-slate-500">
                      Error loading
                    </p>
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
                  <span className={isActuallyLoading ? "text-slate-600 dark:text-tx-secondary" : !kpiData ? "text-slate-400 dark:text-slate-500" : trendTextClass(trendStr)}>
                    {isActuallyLoading ? "N/A vs yesterday" : !kpiData ? "N/A" : trendLine}
                  </span>
                </p>
              </div>
              </div>

              <div
                className={`absolute bottom-0 left-0 right-0 h-[44%] pointer-events-none ${
                  k.label === "Critical Patients" ? "pb-[3px]" : ""
                }`}
              >
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
                  className={
                    htmlIsDark
                      ? "h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent border-b-base-border"
                      : "h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent border-b-slate-200"
                  }
                  aria-hidden
                />
                <div
                  className={
                    htmlIsDark
                      ? "-mt-px w-full rounded-2xl border border-base-border bg-base-card px-3 py-2.5 shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
                      : "-mt-px w-full rounded-2xl border border-slate-200 !bg-white px-3 py-2.5 shadow-[0_4px_20px_rgba(15,23,42,0.08)]"
                  }
                >
                  <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-text-secondary">
                    {tipTitle}
                  </p>
                  <div className="space-y-1.5">
                    {tipRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex justify-between gap-2 text-xs leading-snug"
                      >
                        <span className="text-slate-600 dark:text-text-secondary">
                          {row.label}
                        </span>
                        <span className="shrink-0 pl-1 text-right font-semibold text-slate-900 dark:text-text-primary">
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
        <div
          className="order-1 bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] overflow-hidden dark:bg-panel dark:border-white/[0.06] dark:shadow-panel"
          style={{ height: 344, display: "flex", flexDirection: "column" }}
        >
          <div className="h-[44px] box-border flex items-center justify-between px-5 py-0 border-b border-dash-border shrink-0">
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

          {intelData ? (
            <div className="h-[300px] min-h-0 grid grid-cols-[160px_1fr_180px] divide-x divide-dash-border overflow-hidden">
              {/* LEFT: KPI STACK */}
              <div className="min-h-0 grid grid-rows-4 divide-y divide-dash-border overflow-visible">
                {/* TOTAL PATIENTS */}
                <div
                  className={`relative group min-h-0 flex flex-col justify-center px-3 py-1 hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                  role="presentation"
                  onClick={() =>
                    openIntelDetail((d) =>
                      patientIntelRosterTablePayload(d, "all", "All inpatients — full roster"),
                    )
                  }
                >
                  <div
                    className={`absolute left-full top-0 z-50 ml-2 w-56 ${patientIntelHoverPanelCls(htmlIsDark)} opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Total patients</p>
                    <p className="text-[10px] text-tx-secondary">Previous week: {intelData.previous_week_patients ?? 0}</p>
                    <p className="text-[10px] text-tx-secondary mt-0.5">Change: {intelData.change_from_last_week ?? 0}</p>
                    <p className="text-[10px] text-kpi-cyan mt-1">Active admissions snapshot</p>
                  </div>
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">TOTAL PATIENTS</p>
                  <div className="flex items-end gap-2 mt-0.5">
                    <p className="text-tx-bright font-black text-xl tabular-nums leading-none">
                      {intelData.total_patients}
                    </p>
                    {(() => {
                      const u = changeVsWeekUi(intelData.change_from_last_week);
                      return (
                        <p className={`text-[10px] font-medium mb-0.5 ${u.cls}`}>
                          {u.arrow} {u.tail}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="mt-1 h-5 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={derivePrediction(intelData.total_patients, undefined, undefined).trend.map((v, i) => ({ x: i, v }))}
                        margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="g-patients" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={1.5} fill="url(#g-patients)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* VITALS HEALTH */}
                <div
                  className={`relative group min-h-0 flex flex-col justify-center px-3 py-1 hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                  role="presentation"
                  onClick={() =>
                    openIntelDetail((d) =>
                      patientIntelRosterTablePayload(
                        d,
                        "healthy",
                        "Vitals health — inpatients",
                      ),
                    )
                  }
                >
                  <div
                    className={`absolute left-full top-0 z-50 ml-2 w-56 ${patientIntelHoverPanelCls(htmlIsDark)} opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Vitals status</p>
                    <p className="text-[10px] text-kpi-green">✓ Healthy: {intelData.vitals_health_percentage}%</p>
                    <p className="text-[10px] text-kpi-red mt-0.5">✗ Critical: {intelData.critical_vitals_percentage}%</p>
                    <p className="text-[10px] text-tx-yellow mt-0.5">⚠ At risk: {intelData.at_risk_count}</p>
                    <p className="text-[10px] text-tx-secondary mt-1">Based on latest recorded vitals</p>
                  </div>
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">VITALS HEALTH</p>
                  <p className="text-kpi-green font-black text-xl tabular-nums leading-none mt-0.5">
                    {intelData.vitals_health_percentage}%
                  </p>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-green transition-all"
                      style={{ width: `${Math.min(100, intelData.vitals_health_percentage)}%` }}
                    />
                  </div>
                  <div className="mt-1 h-5 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={derivePrediction(intelData.vitals_health_percentage, undefined, undefined).trend.map((v, i) => ({ x: i, v }))}
                        margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="g-vitals" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={1.5} fill="url(#g-vitals)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* CRITICAL VITALS */}
                <div
                  className={`relative group min-h-0 flex flex-col justify-center px-3 py-1 hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                  role="presentation"
                  onClick={() =>
                    openIntelDetail((d) =>
                      patientIntelRosterTablePayload(
                        d,
                        "critical_vitals",
                        "Critical / abnormal vitals — inpatient roster",
                      ),
                    )
                  }
                >
                  <div
                    className={`absolute left-full top-0 z-50 ml-2 w-56 ${patientIntelHoverPanelCls(htmlIsDark)} opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Top critical (ML)</p>
                    {(() => {
                      const top = (intelData.ml_forecast || [])
                        .filter((p) => ["high", "critical"].includes((p.risk_label || "").toLowerCase()))
                        .slice(0, 3);
                      return top.length ? (
                        <div className="space-y-0.5">
                          {top.map((p, i) => (
                            <p key={`${p.patient_id}-${i}`} className="text-[10px] text-tx-secondary truncate">
                              {i + 1}. {p.name} ({p.risk_pct}%)
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-tx-secondary">No high/critical ML patients</p>
                      );
                    })()}
                    <p className="text-[10px] text-tx-secondary mt-1">Hover shows ML high/critical list</p>
                  </div>
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">CRITICAL VITALS</p>
                  <p className="text-kpi-red font-black text-xl tabular-nums leading-none mt-0.5">
                    {intelData.critical_vitals_percentage}%
                  </p>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-red transition-all"
                      style={{ width: `${Math.min(100, intelData.critical_vitals_percentage)}%` }}
                    />
                  </div>
                  <div className="mt-1 h-5 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={derivePrediction(intelData.critical_vitals_percentage, undefined, undefined).trend.map((v, i) => ({ x: i, v }))}
                        margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="g-critical" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={1.5} fill="url(#g-critical)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* AT RISK */}
                <div
                  className={`relative group min-h-0 flex flex-col justify-center px-3 py-1 hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                  role="presentation"
                  onClick={() =>
                    openIntelDetail((d) =>
                      patientIntelRosterTablePayload(
                        d,
                        "at_risk",
                        "At risk — inpatient roster",
                      ),
                    )
                  }
                >
                  <div
                    className={`absolute left-full bottom-0 z-50 ml-2 w-56 ${patientIntelHoverPanelCls(htmlIsDark)} opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">At risk (ML)</p>
                    <p className="text-[10px] text-tx-secondary">
                      High/Critical in 24h: {intelData.ml_high_risk_24h_count ?? 0}
                    </p>
                    <p className="text-[10px] text-tx-secondary mt-0.5">Thresholds: High ≥ 0.75, Critical ≥ 0.90</p>
                    <p className="text-[10px] text-tx-yellow mt-1">Needs immediate attention</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-tx-yellow text-[10px]">⚠️</span>
                    <p className="text-tx-yellow text-[9px] font-semibold uppercase tracking-wider">AT RISK</p>
                  </div>
                  <p className="text-tx-bright font-black text-xl tabular-nums leading-none mt-0.5">
                    {intelData.at_risk_count}
                  </p>
                </div>
              </div>

              {/* MIDDLE: ML FORECAST */}
              <div className="flex flex-col px-4 py-2 overflow-hidden min-h-0">
                <p className="text-kpi-cyan text-[10px] font-bold uppercase tracking-wider shrink-0">
                  🤖 ML RISK FORECAST
                </p>
                <div className="mt-1.5 flex flex-col gap-0.5 overflow-hidden flex-1 min-h-0">
                  {(() => {
                    const fallbackNames = (intelData.top_risk_patients || "")
                      .split(/,|\n/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const rows =
                      (intelData.ml_forecast && intelData.ml_forecast.length
                        ? intelData.ml_forecast
                        : fallbackNames.slice(0, 5).map((n) => ({
                            patient_id: 0,
                            name: n,
                            risk_prob: 0,
                            risk_pct: 0,
                            risk_label: "Low",
                          }))) ?? [];

                    const colorFor = (label: string) => {
                      const l = (label || "").toLowerCase();
                      if (l === "critical") return "#ef4444";
                      if (l === "high") return "#f97316";
                      if (l === "moderate") return "#eab308";
                      return "#22c55e";
                    };
                    const badgeFor = (label: string) => {
                      const l = (label || "").toLowerCase();
                      if (l === "critical") return "bg-red-500/15 text-kpi-red border-red-500/20";
                      if (l === "high") return "bg-orange-500/15 text-kpi-orange border-orange-500/20";
                      if (l === "moderate") return "bg-yellow-500/15 text-tx-yellow border-yellow-500/20";
                      return "bg-green-500/15 text-kpi-green border-green-500/20";
                    };

                    return rows.slice(0, 5).map((pt, i) => {
                      const name = pt.name || "Patient";
                      const pct = Math.max(0, Math.min(100, Number(pt.risk_pct ?? 0)));
                      const label = pt.risk_label || "Low";
                      const color = colorFor(label);
                      const badgeClass = badgeFor(label);
                      const pid = Number(pt.patient_id);
                      const rowOpen = Number.isFinite(pid) && pid > 0;
                      return (
                        <div
                          key={`${pt.patient_id || name}-${i}`}
                          className={`flex items-center gap-2 py-0.5 border-b border-dash-border/40 last:border-0 ${
                            rowOpen ? insightOpenCls : ""
                          }`}
                          role={rowOpen ? "button" : undefined}
                          onClick={
                            rowOpen
                              ? () => openIntelDetail((d) => patientIntelSingleRowTable(d, pid))
                              : undefined
                          }
                        >
                          <span className="text-[10px] text-tx-muted w-3 shrink-0">{i + 1}</span>
                          <span className="text-[11px] text-tx-primary truncate flex-1 min-w-0">{name}</span>
                          <div className="w-16 h-1.5 rounded-full bg-dash-border overflow-hidden shrink-0">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${badgeClass}`}>
                            {label}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div
                  className={`mt-1 pt-1.5 border-t border-dash-border shrink-0 ${insightOpenCls}`}
                  role="presentation"
                  title="Risk detail"
                  onClick={() =>
                    openIntelDetail((d) =>
                      patientIntelRosterTablePayload(
                        d,
                        "ml_deterioration_24h",
                        "ML high/critical (24h) — matching inpatients",
                      ),
                    )
                  }
                >
                  {(() => {
                    const highRisk =
                      typeof intelData.ml_high_risk_24h_count === "number"
                        ? intelData.ml_high_risk_24h_count
                        : (intelData.ml_forecast || []).filter((p) =>
                            ["high", "critical"].includes((p.risk_label || "").toLowerCase())
                          ).length;
                    return (
                      <p className={`text-[11px] font-semibold ${highRisk > 0 ? "text-kpi-red" : "text-kpi-green"}`}>
                        ⚡ {highRisk} patients predicted to deteriorate in 24h
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* RIGHT: SUGGESTION */}
              <div className="flex flex-col px-4 py-2 overflow-hidden min-h-0">
                <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider shrink-0">
                  💡 SUGGESTION
                </p>

                {(() => {
                  const mlSuggestion = derivePatientMlSuggestion(intelData);
                  const riskLevel = mlSuggestion.riskLevel;
                  const badgeClass =
                    riskLevel === "Critical" ? "bg-red-500/15 text-kpi-red border-red-500/20" :
                    riskLevel === "High" ? "bg-orange-500/15 text-kpi-orange border-orange-500/20" :
                    riskLevel === "Medium" ? "bg-yellow-500/15 text-tx-yellow border-yellow-500/20" :
                    "bg-green-500/15 text-kpi-green border-green-500/20";
                  return (
                    <>
                      <div className="mt-1.5 bg-kpi-orange/8 border border-kpi-orange/20 rounded-xl p-3 h-[188px] overflow-hidden shrink-0">
                        <p
                          className="text-kpi-orange font-semibold text-[11px] leading-relaxed overflow-hidden"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 7,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {mlSuggestion.suggestion}
                        </p>
                      </div>
                      <span className={`mt-2 self-start text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${badgeClass} shrink-0`}>
                        [{riskLevel.toUpperCase()}]
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : null}

          {/* Loading state */}
          {intelLoading && !intelData ? (
            <SkeletonCard />
          ) : null}

          {/* Error state */}
          {!intelData && !intelLoading ? (
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <p className="text-xs text-tx-muted">Unable to load. Check admin access and API.</p>
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

        <div
          className="order-3 bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] overflow-visible dark:bg-panel dark:border-white/[0.06] dark:shadow-panel"
          style={{ height: 344, display: "flex", flexDirection: "column" }}
        >
          {/* Header */}
          <div className="h-[44px] box-border flex items-center justify-between px-5 py-0 border-b border-dash-border shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xl" aria-hidden>💊</span>
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

          {/* Loading */}
          {pharmacyLoading && !pharmacyData ? (
            <SkeletonCard />
          ) : null}

          {/* Error */}
          {!pharmacyData && !pharmacyLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-xs text-tx-muted">Unable to load. Check admin access and API.</p>
            </div>
          ) : null}

          {/* Body — 3 columns same as Patient Intelligence */}
          {pharmacyData ? (
            <div className="h-[300px] min-w-0 grid grid-cols-[160px_minmax(0,1fr)_180px] divide-x divide-dash-border overflow-visible">

              {/* ── COLUMN 1: 4 KPI Stats ── */}
              <div className="min-w-0 grid grid-rows-4 divide-y divide-dash-border overflow-visible">

                {/* Stat 1: Total Medicines */}
                <div
                  className="relative group flex min-w-0 flex-col justify-center px-3 py-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() =>
                    openPharmacyDetail((d) => pharmacyInventorySnapshotTable(d), {
                      title: "Total Medicines",
                      subtitle: "Loading medicine lists…",
                    })
                  }
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">Total Medicines</p>
                  <p className="text-tx-bright font-black text-xl tabular-nums leading-none mt-0.5">
                    {pharmacyData.total_medicines}
                  </p>
                  {(() => {
                    const { total, oos, low, soon, expired, safe, healthPct: healthyPct } =
                      pharmacyStockBreakdown(pharmacyData);
                    // Build segments only for non-zero values, then normalize to <=100%
                    const rawLow  = low > 0           ? Math.max(2, Math.round((low / total) * 100))             : 0;
                    const rawSoon = soon > 0          ? Math.max(2, Math.round((soon / total) * 100))            : 0;
                    const rawOos  = (oos + expired) > 0 ? Math.max(2, Math.round(((oos + expired) / total) * 100)) : 0;
                    const safePct = Math.max(0, 100 - rawLow - rawSoon - rawOos);
                    return (
                      <div className="mt-1.5 w-[120px] max-w-[120px]">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-white/5 flex">
                          <span className="h-full bg-emerald-500/70" style={{ width: `${safePct}%` }} />
                          <span className="h-full bg-orange-500/70"  style={{ width: `${rawLow}%` }} />
                          <span className="h-full bg-yellow-500/70"  style={{ width: `${rawSoon}%` }} />
                          <span className="h-full bg-red-500/70"     style={{ width: `${rawOos}%` }} />
                        </div>
                        <p className="text-[9px] text-tx-secondary mt-0.5">{healthyPct}% healthy</p>
                      </div>
                    );
                  })()}
                  <div
                    className={`absolute left-full top-0 z-[9999] ml-1 w-44 ${patientIntelHoverPanelCls(htmlIsDark)} hidden group-hover:block pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Stock Overview</p>
                    {(() => {
                      const total = Math.max(1, pharmacyData.total_medicines);
                      const oos = pharmacyData.out_of_stock_count ?? 0;
                      const low = pharmacyData.low_stock_count ?? 0;
                      const soon = pharmacyData.expiring_soon_count ?? 0;
                      const expired = pharmacyData.expired_count ?? 0;
                      const safe = Math.max(0, total - oos - low - soon - expired);
                      return (
                        <>
                          <div className="flex justify-between text-[10px] py-0.5 border-b border-slate-100 dark:border-white/5"><span className="text-kpi-green">✓ Safe</span><span className="text-kpi-green font-bold">{safe}</span></div>
                          <div className="flex justify-between text-[10px] py-0.5 border-b border-slate-100 dark:border-white/5"><span className="text-kpi-orange">⚠ Low</span><span className="text-kpi-orange font-bold">{low}</span></div>
                          <div className="flex justify-between text-[10px] py-0.5 border-b border-slate-100 dark:border-white/5"><span className="text-tx-yellow">⏳ Expiring</span><span className="text-tx-yellow font-bold">{soon}</span></div>
                          <div className="flex justify-between text-[10px] py-0.5 border-b border-slate-100 dark:border-white/5"><span className="text-kpi-red">✗ OOS</span><span className="text-kpi-red font-bold">{oos}</span></div>
                          <div className="flex justify-between text-[10px] py-0.5"><span className="text-tx-muted">💀 Expired</span><span className="text-tx-muted font-bold">{expired}</span></div>
                          <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-1.5 text-[10px] dark:border-white/10">
                            <span className="text-tx-muted">Health Rate</span>
                            <span className={`font-bold ${safe / total >= 0.7 ? "text-kpi-green" : safe / total >= 0.4 ? "text-kpi-orange" : "text-kpi-red"}`}>{Math.round((safe / total) * 100)}%</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Stat 2: Out of Stock */}
                <div
                  className="relative group flex min-w-0 flex-col justify-center px-3 py-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors ring-1 ring-inset ring-kpi-red/20"
                  onClick={() =>
                    openPharmacyDetail((d) =>
                      pharmacyMedicineNameTable(
                        "Out of stock",
                        d.out_of_stock_medicines ?? [],
                        "No out-of-stock medicines",
                      ),
                    )
                  }
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">Out of Stock</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-kpi-red font-black text-xl tabular-nums leading-none">
                      {pharmacyData.out_of_stock_count ?? 0}
                    </p>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-red opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kpi-red" />
                    </span>
                  </div>
                  {(pharmacyData.out_of_stock_medicines ?? []).length > 0 ? (
                    <p className="block w-[120px] max-w-[120px] overflow-hidden truncate whitespace-nowrap text-[9px] text-kpi-red/70 mt-0.5">
                      {(pharmacyData.out_of_stock_medicines ?? []).slice(0, 2).join(", ")}
                      {(pharmacyData.out_of_stock_medicines ?? []).length > 2 ? ` +${(pharmacyData.out_of_stock_medicines ?? []).length - 2}` : ""}
                    </p>
                  ) : null}
                  <div
                    className={`absolute left-full top-0 z-[9999] ml-1 w-44 ${patientIntelHoverPanelCls(htmlIsDark)} hidden group-hover:block pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Out of Stock — {pharmacyData.out_of_stock_count ?? 0}</p>
                    {(pharmacyData.out_of_stock_medicines ?? []).length > 0 ? (
                      <>
                        {(pharmacyData.out_of_stock_medicines ?? []).slice(0, 5).map((m, i) => (
                          <div key={i} className="flex items-center gap-1.5 py-0.5 border-b border-slate-100 dark:border-white/5 last:border-0">
                            <span className="w-1 h-1 rounded-full bg-kpi-red shrink-0" />
                            <p className="text-[10px] text-tx-secondary truncate">{m}</p>
                          </div>
                        ))}
                        {(pharmacyData.out_of_stock_medicines ?? []).length > 5 && (
                          <p className="text-[9px] text-tx-muted mt-1">+{(pharmacyData.out_of_stock_medicines ?? []).length - 5} more — click for all</p>
                        )}
                      </>
                    ) : (
                      <p className="text-[10px] text-kpi-green">✓ All in stock</p>
                    )}
                  </div>
                </div>

                {/* Stat 3: Low Stock */}
                <div
                  className="relative group flex min-w-0 flex-col justify-center px-3 py-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() =>
                    openPharmacyDetail((d) =>
                      pharmacyMedicineNameTable(
                        "Low stock",
                        d.low_stock_medicines ?? [],
                        "No low-stock medicines",
                      ),
                    )
                  }
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">Low Stock</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-kpi-orange font-black text-xl tabular-nums leading-none">
                      {pharmacyData.low_stock_count ?? 0}
                    </p>
                    <span className="w-1.5 h-1.5 rounded-full bg-kpi-orange" />
                  </div>
                  {(pharmacyData.low_stock_medicines ?? []).length > 0 ? (
                    <p className="block w-[120px] max-w-[120px] overflow-hidden truncate whitespace-nowrap text-[9px] text-kpi-orange/70 mt-0.5">
                      {(pharmacyData.low_stock_medicines ?? []).slice(0, 2).join(", ")}
                      {(pharmacyData.low_stock_medicines ?? []).length > 2 ? ` +${(pharmacyData.low_stock_medicines ?? []).length - 2}` : ""}
                    </p>
                  ) : null}
                  <div
                    className={`absolute left-full top-0 z-[9999] ml-1 w-44 ${patientIntelHoverPanelCls(htmlIsDark)} hidden group-hover:block pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Low Stock — {pharmacyData.low_stock_count ?? 0}</p>
                    {(pharmacyData.low_stock_medicines ?? []).length > 0 ? (
                      <>
                        {(pharmacyData.low_stock_medicines ?? []).slice(0, 5).map((m, i) => (
                          <div key={i} className="flex items-center gap-1.5 py-0.5 border-b border-slate-100 dark:border-white/5 last:border-0">
                            <span className="w-1 h-1 rounded-full bg-kpi-orange shrink-0" />
                            <p className="text-[10px] text-tx-secondary truncate">{m}</p>
                          </div>
                        ))}
                        {(pharmacyData.low_stock_medicines ?? []).length > 5 && (
                          <p className="text-[9px] text-tx-muted mt-1">+{(pharmacyData.low_stock_medicines ?? []).length - 5} more — click for all</p>
                        )}
                      </>
                    ) : (
                      <p className="text-[10px] text-kpi-green">✓ No low stock items</p>
                    )}
                  </div>
                </div>

                {/* Stat 4: Expiring Soon */}
                <div
                  className="relative group flex min-w-0 flex-col justify-center px-3 py-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() =>
                    openPharmacyDetail((d) =>
                      pharmacyMedicineNameTable(
                        "Expiring soon (30d)",
                        d.expiring_soon_medicines ?? [],
                        "No medicines expiring in the next 30 days",
                      ),
                    )
                  }
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">Expiring Soon</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-tx-yellow font-black text-xl tabular-nums leading-none">
                      {pharmacyData.expiring_soon_count ?? 0}
                    </p>
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                  </div>
                  {(pharmacyData.expiring_soon_medicines ?? []).length > 0 ? (
                    <p className="block w-[120px] max-w-[120px] overflow-hidden truncate whitespace-nowrap text-[9px] text-tx-yellow/70 mt-0.5">
                      {(pharmacyData.expiring_soon_medicines ?? []).slice(0, 2).join(", ")}
                      {(pharmacyData.expiring_soon_medicines ?? []).length > 2 ? ` +${(pharmacyData.expiring_soon_medicines ?? []).length - 2}` : ""}
                    </p>
                  ) : null}
                  <div
                    className={`absolute left-full bottom-0 z-[9999] ml-1 w-44 ${patientIntelHoverPanelCls(htmlIsDark)} hidden group-hover:block pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Expiring 30d — {pharmacyData.expiring_soon_count ?? 0}</p>
                    {(pharmacyData.expiring_soon_medicines ?? []).length > 0 ? (
                      <>
                        {(pharmacyData.expiring_soon_medicines ?? []).slice(0, 5).map((m, i) => (
                          <div key={i} className="flex items-center gap-1.5 py-0.5 border-b border-slate-100 dark:border-white/5 last:border-0">
                            <span className="w-1 h-1 rounded-full bg-yellow-500 shrink-0" />
                            <p className="text-[10px] text-tx-secondary truncate">{m}</p>
                          </div>
                        ))}
                        {(pharmacyData.expiring_soon_medicines ?? []).length > 5 && (
                          <p className="text-[9px] text-tx-muted mt-1">+{(pharmacyData.expiring_soon_medicines ?? []).length - 5} more — click for all</p>
                        )}
                      </>
                    ) : (
                      <p className="text-[10px] text-kpi-green">✓ None expiring soon</p>
                    )}
                    <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-1.5 text-[9px] dark:border-white/10">
                      <span className="text-tx-muted">Already expired:</span>
                      <span className="text-tx-secondary font-bold">{pharmacyData.expired_count ?? 0}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* ── COLUMN 2: ML Medicines at Risk (stockout model) ── */}
              <div className="min-w-0 flex flex-col px-4 py-3 overflow-hidden">

                {/* Section header with info-icon tooltip */}
                <div className="flex items-center gap-1.5 shrink-0 mb-1.5">
                  <p className="text-kpi-cyan text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    🩺 Medicines Running Out (Next 7 Days)
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-cyan opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kpi-cyan" />
                    </span>
                  </p>
                  {/* Info icon with hover tooltip — 200ms delay, dark theme */}
                  <span className="relative group/info inline-flex items-center justify-center cursor-help">
                    <svg
                      className="w-3 h-3 text-tx-muted group-hover/info:text-kpi-cyan transition-colors"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span
                      role="tooltip"
                      className={
                        htmlIsDark
                          ? "pointer-events-none absolute top-full left-0 mt-1.5 z-[9999] w-[200px] rounded-md border border-white/10 bg-gray-900 px-2 py-1.5 text-[10px] leading-snug text-white shadow-[0_8px_32px_rgba(0,0,0,0.7)] opacity-0 transition-opacity duration-150 delay-200 group-hover/info:opacity-100"
                          : "pointer-events-none absolute top-full left-0 mt-1.5 z-[9999] w-[200px] rounded-md border border-slate-200 !bg-white px-2 py-1.5 text-[10px] leading-snug text-slate-700 shadow-[0_4px_20px_rgba(15,23,42,0.1)] opacity-0 transition-opacity duration-150 delay-200 group-hover/info:opacity-100"
                      }
                    >
                      Predicted out-of-stock risk per medicine in the next 7 days.
                    </span>
                  </span>
                </div>

                {/* Row-by-row medicine risk: show all rows with internal scrolling */}
                <div className="space-y-1 flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-kpi-red/25 scrollbar-track-transparent">
                  {(pharmacyData.ml_at_risk_medicines ?? []).length > 0
                    ? (pharmacyData.ml_at_risk_medicines ?? []).map((m, i) => {
                        const pct = Math.round(m.stockout_probability * 100);
                        const badgeClass =
                          pct >= 80 ? "bg-red-500/20 text-kpi-red border-red-500/30" :
                          pct >= 50 ? "bg-orange-500/20 text-kpi-orange border-orange-500/30" :
                                      "bg-yellow-500/20 text-tx-yellow border-yellow-500/30";
                        const label =
                          pct >= 80 ? "critical" :
                          pct >= 50 ? "high risk" : "moderate";
                        return (
                          <div
                            key={i}
                            className={`flex items-center justify-between gap-2 py-[3px] border-b border-white/[0.04] last:border-0 ${insightOpenCls}`}
                            role="presentation"
                            onClick={() => openDetail(pharmacyMlAtRiskSingleRow(m))}
                          >
                            <p className="text-[10px] text-tx-secondary truncate flex-1">{m.medicine_name}</p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-tx-muted tabular-nums">{pct}%</span>
                              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${badgeClass}`}>
                                {label}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    : (pharmacyData.medicines_to_reorder ?? []).map((name, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between gap-2 py-[3px] border-b border-white/[0.04] last:border-0 ${insightOpenCls}`}
                          role="presentation"
                          onClick={() =>
                            openDetail(pharmacyMedicineNameTable("Reorder item", [name], "—"))
                          }
                        >
                          <p className="text-[10px] text-tx-secondary truncate flex-1">{name}</p>
                          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border bg-red-500/20 text-kpi-red border-red-500/30 shrink-0">
                            reorder
                          </span>
                        </div>
                      ))
                  }
                </div>

                {/* Predicted totals footer */}
                <div
                  className={`mt-auto pt-2 border-t border-dash-border shrink-0 ${insightOpenCls}`}
                  role="presentation"
                  title="Full ML / reorder table"
                  onClick={() => openPharmacyDetail((d) => pharmacyMlAtRiskTable(d))}
                >
                  {(() => {
                    const atRisk   = pharmacyData.ml_at_risk_medicines ?? [];
                    const reorder  = pharmacyData.medicines_to_reorder ?? [];
                    const useML    = atRisk.length > 0;

                    if (useML) {
                      const critical = atRisk.filter(m => m.stockout_probability >= 0.80).length;
                      const high     = atRisk.filter(m => m.stockout_probability >= 0.50 && m.stockout_probability < 0.80).length;
                      const moderate = Math.max(0, atRisk.length - critical - high);
                      const total    = atRisk.length;
                      const riskParts = [
                        critical > 0 ? `${critical} critical` : "",
                        high > 0 ? `${high} high risk` : "",
                        moderate > 0 ? `${moderate} moderate` : "",
                      ].filter(Boolean).join(" · ");
                      return (
                        <>
                          <p className={`text-[11px] font-bold ${critical > 0 ? "text-kpi-red" : high > 0 ? "text-kpi-orange" : "text-kpi-green"}`}>
                            ⚡ {total > 0
                              ? `In the next 7 days, ${total} medicine${total > 1 ? "s" : ""} predicted to go out of stock`
                              : "No medicines predicted to run out in next 7 days ✓"}
                          </p>
                          {total > 0 ? (
                            <p className="text-[9px] text-tx-muted mt-0.5">
                              {riskParts}
                            </p>
                          ) : null}
                        </>
                      );
                    }

                    // No ML — count matches the reorder list shown above
                    const total = reorder.length;
                    const oosCount = pharmacyData.out_of_stock_count ?? 0;
                    const lowCount = pharmacyData.low_stock_count ?? 0;
                    return (
                      <>
                        <p className={`text-[11px] font-bold ${total > 0 ? "text-kpi-red" : "text-kpi-green"}`}>
                          ⚡ {total > 0
                            ? `${total} medicine${total > 1 ? "s" : ""} need reordering`
                            : "All medicines have healthy stock levels ✓"}
                        </p>
                        {total > 0 ? (
                          <p className="text-[9px] text-tx-muted mt-0.5">
                            {oosCount > 0 ? `${oosCount} out of stock · ` : ""}
                            {lowCount > 0 ? `${lowCount} low stock` : ""}
                          </p>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* ── COLUMN 3: 7-Day Demand Forecast ── */}
              <div className="min-w-0 flex flex-col px-4 py-3 bg-white/[0.01] overflow-hidden">

                {/* Section header */}
                <p className="text-tx-muted text-[10px] font-bold uppercase tracking-wider shrink-0">
                  📈 Prescription Forecast (Next 7 Days)
                </p>
                <p className="text-[8px] text-tx-muted mt-0.5 mb-1.5 shrink-0">
                  Expected number of prescriptions per day
                </p>

                {/* Row-by-row forecast: show all 7 days with internal scrolling */}
                <div className="space-y-[3px] flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-kpi-cyan/25 scrollbar-track-transparent">
                  {(pharmacyData.demand_forecast ?? []).length > 0
                    ? (pharmacyData.demand_forecast ?? []).slice(0, 7).map((f, i) => {
                        const dateLabel = new Date(f.date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
                        const dayLabel  = new Date(f.date).toLocaleDateString("en-US", { weekday: "short" });
                        return (
                          <div key={i} className="flex items-center justify-between gap-2 py-[3px] border-b border-white/[0.04] last:border-0">
                            <p className="text-[10px] text-tx-secondary tabular-nums">{dateLabel} <span className="text-tx-muted">({dayLabel})</span></p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-kpi-cyan font-semibold tabular-nums">
                                {f.predicted_prescriptions} Rx
                              </span>
                              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border bg-kpi-cyan/10 text-kpi-cyan border-kpi-cyan/20">
                                forecast
                              </span>
                            </div>
                          </div>
                        );
                      })
                    : null
                  }
                </div>

                {/* Predicted totals summary — matches Finance "PREDICTED NEXT 7 DAYS TOTALS" */}
                {(pharmacyData.demand_forecast ?? []).length > 0 ? (
                  <div
                    className={`mt-2 pt-1.5 border-t border-dash-border shrink-0 ${insightOpenCls}`}
                    role="presentation"
                    title="Forecast detail"
                    onClick={() =>
                      openPharmacyDetail((d) =>
                        pharmacyDemandForecastModalPayload(d as unknown as Record<string, unknown>),
                      )
                    }
                  >
                    {(() => {
                      const total = (pharmacyData.demand_forecast ?? []).reduce((s, f) => s + f.predicted_prescriptions, 0);
                      const avg   = total / Math.max((pharmacyData.demand_forecast ?? []).length, 1);
                      return (
                        <>
                          <p className="text-[10px] font-bold text-tx-primary">
                            ⚡ Predicted Next 7 Days Totals
                          </p>
                          <p className="text-[10px] text-tx-secondary mt-0.5">
                            <span className="font-semibold text-kpi-cyan">{Math.round(total)} Rx</span> total
                            <span className="text-tx-muted mx-1">·</span>
                            Avg / day: <span className="font-semibold text-kpi-cyan">{avg.toFixed(1)} Rx</span>
                          </p>
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </div>

            </div>
          ) : null}
        </div>
        {/* ── Finance & Billing Intelligence Card ── */}
        <div
          className="order-2 bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] overflow-hidden dark:bg-panel dark:border-white/[0.06] dark:shadow-panel"
          style={{ height: 344, display: "flex", flexDirection: "column" }}
        >
          <div className="h-[44px] box-border flex items-center justify-between px-5 py-0 border-b border-dash-border shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xl" aria-hidden>
                💰
              </span>
              <h2 className="text-tx-bright font-bold text-lg">
                Finance & Billing Intelligence
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {financeData ? (
                <span className="whitespace-nowrap text-tx-secondary text-xs">
                  {intelFooterUpdated(financeLastFetch, intelClock)}
                </span>
              ) : null}
              {financeData ? (
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-green opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-kpi-green" />
                </span>
              ) : null}
            </div>
          </div>

          {financeLoading && !financeData ? (
            <SkeletonCard />
          ) : null}

          {!financeData && !financeLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-xs text-tx-muted">Unable to load finance data.</p>
            </div>
          ) : null}

          {financeData ? (
            <div className="h-[300px] grid grid-cols-[160px_1fr_180px] divide-x divide-dash-border overflow-hidden">
              {/* ── COLUMN 1: 4 KPI Stats ── */}
              <div className="min-h-0 grid grid-rows-4 divide-y divide-dash-border overflow-visible">
                {(() => {
                  const revenue = Number(financeData?.todays_revenue ?? 0);
                  const outstanding = Number(financeData?.outstanding_balance ?? 0);
                  const expenses = Number(financeData?.todays_expenses ?? 0);
                  const invoices = (financeData?.recent_invoices ?? []) as any[];
                  const totalTx = invoices.length;
                  const largestBill = invoices.reduce(
                    (m, inv) => Math.max(m, Number(inv?.amount ?? 0)),
                    0
                  );
                  const safeK = (v: number) => `₨${(v / 1000).toFixed(1)}k`;
                  const outstandingPct =
                    ((outstanding /
                      Math.max(1, revenue + outstanding)) *
                      100);

                  return (
                    <>
                      {/* Stat 1: Today's Revenue */}
                      <div
                        className={`relative group min-h-0 flex flex-col justify-center px-3 py-1 hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                        role="presentation"
                        onClick={() =>
                          openFinanceDetail((d) => financeSnapshotModalPayload(d, "revenue"))
                        }
                      >
                        <div
                          className={`absolute left-full top-0 z-50 ml-2 w-56 ${patientIntelHoverPanelCls(htmlIsDark)} opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none`}
                        >
                          <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">
                            Revenue Breakdown
                          </p>
                          <p className="text-[10px] text-kpi-green">
                            ✓ Paid today: {safeK(revenue)}
                          </p>
                          <p className="text-[10px] text-kpi-orange mt-0.5">
                            ⏳ Outstanding: {safeK(outstanding)}
                          </p>
                          <p className="text-[10px] text-tx-secondary mt-0.5">
                            Recent invoices: {totalTx}
                          </p>
                        </div>
                        <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">
                          Today&apos;s Revenue
                        </p>
                        <p className="text-kpi-green font-black text-xl tabular-nums leading-none mt-0.5">
                          {safeK(revenue)}
                        </p>
                        <div className="mt-1 h-5 -mx-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={(financeData.revenue_vs_expenses ?? []).map(
                                (d: any, i: number) => ({
                                  x: i,
                                  v: d.revenue ?? 0,
                                })
                              )}
                              margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient
                                  id="g-revenue"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#22c55e"
                                    stopOpacity={0.2}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#22c55e"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="v"
                                stroke="#22c55e"
                                strokeWidth={1.5}
                                fill="url(#g-revenue)"
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Stat 2: Outstanding Balance */}
                      <div
                        className={`relative group min-h-0 flex flex-col justify-center px-3 py-1 hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                        role="presentation"
                        onClick={() =>
                          openFinanceDetail((d) => financeSnapshotModalPayload(d, "outstanding"))
                        }
                      >
                        <div
                          className={`absolute left-full top-0 z-50 ml-2 w-56 ${patientIntelHoverPanelCls(htmlIsDark)} opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none`}
                        >
                          <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">
                            Outstanding Detail
                          </p>
                          <p className="text-[10px] text-kpi-orange">
                            Amount: {safeK(outstanding)}
                          </p>
                          <p className="text-[10px] text-tx-secondary mt-0.5">
                            Largest invoice: {safeK(largestBill)}
                          </p>
                          <p className="text-[10px] text-tx-secondary mt-0.5">
                            Share of total: {outstandingPct.toFixed(0)}%
                          </p>
                        </div>
                        <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">
                          Outstanding
                        </p>
                        <p className="text-kpi-orange font-black text-xl tabular-nums leading-none mt-0.5">
                          {safeK(outstanding)}
                        </p>
                        <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-kpi-orange transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(0, outstandingPct))}%`,
                            }}
                          />
                        </div>
                        <div className="mt-1 h-5 -mx-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={(financeData.revenue_vs_expenses ?? []).map(
                                (d: any, i: number) => ({
                                  x: i,
                                  v: d.expenses ?? 0,
                                })
                              )}
                              margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient
                                  id="g-outstanding"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#f97316"
                                    stopOpacity={0.2}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#f97316"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="v"
                                stroke="#f97316"
                                strokeWidth={1.5}
                                fill="url(#g-outstanding)"
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Stat 3: Net Profit */}
                      <div
                        className={`relative group min-h-0 flex flex-col justify-center px-3 py-1 hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                        role="presentation"
                        onClick={() =>
                          openFinanceDetail((d) => financeSnapshotModalPayload(d, "net"))
                        }
                      >
                        <div
                          className={`absolute left-full top-0 z-50 ml-2 w-56 ${patientIntelHoverPanelCls(htmlIsDark)} opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none`}
                        >
                          <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">
                            Net profit (today)
                          </p>
                          <p className="text-[10px] text-kpi-green">
                            Revenue: {safeK(revenue)}
                          </p>
                          <p className="text-[10px] text-kpi-red mt-0.5">
                            Expenses: {safeK(expenses)}
                          </p>
                          <p className="text-[10px] text-tx-secondary mt-0.5">
                            Net: {safeK(revenue - expenses)}
                          </p>
                        </div>
                        <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">
                          Net Profit
                        </p>
                        <p className="text-kpi-green font-black text-xl tabular-nums leading-none mt-0.5">
                          {safeK(revenue - expenses)}
                        </p>
                        <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-kpi-green"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, ((revenue - expenses) / Math.max(1, revenue)) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Stat 4: Today's Expenses */}
                      <div
                        className={`relative group min-h-0 flex flex-col justify-center px-3 py-1 hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                        role="presentation"
                        onClick={() =>
                          openFinanceDetail((d) => financeSnapshotModalPayload(d, "expenses"))
                        }
                      >
                        <div
                          className={`absolute left-full bottom-0 z-50 ml-2 w-56 ${patientIntelHoverPanelCls(htmlIsDark)} opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none`}
                        >
                          <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">
                            Expense Ratio
                          </p>
                          <p className="text-[10px] text-kpi-red">
                            Expenses: {safeK(expenses)}
                          </p>
                          <p className="text-[10px] text-kpi-green mt-0.5">
                            Revenue: {safeK(revenue)}
                          </p>
                          <p className="text-[10px] text-tx-secondary mt-0.5">
                            Net: {safeK(revenue - expenses)}
                          </p>
                        </div>
                        <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">
                          Expenses
                        </p>
                        <p className="text-kpi-red font-black text-xl tabular-nums leading-none mt-0.5">
                          {safeK(expenses)}
                        </p>
                        <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-kpi-red"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  (expenses / Math.max(1, revenue || 1)) * 100
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* ── COLUMN 2: Revenue vs Expenses Chart + Recent Invoices ── */}
              <div className="flex flex-col px-4 py-2 overflow-hidden min-h-0">
                <p className="text-kpi-cyan text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                  📈 Revenue vs Expenses
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-cyan opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kpi-cyan" />
                  </span>
                </p>

                <div className="mt-1.5 h-[100px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={
                        (financeData.ml_revenue_forecast ?? []).length
                          ? (financeData.ml_revenue_forecast ?? []).map((d: any) => ({
                              day: String(d.date ?? "").slice(5),
                              revenue: d.predicted_revenue ?? 0,
                              expenses: (d.predicted_revenue ?? 0) * 0.3,
                            }))
                          : (financeData.revenue_vs_expenses ?? [])
                      }
                      margin={{ top: 2, right: 0, left: -10, bottom: 0 }}
                      barCategoryGap="20%"
                    >
                      <RechartsTooltip
                        cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const rev = Number(payload.find((p) => p.dataKey === "revenue")?.value ?? 0);
                          const exp = Number(payload.find((p) => p.dataKey === "expenses")?.value ?? 0);
                          const fmt = (v: number) => `₨${(v / 1000).toFixed(1)}k`;
                          return (
                            <div
                              className={
                                htmlIsDark
                                  ? "rounded-xl border border-white/10 bg-[#0d1424] px-2.5 py-2 shadow-panel"
                                  : "rounded-xl border border-slate-200 !bg-white px-2.5 py-2 shadow-[0_4px_20px_rgba(15,23,42,0.08)]"
                              }
                            >
                              <p className="text-[10px] text-tx-muted uppercase font-semibold">
                                {label}
                              </p>
                              <p className="mt-1 text-[10px] text-kpi-green font-semibold">
                                Revenue: {fmt(rev)}
                              </p>
                              <p className="text-[10px] text-kpi-red font-semibold mt-0.5">
                                Expenses: {fmt(exp)}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `₨${(Number(v) / 1000).toFixed(0)}k`}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="#22c55e"
                        fillOpacity={0.8}
                        radius={[2, 2, 0, 0]}
                        name="Revenue"
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="expenses"
                        fill="#ef4444"
                        fillOpacity={0.6}
                        radius={[2, 2, 0, 0]}
                        name="Expenses"
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <p className="text-kpi-cyan text-[10px] font-bold uppercase tracking-wider mt-2 shrink-0">
                  ML Revenue Forecast (7 days)
                </p>
                <div className="mt-1 flex flex-col gap-0.5 overflow-y-auto pr-1 flex-1 min-h-0 overscroll-contain [scrollbar-width:thin]">
                  {(financeData.ml_revenue_forecast ?? []).slice(0, 7).map((d: any, i: number) => {
                    const amt = Number(d.predicted_revenue ?? 0);
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 py-0.5 border-b border-dash-border/40 last:border-0"
                      >
                        <span className="text-[10px] text-tx-primary truncate flex-1 min-w-0">
                          {String(d.date ?? "").slice(5)}
                        </span>
                        <span className="text-[10px] text-tx-secondary shrink-0">
                          ₨{(amt / 1000).toFixed(1)}k
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 bg-cyan-500/15 text-kpi-cyan border-cyan-500/20">
                          forecast
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-1 pt-1.5 border-t border-dash-border shrink-0">
                  {(() => {
                    const pts = Array.isArray(financeData?.ml_revenue_forecast)
                      ? (financeData.ml_revenue_forecast as any[])
                      : [];
                    const totalPredRevenue = pts.reduce(
                      (s, p) => s + Number(p?.predicted_revenue ?? 0),
                      0
                    );
                    const totalPredExpenses = totalPredRevenue * 0.3;
                    const totalPredNet = totalPredRevenue - totalPredExpenses;
                    const avgPredRevenue = totalPredRevenue / Math.max(1, pts.length);
                    return (
                      <div 
                        className={`space-y-0.5 ${insightOpenCls}`}
                        role="presentation"
                        title="View forecast detail"
                        onClick={() => openFinanceDetail((d) => financeForecastModalPayload(d))}
                      >
                        <p className="text-kpi-cyan text-[10px] font-bold uppercase tracking-wider">
                          ⚡ Predicted (Next 7 Days Totals)
                        </p>
                        <p className="text-[11px] font-black text-tx-primary tabular-nums">
                          Revenue: ₨{(totalPredRevenue / 1000).toFixed(1)}k
                          <span className="text-tx-muted font-black"> · </span>
                          Expenses: ₨{(totalPredExpenses / 1000).toFixed(1)}k
                          <span className="text-tx-muted font-black"> · </span>
                          Net profit: ₨{(totalPredNet / 1000).toFixed(1)}k
                        </p>
                        <p className="text-[10px] font-bold text-tx-secondary tabular-nums">
                          Avg / day (predicted revenue): ₨{(avgPredRevenue / 1000).toFixed(1)}k
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ── COLUMN 3: Suggestion Panel ── */}
              <div className="flex flex-col px-4 py-2 bg-white/[0.01] overflow-hidden min-h-0">
                <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider shrink-0">
                  💡 Suggestion
                </p>

                {(() => {
                  const revenue = Number(financeData?.todays_revenue ?? 0);
                  const outstanding = Number(financeData?.outstanding_balance ?? 0);
                  const expenses = Number(financeData?.todays_expenses ?? 0);
                  const collectionRate = Math.round(
                    (revenue / Math.max(1, revenue + outstanding)) * 100
                  );

                  const mlRevRisk = String(financeData?.ml_revenue_risk_level ?? "Low");
                  const mlCollRisk = String(financeData?.ml_collection_risk?.risk_label ?? "Low");
                  const riskLevel =
                    mlRevRisk === "High" || mlRevRisk === "Critical" || mlCollRisk === "Critical"
                      ? "Critical"
                      : mlCollRisk === "High" || mlRevRisk === "Moderate" || collectionRate < 70
                      ? "High"
                      : collectionRate < 85
                      ? "Moderate"
                      : "Low";
                  const badgeClass =
                    riskLevel === "Critical"
                      ? "bg-red-500/15 text-kpi-red border-red-500/20"
                      : riskLevel === "High"
                      ? "bg-orange-500/15 text-kpi-orange border-orange-500/20"
                      : riskLevel === "Moderate"
                      ? "bg-yellow-500/15 text-tx-yellow border-yellow-500/20"
                      : "bg-green-500/15 text-kpi-green border-green-500/20";

                  const suggestion =
                    riskLevel === "Critical"
                      ? `ML flags elevated finance risk (Revenue=${mlRevRisk}, Collections=${mlCollRisk}). Escalate collections, review large pending bills, and tighten payment follow-up today.`
                      : riskLevel === "High"
                      ? `ML expects pressure on collections (Collections=${mlCollRisk}). ₨${(outstanding / 1000).toFixed(1)}k outstanding — prioritize follow-ups and reduce pending exposure.`
                      : riskLevel === "Moderate"
                      ? `ML forecast is stable but watch trends (Revenue=${mlRevRisk}). Review pending bills and keep billing cycle moving.`
                      : "Finance is healthy. Revenue exceeds expenses. Continue current billing practices.";

                  const net = revenue - expenses;
                  const netText =
                    net >= 0
                      ? `Net +₨${(net / 1000).toFixed(1)}k`
                      : `Net -₨${(Math.abs(net) / 1000).toFixed(1)}k`;

                  return (
                    <>
                      <div className="flex items-center gap-2 mt-1.5 shrink-0">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${badgeClass}`}>
                          {riskLevel} Risk
                        </span>
                      </div>
                      <div className="mt-2 bg-kpi-orange/8 border border-kpi-orange/20 rounded-xl p-3 flex-1 overflow-hidden min-h-0">
                        <p className="text-kpi-orange font-semibold text-[11px] leading-relaxed">
                          {suggestion}
                        </p>
                      </div>
                    </>
                  );
                })()}

                <p className="text-[9px] text-tx-muted italic mt-2 shrink-0">
                  {/* Footer removed per request */}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Bed & Ward Intelligence card (placeholder) */}
        <div
          className="order-4 bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] overflow-visible dark:bg-panel dark:border-white/[0.06] dark:shadow-panel"
          style={{ height: 344, display: "flex", flexDirection: "column" }}
        >
          <div className="h-[44px] box-border flex items-center justify-between px-5 py-0 border-b border-dash-border shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xl" aria-hidden>
                🛏️
              </span>
              <h2 className="text-tx-bright font-bold text-lg">
                Bed & Ward Intelligence
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {bedsData ? (
                <span className="whitespace-nowrap text-tx-secondary text-xs">
                  {intelFooterUpdated(bedsLastFetch, intelClock)}
                </span>
              ) : null}
              {bedsData ? (
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-blue opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-kpi-blue" />
                </span>
              ) : null}
            </div>
          </div>

          {bedsLoading && !bedsData ? (
            <SkeletonCard />
          ) : null}

          {!bedsData && !bedsLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-xs text-tx-muted">Unable to load bed data.</p>
            </div>
          ) : null}

          {bedsData ? (
            <div className="h-[300px] grid grid-cols-[160px_1fr_180px] divide-x divide-dash-border overflow-visible">
              {/* ── COLUMN 1: 4 KPI Stats ── */}
              <div className="grid grid-rows-4 divide-y divide-dash-border overflow-visible">
                {/* Stat 1: Total Capacity */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                  onClick={() =>
                    openBedsDetail((d) => bedsCapacityModalPayload(d), {
                      title: "Total capacity",
                      subtitle: "Loading ward breakdown…",
                    })
                  }
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">
                    Total Capacity
                  </p>
                  <p className="text-tx-bright font-black text-xl tabular-nums leading-none mt-0.5">
                    {bedsData.total_capacity ?? 0}
                  </p>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-blue transition-all"
                      style={{ width: `${Math.min(100, bedsData.occupancy_percentage ?? 0)}%` }}
                    />
                  </div>
                  <p className="text-[8px] text-tx-secondary mt-0.5">
                    {Number(bedsData.occupancy_percentage ?? 0).toFixed(1)}% occupied
                  </p>
                  <div
                    className={`absolute left-full top-0 z-[9999] ml-1 w-44 ${patientIntelHoverPanelCls(htmlIsDark)} hidden group-hover:block pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">
                      Capacity Detail
                    </p>
                    <p className="text-[10px] text-kpi-blue">
                      Total beds: {bedsData.total_capacity ?? 0}
                    </p>
                    <p className="text-[10px] text-kpi-red mt-0.5">
                      Occupied: {bedsData.occupied_beds ?? 0}
                    </p>
                    <p className="text-[10px] text-kpi-green mt-0.5">
                      Available: {bedsData.available_beds ?? 0}
                    </p>
                  </div>
                </div>

                {/* Stat 2: Occupied Beds */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                  onClick={() =>
                    openBedsDetail((d) => bedsOccupiedModalPayload(d), {
                      title: "Occupied beds",
                      subtitle: "Loading inpatient roster…",
                    })
                  }
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">
                    Occupied
                  </p>
                  <p className="text-kpi-red font-black text-xl tabular-nums leading-none mt-0.5">
                    {bedsData.occupied_beds ?? 0}
                  </p>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-red transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          ((bedsData.occupied_beds ?? 0) /
                            Math.max(1, bedsData.total_capacity ?? 1)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <div
                    className={`absolute left-full top-0 z-[9999] ml-1 w-44 ${patientIntelHoverPanelCls(htmlIsDark)} hidden group-hover:block pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">
                      Ward Breakdown
                    </p>
                    {(bedsData.bed_occupancy_by_department ?? [])
                      .slice(0, 4)
                      .map((dep: any, i: number) => (
                        <p
                          key={i}
                          className="text-[10px] text-tx-secondary mt-0.5 truncate"
                        >
                          {dep.department}: {dep.occupied}/{dep.total}
                        </p>
                      ))}
                  </div>
                </div>

                {/* Stat 3: Free Beds */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                  onClick={() =>
                    openBedsDetail((d) => bedsFreeModalPayload(d), {
                      title: "Free beds",
                      subtitle: "Loading ward availability…",
                    })
                  }
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">
                    Free Beds
                  </p>
                  <p className="text-kpi-green font-black text-xl tabular-nums leading-none mt-0.5">
                    {bedsData.available_beds ?? 0}
                  </p>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-green transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          ((bedsData.available_beds ?? 0) /
                            Math.max(1, bedsData.total_capacity ?? 1)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <div
                    className={`absolute left-full top-0 z-[9999] ml-1 w-44 ${patientIntelHoverPanelCls(htmlIsDark)} hidden group-hover:block pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">
                      Bed Status Breakdown
                    </p>
                    <p className="text-[10px] text-kpi-green">
                      Free capacity: {bedsData.available_beds ?? 0}
                    </p>
                    <p className="text-[10px] text-tx-secondary mt-0.5">
                      Status available: {bedsData.available_beds_status ?? "—"}
                    </p>
                    <p className="text-[10px] text-tx-secondary mt-0.5">
                      Maintenance: {bedsData.maintenance_beds ?? "—"}
                    </p>
                    <p className="text-[10px] text-tx-secondary mt-0.5">
                      ML predicts shortage risk
                    </p>
                    <p className="text-[10px] text-tx-secondary mt-0.5">
                      based on admission trend
                    </p>
                  </div>
                </div>

                {/* Stat 4: Emergency Cases */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors ${insightOpenCls}`}
                  onClick={() =>
                    openBedsDetail((d) => bedsEmergencyModalPayload(d), {
                      title: "Emergency cases",
                      subtitle: "Loading alert summary…",
                    })
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-kpi-red text-[10px]">🚨</span>
                    <p className="text-kpi-red text-[9px] font-semibold uppercase tracking-wider">
                      Emergency
                    </p>
                  </div>
                  <p className="text-tx-bright font-black text-xl tabular-nums leading-none mt-0.5">
                    {bedsData.emergency_cases ?? 0}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-red opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kpi-red" />
                    </span>
                    <p className="text-[8px] text-tx-secondary">
                      {bedsData.critical_condition_cases ?? 0} critical
                    </p>
                  </div>
                  <div
                    className={`absolute left-full bottom-0 z-[9999] ml-1 w-44 ${patientIntelHoverPanelCls(htmlIsDark)} hidden group-hover:block pointer-events-none`}
                  >
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">
                      Emergency Detail
                    </p>
                    <p className="text-[10px] text-kpi-red">
                      Emergency: {bedsData.emergency_cases ?? 0}
                    </p>
                    <p className="text-[10px] text-kpi-orange mt-0.5">
                      Critical: {bedsData.critical_condition_cases ?? 0}
                    </p>
                    <p className="text-[10px] text-tx-secondary mt-0.5">
                      Needs immediate bed planning
                    </p>
                  </div>
                </div>
              </div>

              {/* ── COLUMN 2: Department Occupancy + Trend Chart ── */}
              <div className="flex flex-col px-4 py-3 overflow-hidden relative z-50">
                <p className="text-kpi-blue text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                  🏥 Forecasted Admissions (ML · Next 7 Days)
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-blue opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kpi-blue" />
                  </span>
                </p>

                <div
                  ref={bedForecastChartRef}
                  className="mt-2 h-[100px] shrink-0 relative overflow-visible"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={bedsData.ml_next_7_days_forecast ?? []}
                      margin={{ top: 2, right: 0, left: -28, bottom: 0 }}
                      barCategoryGap="20%"
                    >
                      <RechartsTooltip
                        wrapperStyle={{ zIndex: 2147483647, pointerEvents: "none" }}
                        cursor={{ fill: "rgba(148,163,184,0.12)" }}
                        allowEscapeViewBox={{ x: true, y: true }}
                        content={(props: any) => {
                          const { active, payload, label, coordinate, viewBox } = props ?? {};
                          if (!active || !payload || payload.length === 0) return null;
                          if (typeof document === "undefined") return null;
                          const p: any = payload[0]?.payload ?? {};
                          const dateLabel = String(p.date ?? label ?? "—");
                          const adm = Number(p.predicted_admissions ?? 0);
                          const prob = Number(p.shortage_probability ?? 0);
                          const occ = Number(p.estimated_occupancy_pct ?? 0);
                          const occBeds = Number(p.estimated_occupied_beds ?? 0);
                          const rect = bedForecastChartRef.current?.getBoundingClientRect();
                          const cx = Number((coordinate as any)?.x ?? 0);
                          const cy = Number((coordinate as any)?.y ?? 0);
                          const tooltipW = 192;
                          const tooltipH = 104;
                          const gap = 14;
                          const chartLeft = rect?.left ?? Number((viewBox as any)?.x ?? 0);
                          const chartTop = rect?.top ?? Number((viewBox as any)?.y ?? 0);
                          const rawLeft = chartLeft + cx + gap;
                          const shouldFlipLeft = rawLeft + tooltipW > window.innerWidth - 12;
                          const left = Math.max(
                            12,
                            Math.min(
                              window.innerWidth - tooltipW - 12,
                              shouldFlipLeft ? chartLeft + cx - tooltipW - gap : rawLeft
                            )
                          );
                          const top = Math.max(
                            12,
                            Math.min(
                              window.innerHeight - tooltipH - 12,
                              chartTop + cy - tooltipH / 2
                            )
                          );
                          return createPortal(
                            <div
                              className={
                                htmlIsDark
                                  ? "rounded-xl border border-white/10 bg-[#0d1424] px-3 py-2 shadow-panel transition-all duration-150 ease-out"
                                  : "rounded-xl border border-slate-200 !bg-white px-3 py-2 shadow-[0_4px_20px_rgba(15,23,42,0.1)] transition-all duration-150 ease-out"
                              }
                              style={{
                                position: "fixed",
                                left,
                                top,
                                zIndex: 2147483647,
                                pointerEvents: "none",
                                width: tooltipW,
                              }}
                            >
                              <p className="text-[10px] text-tx-muted uppercase font-semibold">
                                {dateLabel}
                              </p>
                              <p className="text-[11px] text-kpi-blue font-semibold mt-1">
                                Pred. admissions:{" "}
                                <span className="tabular-nums">{adm.toFixed(1)}</span>
                              </p>
                              <p className="text-[10px] text-tx-secondary mt-0.5">
                                Shortage prob:{" "}
                                <span className="tabular-nums">
                                  {Math.round(prob * 100)}%
                                </span>
                              </p>
                              <p className="text-[10px] text-tx-secondary mt-0.5">
                                Est. occupancy:{" "}
                                <span className="tabular-nums">
                                  {occ.toFixed(1)}%
                                </span>{" "}
                                <span className="text-tx-muted">
                                  ({occBeds} beds)
                                </span>
                              </p>
                            </div>,
                            document.body
                          );
                        }}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 8, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        minTickGap={0}
                        tickMargin={8}
                        angle={-35}
                        textAnchor="end"
                        height={28}
                        tickFormatter={(v) => {
                          try {
                            // Show MM-DD, but tooltip keeps full YYYY-MM-DD
                            const s = String(v || "");
                            return s.length >= 10 ? s.slice(5) : (s || "—");
                          } catch {
                            return v as any;
                          }
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Bar
                        dataKey="predicted_admissions"
                        fill="#3b82f6"
                        fillOpacity={0.8}
                        radius={[2, 2, 0, 0]}
                        name="Forecasted admissions (ML)"
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider mt-2 shrink-0">
                  Ward Occupancy
                </p>
                <div className="mt-1 flex flex-col gap-1 overflow-hidden flex-1">
                  {(bedsData.bed_occupancy_by_department ?? [])
                    .slice(0, 4)
                    .map((dep: any, i: number) => {
                      const pct = Math.min(
                        100,
                        Math.round(
                          ((dep.occupied ?? 0) / Math.max(1, dep.total ?? 1)) * 100
                        )
                      );
                      const barColor =
                        pct >= 90
                          ? "#ef4444"
                          : pct >= 75
                          ? "#f97316"
                          : pct >= 50
                          ? "#3b82f6"
                          : "#22c55e";
                      return (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                          <span className="text-[10px] text-tx-secondary truncate w-20 shrink-0">
                            {dep.department}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-dash-border overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: barColor }}
                            />
                          </div>
                          <span className="text-[9px] text-tx-muted tabular-nums shrink-0 w-8 text-right">
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                </div>

                <div
                  className={`mt-auto pt-2 border-t border-dash-border shrink-0 ${insightOpenCls}`}
                  role="presentation"
                  title="Admission forecast detail"
                  onClick={() =>
                    bedsData &&
                    openBedsDetail((d) => bedsAdmissionsForecastModalPayload(d), {
                      title: "Forecasted admissions (ML)",
                      subtitle: "Loading 7-day forecast…",
                    })
                  }
                >
                  {(() => {
                    const ml = bedsData.ml_shortage_risk ?? {};
                    const totalAdmissions =
                      typeof ml.predicted_admissions_7d_total === "number"
                        ? ml.predicted_admissions_7d_total
                        : (bedsData.ml_next_7_days_forecast ?? []).reduce(
                            (sum: number, item: any) =>
                              sum + Number(item.predicted_admissions ?? 0),
                            0
                          );
                    return (
                      <p className="text-[11px] font-semibold text-kpi-blue">
                        ⚡ Next 7 days:{" "}
                        <span className="tabular-nums">
                          {Math.round(totalAdmissions)}
                        </span>{" "}
                        predicted admissions
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* ── COLUMN 3: Suggestion Panel ── */}
              <div className="flex flex-col px-4 py-3 bg-white/[0.01] overflow-hidden">
                <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider shrink-0">
                  💡 Suggestion
                </p>

                {(() => {
                  const pct = bedsData.occupancy_percentage ?? 0;
                  const available = bedsData.available_beds ?? 0;

                  const ml = bedsData.ml_shortage_risk ?? {};
                  const riskLevel = (ml.risk_label as any) ?? (pct >= 95 ? "Critical" : pct >= 85 ? "High" : pct >= 70 ? "Moderate" : "Low");
                  const riskPct = typeof ml.risk_pct === "number" ? ml.risk_pct : null;

                  const badgeClass =
                    riskLevel === "Critical"
                      ? "bg-red-500/15 text-kpi-red border-red-500/20"
                      : riskLevel === "High"
                      ? "bg-orange-500/15 text-kpi-orange border-orange-500/20"
                      : riskLevel === "Moderate"
                      ? "bg-yellow-500/15 text-tx-yellow border-yellow-500/20"
                      : "bg-green-500/15 text-kpi-green border-green-500/20";

                  const formattedPct = typeof pct === "number" ? pct.toFixed(1).replace(/\.0$/, '') : pct;

                  const suggestion =
                    riskLevel === "Critical"
                      ? `Only ${available} beds left. Initiate emergency discharge planning and contact overflow facilities immediately.`
                      : riskLevel === "High"
                      ? `${formattedPct}% capacity reached. Accelerate pending discharges and prepare contingency ward expansion.`
                      : riskLevel === "Moderate"
                      ? `Occupancy at ${formattedPct}%. Monitor admissions trend and plan for weekend surge if needed.`
                      : `Bed capacity is healthy at ${formattedPct}%. Continue standard admission protocols.`;

                  return (
                    <>
                      <div className="flex items-center gap-2 mt-1.5 shrink-0">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${badgeClass}`}
                        >
                          {riskLevel} Risk
                        </span>
                        <span className="text-[10px] text-tx-secondary">
                          {riskPct !== null ? `${riskPct}% ML` : `${formattedPct}% full`}
                        </span>
                      </div>
                      <div className="mt-2 bg-kpi-blue/8 border border-kpi-blue/20 rounded-xl p-3 flex-1 overflow-hidden">
                        <p className="text-kpi-blue font-semibold text-[11px] leading-relaxed">
                          {suggestion}
                        </p>
                      </div>
                    </>
                  );
                })()}

                <p className="text-[9px] text-tx-muted italic mt-2 shrink-0">
                  {/* Footer removed per request */}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Staff & Attendance Intelligence Row */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        {/* ── Staff & Attendance Intelligence Card ── */}
        <div
          className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] overflow-visible dark:bg-panel dark:border-white/[0.06] dark:shadow-panel"
          style={{ height: 344, display: "flex", flexDirection: "column" }}
        >
          {/* Header */}
          <div className="h-[44px] box-border flex items-center justify-between px-5 py-0 border-b border-dash-border shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xl" aria-hidden>👨‍⚕️</span>
              <h2 className="text-tx-bright font-bold text-lg">Staff & Attendance Intelligence</h2>
    </div>
            <div className="flex items-center gap-2">
              {staffData ? (
                <span className="whitespace-nowrap text-tx-secondary text-xs">
                  {intelFooterUpdated(staffLastFetch, intelClock)}
                </span>
              ) : null}
              {staffData ? (
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-green opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-kpi-green" />
                </span>
              ) : null}
            </div>
          </div>

          {/* Loading */}
          {staffLoading && !staffData ? (
            <SkeletonCard />
          ) : null}

          {/* Error */}
          {!staffData && !staffLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-xs text-tx-muted">Unable to load staff data.</p>
            </div>
          ) : null}

          {/* Body — 3 columns same as all other cards */}
          {staffData ? (
            <div className="h-[300px] grid grid-cols-[160px_1fr_180px] divide-x divide-dash-border overflow-visible">

              {/* ── COLUMN 1: 4 KPI Stats with TOOLTIPS ── */}
              <div className="grid grid-rows-4 divide-y divide-dash-border overflow-visible">

                {/* Stat 1: Staff On Duty */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-2 transition-colors hover:bg-white/[0.02] ${insightOpenCls}`}
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    openStaffDetail((d) =>
                      liveStaffStatusModalPayload(
                        "Staff on duty · detail",
                        "Present today · names + roles",
                        (d.live_staff_status ?? []).filter((s: any) => s.status === "On Duty"),
                      ),
                    );
                  }}
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">Staff On Duty</p>
                  <p className="text-kpi-green font-black text-xl tabular-nums leading-none mt-0.5">
                    {staffData.staff_on_duty ?? 0}
                  </p>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-green transition-all"
                      style={{ width: `${Math.min(100, ((staffData.staff_on_duty ?? 0) / Math.max(1, (staffData.staff_on_duty ?? 0) + (staffData.absent_today ?? 0) + (staffData.on_leave ?? 0))) * 100)}%` }}
                    />
                  </div>
                  <div className={`${staffIntelTooltipPanelCls(htmlIsDark)} top-0`}>
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Attendance Detail</p>
                    <p className="text-[10px] text-kpi-green">On duty: {staffData.staff_on_duty ?? 0}</p>
                    <p className="text-[10px] text-kpi-red mt-0.5">Absent: {staffData.absent_today ?? 0}</p>
                    <p className="text-[10px] text-tx-yellow mt-0.5">On leave: {staffData.on_leave ?? 0}</p>
                    <p className="text-[10px] text-tx-secondary mt-0.5">
                      Off duty: {staffStatusSlice(staffLiveRows(staffData), "Off Duty", 999).length}
                    </p>
                    {staffDeptBreakdown(staffLiveRows(staffData), "On Duty").map((d, i) => (
                      <p key={i} className="text-[10px] text-tx-secondary mt-0.5 truncate">
                        {d.dept}: {d.count}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Stat 2: Active Shifts */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-2 transition-colors hover:bg-white/[0.02] ${insightOpenCls}`}
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    openStaffDetail((d) =>
                      liveStaffStatusModalPayload(
                        "Active shifts · roster",
                        `${d.active_shifts ?? 0} records vs ${d.staff_on_duty ?? 0} on duty`,
                        d.live_staff_status ?? [],
                      ),
                    );
                  }}
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">Active Shifts</p>
                  <p className="text-kpi-cyan font-black text-xl tabular-nums leading-none mt-0.5">
                    {staffData.active_shifts ?? 0}
                  </p>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-cyan transition-all"
                      style={{ width: `${Math.min(100, ((staffData.active_shifts ?? 0) / Math.max(1, staffData.staff_on_duty ?? 1)) * 100)}%` }}
                    />
                  </div>
                  <div className={`${staffIntelTooltipPanelCls(htmlIsDark)} top-0`}>
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Attendance Records</p>
                    <p className="text-[10px] text-kpi-cyan">Logged today: {staffData.active_shifts ?? 0}</p>
                    <p className="text-[10px] text-kpi-green mt-0.5">Present: {staffData.staff_on_duty ?? 0}</p>
                    <p className="text-[10px] text-kpi-red mt-0.5">Absent: {staffData.absent_today ?? 0}</p>
                    <p className="text-[10px] text-tx-yellow mt-0.5">On leave: {staffData.on_leave ?? 0}</p>
                    {staffStatusSlice(staffLiveRows(staffData), "On Duty", 4).map((s, i) => (
                      <p key={i} className="text-[10px] text-tx-secondary mt-0.5 truncate">
                        ✓ {s.name} · {s.role}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Stat 3: Absent Today */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-2 transition-colors hover:bg-white/[0.02] ${insightOpenCls}`}
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    openStaffDetail((d) =>
                      liveStaffStatusModalPayload(
                        "Absent today · detail",
                        "Counted from today's attendance marks",
                        (d.live_staff_status ?? []).filter((s: any) => s.status === "Absent"),
                      ),
                    );
                  }}
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">Absent Today</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-kpi-red font-black text-xl tabular-nums leading-none">
                      {staffData.absent_today ?? 0}
                    </p>
                    {(staffData.absent_today ?? 0) > 3 ? (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-red opacity-70" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kpi-red" />
                      </span>
                    ) : null}
                  </div>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-red transition-all"
                      style={{ width: `${Math.min(100, ((staffData.absent_today ?? 0) / Math.max(1, (staffData.staff_on_duty ?? 0) + (staffData.absent_today ?? 0))) * 100)}%` }}
                    />
                  </div>
                  <div className={`${staffIntelTooltipPanelCls(htmlIsDark)} top-0`}>
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Absent Detail</p>
                    <p className="text-[10px] text-kpi-red">Absent today: {staffData.absent_today ?? 0}</p>
                    <p className="text-[10px] text-kpi-green mt-0.5">On duty: {staffData.staff_on_duty ?? 0}</p>
                    {staffStatusSlice(staffLiveRows(staffData), "Absent", 4).map((s, i) => (
                      <p key={i} className="text-[10px] text-tx-secondary mt-0.5 truncate">
                        ✗ {s.name} · {s.department}
                      </p>
                    ))}
                    {staffStatusSlice(staffLiveRows(staffData), "Absent").length === 0 && (
                      <p className="text-[10px] text-tx-secondary mt-0.5">No absences recorded</p>
                    )}
                  </div>
                </div>

                {/* Stat 4: On Leave */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-2 transition-colors hover:bg-white/[0.02] ${insightOpenCls}`}
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    openStaffDetail((d) =>
                      liveStaffStatusModalPayload(
                        "On leave today · detail",
                        "Today's leave marks",
                        (d.live_staff_status ?? []).filter((s: any) => s.status === "On Leave"),
                      ),
                    );
                  }}
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">On Leave</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-tx-yellow font-black text-xl tabular-nums leading-none">
                      {staffData.on_leave ?? 0}
                    </p>
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                  </div>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-500 transition-all"
                      style={{ width: `${Math.min(100, ((staffData.on_leave ?? 0) / Math.max(1, (staffData.staff_on_duty ?? 0) + (staffData.on_leave ?? 0))) * 100)}%` }}
                    />
                  </div>
                  <div className={`${staffIntelTooltipPanelCls(htmlIsDark)} bottom-0`}>
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Leave Detail</p>
                    <p className="text-[10px] text-tx-yellow">On leave: {staffData.on_leave ?? 0}</p>
                    <p className="text-[10px] text-kpi-green mt-0.5">On duty: {staffData.staff_on_duty ?? 0}</p>
                    {staffStatusSlice(staffLiveRows(staffData), "On Leave", 4).map((s, i) => (
                      <p key={i} className="text-[10px] text-tx-secondary mt-0.5 truncate">
                        • {s.name} · {s.department}
                      </p>
                    ))}
                    {staffStatusSlice(staffLiveRows(staffData), "On Leave").length === 0 && (
                      <p className="text-[10px] text-tx-secondary mt-0.5">No staff on leave</p>
                    )}
                  </div>
                </div>

              </div>

              {/* ── COLUMN 2: ML Absenteeism Forecast + Attendance Trend ── */}
              <div className="flex min-h-0 flex-col px-4 py-3 overflow-hidden">
                <div
                  className={`flex items-center gap-1.5 shrink-0 mb-0.5 ${insightOpenCls}`}
                  role="presentation"
                  title="Open full breakdown"
                  onClick={() =>
                    staffData &&
                    openStaffDetail((d) => staffForecastFullModalPayload(d))
                  }
                >
                  <p className="text-kpi-green text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    🤖 Absenteeism Forecast (ML · Next 7 Days)
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-green opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kpi-green" />
                    </span>
                  </p>
                  <span className="relative group/staffmlinfo inline-flex items-center justify-center cursor-help">
                    <svg
                      className="w-3 h-3 text-tx-muted transition-colors group-hover/staffmlinfo:text-kpi-green"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span
                      role="tooltip"
                      className={
                        htmlIsDark
                          ? "pointer-events-none absolute top-full left-0 z-[9999] mt-1.5 w-[210px] rounded-md border border-white/10 bg-gray-900 px-2 py-1.5 text-[10px] leading-snug text-white shadow-[0_8px_32px_rgba(0,0,0,0.7)] opacity-0 transition-opacity duration-150 delay-150 group-hover/staffmlinfo:opacity-100"
                          : "pointer-events-none absolute top-full left-0 z-[9999] mt-1.5 w-[210px] rounded-md border border-slate-200 !bg-white px-2 py-1.5 text-[10px] leading-snug text-slate-700 shadow-[0_4px_20px_rgba(15,23,42,0.1)] opacity-0 transition-opacity duration-150 delay-150 group-hover/staffmlinfo:opacity-100"
                      }
                    >
                      Seven-day attendance trend (present, absent, on leave). Hover bars for counts per day.
                    </span>
                  </span>
                </div>

                {/* Attendance trend 7-day bar chart */}
                <div className="mt-2 h-[100px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={staffData.attendance_trend ?? []}
                      margin={{ top: 2, right: 0, left: -28, bottom: 0 }}
                      barCategoryGap="20%"
                    >
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 8, fill: "#64748b" }} 
                        axisLine={false} 
                        tickLine={false} 
                        interval={0}
                        minTickGap={0}
                        tickMargin={8}
                        angle={-35}
                        textAnchor="end"
                        height={28}
                        tickFormatter={(v) => {
                          try {
                            const s = String(v || "");
                            return s.length >= 10 ? s.slice(5) : (s || "—");
                          } catch {
                            return v as any;
                          }
                        }}
                      />
                      <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <RechartsTooltip
                        cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const panel = htmlIsDark
                            ? "rounded-lg border border-white/10 bg-[#0d1424] px-2.5 py-2 shadow-panel"
                            : "rounded-lg border border-slate-200 !bg-white px-2.5 py-2 shadow-[0_4px_20px_rgba(15,23,42,0.08)]";
                          const titleCls = htmlIsDark
                            ? "text-[10px] font-semibold uppercase text-tx-muted"
                            : "text-[10px] font-semibold uppercase text-slate-500";
                          const rowCls = htmlIsDark
                            ? "text-[10px] text-tx-secondary"
                            : "text-[10px] text-slate-700";
                          return (
                            <div className={panel}>
                              <p className={titleCls}>{String(label ?? "—")}</p>
                              <div className="mt-1 space-y-0.5">
                                {payload.map((entry: any) => (
                                  <p key={String(entry.dataKey)} className={rowCls}>
                                    <span style={{ color: entry.color }}>{entry.name}: </span>
                                    <span className="font-semibold tabular-nums">{entry.value}</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="present" fill="#22c55e" fillOpacity={0.8} radius={[2, 2, 0, 0]} name="Present" />
                      <Bar dataKey="absent" fill="#ef4444" fillOpacity={0.7} radius={[2, 2, 0, 0]} name="Absent" />
                      <Bar dataKey="leave" fill="#eab308" fillOpacity={0.6} radius={[2, 2, 0, 0]} name="Leave" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Live staff status list */}
                <div className="mt-2 flex items-center gap-1.5 shrink-0">
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">
                    Live Staff Status
                  </p>
                  <span className="relative group/staffliveinfo inline-flex items-center justify-center cursor-help">
                    <svg
                      className="w-3 h-3 text-tx-muted transition-colors group-hover/staffliveinfo:text-kpi-green"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span
                      role="tooltip"
                      className={
                        htmlIsDark
                          ? "pointer-events-none absolute top-full left-0 z-[9999] mt-1 w-[200px] rounded-md border border-white/10 bg-gray-900 px-2 py-1.5 text-[10px] leading-snug text-white shadow-[0_8px_32px_rgba(0,0,0,0.7)] opacity-0 transition-opacity duration-150 delay-150 group-hover/staffliveinfo:opacity-100"
                          : "pointer-events-none absolute top-full left-0 z-[9999] mt-1 w-[200px] rounded-md border border-slate-200 !bg-white px-2 py-1.5 text-[10px] leading-snug text-slate-700 shadow-[0_4px_20px_rgba(15,23,42,0.1)] opacity-0 transition-opacity duration-150 delay-150 group-hover/staffliveinfo:opacity-100"
                      }
                    >
                      Snapshot of roster status (present, absent, leave) for quick scanning.
                    </span>
                  </span>
                </div>
                <div
                  className={`mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] ${insightOpenCls}`}
                  role="presentation"
                  title="Tap to expand full roster"
                  onClick={(e) => {
                    e.stopPropagation();
                    openStaffDetail((d) =>
                      liveStaffStatusModalPayload(
                        "Live staff status · full roster",
                        "Today's attendance snapshot",
                        d.live_staff_status ?? [],
                      ),
                    );
                  }}
                >
                  {(staffData.live_staff_status ?? []).map((s: any, i: number) => (
                    <div key={`${s.name ?? "staff"}-${i}`} className="flex items-center justify-between py-0.5 border-b border-dash-border/40 last:border-0 shrink-0">
                      <span className="text-[10px] text-tx-primary truncate flex-1 min-w-0">{s.name}</span>
                      <span className="text-[9px] text-tx-secondary mx-2 shrink-0 truncate max-w-[60px]">{s.department}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                        s.status === "On Duty"
                          ? 'bg-green-500/15 text-kpi-green border-green-500/20'
                          : s.status === "Absent"
                          ? 'bg-red-500/15 text-kpi-red border-red-500/20'
                          : s.status === "On Leave"
                          ? 'bg-yellow-500/15 text-tx-yellow border-yellow-500/20'
                          : 'bg-white/10 text-tx-muted border-dash-border'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 7-day forecast totals (sum of bar chart values) — click for names */}
                <div
                  className={`mt-auto pt-2 border-t border-dash-border shrink-0 ${insightOpenCls}`}
                  role="presentation"
                  title="Tap for absent / leave names · all 7 days"
                  onClick={(e) => {
                    e.stopPropagation();
                    openStaffDetail((d) => staffForecastFullModalPayload(d));
                  }}
                >
                  {(() => {
                    const trend = staffData.attendance_trend ?? [];
                    let sumPresent = 0;
                    let sumAbsent = 0;
                    let sumLeave = 0;
                    for (const row of trend) {
                      const r = row as { present?: number; absent?: number; leave?: number };
                      sumPresent += Number(r.present ?? 0);
                      sumAbsent += Number(r.absent ?? 0);
                      sumLeave += Number(r.leave ?? 0);
                    }
                    if (trend.length === 0) {
                      return (
                        <p className="text-[11px] font-semibold text-tx-muted">
                          No 7-day forecast data yet.
                        </p>
                      );
                    }
                    return (
                      <p className="text-[11px] font-semibold leading-snug text-tx-primary">
                        <span className="text-kpi-green">Next 7 days forecast</span>
                        {": "}
                        <span className="text-kpi-green tabular-nums">{sumPresent}</span>
                        {" present · "}
                        <span className="text-kpi-red tabular-nums">{sumAbsent}</span>
                        {" absent · "}
                        <span className="text-tx-yellow tabular-nums">{sumLeave}</span>
                        {" on leave"}
                      </p>
                    );
                  })()}
                <p className="text-[9px] text-tx-muted mt-0.5 italic">
                  {/* ML model info removed per request */}
                </p>
                </div>
              </div>

              {/* ── COLUMN 3: Suggestion Panel ── */}
              <div className="flex flex-col px-4 py-3 bg-white/[0.01] overflow-hidden">
                <div className="flex items-center gap-1.5 shrink-0">
                  <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider">
                    💡 Suggestion
                  </p>
                  <span className="relative group/staffsuginfo inline-flex items-center justify-center cursor-help">
                    <svg
                      className="w-3 h-3 text-tx-muted transition-colors group-hover/staffsuginfo:text-tx-secondary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span
                      role="tooltip"
                      className={
                        htmlIsDark
                          ? "pointer-events-none absolute top-full left-0 z-[9999] mt-1 w-[220px] rounded-md border border-white/10 bg-gray-900 px-2 py-1.5 text-[10px] leading-snug text-white shadow-[0_8px_32px_rgba(0,0,0,0.7)] opacity-0 transition-opacity duration-150 delay-150 group-hover/staffsuginfo:opacity-100"
                          : "pointer-events-none absolute top-full left-0 z-[9999] mt-1 w-[220px] rounded-md border border-slate-200 !bg-white px-2 py-1.5 text-[10px] leading-snug text-slate-700 shadow-[0_4px_20px_rgba(15,23,42,0.1)] opacity-0 transition-opacity duration-150 delay-150 group-hover/staffsuginfo:opacity-100"
                      }
                    >
                      Guidance from today&apos;s absence rate vs on-duty and on-leave counts. Risk bands: Low &lt;8%, Moderate 8–14%, High 15–24%, Critical ≥25%.
                    </span>
                  </span>
                </div>

                {(() => {
                  const absent = staffData.absent_today ?? 0;
                  const onLeave = staffData.on_leave ?? 0;
                  const onDuty = staffData.staff_on_duty ?? 0;
                  const total = onDuty + absent + onLeave;
                  const absentRate = Math.round((absent / Math.max(1, total)) * 100);

                  const riskLevel =
                    absentRate >= 25 ? "Critical" :
                    absentRate >= 15 ? "High" :
                    absentRate >= 8 ? "Moderate" : "Low";

                  const badgeClass =
                    riskLevel === "Critical" ? "bg-red-500/15 text-kpi-red border-red-500/20" :
                    riskLevel === "High" ? "bg-orange-500/15 text-kpi-orange border-orange-500/20" :
                    riskLevel === "Moderate" ? "bg-yellow-500/15 text-tx-yellow border-yellow-500/20" :
                    "bg-green-500/15 text-kpi-green border-green-500/20";

                  const suggestion =
                    riskLevel === "Critical"
                      ? `${absentRate}% staff absent. Activate on-call staff immediately and redistribute workload across available departments.`
                      : riskLevel === "High"
                      ? `Absenteeism at ${absentRate}%. Contact on-call staff and review shift coverage for all critical wards.`
                      : riskLevel === "Moderate"
                      ? `${absent} staff absent today. Monitor ward coverage and prepare backup roster if needed.`
                      : `Staffing levels are healthy. All shifts covered. Continue standard scheduling.`;

                  return (
                    <>
                      <div className="flex items-center gap-2 mt-1.5 shrink-0">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${badgeClass}`}>
                          {riskLevel} Risk
                        </span>
                        <span className="text-[10px] text-tx-secondary">{absentRate}% absent</span>
                      </div>
                      <div className="mt-2 bg-kpi-green/8 border border-kpi-green/20 rounded-xl p-3 flex-1 overflow-hidden">
                        <p className="text-kpi-green font-semibold text-[11px] leading-relaxed">
                          {suggestion}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

            </div>
          ) : null}
        </div>

        {/* ── Lab & Appointments Intelligence Card ── */}
        <div
          className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] overflow-visible dark:bg-panel dark:border-white/[0.06] dark:shadow-panel"
          style={{ height: 344, display: "flex", flexDirection: "column" }}
        >
          {/* Header */}
          <div className="h-[44px] box-border flex items-center justify-between px-5 py-0 border-b border-dash-border shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xl" aria-hidden>🔬</span>
              <h2 className="text-tx-bright font-bold text-lg">Lab & Appointments Intelligence</h2>
            </div>
            <div className="flex items-center gap-2">
              {labData ? (
                <span className="whitespace-nowrap text-tx-secondary text-xs">
                  {intelFooterUpdated(labLastFetch, intelClock)}
                </span>
              ) : null}
              {labData ? (
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-purple opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-kpi-purple" />
                </span>
              ) : null}
            </div>
          </div>

          {/* Loading */}
          {labLoading && !labData ? (
            <SkeletonCard />
          ) : null}

          {/* Error */}
          {!labData && !labLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-xs text-tx-muted">Unable to load lab data.</p>
            </div>
          ) : null}

          {/* Body — 3 columns same as all other cards */}
          {labData ? (
            <div className="h-[300px] grid grid-cols-[160px_1fr_180px] divide-x divide-dash-border overflow-visible">

              {/* ── COLUMN 1: 4 KPI Stats with TOOLTIPS ── */}
              <div className="grid grid-rows-4 divide-y divide-dash-border overflow-visible">

                {/* Stat 1: Pending Tests */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-2 transition-colors hover:bg-white/[0.02] ${insightOpenCls}`}
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    openLabDetail((d) => labCategoryBreakdownModal(d, "pending"), {
                      title: "Pending tests",
                      subtitle: "Loading category breakdown…",
                    });
                  }}
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">Pending Tests</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-kpi-orange font-black text-xl tabular-nums leading-none">
                      {labData.pending_tests ?? 0}
                    </p>
                    {(labData.pending_tests ?? 0) > 10 ? (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-orange opacity-70" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kpi-orange" />
                      </span>
                    ) : null}
                  </div>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-orange transition-all"
                      style={{ width: `${Math.min(100, ((labData.pending_tests ?? 0) / Math.max(1, (labData.pending_tests ?? 0) + (labData.completed_today ?? 0))) * 100)}%` }}
                    />
                  </div>
                  <div className={`${labIntelTooltipPanelCls(htmlIsDark)} top-0`}>
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Pending by Category</p>
                    {(labData.daily_test_volume_by_category ?? []).filter((c: any) => (c.pending ?? 0) > 0).slice(0, 4).map((cat: any, i: number) => (
                      <p key={i} className="text-[10px] text-kpi-orange mt-0.5 truncate">
                        • {cat.category}: {cat.pending} pending
                      </p>
                    ))}
                    {(labData.daily_test_volume_by_category ?? []).filter((c: any) => (c.pending ?? 0) > 0).length === 0 && (
                      <p className="text-[10px] text-tx-secondary">No pending tests</p>
                    )}
                  </div>
                </div>

                {/* Stat 2: Completed Today */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-2 transition-colors hover:bg-white/[0.02] ${insightOpenCls}`}
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    openLabDetail((d) => labCategoryBreakdownModal(d, "completed"), {
                      title: "Completed today",
                      subtitle: "Loading category breakdown…",
                    });
                  }}
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">Completed Today</p>
                  <p className="text-kpi-green font-black text-xl tabular-nums leading-none mt-0.5">
                    {labData.completed_today ?? 0}
                  </p>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-green transition-all"
                      style={{ width: `${Math.min(100, ((labData.completed_today ?? 0) / Math.max(1, (labData.pending_tests ?? 0) + (labData.completed_today ?? 0))) * 100)}%` }}
                    />
                  </div>
                  <div className={`${labIntelTooltipPanelCls(htmlIsDark)} top-0`}>
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Completed by Category</p>
                    <p className="text-[10px] text-kpi-green">Completed today: {labData.completed_today ?? 0}</p>
                    <p className="text-[10px] text-kpi-orange mt-0.5">
                      Still pending: {labData.pending_tests ?? 0}
                    </p>
                    {(labData.daily_test_volume_by_category ?? [])
                      .filter((c) => (c.completed ?? 0) > 0)
                      .slice(0, 4)
                      .map((cat, i) => (
                        <p key={i} className="text-[10px] text-tx-secondary mt-0.5 truncate">
                          ✓ {cat.category}: {cat.completed} done
                        </p>
                      ))}
                    {(labData.daily_test_volume_by_category ?? []).filter((c) => (c.completed ?? 0) > 0)
                      .length === 0 && (
                      <p className="text-[10px] text-tx-secondary mt-0.5">No completions yet</p>
                    )}
                  </div>
                </div>

                {/* Stat 3: Critical Results */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-2 transition-colors hover:bg-white/[0.02] ${insightOpenCls}`}
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    openLabDetail((d) => labCriticalModalPayload(d), {
                      title: "Critical results",
                      subtitle: "Loading abnormal risk detail…",
                    });
                  }}
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">Critical Results</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-kpi-red font-black text-xl tabular-nums leading-none">
                      {labData.critical_results ?? 0}
                    </p>
                    {(labData.critical_results ?? 0) > 0 ? (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-red opacity-70" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kpi-red" />
                      </span>
                    ) : null}
                  </div>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-red transition-all"
                      style={{ width: `${Math.min(100, ((labData.critical_results ?? 0) / Math.max(1, labData.completed_today ?? 1)) * 100)}%` }}
                    />
                  </div>
                  <div className={`${labIntelTooltipPanelCls(htmlIsDark)} top-0`}>
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Critical Detail</p>
                    <p className="text-[10px] text-kpi-red">{labData.critical_results ?? 0} critical today</p>
                    <p className="text-[10px] text-tx-secondary mt-0.5">Requires immediate physician review</p>
                    {(labData.ml_abnormal_at_risk ?? []).slice(0, 3).map((r, i) => (
                      <p key={i} className="text-[10px] text-kpi-orange mt-0.5 truncate">
                        ⚠ {r.patient_name}: {Math.round((r.abnormal_probability ?? 0) * 100)}%
                      </p>
                    ))}
                    {(labData.ml_abnormal_at_risk ?? []).length === 0 && (
                      <p className="text-[10px] text-tx-secondary mt-0.5">No ML-flagged pending tests</p>
                    )}
                  </div>
                </div>

                {/* Stat 4: Active Technicians */}
                <div
                  className={`relative group flex flex-col justify-center px-3 py-2 transition-colors hover:bg-white/[0.02] ${insightOpenCls}`}
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    openLabDetail((d) => labTechniciansModalPayload(d), {
                      title: "Active technicians",
                      subtitle: "Loading capacity breakdown…",
                    });
                  }}
                >
                  <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider">Active Techs</p>
                  <p className="text-kpi-cyan font-black text-xl tabular-nums leading-none mt-0.5">
                    {labData.active_technicians ?? 0}
                  </p>
                  <div className="w-full h-1 rounded-full bg-dash-border mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kpi-cyan transition-all"
                      style={{ width: `${Math.min(100, (labData.active_technicians ?? 0) * 20)}%` }}
                    />
                  </div>
                  <div className={labIntelTooltipPanelCls(htmlIsDark, "bottom")}>
                    <p className="text-[10px] text-tx-muted uppercase font-semibold mb-1">Lab Capacity</p>
                    <p className="text-[10px] text-kpi-cyan">{labData.active_technicians ?? 0} technicians active</p>
                    <p className="text-[10px] text-tx-secondary mt-0.5">
                      Avg load: {Math.round((labData.pending_tests ?? 0) / Math.max(1, labData.active_technicians ?? 1))} tests/tech
                    </p>
                    <p className="text-[10px] text-tx-secondary mt-0.5">
                      {(labData.pending_tests ?? 0) > (labData.active_technicians ?? 1) * 5
                        ? "⚠️ High workload per technician"
                        : "✓ Workload manageable"}
                    </p>
                  </div>
                </div>

              </div>

              {/* ── COLUMN 2: Weekly Trends Chart + Category Breakdown ── */}
              <div className="flex flex-col px-4 py-3 overflow-hidden">
                <p className="text-kpi-purple text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                  🤖 ML Lab Backlog Risk (Next 7 Days)
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-purple opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kpi-purple" />
                  </span>
                </p>

                <div className="mt-2 h-[100px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={
                        (labData.ml_next_7_days_forecast ?? []).length > 0
                          ? (labData.ml_next_7_days_forecast ?? []).map((f) => ({
                              ...f,
                              risk_pct: Math.round((f.risk_probability ?? 0) * 100),
                              day: f.date?.length >= 10 ? f.date.slice(5) : f.date,
                            }))
                          : (labData.weekly_result_trends ?? [])
                      }
                      margin={{ top: 2, right: 0, left: -28, bottom: 0 }}
                      barCategoryGap="20%"
                    >
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      {(labData.ml_next_7_days_forecast ?? []).length > 0 ? (
                        <Bar
                          dataKey="risk_pct"
                          fill="#a855f7"
                          fillOpacity={0.85}
                          radius={[2, 2, 0, 0]}
                          name="Backlog risk %"
                          isAnimationActive={false}
                        />
                      ) : (
                        <>
                          <Bar dataKey="normal" fill="#22c55e" fillOpacity={0.8} radius={[2, 2, 0, 0]} name="Normal" />
                          <Bar dataKey="abnormal" fill="#ef4444" fillOpacity={0.7} radius={[2, 2, 0, 0]} name="Abnormal" />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Category breakdown list */}
                <p className="text-tx-muted text-[9px] font-semibold uppercase tracking-wider mt-2 shrink-0">
                  Test Category Load
                </p>
                <div className="mt-1 flex flex-col gap-0.5 overflow-hidden flex-1">
                  {(labData.daily_test_volume_by_category ?? []).slice(0, 4).map((cat: any, i: number) => {
                    const total = (cat.completed ?? 0) + (cat.pending ?? 0);
                    const pct = Math.min(100, Math.round(((cat.pending ?? 0) / Math.max(1, total)) * 100));
                    const barColor = pct >= 70 ? "#ef4444" : pct >= 40 ? "#f97316" : "#22c55e";
                    return (
                      <div key={i} className="flex items-center gap-2 py-0.5 border-b border-dash-border/40 last:border-0">
                        <span className="text-[10px] text-tx-secondary truncate w-20 shrink-0">{cat.category}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-dash-border overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                        <span className="text-[9px] text-tx-muted tabular-nums shrink-0 w-12 text-right">
                          {cat.pending}/{total}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* ML prediction summary */}
                <div
                  className={`mt-auto pt-2 border-t border-dash-border shrink-0 ${insightOpenCls}`}
                  role="presentation"
                  title="Backlog forecast detail"
                  onClick={() =>
                    labData &&
                    openLabDetail((d) => labBacklogForecastModalPayload(d), {
                      title: "Lab backlog forecast",
                      subtitle: "Loading 7-day forecast…",
                    })
                  }
                >
                  {(() => {
                    const forecast = labData.ml_next_7_days_forecast ?? [];
                    const highRiskDays = forecast.filter((f) => f.backlog_risk).length;
                    const avgPct =
                      forecast.length > 0
                        ? Math.round(
                            (forecast.reduce((s, f) => s + (f.risk_probability ?? 0), 0) /
                              forecast.length) *
                              100,
                          )
                        : typeof labData.ml_backlog_risk?.risk_pct === "number"
                          ? labData.ml_backlog_risk.risk_pct
                          : 0;
                    return (
                      <p className="text-[11px] font-semibold text-kpi-purple">
                        ⚡ Next 7 days:{" "}
                        <span className="tabular-nums">{highRiskDays}</span>{" "}
                        {highRiskDays === 1 ? "day" : "days"} at backlog risk
                        <span className="text-tx-muted font-normal">
                          {" "}
                          · {avgPct}% avg backlog probability
                        </span>
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* ── COLUMN 3: Suggestion Panel ── */}
              <div className="flex flex-col px-4 py-3 bg-white/[0.01] overflow-hidden">
                <p className="text-tx-muted text-[10px] font-semibold uppercase tracking-wider shrink-0">
                  💡 Suggestion
                </p>

                {(() => {
                  const pending = labData.pending_tests ?? 0;
                  const critical = labData.critical_results ?? 0;
                  const techs = Math.max(1, labData.active_technicians ?? 1);
                  const load = Math.round(pending / techs);
                  const mlRisk = labData.ml_backlog_risk?.risk_label ?? "Low";
                  const atRisk = labData.ml_abnormal_at_risk ?? [];

                  const riskLevel =
                    mlRisk === "Critical" || critical > 5 || load >= 10
                      ? "Critical"
                      : mlRisk === "High" || critical > 2 || load >= 5
                      ? "High"
                      : mlRisk === "Moderate" || pending > 10
                      ? "Moderate"
                      : "Low";

                  const badgeClass =
                    riskLevel === "Critical" ? "bg-red-500/15 text-kpi-red border-red-500/20" :
                    riskLevel === "High" ? "bg-orange-500/15 text-kpi-orange border-orange-500/20" :
                    riskLevel === "Moderate" ? "bg-yellow-500/15 text-tx-yellow border-yellow-500/20" :
                    "bg-green-500/15 text-kpi-green border-green-500/20";

                  const topAbnormal = atRisk.slice(0, 2).map((r) => r.patient_name).join(", ");
                  const suggestion =
                    riskLevel === "Critical"
                      ? `${critical} critical results need immediate review. ML flags ${mlRisk} backlog risk — expedite ${pending} pending tests.`
                      : riskLevel === "High"
                      ? `Lab backlog growing (${mlRisk} ML risk). ${pending} tests pending — add technician capacity or prioritize urgent cases.${
                          topAbnormal ? ` Watch: ${topAbnormal}.` : ""
                        }`
                      : riskLevel === "Moderate"
                      ? `${pending} tests still pending. ML backlog risk is ${mlRisk.toLowerCase()} — monitor turnaround time.`
                      : `Lab operations are running smoothly. ${labData.completed_today ?? 0} tests completed today (ML risk: ${mlRisk}).`;

                  return (
                    <>
                      <div className="flex items-center gap-2 mt-1.5 shrink-0">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${badgeClass}`}>
                          {riskLevel} Risk
                        </span>
                        <span className="text-[10px] text-tx-secondary">{pending} pending</span>
                      </div>
                      <div className="mt-2 bg-kpi-purple/8 border border-kpi-purple/20 rounded-xl p-3 flex-1 overflow-hidden">
                        <p className="text-kpi-purple font-semibold text-[11px] leading-relaxed">
                          {suggestion}
                        </p>
                      </div>
                    </>
                  );
                })()}

              </div>

            </div>
          ) : null}
        </div>
      </div>

    </div>
  );
}
