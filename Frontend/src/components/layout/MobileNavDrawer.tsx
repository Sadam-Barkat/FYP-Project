"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { getMobileNavItems } from "@/config/dashboard-nav";

export default function MobileNavDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("admin");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let storedRole = sessionStorage.getItem("userRole");
    if (!storedRole) {
      storedRole = localStorage.getItem("userRole");
      if (storedRole) sessionStorage.setItem("userRole", storedRole);
    }
    if (storedRole) setRole(storedRole);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const items = getMobileNavItems(role, pathname ?? "");

  return (
    <div className="md:hidden shrink-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/50"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav-drawer"
            className="fixed inset-y-0 left-0 z-[70] flex w-[min(18rem,88vw)] flex-col border-r border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
          >
            <div className="flex h-14 items-center justify-between border-b border-gray-100 px-4 dark:border-gray-800">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3">
              {items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (pathname?.startsWith(item.href + "/") && item.href !== "/admin");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 border-l-4 px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-[#0066cc] bg-[#e6f2ff] text-[#0066cc] dark:border-[#60a5fa] dark:bg-[#1e3a8a] dark:text-[#60a5fa]"
                        : "border-transparent text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Icon size={20} className="shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
