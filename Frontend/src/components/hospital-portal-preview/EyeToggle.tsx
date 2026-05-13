"use client";

import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

type EyeToggleProps = {
  visible: boolean;
  onToggle: () => void;
};

export function EyeToggle({ visible, onToggle }: EyeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-[#00e5ff] transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
      aria-label={visible ? "Hide password" : "Show password"}
    >
      {visible ? (
        <EyeSlashIcon className="h-5 w-5" aria-hidden />
      ) : (
        <EyeIcon className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
