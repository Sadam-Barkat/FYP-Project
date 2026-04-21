"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserCircle } from "lucide-react";

export default function NavbarProfileButton() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const profile = useMemo(() => {
    if (typeof window === "undefined") return { role: "", name: "", email: "" };
    const role = sessionStorage.getItem("userRole") ?? localStorage.getItem("userRole") ?? "";
    const name = sessionStorage.getItem("userName") ?? localStorage.getItem("userName") ?? "";
    const email = sessionStorage.getItem("userEmail") ?? localStorage.getItem("userEmail") ?? "";
    return { role, name, email };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && rootRef.current && !rootRef.current.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const roleLabel =
    profile.role === "admin"
      ? "Admin"
      : profile.role === "doctor"
        ? "Doctor"
        : profile.role === "nurse"
          ? "Nurse"
          : profile.role === "finance"
            ? "Finance"
            : profile.role === "laboratorian"
              ? "Laboratorian"
              : profile.role === "receptionist"
                ? "Receptionist"
                : profile.role || "—";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-50 text-gray-600 shadow-sm ring-1 ring-gray-200/50 transition-all duration-300 hover:bg-white hover:text-blue-600 hover:shadow-md hover:ring-blue-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700/50 dark:hover:bg-gray-700 dark:hover:text-blue-400 dark:hover:ring-blue-500/30"
        aria-label="Open profile"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-50 to-indigo-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-blue-900/20 dark:to-indigo-900/20" />
        <UserCircle size={20} className="relative z-10 transition-transform duration-300 group-hover:scale-110" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profile menu"
          className="absolute right-0 top-full z-50 mt-3 w-[min(22rem,86vw)] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Profile</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Signed-in account details</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Close
            </button>
          </div>

          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Role</p>
              <p className="text-gray-900 dark:text-gray-100 mt-0.5">{roleLabel}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Name</p>
              <p className="text-gray-900 dark:text-gray-100 mt-0.5">{profile.name || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Email</p>
              <p className="text-gray-900 dark:text-gray-100 mt-0.5 break-all">{profile.email || "—"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
