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
        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 hover:text-[#0066cc] dark:hover:text-[#60a5fa] transition-colors"
        aria-label="Open profile"
      >
        {/* Blank circle: keep icon outline, no profile image */}
        <UserCircle size={24} />
      </button>
      <ProfileModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
