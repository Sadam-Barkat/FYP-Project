"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type NavItem = { label: string; href: string };

const ADMIN_TOP_NAV: NavItem[] = [
  { label: "Overview", href: "/admin" },
  { label: "Operations", href: "/admin/patients-beds" },
  { label: "Finance", href: "/admin/billing-finance" },
  { label: "HR", href: "/admin/hr-staff" },
  { label: "Alerts", href: "/admin/alerts" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "AI Copilot", href: "/admin/ops-copilot" },
  { label: "User Management", href: "/admin/staff" },
];

function isActivePath(path: string, href: string): boolean {
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(href + "/");
}

export default function TopNavBar({
  rightSlot,
}: {
  rightSlot?: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [role, setRole] = useState<string>("admin");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const r = sessionStorage.getItem("userRole") ?? localStorage.getItem("userRole") ?? "admin";
    setRole(r);
  }, []);

  const items = useMemo(() => {
    if (pathname.startsWith("/admin") || role === "admin" || role === "finance") return ADMIN_TOP_NAV;
    return [];
  }, [pathname, role]);

  return (
    <header className="z-20 w-full border-b border-gray-200 bg-white/90 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/75">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 lg:px-6">
        <Link href="/admin" className="flex shrink-0 items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f2ff] text-[#0066cc] dark:bg-[#0b2a52] dark:text-[#60a5fa]">
            HC
          </span>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Hospital Command Center</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Intelligent operational overview</p>
          </div>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex" aria-label="Top navigation">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#e6f2ff] text-[#0066cc] dark:bg-[#0b2a52] dark:text-[#60a5fa]"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">{rightSlot}</div>
      </div>
    </header>
  );
}

