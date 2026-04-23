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
    <header className="z-20 w-full border-b border-base-border/80 bg-base-card/70 shadow-nav backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-4 px-4 lg:px-6">
        <Link href="/admin" className="flex shrink-0 items-center gap-3 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-btn-primary text-white shadow-glow-blue transition-transform duration-300 group-hover:scale-105">
            <Activity size={20} strokeWidth={2.5} />
            <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </div>
          <div className="hidden sm:block">
            <p className="bg-gradient-to-r from-brand-blue via-brand-indigo to-brand-purple bg-clip-text text-[15px] font-bold tracking-tight text-transparent">
              Intelligent Dashboard
            </p>
            <p className="text-[11px] font-medium text-text-secondary">Real-time Operations</p>
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
                    ? "bg-brand-blue/10 text-text-bright shadow-card"
                    : "text-text-secondary hover:bg-base-hover hover:text-text-bright",
                ].join(" ")}
              >
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-t-full bg-brand-blue shadow-glow-blue" />
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
