"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function HeaderTitle() {
  const pathname = usePathname();
  const [role, setRole] = useState("admin");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let storedRole = sessionStorage.getItem("userRole");
    if (!storedRole) {
      storedRole = localStorage.getItem("userRole");
      if (storedRole) sessionStorage.setItem("userRole", storedRole);
    }
    if (storedRole) setRole(storedRole);
  }, []);

  const path = pathname ?? "";

  // Pathname first so billing route always shows correctly (admin or finance), including first paint.
  let title = "Admin Dashboard";
  if (path.startsWith("/admin/billing-finance/analytics")) {
    title = "Billing analytics";
  } else if (path.startsWith("/admin/billing-finance")) {
    title = "Billing & Finance";
  } else if (path.startsWith("/admin/ops-copilot")) {
    title = "AI Hospital Ops Copilot";
  } else if (role === "doctor" || path.startsWith("/doctor")) {
    title = "Doctor Dashboard";
  } else if (role === "nurse" || path.startsWith("/nurse")) {
    title = "Nurse Dashboard";
  } else if (role === "laboratorian" || path.startsWith("/laboratory-entry")) {
    title = "Laboratorian Dashboard";
  } else if (role === "receptionist" || path.startsWith("/reception")) {
    title = "Receptionist Dashboard";
  } else if (role === "finance") {
    title = "Billing & Finance";
  }

  return (
    <h1 className="min-w-0 truncate text-base font-semibold text-[#0066cc] transition-colors dark:text-[#60a5fa] sm:text-lg md:text-xl">
      {title}
    </h1>
  );
}
