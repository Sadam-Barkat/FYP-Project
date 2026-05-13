"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <Link 
      href="/login?logout=1"
      aria-label="Log out"
      className="group relative flex h-9 shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-xl bg-red-600 px-2.5 py-0 text-[13px] font-bold leading-none text-white shadow-[0_2px_8px_rgba(220,38,38,0.2)] transition-all duration-300 hover:bg-red-700 sm:px-4 dark:bg-btn-danger dark:text-text-bright dark:shadow-card-red dark:hover:scale-[1.02] dark:hover:shadow-glow-red"
      onClick={() => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("userRole");
          localStorage.removeItem("access_token");
          localStorage.removeItem("userName");
          localStorage.removeItem("userEmail");
          localStorage.removeItem("userId");
          sessionStorage.removeItem("access_token");
          sessionStorage.removeItem("userRole");
          sessionStorage.removeItem("userName");
          sessionStorage.removeItem("userEmail");
          sessionStorage.removeItem("userId");

          // Clear auth cookies used by middleware/proxy
          document.cookie = "access_token=; Path=/; Max-Age=0";
          document.cookie = "userRole=; Path=/; Max-Age=0";
        }
      }}
    >
      <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <LogOut size={15} className="mr-1.5 transition-transform duration-300 group-hover:translate-x-0.5" />
      <span>Logout</span>
    </Link>
  );
}
