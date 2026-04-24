"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";

type NavItem = { label: string; href: string };

const ADMIN_TOP_NAV: NavItem[] = [
  { label: "Overview", href: "/admin" },
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
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-dash-border dark:bg-dash-surface">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-6">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-kpi-blue to-kpi-purple flex items-center justify-center flex-shrink-0">
            <Activity className="text-white w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <p className="text-kpi-blue font-bold text-lg leading-tight tracking-tight">
              Intelligent Dashboard
            </p>
            <div className="flex items-center gap-2">
              <p className="text-gray-600 text-xs dark:text-tx-secondary">Real-time Operations</p>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-green opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-kpi-green" />
                </span>
                <span className="text-kpi-green text-xs font-semibold">Live</span>
              </div>
            </div>
          </div>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex" aria-label="Top navigation">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "relative px-5 py-2 text-gray-900 text-sm font-semibold dark:text-tx-bright"
                    : "px-5 py-2 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors duration-200 dark:text-tx-secondary dark:hover:text-tx-primary"
                }
              >
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-kpi-blue rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">{rightSlot}</div>
      </div>
    </header>
  );
}
