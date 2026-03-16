"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

/**
 * Notification icon: shown only for doctors. Hidden for admin, nurse, laboratorian, receptionist.
 */
export default function NavbarNotificationButton() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let role = sessionStorage.getItem("userRole");
    if (!role) {
      role = localStorage.getItem("userRole");
      if (role) sessionStorage.setItem("userRole", role);
    }
    const isDoctor = role === "doctor" || pathname?.startsWith("/doctor");
    setShow(!!isDoctor);
  }, [pathname]);

  if (!show) return null;

  return (
    <button
      type="button"
      className="hover:text-[#0066cc] dark:hover:text-[#60a5fa]"
      aria-label="Notifications"
    >
      <Bell size={20} />
    </button>
  );
}
