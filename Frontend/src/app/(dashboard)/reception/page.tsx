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
        className="bg-base-card border border-base-border rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-base-border">
          {isError ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-danger/15">
              <AlertTriangle className="h-5 w-5 text-status-danger" />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-success/15">
              <CheckCircle className="h-5 w-5 text-status-success" />
            </div>
          )}
          <h3 id="reception-message-modal-title" className="text-text-primary font-semibold text-base">
            {title}
          </h3>
        </div>
        <div className="p-4">
          <p className="text-text-primary text-sm leading-relaxed">{message}</p>
        </div>
        <div className="flex justify-end p-4 border-t border-base-border">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
            className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-semibold rounded-xl px-5 py-2.5 shadow-[0_0_16px_rgba(59,130,246,0.3)] hover:shadow-[0_0_24px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
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
    <div id="dashboard-content" className="bg-base-surface min-h-screen px-8 py-8 space-y-8">
      <div className="-mx-8 -mt-8 bg-base-card border-b border-base-border px-8 py-4">
        <h2 className="text-text-primary font-semibold text-xl tracking-tight">Add New Patient</h2>
        <p className="text-text-primary text-sm leading-relaxed mt-1">
          Register a new patient and assign a doctor and nurse. All fields with * are required.
        </p>
      </div>

      <div className="bg-base-card border border-base-border rounded-2xl p-8 shadow-[0_2px_16px_rgba(0,0,0,0.4)]">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Patient details */}
          <div className="space-y-4">
            <div className="text-text-secondary text-xs font-medium uppercase tracking-widest mb-4 pt-4 border-t border-base-border flex items-center gap-2">
              <User size={20} className="text-text-secondary" />
              Patient details
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="text-text-secondary text-sm font-medium mb-1.5 block">Full name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all duration-200"
                  placeholder="e.g. Ali Ahmed"
                />
              </div>
              <div>
                <label className="text-text-secondary text-sm font-medium mb-1.5 block">Age *</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all duration-200"
                  placeholder="e.g. 35"
                />
              </div>
              <div>
                <label className="text-text-secondary text-sm font-medium mb-1.5 block">Gender *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all duration-200 appearance-none"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-text-secondary text-sm font-medium mb-1.5 block">Contact</label>
                <input
                  type="tel"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all duration-200"
                  placeholder="e.g. +92 300 1234567"
                />
              </div>
              <div className="mt-2 flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-text-primary text-sm leading-relaxed">
                    Admit now & assign bed
                  </p>
                  <p className="text-text-muted text-xs">
                    When enabled, a bed is assigned immediately and Patients & Beds occupancy updates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdmitNow((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    admitNow ? "bg-brand-primary" : "bg-base-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-base-card shadow transition-transform ${
                      admitNow ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="sm:col-span-2">
                <label className="text-text-secondary text-sm font-medium mb-1.5 block">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all duration-200 resize-none min-h-[100px]"
                  placeholder="e.g. Lahore, Punjab"
                />
              </div>
              <div>
                <label className="text-text-secondary text-sm font-medium mb-1.5 block">Blood group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all duration-200 appearance-none"
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
          <div className="space-y-4 pt-4 border-t border-base-border">
            <div className="text-text-secondary text-xs font-medium uppercase tracking-widest mb-4 pt-4 border-t border-base-border flex items-center gap-2">
              <Stethoscope size={20} className="text-text-secondary" />
              Assign doctor *
            </div>
            <div>
              <label className="text-text-secondary text-sm font-medium mb-1.5 block">Doctor</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                required
                disabled={loadingDoctors}
                className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all duration-200 disabled:opacity-70 appearance-none"
              >
                <option value="">{loadingDoctors ? "Loading…" : "Select a doctor"}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assign Nurse */}
          <div className="space-y-4 pt-4 border-t border-base-border">
            <div className="text-text-secondary text-xs font-medium uppercase tracking-widest mb-4 pt-4 border-t border-base-border flex items-center gap-2">
              <Heart size={20} className="text-text-secondary" />
              Assign nurse *
            </div>
            <div>
              <label className="text-text-secondary text-sm font-medium mb-1.5 block">Nurse</label>
              <select
                value={nurseId}
                onChange={(e) => setNurseId(e.target.value)}
                required
                disabled={loadingNurses}
                className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all duration-200 disabled:opacity-70 appearance-none"
              >
                <option value="">{loadingNurses ? "Loading…" : "Select a nurse"}</option>
                {nurses.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-base-border">
            <button
              type="submit"
              disabled={submitting || loadingDoctors || loadingNurses}
              className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-semibold rounded-xl px-5 py-2.5 shadow-[0_0_16px_rgba(59,130,246,0.3)] hover:shadow-[0_0_24px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2"
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
