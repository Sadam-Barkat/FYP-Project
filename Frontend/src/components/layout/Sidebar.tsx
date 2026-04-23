"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { ADMIN_NAV_ITEMS, shouldShowAdminSidebar } from "@/config/dashboard-nav";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState("admin");

  useEffect(() => {
    if (typeof window !== "undefined") {
      let storedRole = sessionStorage.getItem("userRole");
      if (!storedRole) {
        storedRole = localStorage.getItem("userRole");
        if (storedRole) sessionStorage.setItem("userRole", storedRole);
      }
      if (storedRole) setRole(storedRole);
    }
  }, []);

  const navItems = ADMIN_NAV_ITEMS;
  const path = pathname ?? "";

  if (!shouldShowAdminSidebar(role, path)) {
    return null;
  }

  return (
    <aside
      className={`bg-base-card/80 flex flex-col border-r border-base-border hidden md:flex shrink-0 transition-all duration-300 backdrop-blur-md shadow-nav ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Hamburger Menu Area */}
      <div className="h-16 flex items-center justify-center border-b border-base-border bg-base-muted/20">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="p-2 text-text-secondary hover:text-text-bright hover:bg-base-hover rounded-xl transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            path === item.href || (path.startsWith(item.href + "/") && item.href !== "/admin");
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={`flex items-center px-6 py-3 border-l-4 transition-colors ${
                isActive 
                  ? "bg-brand-blue/10 text-text-bright border-brand-blue" 
                  : "text-text-secondary hover:bg-base-hover hover:text-text-bright border-transparent hover:border-base-border"
              }`}
            >
              <Icon size={20} className={collapsed ? "" : "mr-4"} />
              {!collapsed && <span className="font-medium">{item.name}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
