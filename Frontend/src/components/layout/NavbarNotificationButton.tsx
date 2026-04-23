"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, AlertTriangle, Activity, Clock } from "lucide-react";
import { useRealtimeEvent } from "@/hooks/useRealtimeEvent";
import { getApiBaseUrl } from "@/lib/apiBase";

type AlertFeedItem = {
  id: number;
  short_id: string;
  patient_id: number | null;
  type: string;
  message: string;
  severity: string;
  department: string;
  created_at: string | null;
  is_resolved: boolean;
};

const API_BASE = getApiBaseUrl();

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  // Show the exact local time instead of "5 hours ago"
  return d.toLocaleString();
}

function severityIconAndColors(severity: string) {
  if (severity === "critical") {
    return {
      icon: <AlertTriangle size={16} />,
      bg: "bg-status-danger/15",
      text: "text-status-danger",
      dot: "bg-status-danger",
    };
  }
  if (severity === "high" || severity === "medium") {
    return {
      icon: <AlertTriangle size={16} />,
      bg: "bg-status-warning/15",
      text: "text-status-warning",
      dot: "bg-status-warning",
    };
  }
  return {
    icon: <Activity size={16} />,
    bg: "bg-brand-blue/15",
    text: "text-brand-blue",
    dot: "bg-brand-blue",
  };
}

/**
 * Notification icon & dropdown:
 * - Visible only for doctors.
 * - Shows recent critical / high alerts in a dropdown (like a simple notifications tray).
 * - Updates in real time when nurse records critical/emergency vitals via `vitals_updated`.
 */
export default function NavbarNotificationButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let role = sessionStorage.getItem("userRole");
    if (!role) {
      role = localStorage.getItem("userRole");
      if (role) sessionStorage.setItem("userRole", role);
    }
    const isDoctor = role === "doctor" || pathname?.startsWith("/doctor");
    setShow(!!isDoctor);

    if (isDoctor) {
      const idStr =
        sessionStorage.getItem("userId") || localStorage.getItem("userId");
      const idNum = idStr ? Number(idStr) : NaN;
      if (!Number.isNaN(idNum)) {
        setDoctorId(idNum);
        if (typeof window !== "undefined") {
          const key = `doctor_notifications_last_seen_${idNum}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = new Date(stored);
            if (!isNaN(parsed.getTime())) {
              setLastSeenAt(parsed);
            }
          }
        }
      }
    } else {
      setDoctorId(null);
      setLastSeenAt(null);
    }
  }, [pathname]);

  const fetchAlerts = useCallback(async () => {
    try {
      setError(null);
      const query = doctorId ? `?doctor_id=${doctorId}` : "";
      const res = await fetch(`${API_BASE}/api/alerts-overview${query}`);
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      const feed: AlertFeedItem[] = Array.isArray(data.alerts_feed) ? data.alerts_feed : [];
      // For the doctor tray we care mostly about unresolved critical/high alerts.
      setAlerts(feed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    fetchAlerts();
  }, [show, fetchAlerts]);

  useRealtimeEvent("vitals_updated", () => {
    if (show) fetchAlerts();
  });

  const criticalOrHigh = useMemo(
    () =>
      alerts.filter(
        (a) =>
          !a.is_resolved &&
          (a.severity === "critical" || a.severity === "high" || a.severity === "emergency")
      ),
    [alerts]
  );

  const unreadCount = useMemo(() => {
    if (!lastSeenAt) return criticalOrHigh.length;
    return criticalOrHigh.filter((a) => {
      if (!a.created_at) return false;
      const created = new Date(a.created_at);
      return created > lastSeenAt;
    }).length;
  }, [criticalOrHigh, lastSeenAt]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.("#doctor-notification-root")) {
        setOpen(false);
      }
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [open]);

  if (!show) return null;

  return (
    <div id="doctor-notification-root" className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((prev) => {
            const next = !prev;
            if (next && doctorId && criticalOrHigh.length > 0) {
              const latest = criticalOrHigh
                .map((a) => (a.created_at ? new Date(a.created_at) : null))
                .filter((d): d is Date => !!d && !isNaN(d.getTime()))
                .sort((a, b) => b.getTime() - a.getTime())[0];
              if (latest) {
                setLastSeenAt(latest);
                if (typeof window !== "undefined") {
                  const key = `doctor_notifications_last_seen_${doctorId}`;
                  localStorage.setItem(key, latest.toISOString());
                }
              }
            }
            return next;
          });
        }}
        className="relative text-text-secondary hover:text-text-bright focus:outline-none transition-colors duration-150"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-status-danger text-[10px] font-semibold text-text-bright px-0.5 shadow-glow-red">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-base-card/85 shadow-nav border border-base-border z-40 backdrop-blur-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-base-border bg-base-muted/30">
            <div>
              <p className="text-sm font-semibold text-text-bright">Notifications</p>
              <p className="text-xs text-text-secondary">
                Critical & high alerts from your patients
              </p>
            </div>
            {loading && (
              <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium">
                Loading...
              </span>
            )}
          </div>

          {error && (
            <div className="px-4 py-3 text-xs text-status-danger border-b border-base-border bg-status-danger/10">
              {error}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto divide-y divide-base-border">
            {criticalOrHigh.length === 0 && !loading ? (
              <div className="px-4 py-10 text-center text-sm text-text-secondary">
                No critical notifications right now.
              </div>
            ) : (
              criticalOrHigh.map((alert) => {
                const ui = severityIconAndColors(alert.severity);
                return (
                  <div
                    key={alert.id}
                    className={`px-4 py-3 flex items-start gap-3 hover:bg-base-hover transition-colors duration-150 ${
                      alert.patient_id ? "cursor-pointer" : "cursor-default"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (!alert.patient_id) return;
                      setOpen(false);
                      router.push(`/doctor/patients/${alert.patient_id}`);
                    }}
                  >
                    <div
                      className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full ${ui.bg} ${ui.text}`}
                    >
                      {ui.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-bright truncate">
                        {alert.message}
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        <span className="font-medium text-text-primary">Patient:</span>{" "}
                        {alert.patient_id ? `#${alert.patient_id}` : "Unknown"}{" "}
                        <span className="mx-1">•</span>
                        <span className="font-medium text-text-primary">Dept:</span>{" "}
                        {alert.department}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                        <Clock size={10} />
                        {formatTimeAgo(alert.created_at)}
                        <span className="mx-1">•</span>
                        <span className={`inline-flex h-1.5 w-1.5 rounded-full ${ui.dot}`} />
                        <span className="capitalize">{alert.severity}</span>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
