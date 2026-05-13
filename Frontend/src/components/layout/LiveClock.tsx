"use client";

import { useEffect, useState } from "react";

export default function LiveClock() {
  const [time, setTime] = useState("");
  const [dateLine, setDateLine] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      );
      setDateLine(
        now.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      );
    };

    updateClock();

    const intervalId = setInterval(updateClock, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const wrapClass =
    "inline-flex h-9 min-h-9 flex-col items-end justify-center rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-0.5 leading-none text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-text-bright";

  if (!time) {
    return (
      <div className={wrapClass} aria-hidden>
        <span className="text-[9px] font-medium text-slate-500 dark:text-text-secondary">
          —
        </span>
        <span className="font-mono text-xs font-bold tabular-nums sm:text-sm">--:--:--</span>
      </div>
    );
  }

  return (
    <div className={wrapClass} title={`${dateLine} ${time}`}>
      <span className="text-[9px] font-semibold text-slate-600 dark:text-text-secondary">
        {dateLine}
      </span>
      <span className="font-mono text-xs font-bold tabular-nums sm:text-sm">{time}</span>
    </div>
  );
}
