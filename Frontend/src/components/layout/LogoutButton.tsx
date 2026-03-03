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
        }
      }}
    >
      Logout
    </Link>
  );
}