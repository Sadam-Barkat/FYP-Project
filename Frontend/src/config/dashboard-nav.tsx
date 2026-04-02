import type { LucideIcon } from "lucide-react";
import {
  Home,
  BedSingle,
  Pill,
  TestTube2,
  DollarSign,
  Users,
  Bell,
  LineChart,
  Activity,
  UserCog,
} from "lucide-react";

/** Shared navigation config for sidebar (admin) and mobile drawer (all roles). */
export type DashboardNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

export const ADMIN_NAV_ITEMS: DashboardNavItem[] = [
  { name: "Dashboard", href: "/admin", icon: Home },
  { name: "Patients & Beds", href: "/admin/patients-beds", icon: BedSingle },
  { name: "Pharmacy", href: "/admin/pharmacy", icon: Pill },
  { name: "Laboratory", href: "/admin/laboratory", icon: TestTube2 },
  { name: "Billing & Finance", href: "/admin/billing-finance", icon: DollarSign },
  { name: "HR & Staff", href: "/admin/hr-staff", icon: Users },
  { name: "Alerts & Monitoring", href: "/admin/alerts", icon: Bell },
  { name: "Analytics & Forecasts", href: "/admin/analytics", icon: LineChart },
  { name: "User Management", href: "/admin/user-management", icon: UserCog },
];

export const DOCTOR_NAV_ITEMS: DashboardNavItem[] = [
  { name: "My Patients", href: "/doctor", icon: Users },
  { name: "My Analytics", href: "/doctor/analytics", icon: LineChart },
  { name: "Alerts", href: "/doctor/alerts", icon: Bell },
];

export const NURSE_NAV_ITEMS: DashboardNavItem[] = [
  { name: "Vitals Entry", href: "/nurse", icon: Activity },
  { name: "My Ward", href: "/nurse/ward", icon: BedSingle },
];

export const RECEPTION_NAV_ITEMS: DashboardNavItem[] = [
  { name: "Reception Desk", href: "/reception", icon: Home },
];

export const LAB_NAV_ITEMS: DashboardNavItem[] = [
  { name: "Laboratory Entry", href: "/laboratory-entry", icon: TestTube2 },
];

/** Same route visibility rules as the desktop sidebar: admin sees full admin nav on md+. */
export function shouldShowAdminSidebar(role: string, pathname: string): boolean {
  if (role === "doctor" || pathname.startsWith("/doctor")) return false;
  if (role === "nurse" || pathname.startsWith("/nurse")) return false;
  if (role === "receptionist" || pathname.startsWith("/reception")) return false;
  if (role === "laboratorian" || pathname.startsWith("/laboratory-entry")) return false;
  return true;
}

export function getMobileNavItems(role: string, pathname: string): DashboardNavItem[] {
  if (role === "doctor" || pathname.startsWith("/doctor")) return DOCTOR_NAV_ITEMS;
  if (role === "nurse" || pathname.startsWith("/nurse")) return NURSE_NAV_ITEMS;
  if (role === "receptionist" || pathname.startsWith("/reception")) return RECEPTION_NAV_ITEMS;
  if (role === "laboratorian" || pathname.startsWith("/laboratory-entry")) return LAB_NAV_ITEMS;
  return ADMIN_NAV_ITEMS;
}
