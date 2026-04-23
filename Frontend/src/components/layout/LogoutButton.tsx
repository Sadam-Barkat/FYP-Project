"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <Link 
      href="/login" 
      className="group relative flex items-center justify-center overflow-hidden rounded-xl bg-btn-danger px-4 py-2 text-[13px] font-bold text-text-bright shadow-card-red transition-all duration-300 hover:scale-[1.02] hover:shadow-glow-red"
      onClick={() => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("userRole");
          localStorage.removeItem("access_token");
          localStorage.removeItem("userName");
          localStorage.removeItem("userEmail");
          sessionStorage.removeItem("access_token");
          sessionStorage.removeItem("userRole");
          sessionStorage.removeItem("userName");
          sessionStorage.removeItem("userEmail");

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
