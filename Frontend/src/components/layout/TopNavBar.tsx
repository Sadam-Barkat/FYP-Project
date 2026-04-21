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
    <header className="z-20 w-full border-b border-gray-200/80 bg-white/80 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-900/80">
      <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-4 px-4 lg:px-6">
        <Link href="/admin" className="flex shrink-0 items-center gap-3 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 transition-transform duration-300 group-hover:scale-105">
            <Activity size={20} strokeWidth={2.5} />
            <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </div>
          <div className="hidden sm:block">
            <p className="bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 bg-clip-text text-[15px] font-bold tracking-tight text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
              Intelligent Dashboard
            </p>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Real-time Operations</p>
          </div>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1.5 lg:flex ml-4" aria-label="Top navigation">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "relative rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-all duration-300",
                  active
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm dark:from-blue-900/40 dark:to-indigo-900/40 dark:text-blue-300"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:text-white",
                ].join(" ")}
              >
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-t-full bg-blue-600 dark:bg-blue-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">{rightSlot}</div>
      </div>
    </header>
  );
}
