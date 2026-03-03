"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  Home, BedSingle, Pill, TestTube2, DollarSign, 
  Users, Bell, LineChart, Menu, Activity
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState("admin");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem("userRole");
      if (storedRole) setRole(storedRole);
    }
  }, []);

  const adminNavItems = [
    { name: "Dashboard", href: "/admin", icon: Home },
    { name: "Patients & Beds", href: "/admin/patients-beds", icon: BedSingle },
    { name: "Pharmacy", href: "/admin/pharmacy", icon: Pill },
    { name: "Laboratory", href: "/admin/laboratory", icon: TestTube2 },
    { name: "Billing & Finance", href: "/admin/billing-finance", icon: DollarSign },
    { name: "HR & Staff", href: "/admin/hr-staff", icon: Users },
    { name: "Alerts & Monitoring", href: "/admin/alerts", icon: Bell },
    { name: "Analytics & Forecasts", href: "/admin/analytics", icon: LineChart },
  ];

  const doctorNavItems = [
    { name: "My Patients", href: "/doctor", icon: Users },
    { name: "My Analytics", href: "/doctor/analytics", icon: LineChart },
    { name: "Alerts", href: "/doctor/alerts", icon: Bell },
  ];

  const nurseNavItems = [
    { name: "Vitals Entry", href: "/nurse", icon: Activity },
    { name: "My Ward", href: "/nurse/ward", icon: BedSingle },
  ];

  const navItems = role === "doctor" ? doctorNavItems : role === "nurse" ? nurseNavItems : adminNavItems;

  // Hide the entire sidebar for the Doctor role or if on a doctor route
  if (role === "doctor" || pathname.startsWith("/doctor")) {
    return null;
  }

  return (
    <aside
      className={`bg-white flex flex-col border-r border-gray-200 hidden md:flex shrink-0 transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Hamburger Menu Area */}
      <div className="h-16 flex items-center justify-center border-b border-gray-100">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="p-2 text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
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
                  ? "bg-[#e6f2ff] text-[#0066cc] border-[#0066cc]" 
                  : "text-gray-700 hover:bg-gray-50 border-transparent hover:border-gray-300"
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
