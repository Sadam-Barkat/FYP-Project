"use client";

import { useState, useEffect, useCallback, useRef, useId } from "react";
import {
  TestTube2,
  ClipboardList,
  User,
  Clock,
  CheckCircle,
  ChevronDown,
  X,
  CalendarDays,
  Beaker,
  ListFilter,
  Activity,
  FileText,
  RotateCcw,
  FlaskConical,
} from "lucide-react";
import { CompactMetricCard, TooltipRow } from "@/components/dashboard/MetricHoverCard";
import { getApiBaseUrl } from "@/lib/apiBase";
import { formatLocalDateISO } from "@/lib/calendarDate";

const API_BASE = getApiBaseUrl();

type LabStatus = "pending" | "completed";

interface PatientOption {
  id: number;
  name: string;
  age: number;
}

interface CategoryOption {
  id: number;
  name: string;
}

interface LabEntry {
  id: number;
  patient_id: number;
  patient_name: string;
  test_category: string;
  test_name: string;
  status: LabStatus;
  result_summary: string;
  collected_at: string;
}

function LabSection({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="group/section rounded-2xl border border-base-border bg-base-card/85 p-5 shadow-[0_2px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-[box-shadow,border-color] duration-300 hover:border-emerald-500/20 hover:shadow-[0_8px_40px_rgba(16,185,129,0.08)] sm:p-6 dark:border-white/[0.08] dark:bg-gradient-to-b dark:from-emerald-950/25 dark:to-transparent dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_32px_rgba(0,0,0,0.35)] dark:hover:border-emerald-400/20 dark:hover:shadow-[0_12px_48px_rgba(16,185,129,0.12)]">
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 ring-2 ring-white/25 ring-offset-2 ring-offset-base-card dark:ring-emerald-400/20 dark:ring-offset-[#0c1424]"
          aria-hidden
        >
          {step}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight text-text-bright sm:text-lg">{title}</h3>
          {subtitle ? (
            <p className="mt-1.5 text-xs leading-relaxed text-text-secondary sm:text-sm">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
      {children}
      {required ? <span className="ml-0.5 text-emerald-600 dark:text-cyan-400">*</span> : null}
    </label>
  );
}

function InputShell({
  icon: Icon,
  children,
  withChevron,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  children: React.ReactNode;
  withChevron?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-emerald-600/75 dark:text-cyan-400/85">
        <Icon size={18} className="shrink-0" strokeWidth={2} />
      </span>
      {withChevron ? (
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
      ) : null}
      <div
        className={
          withChevron
            ? "[&_input]:pl-11 [&_select]:pl-11 [&_select]:pr-10 [&_textarea]:pl-11 [&_textarea]:pt-3.5 [&_input]:pr-4"
            : "[&_input]:pl-11 [&_select]:pl-11 [&_textarea]:pl-11 [&_textarea]:pt-3.5 [&_input]:pr-4 [&_select]:pr-4"
        }
      >
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-base-border bg-base-card py-3 text-sm text-text-primary placeholder:text-text-muted shadow-inner transition focus:border-emerald-500/90 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:bg-dash-elevated dark:text-tx-bright dark:placeholder:text-tx-muted dark:focus:border-cyan-500/75 dark:focus:ring-cyan-500/20";

/** Empty query: show all (handled by caller). Non-empty: only patients whose full name starts with the typed text (case-insensitive). */
function patientNameStartsWithQuery(p: PatientOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return p.name.toLowerCase().trim().startsWith(q);
}

export default function LaboratoryEntryPage() {
  const formId = useId();
  const today = formatLocalDateISO(new Date());

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [entries, setEntries] = useState<LabEntry[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPatient = patients.find((p) => String(p.id) === selectedPatientId);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const patientDropdownRef = useRef<HTMLDivElement>(null);
  const patientInputRef = useRef<HTMLInputElement>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [highlightedPatientIndex, setHighlightedPatientIndex] = useState(0);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target as Node)) {
        setPatientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const qTrim = patientQuery.trim();
  const filteredPatients = !qTrim ? patients : patients.filter((p) => patientNameStartsWithQuery(p, patientQuery));

  useEffect(() => {
    if (!patientDropdownOpen) return;
    setHighlightedPatientIndex(0);
  }, [patientQuery, patientDropdownOpen]);

  const selectPatient = (p: PatientOption | null) => {
    if (!p) {
      setSelectedPatientId("");
      setPatientQuery("");
      setPatientDropdownOpen(false);
      return;
    }
    setSelectedPatientId(String(p.id));
    setPatientQuery(p.name);
    setPatientDropdownOpen(false);
  };

  const patientInputValue =
    patientDropdownOpen ? patientQuery : selectedPatient ? selectedPatient.name : patientQuery;

  const [testCategoryId, setTestCategoryId] = useState<number>(0);
  const [testName, setTestName] = useState<string>("");
  const [status, setStatus] = useState<LabStatus>("pending");
  const [resultSummary, setResultSummary] = useState<string>("");

  const resetTestFields = () => {
    setTestName("");
    setResultSummary("");
    setStatus("pending");
    setError(null);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPatients(true);
      try {
        const res = await fetch(`${API_BASE}/api/laboratorian/patients`);
        if (!res.ok) throw new Error("Failed to load patients");
        const data = await res.json();
        if (!cancelled) setPatients(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("Failed to load patients. Is the backend running?");
      } finally {
        if (!cancelled) setLoadingPatients(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCategories(true);
      try {
        const res = await fetch(`${API_BASE}/api/laboratorian/categories`);
        if (!res.ok) throw new Error("Failed to load categories");
        const data = await res.json();
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setCategories(list);
          if (list.length > 0) setTestCategoryId((prev) => (list.some((c) => c.id === prev) ? prev : list[0].id));
        }
      } catch {
        if (!cancelled) setError("Failed to load categories.");
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedPatientId) {
      setEntries([]);
      return;
    }
    setLoadingResults(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/laboratorian/patients/${selectedPatientId}/results?date=${selectedDate}`,
      );
      if (!res.ok) throw new Error("Failed to load results");
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoadingResults(false);
    }
  }, [selectedPatientId, selectedDate]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedPatient) {
      setError("Please select a patient first.");
      return;
    }
    if (!testName.trim()) {
      setError("Please enter a test name.");
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const collectedAt = new Date(`${selectedDate}T${now.toTimeString().slice(0, 8)}`).toISOString();

      const res = await fetch(`${API_BASE}/api/laboratorian/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          lab_category_id: testCategoryId,
          test_name: testName.trim(),
          status,
          result_summary: resultSummary.trim() || "Pending interpretation",
          collected_at: collectedAt,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Failed to save lab test");
      }

      resetTestFields();
      await fetchResults();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lab test.");
    } finally {
      setSubmitting(false);
    }
  };

  const entriesForSelectedDate = entries;
  const pendingCount = entriesForSelectedDate.filter((e) => e.status === "pending").length;
  const completedCount = entriesForSelectedDate.filter((e) => e.status === "completed").length;

  return (
    <div id="dashboard-content" className="relative min-h-0 overflow-x-hidden pb-10">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 dark:opacity-100 bg-[radial-gradient(ellipse_85%_55%_at_50%_-25%,rgba(16,185,129,0.14),transparent_55%),radial-gradient(ellipse_60%_45%_at_100%_0%,rgba(6,182,212,0.11),transparent_48%)]" />

      <div className="dashboard-page-shell max-w-6xl">
        {/* Header — enhanced framing */}
        <header className="relative mb-7 sm:mb-9">
          <div className="rounded-2xl border border-base-border/80 bg-base-card/50 p-4 shadow-sm backdrop-blur-md dark:border-white/[0.07] dark:bg-white/[0.03] sm:p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="relative z-10 min-w-0 max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/45 bg-emerald-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-950 shadow-sm dark:border-emerald-500/50 dark:bg-emerald-950 dark:text-emerald-300 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Beaker size={12} className="text-emerald-800 dark:text-emerald-400" />
                  Laboratory
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg shadow-emerald-900/35 ring-1 ring-white/20">
                    <TestTube2 className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                    Laboratory data entry
                  </h1>
                </div>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Select a patient and the working date, then record tests for that day. All fields with{" "}
                  <span className="font-semibold text-emerald-600 dark:text-cyan-400">*</span> are required.
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-1.5 rounded-2xl border border-base-border bg-base-card px-4 py-3 shadow-inner dark:border-white/[0.08] dark:bg-dash-elevated/80 sm:flex-row sm:items-center sm:gap-3">
                <label
                  htmlFor="lab-entry-date"
                  className="text-xs font-bold uppercase tracking-wider text-text-secondary"
                >
                  Working date
                </label>
                <div className="relative min-w-[10.5rem]">
                  <CalendarDays
                    className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-emerald-600/80 dark:text-cyan-400"
                    aria-hidden
                  />
                  <input
                    id="lab-entry-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className={`${inputClass} py-2.5 pl-9 pr-3 text-sm`}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-6 sm:space-y-7">
          <LabSection
            step={1}
            title="Select patient"
            subtitle="Open the list to see everyone, or type letters so only names that start with that text stay in the list. Results use the working date in the header."
          >
            <div ref={patientDropdownRef} className="relative w-full max-w-xl">
              <FieldLabel required>Patient</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-emerald-600/80 dark:text-cyan-400">
                  <User size={18} strokeWidth={2} />
                </span>
                <input
                  ref={patientInputRef}
                  type="text"
                  value={patientInputValue}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    if (!patientDropdownOpen) setPatientDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (!loadingPatients) setPatientDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (!patientDropdownOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                      setPatientDropdownOpen(true);
                      return;
                    }
                    if (!patientDropdownOpen) return;
                    if (e.key === "Escape") {
                      setPatientDropdownOpen(false);
                      return;
                    }
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedPatientIndex((i) =>
                        Math.min(i + 1, Math.max(filteredPatients.length - 1, 0)),
                      );
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedPatientIndex((i) => Math.max(i - 1, 0));
                      return;
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const p = filteredPatients[highlightedPatientIndex];
                      if (p) selectPatient(p);
                    }
                  }}
                  disabled={loadingPatients}
                  placeholder={loadingPatients ? "Loading patients…" : "Scroll the list or type the start of a name…"}
                  className={`${inputClass} pl-12 pr-20`}
                  aria-expanded={patientDropdownOpen}
                  aria-autocomplete="list"
                  role="combobox"
                />
                {patientInputValue && !loadingPatients && (
                  <button
                    type="button"
                    onClick={() => selectPatient(null)}
                    className="absolute right-10 top-1/2 z-10 -translate-y-1/2 rounded-lg p-1.5 text-text-muted transition hover:bg-base-hover hover:text-text-bright"
                    title="Clear selection"
                    aria-label="Clear selection"
                  >
                    <X size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => !loadingPatients && setPatientDropdownOpen((o) => !o)}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg p-1.5 text-text-secondary transition hover:bg-base-hover"
                  aria-label={patientDropdownOpen ? "Close list" : "Open list"}
                  disabled={loadingPatients}
                >
                  <ChevronDown
                    size={18}
                    className={patientDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"}
                  />
                </button>
              </div>

              {patientDropdownOpen && !loadingPatients && (
                <ul
                  className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-base-border bg-base-card py-1 shadow-[0_16px_48px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04] dark:shadow-[0_16px_56px_rgba(0,0,0,0.55)] dark:ring-white/10"
                  role="listbox"
                >
                  {filteredPatients.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-text-muted">
                      {patients.length === 0
                        ? "No patients loaded."
                        : "No patient names start with that — clear the box to see everyone again."}
                    </li>
                  ) : (
                    filteredPatients.map((p, idx) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setHighlightedPatientIndex(idx)}
                          onClick={() => selectPatient(p)}
                          className={`w-full px-4 py-3 text-left text-sm transition ${
                            idx === highlightedPatientIndex ? "bg-emerald-500/12 dark:bg-cyan-500/12" : ""
                          } ${
                            selectedPatientId === String(p.id)
                              ? "font-semibold text-text-bright"
                              : "text-text-secondary hover:bg-base-hover"
                          }`}
                          role="option"
                          aria-selected={selectedPatientId === String(p.id)}
                        >
                          <span className="block truncate">
                            #{p.id} — {p.name}{" "}
                            <span className="font-normal text-text-muted">(age {p.age})</span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
              {loadingPatients && <p className="mt-2 text-sm text-text-muted">Loading patients…</p>}
            </div>
          </LabSection>

          {!selectedPatient && (
            <div className="rounded-2xl border border-dashed border-emerald-300/50 bg-emerald-50/40 px-6 py-12 text-center dark:border-emerald-500/25 dark:bg-emerald-950/20">
              <FlaskConical className="mx-auto mb-3 h-11 w-11 text-emerald-600/70 dark:text-emerald-400/80" strokeWidth={1.25} />
              <p className="text-sm font-semibold text-text-bright">Choose a patient to continue</p>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-text-secondary sm:text-sm">
                Daily metrics, the test form, and the results table will appear in the steps below once you select a
                patient.
              </p>
            </div>
          )}

          {selectedPatient && (
            <div className="space-y-6 sm:space-y-7">
              <LabSection
                step={2}
                title={`Today for ${selectedPatient.name}`}
                subtitle={`Figures are for ${selectedDate} only — change the working date in the header to view another day.`}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
                  <CompactMetricCard
                    borderLeftClass="border-l-4 border-l-status-warning"
                    left={
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Pending</p>
                        <p className="mt-1 text-3xl font-bold tabular-nums text-text-bright">{pendingCount}</p>
                      </div>
                    }
                    rightIcon={<Clock className="text-text-secondary" size={26} />}
                    tooltipTitle="Pending tests"
                    tooltipContent={
                      <>
                        <TooltipRow label="Patient" value={selectedPatient.name} />
                        <TooltipRow label="Date" value={selectedDate} />
                      </>
                    }
                  />
                  <CompactMetricCard
                    borderLeftClass="border-l-4 border-l-status-success"
                    left={
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Completed</p>
                        <p className="mt-1 text-3xl font-bold tabular-nums text-text-bright">{completedCount}</p>
                      </div>
                    }
                    rightIcon={<CheckCircle className="text-text-secondary" size={26} />}
                    tooltipTitle="Completed tests"
                    tooltipContent={
                      <>
                        <TooltipRow label="Patient" value={selectedPatient.name} />
                        <TooltipRow label="Date" value={selectedDate} />
                      </>
                    }
                  />
                  <CompactMetricCard
                    borderLeftClass="border-l-4 border-l-emerald-500"
                    left={
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Total tests</p>
                        <p className="mt-1 text-3xl font-bold tabular-nums text-text-bright">
                          {entriesForSelectedDate.length}
                        </p>
                      </div>
                    }
                    rightIcon={<TestTube2 className="text-text-secondary" size={26} />}
                    tooltipTitle="All tests this day"
                    tooltipContent={
                      <>
                        <TooltipRow label="Patient" value={selectedPatient.name} />
                        <TooltipRow label="Date" value={selectedDate} />
                      </>
                    }
                  />
                </div>
              </LabSection>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">
                <LabSection
                  step={3}
                  title="Record a new test"
                  subtitle="Each save adds one row for this patient on the working date. Use status to track workflow."
                >
                  {error && (
                    <div
                      className="mb-4 rounded-xl border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm font-medium text-status-danger"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}

                  <form id={formId} onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel required>Test category</FieldLabel>
                        <InputShell icon={ListFilter} withChevron>
                          <select
                            value={categories.length === 0 ? "" : testCategoryId}
                            onChange={(e) => setTestCategoryId(Number(e.target.value))}
                            disabled={loadingCategories || categories.length === 0}
                            className={`${inputClass} appearance-none disabled:opacity-50`}
                          >
                            <option value="">{loadingCategories ? "Loading…" : "No categories"}</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </InputShell>
                      </div>
                      <div>
                        <FieldLabel required>Test name</FieldLabel>
                        <InputShell icon={Activity}>
                          <input
                            type="text"
                            value={testName}
                            onChange={(e) => setTestName(e.target.value)}
                            className={inputClass}
                            placeholder="e.g. CBC, LFT, RFT"
                          />
                        </InputShell>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel required>Status</FieldLabel>
                        <InputShell icon={ClipboardList} withChevron>
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as LabStatus)}
                            className={`${inputClass} appearance-none`}
                          >
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                          </select>
                        </InputShell>
                      </div>
                      <div>
                        <FieldLabel>Result summary</FieldLabel>
                        <InputShell icon={FileText}>
                          <input
                            type="text"
                            value={resultSummary}
                            onChange={(e) => setResultSummary(e.target.value)}
                            className={inputClass}
                            placeholder="e.g. Normal, Elevated, Critical"
                          />
                        </InputShell>
                        <p className="mt-1.5 text-[11px] leading-snug text-text-muted">
                          Defaults to &quot;Pending interpretation&quot; if left empty.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-base-border pt-5 sm:flex-row sm:justify-end sm:gap-3 dark:border-white/[0.06]">
                      <button
                        type="button"
                        onClick={resetTestFields}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-base-border bg-transparent px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:border-emerald-500/35 hover:bg-base-hover hover:text-text-bright"
                      >
                        <RotateCcw size={17} />
                        Clear form
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || categories.length === 0}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_28px_rgba(16,185,129,0.28)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <TestTube2 size={18} strokeWidth={2.25} />
                        {submitting ? "Saving…" : "Save test"}
                      </button>
                    </div>
                  </form>
                </LabSection>

                <LabSection
                  step={4}
                  title="Tests for this day"
                  subtitle={`All rows for ${selectedPatient.name} on ${selectedDate}.`}
                >
                  {loadingResults ? (
                    <div className="flex min-h-[220px] items-center justify-center text-sm text-text-muted">
                      Loading…
                    </div>
                  ) : entriesForSelectedDate.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-base-border bg-base-muted/25 px-4 py-12 text-center text-sm text-text-muted dark:bg-white/[0.02]">
                      No tests recorded for this date yet. Add one using the form.
                    </div>
                  ) : (
                    <div className="max-h-[min(58vh,520px)] overflow-auto rounded-xl border border-base-border shadow-inner">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-base-muted/95 backdrop-blur-sm dark:bg-[#0f1729]/95">
                          <tr className="border-b border-base-border dark:border-white/[0.06]">
                            <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-text-muted">
                              Test
                            </th>
                            <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-text-muted">
                              Status
                            </th>
                            <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-text-muted">
                              Summary
                            </th>
                            <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-text-muted">
                              Time
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {entriesForSelectedDate.map((entry) => {
                            const timeLabel = new Date(entry.collected_at).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            const statusColor =
                              entry.status === "completed"
                                ? "bg-status-success/15 text-status-success ring-1 ring-status-success/30"
                                : "bg-status-warning/15 text-status-warning ring-1 ring-status-warning/30";

                            return (
                              <tr
                                key={entry.id}
                                className="border-b border-base-border transition-colors last:border-0 hover:bg-emerald-500/[0.06] dark:border-white/[0.05] dark:hover:bg-cyan-500/[0.06]"
                              >
                                <td className="px-4 py-3.5 text-text-bright">
                                  <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                    {entry.test_category}
                                  </span>
                                  <span className="font-medium">{entry.test_name}</span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusColor}`}
                                  >
                                    {entry.status === "completed" ? "Completed" : "Pending"}
                                  </span>
                                </td>
                                <td
                                  className="max-w-[220px] truncate px-4 py-3.5 text-text-secondary"
                                  title={entry.result_summary}
                                >
                                  {entry.result_summary}
                                </td>
                                <td className="px-4 py-3.5 text-right tabular-nums text-text-secondary">{timeLabel}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </LabSection>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
