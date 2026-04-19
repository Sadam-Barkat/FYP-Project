"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { UserPlus, Pencil, Trash2, Search, X, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import {
  ADMIN_DASHBOARD_REALTIME_EVENTS,
  useRealtimeEvent,
} from "@/hooks/useRealtimeEvent";
import { getApiBaseUrl } from "@/lib/apiBase";

const STAFF_PER_PAGE = 8;
const PATIENTS_PER_PAGE = 8;

const API_BASE = getApiBaseUrl();

export type StaffType = "Doctor" | "Nurse" | "Laboratorian" | "Receptionist";

/** Staff: email + occupation set by admin. Name, age, etc. filled when they complete signup via invitation link. */
type StaffMember = {
  id: string;
  email: string;
  type: StaffType;
  /** Filled after signup; null = invitation sent, pending signup */
  name: string | null;
  age: number | null;
  phone: string | null;
  address: string | null;
  gender: string | null;
  department?: string | null;
  activePatients?: number;
};

const STAFF_TYPES: StaffType[] = ["Doctor", "Nurse", "Laboratorian", "Receptionist"];

const MOCK_STAFF: StaffMember[] = [
  { id: "d1", email: "ayesha@hospital.com", type: "Doctor", name: "Dr. Ayesha Khan", age: 38, phone: "+92 300 1112233", address: "Lahore", gender: "Female" },
  { id: "d2", email: "bilal@hospital.com", type: "Doctor", name: "Dr. Bilal Ahmed", age: 42, phone: "+92 321 4445566", address: "Faisalabad", gender: "Male" },
  { id: "d3", email: "sara@hospital.com", type: "Doctor", name: "Dr. Sara Ali", age: 35, phone: "+92 333 7778899", address: "Islamabad", gender: "Female" },
  { id: "n1", email: "fatima@hospital.com", type: "Nurse", name: "Fatima Hassan", age: 28, phone: "+92 302 2223344", address: "Rawalpindi", gender: "Female" },
  { id: "n2", email: "sana@hospital.com", type: "Nurse", name: "Sana Mahmood", age: 31, phone: "+92 321 5556677", address: "Lahore", gender: "Female" },
  { id: "n3", email: "zainab@hospital.com", type: "Nurse", name: "Zainab Noor", age: 26, phone: "+92 300 8889900", address: "Karachi", gender: "Female" },
  { id: "l1", email: "lab@hospital.com", type: "Laboratorian", name: "Ali Raza", age: 34, phone: "+92 333 1234567", address: "Lahore", gender: "Male" },
  { id: "r1", email: "reception@hospital.com", type: "Receptionist", name: "Hira Khan", age: 29, phone: "+92 302 9876543", address: "Faisalabad", gender: "Female" },
];

type PatientCard = { id: string; name: string; age: number; gender: string; contact: string; address?: string };
type BackendPatient = { id: number; name: string; age: number; gender: string; contact: string | null; address: string | null };

const MOCK_PATIENTS: PatientCard[] = [];

function typeColor(type: StaffType): string {
  switch (type) {
    case "Doctor":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "Nurse":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "Laboratorian":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    case "Receptionist":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
}

/** Modal for delete confirmation. Replaces browser confirm/alert. */
function DeleteConfirmModal({
  open,
  onClose,
  title,
  message,
  itemName,
  error,
  loading,
  onConfirm,
  confirmLabel = "Delete",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  itemName?: string;
  error: string | null;
  loading: boolean;
  onConfirm: () => Promise<void>;
  confirmLabel?: string;
}) {
  if (!open) return null;
  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch {
      // Error shown via error prop
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 id="delete-modal-title" className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {title}
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {!error && <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>}
          {itemName && (
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {itemName}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          {error ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
              className="px-4 py-2 bg-[#0066cc] text-white text-sm font-medium rounded-lg hover:bg-[#0052a3]"
            >
              OK
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleConfirm(); }}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Deleting…" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Simple message modal (success or error). Replaces browser alert. */
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
      aria-labelledby="message-modal-title"
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
          <h3 id="message-modal-title" className="text-lg font-semibold text-gray-800 dark:text-gray-200">
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

/** Modal for "must add replacement first" (Receptionist / Laboratorian). */
function ReplaceFirstModal({
  open,
  onClose,
  staffType,
  onAddClick,
}: {
  open: boolean;
  onClose: () => void;
  staffType: "Receptionist" | "Laboratorian";
  onAddClick: () => void;
}) {
  if (!open) return null;
  const label = staffType === "Laboratorian" ? "Laboratory staff member" : staffType.toLowerCase();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="replace-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 id="replace-modal-title" className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Replacement required
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {staffType === "Receptionist"
              ? "You must add a new Receptionist before deleting the existing one."
              : "You must add a new Laboratory staff member before deleting the existing one."}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Click below to add a new {label}, then you can delete the current one after they are added.
          </p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAddClick}
            className="px-4 py-2 bg-[#0066cc] text-white text-sm font-medium rounded-lg hover:bg-[#0052a3]"
          >
            Add new {staffType === "Laboratorian" ? "Laboratory staff" : staffType}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Edit staff modal: all card details editable except role (fixed). */
function EditStaffModal({
  open,
  onClose,
  staff,
  onSave,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  onSave: (updated: StaffMember) => void;
  onError?: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && staff) {
      setName(staff.name ?? "");
      setEmail(staff.email);
      setAge(staff.age ?? "");
      setPhone(staff.phone ?? "");
      setDepartment(staff.department ?? "");
      setAddress(staff.address ?? "");
    }
  }, [open, staff]);

  if (!open || !staff) return null;

  const handleSave = async () => {
    const parts = (name || "").trim().split(/\s+/);
    const first_name = parts[0] ?? "";
    const last_name = parts.slice(1).join(" ") ?? "";
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/user-management/staff/${staff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          first_name: first_name || undefined,
          last_name: last_name || undefined,
          age: age === "" ? undefined : Number(age),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          department: department.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Failed to update staff.");
      }
      const updated: StaffMember = {
        ...staff,
        name: (name || "").trim() || null,
        email: email.trim(),
        age: age === "" ? null : Number(age),
        phone: phone.trim() || null,
        address: address.trim() || null,
        department: department.trim() || undefined,
      };
      onSave(updated);
      onClose();
    } catch (e) {
      console.error(e);
      setSaving(false);
      onError?.(e instanceof Error ? e.message : "Failed to update staff.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-staff-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 id="edit-staff-modal-title" className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Edit staff
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Role: fixed, read-only */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Role</label>
            <div className={`px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-not-allowed`}>
              {staff.type}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm dark:bg-gray-700"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Age</label>
            <input
              type="number"
              min={18}
              value={age}
              onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm dark:bg-gray-700"
              placeholder="e.g. ICU, Emergency"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm dark:bg-gray-700"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffAndPatientsPage() {
  const [activeTab, setActiveTab] = useState<"staff" | "patients">("staff");

  return (
    <div id="dashboard-content" className="dashboard-page-shell max-w-7xl">
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-semibold text-[#0066cc] dark:text-[#60a5fa] sm:text-3xl">User Management</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Invite staff (doctors, nurses, laboratorian, receptionist) and view or remove patients.</p>
      </div>

      {/* Tabs */}
      <div className="-mx-1 flex overflow-x-auto border-b border-gray-200 px-1 dark:border-gray-700 sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors sm:px-6 ${
            activeTab === "staff"
              ? "border-[#0066cc] text-[#0066cc] dark:border-[#60a5fa] dark:text-[#60a5fa]"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Staff
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("patients")}
          className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors sm:px-6 ${
            activeTab === "patients"
              ? "border-[#0066cc] text-[#0066cc] dark:border-[#60a5fa] dark:text-[#60a5fa]"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Patients
        </button>
      </div>

      {activeTab === "staff" && <StaffTab />}
      {activeTab === "patients" && <PatientsTab />}
    </div>
  );
}

function StaffTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addType, setAddType] = useState<StaffType>("Doctor");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPayload, setEditPayload] = useState<StaffMember | null>(null);
  const addEmailInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacementForId, setReplacementForId] = useState<string | null>(null);
  const [replacementForType, setReplacementForType] = useState<StaffType | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePayload, setDeletePayload] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replacePayload, setReplacePayload] = useState<{ id: string; type: StaffType } | null>(null);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageModalTitle, setMessageModalTitle] = useState("Success");
  const [messageModalMessage, setMessageModalMessage] = useState("");
  const [messageModalVariant, setMessageModalVariant] = useState<"success" | "error">("success");
  const [inviteLoading, setInviteLoading] = useState(false);
  const staffTabAlive = useRef(true);

  useEffect(() => {
    staffTabAlive.current = true;
    return () => {
      staffTabAlive.current = false;
    };
  }, []);

  useEffect(() => {
    if (showAddForm && addEmailInputRef.current) {
      addEmailInputRef.current.focus();
    }
  }, [showAddForm]);

  // Load staff from backend (skip admin handled server-side).
  const loadStaff = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/user-management/staff`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Failed to load staff.");
      }
      const data: {
        id: number;
        email: string;
        staff_type: StaffType;
        name: string | null;
        age: number | null;
        phone: string | null;
        address: string | null;
        gender: string | null;
        department?: string | null;
        active_patients?: number;
      }[] = await res.json();
      if (!staffTabAlive.current) return;
      const mapped: StaffMember[] = data.map((item) => ({
        id: String(item.id),
        email: item.email,
        type: item.staff_type,
        name: item.name,
        age: item.age,
        phone: item.phone,
        address: item.address,
        gender: item.gender,
        department: item.department ?? null,
        activePatients: item.active_patients ?? 0,
      }));
      setStaff(mapped);
    } catch (err) {
      console.error("Failed to load staff", err);
      if (staffTabAlive.current) {
        setError(err instanceof Error ? err.message : "Failed to load staff.");
      }
    } finally {
      if (staffTabAlive.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useRealtimeEvent(ADMIN_DASHBOARD_REALTIME_EVENTS, loadStaff);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return staff.filter(
      (x) =>
        x.email.toLowerCase().includes(s) ||
        x.type.toLowerCase().includes(s) ||
        (x.name && x.name.toLowerCase().includes(s)) ||
        (x.phone && x.phone.includes(s)) ||
        (x.address && x.address.toLowerCase().includes(s)) ||
        (x.gender && x.gender.toLowerCase().includes(s))
    );
  }, [staff, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / STAFF_PER_PAGE));
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);
  const page = Math.min(currentPage, totalPages);
  const paginatedStaff = useMemo(() => {
    const start = (page - 1) * STAFF_PER_PAGE;
    return filtered.slice(start, start + STAFF_PER_PAGE);
  }, [filtered, page]);

  const hasLaboratorian = staff.some((x) => x.type === "Laboratorian");
  const hasReceptionist = staff.some((x) => x.type === "Receptionist");
  const canAddType = (t: StaffType) => {
    if (t === "Laboratorian") return !hasLaboratorian;
    if (t === "Receptionist") return !hasReceptionist;
    return true;
  };
  const canAdd = canAddType(addType);

  const handleAdd = async () => {
    if (!addEmail.trim()) return;
    if (inviteLoading) return;
    const startedAt = Date.now();
    let closeAfter = false;
    const isReplacement = replacementForId !== null && replacementForType === addType;
    if (!isReplacement && !canAdd) return;
    // Prevent duplicate email (same email already in staff list for any role)
    const emailLower = addEmail.trim().toLowerCase();
    const alreadyUsed = staff.some((s) => s.email.trim().toLowerCase() === emailLower);
    if (alreadyUsed) {
      setShowAddForm(false);
      setMessageModalVariant("error");
      setMessageModalTitle("Cannot add staff");
      setMessageModalMessage("This email is already registered or has a pending invitation. Each email can only be used for one role.");
      setMessageModalOpen(true);
      return;
    }
    try {
      setInviteLoading(true);
      const res = await fetch(`${API_BASE}/api/user-management/staff/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim(), staff_type: addType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Failed to send invitation.");
      }
      const prefix = addType === "Doctor" ? "d" : addType === "Nurse" ? "n" : addType === "Laboratorian" ? "l" : "r";
      setStaff((prev) => [
        ...prev,
        {
          id: `${prefix}${Date.now()}`,
          email: addEmail.trim(),
          type: addType,
          name: null,
          age: null,
          phone: null,
          address: null,
          gender: null,
          activePatients: 0,
        },
      ]);
      setAddEmail("");
      setAddType("Doctor");
      closeAfter = true;
      setMessageModalVariant("success");
      setMessageModalTitle("Success");
      setMessageModalMessage("Invitation email sent to the staff member.");
      setMessageModalOpen(true);
      // If this was a replacement flow for receptionist or laboratorian, delete the old one now.
      if (isReplacement && replacementForId) {
        try {
          const resDel = await fetch(`${API_BASE}/api/user-management/staff/${replacementForId}`, {
            method: "DELETE",
          });
          if (!resDel.ok) {
            const errDel = await resDel.json().catch(() => ({}));
            throw new Error(errDel.detail ?? "Failed to delete old staff member after replacement.");
          }
          setStaff((prev) => prev.filter((x) => x.id !== replacementForId));
        } catch (err) {
          console.error("Failed to delete old staff after replacement", err);
          setMessageModalVariant("error");
          setMessageModalTitle("Error");
          setMessageModalMessage(err instanceof Error ? err.message : "Failed to delete old staff after replacement.");
          setMessageModalOpen(true);
        } finally {
          setReplacementForId(null);
          setReplacementForType(null);
        }
      } else {
        setReplacementForId(null);
        setReplacementForType(null);
      }
    } catch (err) {
      console.error("Failed to invite staff", err);
      closeAfter = true;
      setMessageModalVariant("error");
      setMessageModalTitle("Error");
      setMessageModalMessage(err instanceof Error ? err.message : "Failed to send staff invitation.");
      setMessageModalOpen(true);
    } finally {
      // Ensure the user sees the loading feedback even on fast networks.
      const elapsed = Date.now() - startedAt;
      const minMs = 600;
      if (elapsed < minMs) {
        await new Promise((r) => setTimeout(r, minMs - elapsed));
      }
      setInviteLoading(false);
      if (closeAfter) setShowAddForm(false);
    }
  };

  const handleEditSave = (updated: StaffMember) => {
    setStaff((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setEditModalOpen(false);
    setEditPayload(null);
  };

  const handleDeleteClick = (id: string, type: StaffType, name: string) => {
    if (type === "Receptionist" || type === "Laboratorian") {
      setReplacePayload({ id, type });
      setReplaceModalOpen(true);
      return;
    }
    setDeletePayload({ id, name: name || id });
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletePayload) return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/user-management/staff/${deletePayload.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Failed to delete staff member.");
      }
      setStaff((prev) => prev.filter((x) => x.id !== deletePayload.id));
      setDeleteModalOpen(false);
      setDeletePayload(null);
    } catch (err) {
      console.error("Failed to delete staff member", err);
      setDeleteError(err instanceof Error ? err.message : "Failed to delete staff member.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleReplaceAddClick = () => {
    if (replacePayload) {
      setReplacementForId(replacePayload.id);
      setReplacementForType(replacePayload.type);
      setAddType(replacePayload.type);
      setShowAddForm(true);
    }
    setReplaceModalOpen(false);
    setReplacePayload(null);
  };

  const startEdit = (s: StaffMember) => {
    setEditPayload(s);
    setEditModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="search"
            name="staff-search"
            autoComplete="off"
            placeholder="Search by email, occupation, name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0066cc] text-white text-sm font-medium rounded-lg hover:bg-[#0052a3] shrink-0"
        >
          <UserPlus size={18} />
          Add staff
        </button>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading staff...</p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
      )}

      {/* Add staff modal */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => { if (!inviteLoading) setShowAddForm(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-staff-title"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 id="add-staff-title" className="text-lg font-semibold text-gray-800 dark:text-gray-200">Invite staff</h3>
              <button
                type="button"
                onClick={() => { if (!inviteLoading) setShowAddForm(false); }}
                disabled={inviteLoading}
                className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter email and occupation. An invitation email will be sent with a private signup link where they complete their profile.
              </p>
              <div>
                <label htmlFor="add-staff-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  ref={addEmailInputRef}
                  id="add-staff-email"
                  type="email"
                  autoComplete="off"
                  placeholder="Email address to send invitation"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  disabled={inviteLoading}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Occupation</label>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value as StaffType)}
                  disabled={inviteLoading}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {STAFF_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {!canAdd && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Only one {addType.toLowerCase()} allowed. Delete the current one to add a new.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => { if (!inviteLoading) setShowAddForm(false); }}
                disabled={inviteLoading}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={inviteLoading || !canAdd || !addEmail.trim()}
                className="px-4 py-2 bg-[#0066cc] text-white text-sm font-medium rounded-lg hover:bg-[#0052a3] disabled:opacity-50 inline-flex items-center gap-2"
              >
                {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                {inviteLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeletePayload(null); setDeleteError(null); }}
        title="Delete staff member?"
        message="This action cannot be undone. The staff member will be removed from the system."
        itemName={deletePayload?.name}
        error={deleteError}
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Delete"
      />

      <ReplaceFirstModal
        open={replaceModalOpen}
        onClose={() => { setReplaceModalOpen(false); setReplacePayload(null); }}
        staffType={replacePayload?.type === "Laboratorian" ? "Laboratorian" : "Receptionist"}
        onAddClick={handleReplaceAddClick}
      />

      <MessageModal
        open={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        title={messageModalTitle}
        message={messageModalMessage}
        variant={messageModalVariant}
      />

      <EditStaffModal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditPayload(null); }}
        staff={editPayload}
        onSave={handleEditSave}
        onError={(msg) => {
          setMessageModalVariant("error");
          setMessageModalTitle("Error");
          setMessageModalMessage(msg);
          setMessageModalOpen(true);
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedStaff.map((s) => (
            <div
              key={s.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Profile header: role + name */}
              <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-2 flex-wrap">
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${typeColor(s.type)}`}>
                  {s.type}
                </span>
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate min-w-0">
                  {s.name ?? "Pending signup"}
                </h3>
              </div>

              {/* Details: label left, value right */}
              <div className="px-5 pb-4 flex-1 min-w-0">
                <div className="grid grid-cols-[minmax(0,6rem)_1fr] gap-y-1.5 gap-x-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">Email</span>
                  <span className="text-gray-800 dark:text-gray-200 truncate" title={s.email}>{s.email}</span>

                  {s.age != null && (
                    <>
                      <span className="text-gray-500 dark:text-gray-400 shrink-0">Age</span>
                      <span className="text-gray-800 dark:text-gray-200">{s.age}{s.gender ? ` · ${s.gender}` : ""}</span>
                    </>
                  )}
                  {s.phone && (
                    <>
                      <span className="text-gray-500 dark:text-gray-400 shrink-0">Phone</span>
                      <span className="text-gray-800 dark:text-gray-200 truncate" title={s.phone}>{s.phone}</span>
                    </>
                  )}
                  {s.department && (
                    <>
                      <span className="text-gray-500 dark:text-gray-400 shrink-0">Dept</span>
                      <span className="text-gray-800 dark:text-gray-200">{s.department}</span>
                    </>
                  )}
                  {(s.type === "Doctor" || s.type === "Nurse") && (
                    <>
                      <span className="text-gray-500 dark:text-gray-400 shrink-0">Patients</span>
                      <span className="text-gray-800 dark:text-gray-200">{s.activePatients ?? 0} active</span>
                    </>
                  )}
                  {s.address && (
                    <>
                      <span className="text-gray-500 dark:text-gray-400 shrink-0 pt-0.5">Address</span>
                      <span className="text-gray-800 dark:text-gray-200 line-clamp-2" title={s.address}>{s.address}</span>
                    </>
                  )}
                </div>
                {!s.name && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Invitation sent; signup pending</p>
                )}
              </div>

              {/* Actions inside card */}
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(s)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-[#0066cc] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700"
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(s.id, s.type, s.name ?? s.email)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center py-12 text-gray-500 dark:text-gray-400">No staff match your search.</p>
      )}

      {filtered.length > 0 && totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {(page - 1) * STAFF_PER_PAGE + 1}–{Math.min(page * STAFF_PER_PAGE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PatientsTab() {
  const [patients, setPatients] = useState<PatientCard[]>(MOCK_PATIENTS);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePayload, setDeletePayload] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const patientsTabAlive = useRef(true);

  useEffect(() => {
    patientsTabAlive.current = true;
    return () => {
      patientsTabAlive.current = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.contact.includes(s) ||
        p.address?.toLowerCase().includes(s) ||
        p.id.toLowerCase().includes(s) ||
        p.gender.toLowerCase().includes(s)
    );
  }, [patients, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const fetchPatients = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/user-management/patients`);
      if (!res.ok) {
        throw new Error("Failed to load patients");
      }
      const data: BackendPatient[] = await res.json();
      if (!patientsTabAlive.current) return;
      const mapped: PatientCard[] = data.map((p) => ({
        id: String(p.id),
        name: p.name,
        age: p.age,
        gender: p.gender,
        contact: p.contact ?? "",
        address: p.address ?? undefined,
      }));
      setPatients(mapped);
    } catch (err) {
      console.error("Failed to load patients", err);
      if (patientsTabAlive.current) {
        setError("Failed to load patients from server.");
      }
    } finally {
      if (patientsTabAlive.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useRealtimeEvent(ADMIN_DASHBOARD_REALTIME_EVENTS, fetchPatients);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PATIENTS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginatedPatients = useMemo(() => {
    const start = (page - 1) * PATIENTS_PER_PAGE;
    return filtered.slice(start, start + PATIENTS_PER_PAGE);
  }, [filtered, page]);

  const handleDeleteClick = (id: string, name: string) => {
    setDeletePayload({ id, name });
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletePayload) return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/user-management/patients/${deletePayload.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Failed to delete patient");
      }
      setPatients((prev) => prev.filter((p) => p.id !== deletePayload.id));
      setDeleteModalOpen(false);
      setDeletePayload(null);
    } catch (err) {
      console.error("Failed to delete patient", err);
      setDeleteError(err instanceof Error ? err.message : "Failed to delete patient.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeletePayload(null); setDeleteError(null); }}
        title="Delete patient?"
        message="This action cannot be undone. The patient and their related records will be removed from the system."
        itemName={deletePayload?.name}
        error={deleteError}
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Delete"
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search patients by name, ID, contact, address, gender..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
        />
      </div>

      {isLoading && patients.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading patients...</p>
      )}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedPatients.map((p) => (
          <div
            key={p.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{p.id}</p>
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{p.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{p.gender} · {p.age} yrs</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 truncate" title={p.contact}>{p.contact}</p>
                {p.address && (
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5 truncate" title={p.address}>{p.address}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteClick(p.id, p.name)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg shrink-0"
                title="Delete patient"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center py-12 text-gray-500 dark:text-gray-400">No patients match your search.</p>
      )}

      {filtered.length > 0 && totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {(page - 1) * PATIENTS_PER_PAGE + 1}–{Math.min(page * PATIENTS_PER_PAGE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
