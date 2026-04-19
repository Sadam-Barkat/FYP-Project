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
      className="dashboard-page-shell max-w-6xl py-4 sm:py-6"
    >
      <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4 mb-4">
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-semibold text-[#0066cc]">
            Laboratory Data Entry
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Select a patient first, then add daily lab tests for that patient.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="lab-entry-date" className="text-sm text-gray-600">
            Working date
          </label>
          <input
            id="lab-entry-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-[#3b82f6]"
          />
        </div>
      </div>

      {/* Step 1: Select patient */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <User className="text-[#0066cc]" size={20} />
          Step 1 — Select patient
        </h3>
        <div ref={patientDropdownRef} className="relative w-full max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full border border-gray-300 rounded-md pl-3 pr-20 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-[#3b82f6] disabled:opacity-70"
              aria-expanded={patientDropdownOpen}
              aria-autocomplete="list"
              role="combobox"
            />
            {patientInputValue && !loadingPatients && (
              <button
                type="button"
                onClick={() => selectPatient(null)}
                className="absolute right-10 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                title="Clear selection"
                aria-label="Clear selection"
              >
                <X size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => !loadingPatients && setPatientDropdownOpen((o) => !o)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:bg-gray-50"
              aria-label={patientDropdownOpen ? "Close list" : "Open list"}
              disabled={loadingPatients}
            >
              <ChevronDown size={18} className={patientDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          </div>

          {patientDropdownOpen && !loadingPatients && (
            <ul
              className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto"
              role="listbox"
            >
              {filteredPatients.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500">
                  No patients match your search.
                </li>
              ) : (
                filteredPatients.map((p, idx) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlightedPatientIndex(idx)}
                      onClick={() => selectPatient(p)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                        idx === highlightedPatientIndex ? "bg-blue-50" : ""
                      } ${selectedPatientId === String(p.id) ? "text-[#0066cc] font-medium" : "text-gray-800"}`}
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
            <p className="text-sm text-gray-500 mt-1">Loading patients…</p>
          )}
        </div>
      </div>

      {/* Step 2: Add daily tests (only when patient selected) */}
      {selectedPatient && (
        <>
          {/* Summary cards for selected patient's daily tests */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CompactMetricCard
              borderLeftClass="border-l-4 border-l-[#f97316]"
              left={
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Pending Tests
                  </p>
                  <p className="text-3xl font-bold text-[#f97316] mt-1">{pendingCount}</p>
                </div>
              }
              rightIcon={<Clock className="text-[#f97316]" size={26} />}
              tooltipTitle="Pending tests"
              tooltipContent={
                <>
                  <TooltipRow label="Patient" value={selectedPatient.name} />
                  <TooltipRow label="Selected date" value={selectedDate} />
                </>
              }
            />
            <CompactMetricCard
              borderLeftClass="border-l-4 border-l-[#22c55e]"
              left={
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Completed Tests
                  </p>
                  <p className="text-3xl font-bold text-[#22c55e] mt-1">{completedCount}</p>
                </div>
              }
              rightIcon={<CheckCircle className="text-[#22c55e]" size={26} />}
              tooltipTitle="Completed tests"
              tooltipContent={
                <>
                  <TooltipRow label="Patient" value={selectedPatient.name} />
                  <TooltipRow label="Selected date" value={selectedDate} />
                </>
              }
            />
            <CompactMetricCard
              borderLeftClass="border-l-4 border-l-[#3b82f6]"
              left={
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Total (this patient, day)
                  </p>
                  <p className="text-3xl font-bold text-[#3b82f6] mt-1">
                    {entriesForSelectedDate.length}
                  </p>
                </div>
              }
              rightIcon={<TestTube2 className="text-[#3b82f6]" size={26} />}
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
              <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <ClipboardList className="text-[#0066cc]" size={20} />
                Step 2 — Add daily test for {selectedPatient.name}
              </h3>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Test Category
                    </label>
                    <select
                      value={categories.length === 0 ? "" : testCategoryId}
                      onChange={(e) => setTestCategoryId(Number(e.target.value))}
                      disabled={loadingCategories || categories.length === 0}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-[#3b82f6] disabled:opacity-70"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Test Name
                    </label>
                    <input
                      type="text"
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-[#3b82f6]"
                      placeholder="e.g. CBC, LFT, RFT"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as LabStatus)
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-[#3b82f6]"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Result Summary
                    </label>
                    <input
                      type="text"
                      value={resultSummary}
                      onChange={(e) => setResultSummary(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-[#3b82f6]"
                      placeholder="e.g. Normal, Mildly elevated, Critical"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || categories.length === 0}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-md bg-[#0066cc] text-white text-sm font-medium hover:bg-[#0052a3] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : "Add daily test"}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
              <h3 className="font-semibold text-gray-800 mb-4">
                Daily tests — {selectedPatient.name} ({selectedDate})
              </h3>
              {loadingResults ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                  Loading…
                </div>
              ) : entriesForSelectedDate.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                  No tests recorded for this patient on this date yet.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="py-2 pr-2 font-medium">Test</th>
                        <th className="py-2 pr-2 font-medium">Status</th>
                        <th className="py-2 pr-2 font-medium">Summary</th>
                        <th className="py-2 font-medium text-right">Time</th>
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
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-700";

                        return (
                          <tr
                            key={entry.id}
                            className="border-b border-gray-100 last:border-0"
                          >
                            <td className="py-2 pr-2 text-gray-800">
                              <span className="text-xs text-gray-400 block">
                                {entry.test_category}
                              </span>
                              {entry.test_name}
                            </td>
                            <td className="py-2 pr-2">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}
                              >
                                {entry.status === "completed"
                                  ? "Completed"
                                  : "Pending"}
                              </span>
                            </td>
                            <td className="py-2 pr-2 text-gray-700">
                              {entry.result_summary}
                            </td>
                            <td className="py-2 text-right text-gray-500">
                              {timeLabel}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!selectedPatient && (
        <p className="text-sm text-gray-500 text-center py-4">
          Select a patient above to add daily lab tests.
        </p>
      )}
    </div>
  );
}
