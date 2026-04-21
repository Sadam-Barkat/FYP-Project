"use client";

import { useState } from "react";
import { UserCircle } from "lucide-react";
import ProfileModal from "./ProfileModal";

export default function NavbarProfileButton() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-50 text-gray-600 shadow-sm ring-1 ring-gray-200/50 transition-all duration-300 hover:bg-white hover:text-blue-600 hover:shadow-md hover:ring-blue-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700/50 dark:hover:bg-gray-700 dark:hover:text-blue-400 dark:hover:ring-blue-500/30"
        aria-label="Open profile"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-50 to-indigo-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-blue-900/20 dark:to-indigo-900/20" />
        <UserCircle size={20} className="relative z-10 transition-transform duration-300 group-hover:scale-110" />
      </button>
      <ProfileModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
