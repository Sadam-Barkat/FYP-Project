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
      className="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-base-muted text-text-secondary shadow-card ring-1 ring-base-border/60 transition-all duration-300 hover:bg-base-hover hover:text-text-bright hover:shadow-glow-blue hover:ring-brand-blue/30"
      aria-label="Toggle dark mode"
    >
      <div className="absolute inset-0 bg-btn-primary opacity-0 transition-opacity duration-300 group-hover:opacity-15" />
      {isDark ? (
        <Sun size={18} className="relative z-10 transition-transform duration-500 group-hover:rotate-45" />
      ) : (
        <Moon size={18} className="relative z-10 transition-transform duration-500 group-hover:-rotate-12" />
      )}
    </button>
  );
}
