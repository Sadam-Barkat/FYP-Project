"use client";

import { useEffect, useRef } from "react";

/**
 * Shared WebSocket for real-time dashboard updates.
 * One connection per app; multiple components can subscribe to different event types.
 * Backend sends JSON: { type: "laboratory_updated" | "patients_updated" | "vitals_updated" | "patient_discharged" | "nurse_patient_updated" | "overview_updated", ... }
 */
function getWsUrl(): string {
  if (typeof window === "undefined") return "";
  const base =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return base.replace(/^http/, "ws") + "/ws";
}

let socket: WebSocket | null = null;
const listeners: Record<string, Set<(payload: unknown) => void>> = {};

function ensureConnected(): void {
  if (typeof window === "undefined") return;
  if (socket?.readyState === WebSocket.OPEN) return;
  const url = getWsUrl();
  if (!url) return;
  socket = new WebSocket(url);
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
    socket = null;
  };
}

/**
 * Subscribe to a real-time event from the backend WebSocket.
 * When the backend broadcasts { type: eventType }, onEvent is called.
 * Use for: laboratory_updated, patients_updated, vitals_updated, patient_discharged, nurse_patient_updated, overview_updated.
 */
export function useRealtimeEvent(
  eventType: string,
  onEvent: (payload?: unknown) => void
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (typeof window === "undefined" || !eventType) return;
    ensureConnected();
    const stableCb = (payload?: unknown) => {
      onEventRef.current?.(payload);
    };
    if (!listeners[eventType]) listeners[eventType] = new Set();
    listeners[eventType].add(stableCb);
    return () => {
      listeners[eventType]?.delete(stableCb);
    };
  }, [eventType]);
}
