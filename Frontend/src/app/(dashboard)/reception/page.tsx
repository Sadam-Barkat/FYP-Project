"use client";

import { useState, useEffect } from "react";
import { UserPlus, User, Stethoscope, Heart, CheckCircle, AlertTriangle } from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiBase";

function MessageModal({
  open,
  onClose,
  title,
  message,
  variant = "success",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: "success" | "error";
}) {
  if (!open) return null;
  const isError = variant === "error";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reception-message-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          {isError ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          )}
          <h3 id="reception-message-modal-title" className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {title}
          </h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        </div>
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
            className="px-4 py-2 bg-[#0066cc] text-white text-sm font-medium rounded-lg hover:bg-[#0052a3]"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

const API_BASE = getApiBaseUrl();

interface DoctorOption {
  id: number;
  name: string;
}

interface NurseOption {
  id: number;
  name: string;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function ReceptionPage() {
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [nurseId, setNurseId] = useState("");
  const [admitNow, setAdmitNow] = useState(true);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingNurses, setLoadingNurses] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageModalTitle, setMessageModalTitle] = useState("Success");
  const [messageModalMessage, setMessageModalMessage] = useState("");
  const [messageModalVariant, setMessageModalVariant] = useState<"success" | "error">("success");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDoctors(true);
      try {
        const res = await fetch(`${API_BASE}/api/receptionist/doctors`);
        if (!res.ok) throw new Error("Failed to load doctors");
        const data = await res.json();
        if (!cancelled) setDoctors(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setDoctors([]);
      } finally {
        if (!cancelled) setLoadingDoctors(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingNurses(true);
      try {
        const res = await fetch(`${API_BASE}/api/receptionist/nurses`);
        if (!res.ok) throw new Error("Failed to load nurses");
        const data = await res.json();
        if (!cancelled) setNurses(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setNurses([]);
      } finally {
        if (!cancelled) setLoadingNurses(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const docId = doctorId ? Number(doctorId) : 0;
    const nurId = nurseId ? Number(nurseId) : 0;
    if (!docId || !nurId) {
      setMessageModalTitle("Cannot add patient");
      setMessageModalMessage("Please select a doctor and a nurse.");
      setMessageModalVariant("error");
      setMessageModalOpen(true);
      return;
    }
    if (age === "" || age < 1) {
      setMessageModalTitle("Cannot add patient");
      setMessageModalMessage("Please enter a valid age.");
      setMessageModalVariant("error");
      setMessageModalOpen(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/receptionist/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          age: Number(age),
          gender: gender.trim(),
          contact: contact.trim() || null,
          address: address.trim() || null,
          blood_group: bloodGroup.trim() || null,
          doctor_id: docId,
          nurse_id: nurId,
          admit_now: admitNow,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Failed to register patient.");
      }
      const patientName = (data as { name?: string }).name ?? name.trim();
      setName("");
      setAge("");
      setGender("");
      setContact("");
      setAddress("");
      setBloodGroup("");
      setDoctorId("");
      setNurseId("");
      setAdmitNow(true);
      setMessageModalTitle("Success");
      setMessageModalMessage(`Patient "${patientName}" has been added successfully.`);
      setMessageModalVariant("success");
      setMessageModalOpen(true);
    } catch (err) {
      setMessageModalTitle("Error");
      setMessageModalMessage(err instanceof Error ? err.message : "Failed to register patient.");
      setMessageModalVariant("error");
      setMessageModalOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-3xl pb-8 transition-colors sm:pb-12">
      <div>
        <h2 className="text-2xl font-semibold text-[#0066cc] dark:text-[#60a5fa] sm:text-3xl">Add New Patient</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Register a new patient and assign a doctor and nurse. All fields with * are required.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
          {/* Patient details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium text-gray-800 dark:text-gray-200">
              <User size={20} className="text-[#0066cc] dark:text-[#60a5fa]" />
              Patient details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
                  placeholder="e.g. Ali Ahmed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Age *</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
                  placeholder="e.g. 35"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact</label>
                <input
                  type="tel"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
                  placeholder="e.g. +92 300 1234567"
                />
              </div>
              <div className="mt-2 flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Admit now & assign bed
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    When enabled, a bed is assigned immediately and Patients & Beds occupancy updates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdmitNow((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    admitNow ? "bg-[#0066cc]" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      admitNow ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none resize-none"
                  placeholder="e.g. Lahore, Punjab"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Blood group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
                >
                  <option value="">Select (optional)</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Assign Doctor */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium text-gray-800 dark:text-gray-200">
              <Stethoscope size={20} className="text-[#0066cc] dark:text-[#60a5fa]" />
              Assign doctor *
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Doctor</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                required
                disabled={loadingDoctors}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none disabled:opacity-70"
              >
                <option value="">{loadingDoctors ? "Loading…" : "Select a doctor"}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assign Nurse */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium text-gray-800 dark:text-gray-200">
              <Heart size={20} className="text-[#0066cc] dark:text-[#60a5fa]" />
              Assign nurse *
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nurse</label>
              <select
                value={nurseId}
                onChange={(e) => setNurseId(e.target.value)}
                required
                disabled={loadingNurses}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none disabled:opacity-70"
              >
                <option value="">{loadingNurses ? "Loading…" : "Select a nurse"}</option>
                {nurses.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting || loadingDoctors || loadingNurses}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0066cc] text-white font-medium rounded-lg hover:bg-[#0052a3] dark:bg-[#60a5fa] dark:hover:bg-[#3b82f6] focus:ring-2 focus:ring-[#0066cc] focus:ring-offset-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <UserPlus size={18} />
              {submitting ? "Adding…" : "Add patient"}
            </button>
          </div>
        </form>
      </div>

      <MessageModal
        open={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        title={messageModalTitle}
        message={messageModalMessage}
        variant={messageModalVariant}
      />
    </div>
  );
}
