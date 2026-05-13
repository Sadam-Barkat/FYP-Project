/**
 * Browser-side API origin from NEXT_PUBLIC_API_URL.
 * If the env value is a bare host (e.g. `xxx.up.railway.app` without `https://`),
 * fetch() treats it as a path on the current site and breaks all API calls.
 */
export function normalizeApiBaseUrl(raw: string): string {
  let s = raw.trim().replace(/\/+$/, "").replace(/\/api\/?$/i, "");
  if (!s) return s;
  const hasHttpScheme = /^https?:\/\//i.test(s);
  const hasWsScheme = /^wss?:\/\//i.test(s);
  if (!hasHttpScheme && !hasWsScheme && !s.startsWith("/")) {
    s = `https://${s}`;
  }
  return s;
}

/**
 * When `NEXT_PUBLIC_API_URL` is unset, use the same origin as the portal login fallback so
 * auth and dashboards hit one backend (avoids logging in against Railway while `/doctor` calls localhost).
 * Override with `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local` for a local API.
 */
export const DEFAULT_PUBLIC_API_FALLBACK =
  "https://fyp-project-production-8c05.up.railway.app";

export function getApiBaseUrl(fallback = DEFAULT_PUBLIC_API_FALLBACK): string {
  return normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL || fallback);
}
