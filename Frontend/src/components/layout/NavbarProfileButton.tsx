"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserCircle } from "lucide-react";

export default function NavbarProfileButton() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );

  const profile = useMemo(() => {
    if (typeof window === "undefined") return { role: "", name: "", email: "" };
    const role = sessionStorage.getItem("userRole") ?? localStorage.getItem("userRole") ?? "";
    const name = sessionStorage.getItem("userName") ?? localStorage.getItem("userName") ?? "";
    const email = sessionStorage.getItem("userEmail") ?? localStorage.getItem("userEmail") ?? "";
    return { role, name, email };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const place = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const menuWidth = Math.min(352, Math.round(window.innerWidth * 0.86)); // matches w-[min(22rem,86vw)]
      const gap = 10;
      const top = Math.round(r.bottom + gap);
      // Right-align to the button, but clamp into viewport with 8px padding.
      const pad = 8;
      const desiredLeft = Math.round(r.right - menuWidth);
      const left = Math.max(pad, Math.min(desiredLeft, window.innerWidth - menuWidth - pad));
      setMenuPos({ top, left });
    };

    place();

    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && rootRef.current && !rootRef.current.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReflow = () => place();

    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
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
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-slate-500 transition-all duration-300 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 dark:bg-base-muted dark:text-text-secondary dark:shadow-card dark:ring-base-border/60 dark:hover:bg-base-hover dark:hover:text-text-bright dark:hover:shadow-glow-blue dark:hover:ring-brand-blue/30"
        aria-label="Open profile"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="absolute inset-0 bg-btn-primary opacity-0 transition-opacity duration-300 group-hover:opacity-15" />
        <UserCircle size={20} className="relative z-10 transition-transform duration-300 group-hover:scale-110" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profile menu"
          className="fixed z-50 w-[min(22rem,86vw)] rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur-md dark:border-base-border dark:bg-base-card/80 dark:shadow-nav"
          style={
            menuPos
              ? { top: menuPos.top, left: menuPos.left }
              : { top: 80, left: 8 }
          }
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-base-border">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-text-bright">Profile</p>
              <p className="text-xs text-gray-600 dark:text-text-secondary">Signed-in account details</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 dark:text-text-secondary dark:hover:bg-base-hover dark:hover:text-text-bright"
            >
              Close
            </button>
          </div>

          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="text-gray-600 font-medium dark:text-text-secondary">Role</p>
              <p className="text-gray-900 mt-0.5 dark:text-text-bright">{roleLabel}</p>
            </div>
            <div>
              <p className="text-gray-600 font-medium dark:text-text-secondary">Name</p>
              <p className="text-gray-900 mt-0.5 dark:text-text-bright">{profile.name || "—"}</p>
            </div>
            <div>
              <p className="text-gray-600 font-medium dark:text-text-secondary">Email</p>
              <p className="text-gray-900 mt-0.5 break-all dark:text-text-bright">{profile.email || "—"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
