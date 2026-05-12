/**
 * Calendar YYYY-MM-DD in the user's local timezone (not UTC).
 * Use when querying APIs that interpret `date` as an app-calendar day (e.g. Asia/Karachi)
 * while the browser would otherwise send UTC from `toISOString().slice(0, 10)`.
 */
export function formatLocalDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
