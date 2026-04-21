"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ADMIN_DASHBOARD_REALTIME_EVENTS,
  useRealtimeEvent,
} from "@/hooks/useRealtimeEvent";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";

type ServiceSignal = {
  id: number;
  patient_id: number;
  patient_name: string;
  signal_type: string;
  reference_id: number | null;
  detail: string | null;
  created_at: string | null;
};

type PendingCharge = {
  id: number;
  patient_id: number;
  patient_name: string;
  amount: number;
  description: string;
  date: string | null;
};

type PatientSearchHit = {
  id: number;
  name: string;
  age: number | null;
};

const API_BASE = getApiBaseUrl();

export default function BillingFinancePage() {
  const [signals, setSignals] = useState<ServiceSignal[]>([]);
  const [pending, setPending] = useState<PendingCharge[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [patientQuery, setPatientQuery] = useState("");
  const [patientHits, setPatientHits] = useState<PatientSearchHit[]>([]);
  const [patientMenuOpen, setPatientMenuOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchHit | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeSignalIds, setChargeSignalIds] = useState<number[]>([]);
  const [chargeSubmitting, setChargeSubmitting] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("admin");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let r = sessionStorage.getItem("userRole");
    if (!r) {
      r = localStorage.getItem("userRole");
      if (r) sessionStorage.setItem("userRole", r);
    }
    if (r) setUserRole(r);
    const name =
      sessionStorage.getItem("userName") ||
      localStorage.getItem("userName") ||
      "";
    setUserDisplayName(name);
  }, []);

  const isFinanceUser = userRole === "finance";

  const fetchSignalsAndPending = useCallback(async () => {
    try {
      const [sigRes, pendRes] = await Promise.all([
        fetch(`${API_BASE}/api/billing-service-signals`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/api/billing-pending-charges`, { headers: getAuthHeaders() }),
      ]);
      if (sigRes.ok) {
        const s = await sigRes.json();
        setSignals(Array.isArray(s) ? s : []);
      }
      if (pendRes.ok) {
        const p = await pendRes.json();
        setPending(Array.isArray(p) ? p : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchSignalsAndPending();
    const interval = setInterval(fetchSignalsAndPending, 30000);
    return () => clearInterval(interval);
  }, [fetchSignalsAndPending]);

  useRealtimeEvent(ADMIN_DASHBOARD_REALTIME_EVENTS, fetchSignalsAndPending);

  useEffect(() => {
    const q = patientQuery.trim();
    if (q.length < 2) {
      setPatientHits([]);
      return;
    }
    if (selectedPatient && q === selectedPatient.name) {
      setPatientHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/billing-patients/search?q=${encodeURIComponent(q)}`,
          { headers: getAuthHeaders() },
        );
        if (!res.ok) {
          setPatientHits([]);
          return;
        }
        const data = await res.json();
        setPatientHits(Array.isArray(data) ? data : []);
        setPatientMenuOpen(true);
      } catch {
        setPatientHits([]);
      }
    }, 320);
    return () => clearTimeout(t);
  }, [patientQuery, selectedPatient]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setPatientMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggleSignalForCharge = (id: number) => {
    setChargeSignalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const pickPatient = (p: PatientSearchHit) => {
    setSelectedPatient(p);
    setPatientQuery(p.name);
    setPatientHits([]);
    setPatientMenuOpen(false);
  };

  const clearPatient = () => {
    setSelectedPatient(null);
    setPatientQuery("");
    setPatientHits([]);
  };

  const submitCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setError("Search and select a patient before creating a charge.");
      return;
    }
    const amt = parseFloat(chargeAmount);
    if (!chargeDescription.trim() || !amt || amt <= 0) return;
    setChargeSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/billing-charges`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          amount: amt,
          description: chargeDescription.trim(),
          signal_ids: chargeSignalIds.length ? chargeSignalIds : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Failed to add charge");
      }
      clearPatient();
      setChargeAmount("");
      setChargeDescription("");
      setChargeSignalIds([]);
      await fetchSignalsAndPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add charge");
    } finally {
      setChargeSubmitting(false);
    }
  };

  const markPaid = async (billingId: number) => {
    setMarkingPaidId(billingId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/billing-charges/${billingId}/mark-paid`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ payment_method: paymentMethod }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Failed to mark paid");
      }
      await fetchSignalsAndPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark paid");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const shellClass = isFinanceUser
    ? "dashboard-page-shell max-w-5xl pb-8 transition-colors sm:pb-12"
    : "dashboard-page-shell max-w-7xl pb-8 transition-colors sm:pb-12";

  return (
    <div id="dashboard-content" className={shellClass}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className={
              isFinanceUser
                ? "text-2xl font-semibold text-[#1e40af] dark:text-[#60a5fa] sm:text-3xl"
                : "text-2xl font-semibold text-[#0066cc] dark:text-[#60a5fa] sm:text-3xl"
            }
          >
            {isFinanceUser ? "Billing workspace" : "Billing & Finance"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isFinanceUser
              ? "Queue clinical events, add charges, confirm payment."
              : "Operational billing: queue, charges, and payments."}
          </p>
          {userDisplayName ? (
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">
              Logged in as{" "}
              <span className="text-[#0066cc] dark:text-[#60a5fa]">{userDisplayName}</span>
            </p>
          ) : null}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Clinical service queue</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Discharge, lab completed, and consultation events (no amounts). Link rows when posting a charge below.
          </p>
          <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-md border border-gray-100 dark:border-gray-700">
            <table className="w-full text-left text-sm border-collapse min-w-0">
              <thead className="sticky top-0 z-[1] bg-gray-50 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-600">
                <tr className="text-gray-500">
                  <th className="py-2 pr-2 pl-1 font-medium">Patient</th>
                  <th className="py-2 pr-2 font-medium">Type</th>
                  <th className="py-2 pr-2 font-medium">Detail</th>
                  <th className="py-2 w-10 font-medium text-center">Link</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-2 pl-1">
                      {s.patient_name}{" "}
                      <span className="text-gray-400">#{s.patient_id}</span>
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">{s.signal_type}</td>
                    <td
                      className="py-2 pr-2 text-gray-600 dark:text-gray-300 text-xs max-w-[10rem] sm:max-w-[12rem] truncate"
                      title={s.detail || ""}
                    >
                      {s.detail || "—"}
                    </td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        checked={chargeSignalIds.includes(s.id)}
                        onChange={() => toggleSignalForCharge(s.id)}
                        title="Resolve when posting the charge below"
                        aria-label={`Link signal ${s.id}`}
                      />
                    </td>
                  </tr>
                ))}
                {signals.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-gray-500 text-center">
                      No open service signals.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Add charge (pending until paid)</h3>
          <form onSubmit={submitCharge} className="space-y-3 text-sm">
            <div ref={searchWrapRef} className="relative">
              <label className="block text-gray-600 dark:text-gray-400 mb-1">Patient (search by name)</label>
              <input
                type="text"
                autoComplete="off"
                className="w-full border border-gray-200 rounded-md px-3 py-2 dark:bg-gray-900 dark:border-gray-600"
                value={patientQuery}
                onChange={(e) => {
                  setPatientQuery(e.target.value);
                  if (selectedPatient && e.target.value !== selectedPatient.name) {
                    setSelectedPatient(null);
                  }
                  if (e.target.value.trim().length >= 2) setPatientMenuOpen(true);
                }}
                onFocus={() => {
                  if (patientHits.length > 0) setPatientMenuOpen(true);
                }}
                placeholder="Type at least 2 letters…"
              />
              {selectedPatient ? (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Selected:{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedPatient.name} (#{selectedPatient.id})
                  </span>{" "}
                  <button
                    type="button"
                    className="text-[#0066cc] hover:underline dark:text-[#60a5fa]"
                    onClick={clearPatient}
                  >
                    Clear
                  </button>
                </p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Pick a row from the list to set the patient for this charge.
                </p>
              )}
              {patientMenuOpen && patientHits.length > 0 && (
                <ul
                  className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-600 dark:bg-gray-900"
                  role="listbox"
                >
                  {patientHits.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickPatient(p)}
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
                        <span className="shrink-0 text-xs text-gray-500">
                          #{p.id}
                          {p.age != null ? ` · ${p.age} yrs` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-gray-600 dark:text-gray-400 mb-1">Amount (PKR)</label>
              <input
                type="number"
                step="0.01"
                min={0.01}
                className="w-full border border-gray-200 rounded-md px-3 py-2 dark:bg-gray-900 dark:border-gray-600"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-md px-3 py-2 dark:bg-gray-900 dark:border-gray-600"
                value={chargeDescription}
                onChange={(e) => setChargeDescription(e.target.value)}
                placeholder="e.g. Bed stay 3d, CBC lab, consultation"
                required
              />
            </div>
            <button
              type="submit"
              disabled={chargeSubmitting || !selectedPatient}
              className="w-full bg-[#0066cc] text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {chargeSubmitting ? "Saving…" : "Create pending charge"}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Pending charges — confirm payment</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="text-gray-600 dark:text-gray-400">Payment method</label>
            <input
              type="text"
              className="border border-gray-200 rounded-md px-2 py-1 w-36 dark:bg-gray-900 dark:border-gray-600"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="cash / card / …"
            />
          </div>
        </div>
        <div className="max-h-[min(20rem,45vh)] overflow-y-auto overflow-x-auto rounded-md border border-gray-100 dark:border-gray-700">
          <table className="w-full text-left text-sm border-collapse min-w-[480px]">
            <thead className="sticky top-0 z-[1] bg-gray-50 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-600">
              <tr className="text-gray-500">
                <th className="py-2 px-2 font-medium">Patient</th>
                <th className="py-2 px-2 font-medium">Description</th>
                <th className="py-2 px-2 font-medium text-right">Amount</th>
                <th className="py-2 px-2 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 px-2">
                    {row.patient_name} <span className="text-gray-400">#{row.patient_id}</span>
                  </td>
                  <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{row.description || "—"}</td>
                  <td className="py-2 px-2 text-right font-medium">PKR {row.amount.toLocaleString()}</td>
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => markPaid(row.id)}
                      disabled={markingPaidId === row.id}
                      className="px-3 py-1 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-60"
                    >
                      {markingPaidId === row.id ? "…" : "Mark paid"}
                    </button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No pending charges.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
