"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function HeaderTitle() {
  const pathname = usePathname();
  const [role, setRole] = useState("admin");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem("userRole");
      if (storedRole) setRole(storedRole);
    }
  }, []);

  let title = "Admin Dashboard";
  if (role === "doctor" || pathname.startsWith("/doctor")) {
    title = "Doctor Dashboard";
  } else if (role === "nurse" || pathname.startsWith("/nurse")) {
    title = "Nurse Dashboard";
  }

  return (
    <h1 className="text-xl font-semibold text-[#0066cc]">
      {title}
    </h1>
  );
}
