"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, BedSingle, Pill, TestTube2, DollarSign, 
  Users, Bell, LineChart, Menu 
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/admin", icon: Home },
    { name: "Patients & Beds", href: "/admin/patients-beds", icon: BedSingle },
    { name: "Pharmacy", href: "/admin/pharmacy", icon: Pill },
    { name: "Laboratory", href: "/admin/laboratory", icon: TestTube2 },
    { name: "Billing & Finance", href: "/admin/billing-finance", icon: DollarSign },
    { name: "HR & Staff", href: "/admin/hr-staff", icon: Users },
    { name: "Alerts & Monitoring", href: "/admin/alerts", icon: Bell },
    { name: "Analytics & Forecasts", href: "/admin/analytics", icon: LineChart },
  ];

  return (
    <aside className="w-64 bg-white flex flex-col border-r border-gray-200 hidden md:flex shrink-0">
      {/* Hamburger Menu Area */}
      <div className="h-16 flex items-center justify-center border-b border-gray-100">
        <button className="p-2 text-gray-800 hover:bg-gray-100 rounded-md">
          <Menu size={24} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
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
              <Icon size={20} className="mr-4" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
