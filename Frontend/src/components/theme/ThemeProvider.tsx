"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";

function applyDomTheme(next: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", next === "dark");
}

function readInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, _setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const initial = readInitialTheme();
    _setTheme(initial);
    applyDomTheme(initial);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    _setTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    applyDomTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

