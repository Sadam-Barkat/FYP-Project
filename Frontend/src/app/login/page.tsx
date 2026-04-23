"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = getApiBaseUrl("https://fyp-project-production-8c05.up.railway.app");

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data?.detail === "string" ? data.detail : "Invalid email or password.");
        return;
      }

      const role = data.user?.role ?? "admin";
      const userEmail = (data.user?.email ?? "").toString().trim().toLowerCase();
      // Reception → /reception; Laboratorian (lab@hospital.com) → /laboratory-entry; Finance → billing only
      let effectiveRole = role;
      if (userEmail === "reception@hospital.com") effectiveRole = "receptionist";
      else if (userEmail === "lab@hospital.com") effectiveRole = "laboratorian";
      else if (role === "finance" || userEmail === "finance@hospital.com") effectiveRole = "finance";

      if (typeof window !== "undefined") {
        const firstName = (data.user?.first_name ?? "").toString().trim();
        const lastName = (data.user?.last_name ?? "").toString().trim();
        const displayName = [firstName, lastName].filter(Boolean).join(" ") || (data.user?.email ?? "").toString();

        const token = data.access_token ?? "";
        localStorage.setItem("access_token", token);
        localStorage.setItem("userRole", effectiveRole);
        localStorage.setItem("userName", displayName);
        localStorage.setItem("userEmail", (data.user?.email ?? "").toString().trim());
         // Persist numeric user id for role-specific features (e.g. doctor notifications)
        if (data.user?.id != null) {
          const idStr = String(data.user.id);
          localStorage.setItem("userId", idStr);
          sessionStorage.setItem("userId", idStr);
        }
        // Per-tab auth: token + role so each tab keeps its own login (nurse in tab 1, doctor in tab 2, etc.)
        sessionStorage.setItem("access_token", token);
        sessionStorage.setItem("userRole", effectiveRole);
        sessionStorage.setItem("userName", displayName);
        sessionStorage.setItem("userEmail", (data.user?.email ?? "").toString().trim());

        // Also store in cookies so Next.js middleware/proxy can read auth state
        const maxAge = 60 * 30; // 30 minutes
        document.cookie = `access_token=${data.access_token ?? ""}; Path=/; Max-Age=${maxAge}`;
        document.cookie = `userRole=${effectiveRole}; Path=/; Max-Age=${maxAge}`;
      }

      if (effectiveRole === "admin") router.push("/admin");
      else if (effectiveRole === "doctor") router.push("/doctor");
      else if (effectiveRole === "nurse") router.push("/nurse");
      else if (effectiveRole === "receptionist") router.push("/reception");
      else if (effectiveRole === "laboratorian") router.push("/laboratory-entry");
      else if (effectiveRole === "finance") router.push("/admin/billing-finance");
      else router.push("/admin");
    } catch (err) {
      console.error("Login error", err);
      setError(
        err instanceof TypeError && err.message === "Failed to fetch"
          ? "Cannot connect to the server. Make sure the backend is running at " + API_BASE
          : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-base-bg flex items-center justify-center px-4 py-10 overflow-hidden">
      <div className="absolute w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="bg-base-card border border-base-border rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] p-10 w-full max-w-md relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-primary to-transparent" />
        <div className="text-center mb-8">
          <h1 className="text-text-primary font-bold text-2xl tracking-tight mb-2">
            Real Time Intelligent Dashboard
          </h1>
          <p className="text-text-muted text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-status-danger/10 text-status-danger text-sm border border-status-danger/20">
              {error}
            </div>
          )}

          <div>
            <label className="text-text-secondary text-sm font-medium mb-1.5 block">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all duration-200"
              placeholder="user@hospital.com"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="text-text-secondary text-sm font-medium mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 pr-11 w-full focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all duration-200"
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={isLoading}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-text-muted hover:text-text-primary disabled:opacity-60 transition-colors duration-150"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-semibold rounded-xl px-5 py-3 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_32px_rgba(59,130,246,0.5)] hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
          <p className="text-center mt-4">
            <Link
              href="/forgot-password"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
            >
              Forgot password?
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
