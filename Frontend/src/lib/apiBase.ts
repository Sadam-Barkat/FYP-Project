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

export function getApiBaseUrl(fallback = "http://localhost:8000"): string {
  return normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL || fallback);
}
