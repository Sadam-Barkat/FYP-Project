"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type TooltipAlign = "center" | "start" | "end";

const DEFAULT_TOOLTIP_PX = 260;

const alignClasses: Record<TooltipAlign, string> = {
  center: "left-1/2 -translate-x-1/2",
  start: "left-4 translate-x-0",
  end: "right-4 left-auto translate-x-0",
};

function parseTooltipWidth(className: string): number {
  const m = className.match(/w-\[(\d+)px\]/);
  if (m) return Number(m[1]);
  return DEFAULT_TOOLTIP_PX;
}

function computeFixedPosition(
  rect: DOMRect,
  align: TooltipAlign,
  width: number
): { top: number; left: number } {
  const vpad = 8;
  const inset = 16;
  let left: number;
  if (align === "start") left = rect.left + inset;
  else if (align === "end") left = rect.right - width - inset;
  else left = rect.left + rect.width / 2 - width / 2;
  const maxLeft = window.innerWidth - width - 12;
  left = Math.max(12, Math.min(left, maxLeft));
  return { top: rect.bottom + vpad, left };
}

function TooltipPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 ${className}`}
      role="tooltip"
      aria-label={title}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function InfoTooltip({
  title,
  children,
  className = "w-[260px]",
  align = "center",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  align?: TooltipAlign;
}) {
  return (
    <div
      className={`pointer-events-none absolute top-full z-[100] mt-2 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 ${alignClasses[align]} ${className}`}
      role="tooltip"
      aria-label={title}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function TooltipRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-semibold text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

type MetricKpiCardProps = {
  borderLeftClass: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  footnote?: ReactNode;
  tooltipTitle: string;
  tooltipContent: ReactNode;
  minHeightClass?: string;
  showChevron?: boolean;
  chevronClassName?: string;
  tooltipClassName?: string;
  tooltipAlign?: TooltipAlign;
};

export function MetricKpiCard({
  borderLeftClass,
  icon,
  label,
  value,
  footnote,
  tooltipTitle,
  tooltipContent,
  minHeightClass = "min-h-[160px]",
  showChevron = true,
  chevronClassName = "text-gray-300 mt-4",
  tooltipClassName,
  tooltipAlign = "center",
}: MetricKpiCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  const widthPx = parseTooltipWidth(tooltipClassName ?? `w-[${DEFAULT_TOOLTIP_PX}px]`);

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    setPos(computeFixedPosition(el.getBoundingClientRect(), tooltipAlign, widthPx));
  }, [tooltipAlign, widthPx]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hovered) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [hovered, updatePosition]);

  const tooltipWClass = tooltipClassName ?? `w-[${DEFAULT_TOOLTIP_PX}px]`;

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => {
        updatePosition();
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      className={`group bg-white rounded-xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 ${borderLeftClass} p-6 relative flex flex-col items-center justify-between ${minHeightClass}`}
    >
      {icon}
      <div className="mt-4 w-full text-center">
        <p className="text-gray-800 font-medium text-sm dark:text-gray-200">{label}</p>
        {value}
      </div>
      {footnote != null ? <div className="mt-4 w-full text-center">{footnote}</div> : null}
      {showChevron ? (
        <ChevronDown
          className={`${chevronClassName} shrink-0`}
          size={20}
          data-hide-in-pdf
          aria-hidden
        />
      ) : null}
      {mounted &&
        hovered &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999]"
            style={{ top: pos.top, left: pos.left }}
            data-hide-in-pdf
          >
            <TooltipPanel title={tooltipTitle} className={tooltipWClass}>
              {tooltipContent}
            </TooltipPanel>
          </div>,
          document.body
        )}
    </div>
  );
}

type CompactMetricCardProps = {
  borderLeftClass: string;
  left: ReactNode;
  rightIcon: ReactNode;
  tooltipTitle: string;
  tooltipContent: ReactNode;
  tooltipClassName?: string;
  tooltipAlign?: TooltipAlign;
};

/** Horizontal KPI strip (e.g. laboratory entry summaries). */
export function CompactMetricCard({
  borderLeftClass,
  left,
  rightIcon,
  tooltipTitle,
  tooltipContent,
  tooltipClassName,
  tooltipAlign = "center",
}: CompactMetricCardProps) {
  return (
    <div
      className={`group relative flex items-center justify-between rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${borderLeftClass} p-4`}
    >
      {left}
      {rightIcon}
      <InfoTooltip
        title={tooltipTitle}
        className={tooltipClassName ?? "w-[240px]"}
        align={tooltipAlign}
      >
        {tooltipContent}
      </InfoTooltip>
    </div>
  );
}
