"use client";

import Link from "next/link";

export default function LogoutButton() {
  return (
    <Link 
      href="/login" 
      className="bg-[#ef4444] hover:bg-red-600 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm inline-flex items-center"
      onClick={() => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("userRole");
          localStorage.removeItem("access_token");

          // Clear auth cookies used by middleware/proxy
          document.cookie = "access_token=; Path=/; Max-Age=0";
          document.cookie = "userRole=; Path=/; Max-Age=0";
        }
      }}
    >
      Logout
    </Link>
  );
}