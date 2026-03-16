/**
 * Per-tab auth: token is read from sessionStorage first so each tab keeps
 * its own login (e.g. nurse in tab 1, doctor in tab 2) without overwriting.
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("access_token") ?? localStorage.getItem("access_token");
}

export function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
