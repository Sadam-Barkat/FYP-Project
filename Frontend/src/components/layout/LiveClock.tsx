"use client";

import { useEffect, useState } from "react";

export default function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    
    // Set initial time
    updateClock();
    
    // Update every second
    const intervalId = setInterval(updateClock, 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Return a placeholder during SSR to avoid hydration mismatch
  if (!time) {
    return (
      <span className="hidden w-[120px] tabular-nums sm:block text-slate-900 font-mono font-bold bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 dark:bg-transparent dark:border-transparent dark:text-text-bright dark:font-semibold dark:font-sans">
        --:--:--
      </span>
    );
  }

  return (
    <span className="hidden sm:block w-[120px] tabular-nums text-slate-900 font-mono font-bold bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 dark:bg-transparent dark:border-transparent dark:text-text-bright dark:font-semibold dark:font-sans">
      {time}
    </span>
  );
}
