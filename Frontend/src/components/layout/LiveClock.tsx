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
    return <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 hidden sm:block w-[75px]">--:--:--</span>;
  }

  return (
    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 hidden sm:block tracking-wide">
      {time}
    </span>
  );
}
