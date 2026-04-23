"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TestTube2, ClipboardList, User, Clock, CheckCircle, ChevronDown, X } from "lucide-react";
import { CompactMetricCard, TooltipRow } from "@/components/dashboard/MetricHoverCard";
import { getApiBaseUrl } from "@/lib/apiBase";

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

export default function LaboratoryEntryPage() {
  const today = new Date().toISOString().slice(0, 10);

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
    if (!patientDropdownOpen) return;
    // Start from current query; ensure highlight resets so keyboard works.
    setHighlightedPatientIndex(0);
  }, [patientDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target as Node)) {
        setPatientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPatients = patients.filter((p) => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return true;
    const idStr = String(p.id);
    return (
      idStr.includes(q) ||
      p.name.toLowerCase().includes(q) ||
      String(p.age).includes(q)
    );
  });

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPatients(true);
      try {
        const res = await fetch(`${API_BASE}/api/laboratorian/patients`);
        if (!res.ok) throw new Error("Failed to load patients");
        const data = await res.json();
        if (!cancelled) setPatients(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError("Failed to load patients. Is the backend running?");
      } finally {
        if (!cancelled) setLoadingPatients(false);
      }
    })();
    return () => { cancelled = true; };
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
      } catch (e) {
        if (!cancelled) setError("Failed to load categories.");
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedPatientId) {
      setEntries([]);
      return;
    }
    setLoadingResults(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/laboratorian/patients/${selectedPatientId}/results?date=${selectedDate}`
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
      const collectedAt = new Date(
        `${selectedDate}T${now.toTimeString().slice(0, 8)}`
      ).toISOString();

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

      setTestName("");
      setResultSummary("");
      await fetchResults();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lab test.");
    } finally {
      setSubmitting(false);
    }
  };

  const entriesForSelectedDate = entries;

  const pendingCount = entriesForSelectedDate.filter(
    (e) => e.status === "pending"
  ).length;
  const completedCount = entriesForSelectedDate.filter(
    (e) => e.status === "completed"
  ).length;

  return (
    <div
      id="dashboard-content"
      className="bg-base-surface min-h-screen px-8 py-8 space-y-8"
    >
      <div className="-mx-8 -mt-8 bg-base-card border-b border-base-border px-8 py-4 flex flex-col md:flex-row items-center md:items-end justify-between gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-text-primary font-semibold text-xl tracking-tight">
            Laboratory Data Entry
          </h2>
          <p className="text-text-primary text-sm leading-relaxed mt-1">
            Select a patient first, then add daily lab tests for that patient.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="lab-entry-date" className="text-text-secondary text-sm font-medium">
            Working date
          </label>
          <input
            id="lab-entry-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200"
          />
        </div>
      </div>

      {/* Step 1: Select patient */}
      <div className="bg-base-card/70 border border-base-border rounded-2xl shadow-card backdrop-blur-md p-6 hover:bg-base-hover hover:-translate-y-1 transition-all duration-200">
        <h3 className="text-text-primary font-semibold text-base mb-5 flex items-center gap-2">
          <User className="text-text-secondary" size={20} />
          Step 1 — Select patient
        </h3>
        <div ref={patientDropdownRef} className="relative w-full max-w-md">
          <label className="text-text-secondary text-sm font-medium mb-1.5 block">
            Patient
          </label>
          <div className="relative">
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
                if (!selectedPatient) setPatientQuery((q) => q); // keep any typed text
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
                  setHighlightedPatientIndex((i) => Math.min(i + 1, Math.max(filteredPatients.length - 1, 0)));
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
              placeholder={loadingPatients ? "Loading patients…" : "Search patient by name or ID..."}
              className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-2.5 w-full pr-20 focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200 disabled:opacity-70"
              aria-expanded={patientDropdownOpen}
              aria-autocomplete="list"
              role="combobox"
            />
            {patientInputValue && !loadingPatients && (
              <button
                type="button"
                onClick={() => selectPatient(null)}
                className="absolute right-10 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-base-hover transition-colors duration-150"
                title="Clear selection"
                aria-label="Clear selection"
              >
                <X size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => !loadingPatients && setPatientDropdownOpen((o) => !o)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-secondary hover:bg-base-hover transition-colors duration-150"
              aria-label={patientDropdownOpen ? "Close list" : "Open list"}
              disabled={loadingPatients}
            >
              <ChevronDown size={18} className={patientDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          </div>

          {patientDropdownOpen && !loadingPatients && (
            <ul
              className="absolute left-0 right-0 top-full mt-2 z-20 bg-base-card border border-base-border rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] max-h-64 overflow-y-auto"
              role="listbox"
            >
              {filteredPatients.length === 0 ? (
                <li className="py-3 px-4 text-text-muted text-sm">
                  No patients match your search.
                </li>
              ) : (
                filteredPatients.map((p, idx) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlightedPatientIndex(idx)}
                      onClick={() => selectPatient(p)}
                      className={`w-full py-3 px-4 text-left text-sm hover:bg-base-hover transition-colors duration-150 ${
                        idx === highlightedPatientIndex ? "bg-brand-blue/10" : ""
                      } ${selectedPatientId === String(p.id) ? "text-text-primary font-medium" : "text-text-secondary"}`}
                      role="option"
                      aria-selected={selectedPatientId === String(p.id)}
                    >
                      <span className="block truncate">
                        #{p.id} — {p.name} (Age {p.age})
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
          {loadingPatients && (
            <p className="text-text-muted text-sm mt-2">Loading patients…</p>
          )}
        </div>
      </div>

      {/* Step 2: Add daily tests (only when patient selected) */}
      {selectedPatient && (
        <>
          {/* Summary cards for selected patient's daily tests */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CompactMetricCard
              borderLeftClass="border-l-4 border-l-status-warning"
              left={
                <div>
                  <p className="text-text-secondary text-xs font-medium uppercase tracking-widest">
                    Pending Tests
                  </p>
                  <p className="text-text-primary text-3xl font-bold tabular-nums mt-1">{pendingCount}</p>
                </div>
              }
              rightIcon={<Clock className="text-text-secondary" size={26} />}
              tooltipTitle="Pending tests"
              tooltipContent={
                <>
                  <TooltipRow label="Patient" value={selectedPatient.name} />
                  <TooltipRow label="Selected date" value={selectedDate} />
                </>
              }
            />
            <CompactMetricCard
              borderLeftClass="border-l-4 border-l-status-success"
              left={
                <div>
                  <p className="text-text-secondary text-xs font-medium uppercase tracking-widest">
                    Completed Tests
                  </p>
                  <p className="text-text-primary text-3xl font-bold tabular-nums mt-1">{completedCount}</p>
                </div>
              }
              rightIcon={<CheckCircle className="text-text-secondary" size={26} />}
              tooltipTitle="Completed tests"
              tooltipContent={
                <>
                  <TooltipRow label="Patient" value={selectedPatient.name} />
                  <TooltipRow label="Selected date" value={selectedDate} />
                </>
              }
            />
            <CompactMetricCard
              borderLeftClass="border-l-4 border-l-brand-blue"
              left={
                <div>
                  <p className="text-text-secondary text-xs font-medium uppercase tracking-widest">
                    Total (this patient, day)
                  </p>
                  <p className="text-text-primary text-3xl font-bold tabular-nums mt-1">
                    {entriesForSelectedDate.length}
                  </p>
                </div>
              }
              rightIcon={<TestTube2 className="text-text-secondary" size={26} />}
              tooltipTitle="Daily total"
              tooltipContent={
                <>
                  <TooltipRow label="Patient" value={selectedPatient.name} />
                  <TooltipRow label="Selected date" value={selectedDate} />
                </>
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-base-card border border-base-border rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.4)] space-y-5">
              <h3 className="text-text-primary font-semibold text-base mb-1 flex items-center gap-2">
                <ClipboardList className="text-text-secondary" size={20} />
                Step 2 — Add daily test for {selectedPatient.name}
              </h3>

              {error && (
                <p className="bg-status-danger/10 border border-status-danger/30 text-status-danger rounded-xl px-5 py-4 text-sm font-medium">
                  {error}
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-text-secondary text-sm font-medium mb-1.5 block">
                      Test Category
                    </label>
                    <select
                      value={categories.length === 0 ? "" : testCategoryId}
                      onChange={(e) => setTestCategoryId(Number(e.target.value))}
                      disabled={loadingCategories || categories.length === 0}
                      className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200 disabled:opacity-70 appearance-none"
                    >
                      <option value="">{loadingCategories ? "Loading…" : "No categories"}</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-text-secondary text-sm font-medium mb-1.5 block">
                      Test Name
                    </label>
                    <input
                      type="text"
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                      className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200"
                      placeholder="e.g. CBC, LFT, RFT"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-text-secondary text-sm font-medium mb-1.5 block">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as LabStatus)
                      }
                      className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200 appearance-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-text-secondary text-sm font-medium mb-1.5 block">
                      Result Summary
                    </label>
                    <input
                      type="text"
                      value={resultSummary}
                      onChange={(e) => setResultSummary(e.target.value)}
                      className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200"
                      placeholder="e.g. Normal, Mildly elevated, Critical"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || categories.length === 0}
                  className="bg-btn-primary text-text-bright font-semibold rounded-xl px-5 py-2.5 shadow-btn hover:shadow-glow-blue hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center"
                >
                  {submitting ? "Saving..." : "Add daily test"}
                </button>
              </form>
            </div>

            <div className="bg-base-card border border-base-border rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden">
              <h3 className="text-text-primary font-semibold text-base mb-5">
                Daily tests — {selectedPatient.name} ({selectedDate})
              </h3>
              {loadingResults ? (
                <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
                  Loading…
                </div>
              ) : entriesForSelectedDate.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
                  No tests recorded for this patient on this date yet.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="bg-base-card border border-base-border rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-base-muted">
                      <tr>
                        <th className="text-text-muted text-xs uppercase tracking-wider font-medium py-3 px-4">Test</th>
                        <th className="text-text-muted text-xs uppercase tracking-wider font-medium py-3 px-4">Status</th>
                        <th className="text-text-muted text-xs uppercase tracking-wider font-medium py-3 px-4">Summary</th>
                        <th className="text-text-muted text-xs uppercase tracking-wider font-medium py-3 px-4 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entriesForSelectedDate.map((entry) => {
                        const timeLabel = new Date(
                          entry.collected_at
                        ).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        const statusColor =
                          entry.status === "completed"
                            ? "bg-status-success/10 text-status-success text-xs font-medium px-2.5 py-1 rounded-full"
                            : "bg-status-warning/10 text-status-warning text-xs font-medium px-2.5 py-1 rounded-full";

                        return (
                          <tr
                            key={entry.id}
                            className="border-b border-base-border last:border-0 hover:bg-base-hover transition-colors duration-150"
                          >
                            <td className="text-text-primary text-sm py-3 px-4">
                              <span className="text-text-muted text-xs block">
                                {entry.test_category}
                              </span>
                              {entry.test_name}
                            </td>
                            <td className="text-text-primary text-sm py-3 px-4">
                              <span className={statusColor}>
                                {entry.status === "completed"
                                  ? "Completed"
                                  : "Pending"}
                              </span>
                            </td>
                            <td className="text-text-primary text-sm py-3 px-4">
                              {entry.result_summary}
                            </td>
                            <td className="text-text-primary text-sm py-3 px-4 text-right tabular-nums">
                              {timeLabel}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!selectedPatient && (
        <p className="text-text-muted text-sm text-center py-4">
          Select a patient above to add daily lab tests.
        </p>
      )}
    </div>
  );
}
