"use client";

import { useEffect, useRef } from "react";

import { getApiBaseUrl, normalizeApiBaseUrl } from "@/lib/apiBase";

/**
 * Shared WebSocket for real-time dashboard updates.
 * One connection per app; multiple components can subscribe to different event types.
 * Backend sends JSON: { type: string, ... }. Admin dashboards subscribe to `admin_data_changed`
 * (emitted after any hospital data mutation). Doctor/nurse UIs may subscribe to `vitals_updated`, etc.
 *
 * FastAPI mounts the socket at `/ws` on the API origin (not under `/api`). `getWsUrl()` strips a
 * trailing `/api` from `NEXT_PUBLIC_API_URL` when present. Override with `NEXT_PUBLIC_WS_URL` if needed.
 */
function getWsUrl(): string {
  if (typeof window === "undefined") return "";

  const explicit = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicit) {
    const u = normalizeApiBaseUrl(explicit.replace(/\/+$/, ""));
    return u.endsWith("/ws") ? u : `${u}/ws`;
  }

  const base = getApiBaseUrl();

  try {
    const url = new URL(base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

let socket: WebSocket | null = null;
// Browser timers return `number`; `ReturnType<typeof setTimeout>` can be NodeJS.Timeout and breaks Next.js build.
let reconnectTimer: number | null = null;
let pingTimer: number | null = null;
const listeners: Record<string, Set<(payload: unknown) => void>> = {};

const PING_MS = 25_000;

function clearWsPing(): void {
  if (pingTimer != null) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function hasAnyListeners(): boolean {
  return Object.values(listeners).some((s) => s.size > 0);
}

function scheduleReconnect(): void {
  if (typeof window === "undefined") return;
  if (reconnectTimer != null) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    if (!hasAnyListeners()) return;
    if (socket?.readyState === WebSocket.OPEN) return;
    socket = null;
    ensureConnected();
  }, 1500);
}

function ensureConnected(): void {
  if (typeof window === "undefined") return;
  if (socket?.readyState === WebSocket.OPEN) return;
  if (socket?.readyState === WebSocket.CONNECTING) return;
  const url = getWsUrl();
  if (!url) return;
  socket = new WebSocket(url);
  socket.onopen = () => {
    clearWsPing();
    pingTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_MS);
  };
  socket.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data) as { type?: string };
      const type = d?.type;
      if (type && listeners[type]) {
        listeners[type].forEach((f) => f(d));
      }
    } catch {
      // ignore parse errors
    }
  };
  socket.onclose = () => {
    clearWsPing();
    socket = null;
    scheduleReconnect();
  };
  socket.onerror = () => {
    // onclose will run and schedule reconnect
  };
}

/**
 * Single WebSocket event after any backend change that should refresh admin KPIs/lists
 * (nurse vitals, doctor discharge, reception patient, lab entry, HR/staff, alerts, patient delete).
 */
export const ADMIN_DASHBOARD_REALTIME_EVENTS = ["admin_data_changed"] as const;

export type AdminDashboardRealtimeEvent =
  (typeof ADMIN_DASHBOARD_REALTIME_EVENTS)[number];

/**
 * Subscribe to one or more WebSocket event types. When the backend broadcasts a matching
 * `{ type }`, onEvent runs. Pass `ADMIN_DASHBOARD_REALTIME_EVENTS` for admin dashboard refetch.
 */
export function useRealtimeEvent(
  eventType: string | readonly string[],
  onEvent: (payload?: unknown) => void
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const typesKey =
    typeof eventType === "string"
      ? eventType
      : [...eventType].join("\0");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const typesList =
      typeof eventType === "string" ? [eventType] : [...eventType];
    if (typesList.length === 0 || typesList.some((t) => !t)) return;

    ensureConnected();
    const stableCb = (payload?: unknown) => {
      onEventRef.current?.(payload);
    };
    for (const t of typesList) {
      if (!listeners[t]) listeners[t] = new Set();
      listeners[t].add(stableCb);
    }
    return () => {
      for (const t of typesList) {
        listeners[t]?.delete(stableCb);
      }
    };
  }, [eventType, typesKey]);
}
