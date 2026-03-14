"use client";

import { useState } from "react";
import { TestTube2, ClipboardList, User, Clock, CheckCircle } from "lucide-react";

type LabStatus = "pending" | "completed";

interface LabEntry {
  id: number;
  patientId: string;
  patientName: string;
  testCategory: string;
  testName: string;
  status: LabStatus;
  resultSummary: string;
  createdAt: string;
}

const mockPatients = [
  { id: "P-1001", name: "Ali Raza", age: 45 },
  { id: "P-1002", name: "Ayesha Khan", age: 32 },
  { id: "P-1003", name: "Ahmed Hassan", age: 28 },
  { id: "P-1004", name: "Fatima Noor", age: 55 },
  { id: "P-1005", name: "Sara Mahmood", age: 38 },
];

const mockCategories = [
  "Blood Test (CBC)",
  "Lipid Profile",
  "Liver Function",
  "Urinalysis",
  "COVID-19 PCR",
  "Renal Function",
  "Thyroid Panel",
];

// Dummy daily tests for selected patient (pre-filled for design)
const dummyDailyTests: LabEntry[] = [
  { id: 1, patientId: "P-1001", patientName: "Ali Raza", testCategory: "Blood Test (CBC)", testName: "CBC", status: "completed", resultSummary: "Normal", createdAt: new Date().toISOString().slice(0, 10) + "T09:30:00.000Z" },
  { id: 2, patientId: "P-1001", patientName: "Ali Raza", testCategory: "Liver Function", testName: "LFT", status: "pending", resultSummary: "Pending", createdAt: new Date().toISOString().slice(0, 10) + "T10:15:00.000Z" },
  { id: 3, patientId: "P-1001", patientName: "Ali Raza", testCategory: "Urinalysis", testName: "Urine R/E", status: "completed", resultSummary: "Normal", createdAt: new Date().toISOString().slice(0, 10) + "T11:00:00.000Z" },
];

export default function LaboratoryEntryPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [testCategory, setTestCategory] = useState<string>(mockCategories[0]);
  const [testName, setTestName] = useState<string>("CBC");
  const [status, setStatus] = useState<LabStatus>("pending");
  const [resultSummary, setResultSummary] = useState<string>("");
  const [entries, setEntries] = useState<LabEntry[]>(dummyDailyTests);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPatient = mockPatients.find((p) => p.id === selectedPatientId);

  const handleSubmit = (e: React.FormEvent) => {
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
    const now = new Date();
    const createdAt = new Date(
      `${selectedDate}T${now.toTimeString().slice(0, 8)}`
    ).toISOString();

    setEntries((prev) => [
      {
        id: prev.length + 1,
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        testCategory,
        testName: testName.trim(),
        status,
        resultSummary: resultSummary.trim() || "Pending interpretation",
        createdAt,
      },
      ...prev,
    ]);

    setSubmitting(false);
    setResultSummary("");
  };

  const entriesForSelectedPatient = selectedPatientId
    ? entries.filter((e) => e.patientId === selectedPatientId)
    : [];
  const entriesForSelectedDate = entriesForSelectedPatient.filter(
    (e) => e.createdAt.slice(0, 10) === selectedDate
  );

  const pendingCount = entriesForSelectedDate.filter(
    (e) => e.status === "pending"
  ).length;
  const completedCount = entriesForSelectedDate.filter(
    (e) => e.status === "completed"
  ).length;

  return (
    <div
      id="dashboard-content"
      className="w-full max-w-6xl mx-auto space-y-6 py-6"
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Patient
          </label>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-[#3b82f6]"
          >
            <option value="">— Select a patient —</option>
            {mockPatients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.name} (Age {p.age})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Step 2: Add daily tests (only when patient selected) */}
      {selectedPatient && (
        <>
          {/* Summary cards for selected patient's daily tests */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Pending Tests
                </p>
                <p className="text-3xl font-bold text-[#f97316] mt-1">
                  {pendingCount}
                </p>
              </div>
              <Clock className="text-[#f97316]" size={26} />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Completed Tests
                </p>
                <p className="text-3xl font-bold text-[#22c55e] mt-1">
                  {completedCount}
                </p>
              </div>
              <CheckCircle className="text-[#22c55e]" size={26} />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#3b82f6] p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Total (this patient, day)
                </p>
                <p className="text-3xl font-bold text-[#3b82f6] mt-1">
                  {entriesForSelectedDate.length}
                </p>
              </div>
              <TestTube2 className="text-[#3b82f6]" size={26} />
            </div>
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
                      value={testCategory}
                      onChange={(e) => setTestCategory(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-[#3b82f6]"
                    >
                      {mockCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
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
                  disabled={submitting}
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
              {entriesForSelectedDate.length === 0 ? (
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
                          entry.createdAt
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
                                {entry.testCategory}
                              </span>
                              {entry.testName}
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
                              {entry.resultSummary}
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
