"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button 
      onClick={toggleTheme}
      className="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white text-gray-700 shadow-sm ring-1 ring-gray-200 transition-all duration-300 hover:bg-gray-50 hover:text-gray-900 dark:bg-base-muted dark:text-text-secondary dark:shadow-card dark:ring-base-border/60 dark:hover:bg-base-hover dark:hover:text-text-bright dark:hover:shadow-glow-blue dark:hover:ring-brand-blue/30"
      aria-label="Toggle dark mode"
    >
      <div className="absolute inset-0 bg-btn-primary opacity-0 transition-opacity duration-300 group-hover:opacity-10 dark:group-hover:opacity-15" />
      {isDark ? (
        <Sun size={18} className="relative z-10 transition-transform duration-500 group-hover:rotate-45" />
      ) : (
        <Moon size={18} className="relative z-10 transition-transform duration-500 group-hover:-rotate-12" />
      )}
    </button>
  );
}
