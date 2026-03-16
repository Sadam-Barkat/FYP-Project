"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function ProfileModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      let r = sessionStorage.getItem("userRole");
      if (!r) {
        r = localStorage.getItem("userRole");
        if (r) sessionStorage.setItem("userRole", r);
      }
      let n = sessionStorage.getItem("userName");
      if (!n) {
        n = localStorage.getItem("userName");
        if (n) sessionStorage.setItem("userName", n);
      }
      let e = sessionStorage.getItem("userEmail");
      if (!e) {
        e = localStorage.getItem("userEmail");
        if (e) sessionStorage.setItem("userEmail", e);
      }
      setRole(r ?? "");
      setName(n ?? "");
      setEmail(e ?? "");
    }
  }, [open]);

  const roleLabel =
    role === "admin"
      ? "Admin"
      : role === "doctor"
        ? "Doctor"
        : role === "nurse"
          ? "Nurse"
          : role === "laboratorian"
            ? "Laboratorian"
            : role === "receptionist"
              ? "Receptionist"
              : role;

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Profile
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Blank profile circle (no image, circle kept) */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500">
            {/* Empty circle - no image */}
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Role</p>
            <p className="text-gray-800 dark:text-gray-100 mt-0.5">{roleLabel}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Name</p>
            <p className="text-gray-800 dark:text-gray-100 mt-0.5">
              {name || "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Email</p>
            <p className="text-gray-800 dark:text-gray-100 mt-0.5 break-all">
              {email || "—"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
