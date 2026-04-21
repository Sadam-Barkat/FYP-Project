"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial preference from localStorage or system
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (stored === "dark" || (!stored && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  return (
    <button 
      onClick={toggleTheme}
      className="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-50 text-gray-600 shadow-sm ring-1 ring-gray-200/50 transition-all duration-300 hover:bg-white hover:text-blue-600 hover:shadow-md hover:ring-blue-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700/50 dark:hover:bg-gray-700 dark:hover:text-blue-400 dark:hover:ring-blue-500/30"
      aria-label="Toggle dark mode"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-50 to-indigo-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-blue-900/20 dark:to-indigo-900/20" />
      {isDark ? (
        <Sun size={18} className="relative z-10 transition-transform duration-500 group-hover:rotate-45" />
      ) : (
        <Moon size={18} className="relative z-10 transition-transform duration-500 group-hover:-rotate-12" />
      )}
    </button>
  );
}
