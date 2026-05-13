"use client";

import { useState, useEffect, useId } from "react";
import {
  UserPlus,
  User,
  Stethoscope,
  CheckCircle,
  AlertTriangle,
  CalendarDays,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  Droplets,
  ShieldAlert,
  FileText,
  RotateCcw,
  Save,
  UserRound,
  Sparkles,
} from "lucide-react";
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reception-message-modal-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-base-border bg-base-card shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-base-border p-5">
          {isError ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-status-danger/15">
              <AlertTriangle className="h-5 w-5 text-status-danger" />
            </div>
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-status-success/15">
              <CheckCircle className="h-5 w-5 text-status-success" />
            </div>
          )}
          <h3 id="reception-message-modal-title" className="text-lg font-semibold text-text-bright">
            {title}
          </h3>
        </div>
        <div className="p-5">
          <p className="text-sm leading-relaxed text-text-primary">{message}</p>
        </div>
        <div className="flex justify-end border-t border-base-border p-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition hover:from-blue-500 hover:to-indigo-500"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
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
    <section className="rounded-2xl border border-base-border bg-base-card/80 p-5 shadow-card backdrop-blur-sm sm:p-6 dark:border-white/[0.08] dark:bg-gradient-to-b dark:from-white/[0.05] dark:to-transparent dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-violet-900/25"
          aria-hidden
        >
          {step}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight text-text-bright sm:text-lg">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-xs text-text-secondary sm:text-sm">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-secondary">
      {children}
      {required ? <span className="ml-0.5 text-brand-blue dark:text-violet-400">*</span> : null}
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
  /** Native select: room for dropdown arrow */
  withChevron?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-muted">
        <Icon size={18} className="shrink-0" />
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
  "w-full rounded-xl border border-base-border bg-base-card py-3 text-sm text-text-primary placeholder:text-text-muted shadow-inner transition focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:bg-dash-elevated dark:text-tx-bright dark:placeholder:text-tx-muted";

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
  const formId = useId();
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
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
    return () => {
      cancelled = true;
    };
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
    return () => {
      cancelled = true;
    };
  }, []);

  const resetForm = () => {
    setName("");
    setAge("");
    setGender("");
    setContact("");
    setEmail("");
    setAddress("");
    setBloodGroup("");
    setAllergies("");
    setNotes("");
    setDoctorId("");
    setNurseId("");
    setAdmitNow(true);
  };

  const buildAddressPayload = () => {
    const parts: string[] = [];
    const main = address.trim();
    if (main) parts.push(main);
    const emailTrim = email.trim();
    if (emailTrim) parts.push(`Email: ${emailTrim}`);
    const al = allergies.trim();
    if (al) parts.push(`Allergies: ${al}`);
    const n = notes.trim();
    if (n) parts.push(`Notes: ${n}`);
    return parts.length ? parts.join("\n\n") : null;
  };

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
    if (!contact.trim()) {
      setMessageModalTitle("Cannot add patient");
      setMessageModalMessage("Please enter a contact number.");
      setMessageModalVariant("error");
      setMessageModalOpen(true);
      return;
    }
    if (!address.trim()) {
      setMessageModalTitle("Cannot add patient");
      setMessageModalMessage("Please enter the patient address.");
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
          address: buildAddressPayload(),
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
      resetForm();
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
    <div
      id="dashboard-content"
      className="relative min-h-0 overflow-x-hidden pb-8"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 dark:opacity-100 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.14),transparent_55%),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(139,92,246,0.1),transparent_50%)]" />

      <div className="dashboard-page-shell max-w-5xl">
        {/* Page header */}
        <header className="relative mb-6 sm:mb-8">
          <div className="relative z-10 min-w-0 max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-300/60 bg-violet-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-violet-800 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-200/90">
              <Sparkles size={12} className="text-violet-600 dark:text-violet-300" />
              Reception
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-900/40">
                <UserPlus className="h-6 w-6" strokeWidth={2} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Add New Patient
              </h1>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Register a new patient and assign a doctor and nurse. All fields with{" "}
              <span className="font-semibold text-violet-500 dark:text-violet-400">*</span> are required.
            </p>
          </div>
        </header>

        <form id={formId} onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {/* Section 1 */}
          <SectionCard
            step={1}
            title="Patient information"
            subtitle="Legal name, demographics, and how we can reach the patient."
          >
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel required>Full name</FieldLabel>
                <InputShell icon={User}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    className={inputClass}
                    placeholder="e.g. Ali Ahmed"
                  />
                </InputShell>
              </div>
              <div>
                <FieldLabel required>Age</FieldLabel>
                <InputShell icon={CalendarDays}>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                    required
                    className={inputClass}
                    placeholder="e.g. 35"
                  />
                </InputShell>
              </div>
              <div>
                <FieldLabel required>Gender</FieldLabel>
                <InputShell icon={UserRound} withChevron>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    required
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </InputShell>
              </div>
              <div>
                <FieldLabel required>Contact number</FieldLabel>
                <InputShell icon={Phone}>
                  <input
                    type="tel"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    required
                    autoComplete="tel"
                    className={inputClass}
                    placeholder="e.g. +92 300 1234567"
                  />
                </InputShell>
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <InputShell icon={Mail}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className={inputClass}
                    placeholder="e.g. ali@gmail.com"
                  />
                </InputShell>
                <p className="mt-1 text-[11px] text-text-muted">
                  Optional — stored with address record for staff reference.
                </p>
              </div>
              <div className="md:col-span-2">
                <FieldLabel required>Address</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-3.5 z-10 text-text-muted">
                    <MapPin size={18} />
                  </span>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    rows={3}
                    className={`${inputClass} min-h-[100px] resize-y pl-11 pr-4`}
                    placeholder="e.g. House # 12, Street 5, Block A, Lahore"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Section 2 */}
          <SectionCard
            step={2}
            title="Assign staff"
            subtitle="Link the patient to their care team. Both assignments are required."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel required>Assign doctor</FieldLabel>
                <InputShell icon={Stethoscope} withChevron>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    required
                    disabled={loadingDoctors}
                    className={`${inputClass} appearance-none disabled:opacity-50`}
                  >
                    <option value="">{loadingDoctors ? "Loading…" : "Select doctor"}</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </InputShell>
              </div>
              <div>
                <FieldLabel required>Assign nurse</FieldLabel>
                <InputShell icon={UserRound} withChevron>
                  <select
                    value={nurseId}
                    onChange={(e) => setNurseId(e.target.value)}
                    required
                    disabled={loadingNurses}
                    className={`${inputClass} appearance-none disabled:opacity-50`}
                  >
                    <option value="">{loadingNurses ? "Loading…" : "Select nurse"}</option>
                    {nurses.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </InputShell>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-base-border bg-base-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/[0.03]">
              <div>
                <p className="text-sm font-medium text-text-bright">Admit now &amp; assign bed</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  When on, we assign the first available bed so occupancy dashboards stay accurate.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={admitNow}
                onClick={() => setAdmitNow((v) => !v)}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                  admitNow
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600"
                    : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    admitNow ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </SectionCard>

          {/* Section 3 */}
          <SectionCard
            step={3}
            title="Additional information"
            subtitle="Optional clinical context — helps nursing and pharmacy teams prepare."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Blood group</FieldLabel>
                <InputShell icon={Droplets} withChevron>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="">Select blood group</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </InputShell>
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Allergies</FieldLabel>
                <InputShell icon={ShieldAlert}>
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Penicillin, Peanuts"
                  />
                </InputShell>
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Notes</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-3.5 z-10 text-text-muted">
                    <FileText size={18} />
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className={`${inputClass} min-h-[88px] resize-y pl-11 pr-4`}
                    placeholder="Add any additional notes…"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-base-border pt-6 sm:flex-row sm:justify-end sm:gap-4">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-base-border bg-transparent px-5 py-3 text-sm font-semibold text-text-secondary transition hover:border-brand-blue/40 hover:bg-base-hover hover:text-text-bright"
            >
              <RotateCcw size={18} />
              Reset form
            </button>
            <button
              type="submit"
              disabled={submitting || loadingDoctors || loadingNurses}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_32px_rgba(79,70,229,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={18} strokeWidth={2.5} />
              {submitting ? "Saving…" : "Save patient"}
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
