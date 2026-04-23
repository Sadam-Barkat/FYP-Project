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
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-base-border bg-base-card text-text-secondary shadow-card transition-all duration-200 hover:bg-base-hover hover:text-text-bright hover:-translate-y-0.5"
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
            className="fixed inset-y-0 left-0 z-[70] flex w-[min(18rem,88vw)] flex-col border-r border-base-border bg-base-card/85 shadow-nav backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
          >
            <div className="flex h-14 items-center justify-between border-b border-base-border px-4 bg-base-muted/30">
              <span className="text-sm font-semibold text-text-bright">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary hover:bg-base-hover hover:text-text-bright transition-colors duration-150"
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
                        ? "border-brand-blue bg-brand-blue/10 text-text-bright"
                        : "border-transparent text-text-secondary hover:bg-base-hover hover:text-text-bright"
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
