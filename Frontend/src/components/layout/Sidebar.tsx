"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { ADMIN_NAV_ITEMS, FINANCE_NAV_ITEMS, shouldShowAdminSidebar } from "@/config/dashboard-nav";

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

  const navItems = role === "finance" ? FINANCE_NAV_ITEMS : ADMIN_NAV_ITEMS;

  if (!shouldShowAdminSidebar(role, pathname)) {
    return null;
  }

  return (
    <aside
      className={`bg-white dark:bg-gray-900 flex flex-col border-r border-gray-200 dark:border-gray-800 hidden md:flex shrink-0 transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Hamburger Menu Area */}
      <div className="h-16 flex items-center justify-center border-b border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="p-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/admin');
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={`flex items-center px-6 py-3 border-l-4 transition-colors ${
                isActive 
                  ? "bg-[#e6f2ff] dark:bg-[#1e3a8a] text-[#0066cc] dark:text-[#60a5fa] border-[#0066cc] dark:border-[#60a5fa]" 
                  : "text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent hover:border-gray-300 dark:hover:border-gray-700"
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
