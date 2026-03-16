"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function HeaderTitle() {
  const pathname = usePathname();
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

  let title = "Admin Dashboard";
  if (role === "doctor" || pathname.startsWith("/doctor")) {
    title = "Doctor Dashboard";
  } else if (role === "nurse" || pathname.startsWith("/nurse")) {
    title = "Nurse Dashboard";
  } else if (role === "laboratorian" || pathname.startsWith("/laboratory-entry")) {
    title = "Laboratorian Dashboard";
  } else if (role === "receptionist" || pathname.startsWith("/reception")) {
    title = "Receptionist Dashboard";
  }

  return (
    <h1 className="text-xl font-semibold text-[#0066cc] dark:text-[#60a5fa] transition-colors">
      {title}
    </h1>
  );
}
