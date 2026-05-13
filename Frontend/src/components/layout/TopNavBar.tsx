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

/** Finance role only sees billing; other /admin links redirect away from this layout. */
const FINANCE_TOP_NAV: NavItem[] = [
  { label: "Billing workspace", href: "/admin/billing-finance" },
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
    if (role === "finance") return FINANCE_TOP_NAV;
    if (pathname.startsWith("/admin") || role === "admin") return ADMIN_TOP_NAV;
    return [];
  }, [pathname, role]);

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:border-dash-border dark:bg-dash-surface">
      {/*
        Flex + flex-1 spacer (matches target layout): brand + links stay left; clock + actions
        pack the right edge with all leftover horizontal space between nav and utilities.
      */}
      <div className="mx-auto flex h-16 max-w-[1600px] min-w-0 items-center gap-2 px-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] sm:gap-4 sm:px-6">
        <Link
          href="/admin"
          className="flex min-w-0 max-w-[min(100%,220px)] shrink items-center gap-2.5 sm:max-w-[min(100%,300px)] sm:gap-3 lg:max-w-[min(100%,340px)]"
        >
          <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-kpi-blue to-kpi-purple flex items-center justify-center">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-base font-bold leading-tight tracking-tight text-blue-600 sm:text-lg dark:text-kpi-blue">
              Intelligent Dashboard
            </p>
            <div className="hidden min-w-0 items-center gap-1.5 xs:flex sm:gap-2">
              <p className="truncate text-[10px] text-slate-500 xs:text-xs dark:text-tx-secondary">
                Real-time Operations
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-kpi-green opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-kpi-green" />
                </span>
                <span className="whitespace-nowrap text-[10px] font-semibold text-green-600 xs:text-xs dark:text-kpi-green">
                  Live
                </span>
              </div>
            </div>
          </div>
        </Link>

        <nav
          className="relative z-20 hidden shrink-0 items-center gap-0.5 md:ml-4 md:flex lg:ml-8 xl:ml-12 pointer-events-auto"
          aria-label="Top navigation"
        >
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={
                  active
                    ? "relative whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900 sm:px-5 dark:text-tx-bright"
                    : "whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-900 sm:px-5 dark:text-tx-primary dark:hover:text-tx-bright"
                }
              >
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 dark:bg-kpi-blue" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Absorbs free width so utilities sit on the far right with a clear gap after nav */}
        <div className="min-h-0 min-w-8 flex-1 basis-0 shrink sm:min-w-12" aria-hidden />

        <div className="relative z-10 flex shrink-0 flex-nowrap items-center gap-2 sm:gap-3 [&>*]:shrink-0">
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
