"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = getApiBaseUrl();

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError("Missing reset link. Please request a new password reset.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.detail === "string" ? data.detail : "Failed to reset password. The link may have expired.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Request failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-base-bg px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-base-border bg-base-card/75 p-6 text-center shadow-card backdrop-blur-md sm:p-8">
          <p className="text-status-success font-medium mb-4">Your password has been reset. Redirecting you to sign in…</p>
          <Link href="/login" className="text-text-secondary hover:text-text-bright transition-colors duration-150">Go to sign in</Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-base-bg px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-base-border bg-base-card/75 p-6 shadow-card backdrop-blur-md sm:p-8">
          <p className="text-status-danger text-sm mb-4">{error}</p>
          <Link href="/forgot-password" className="text-text-secondary hover:text-text-bright transition-colors duration-150">Request a new reset link</Link>
          <span className="mx-2 text-text-muted">|</span>
          <Link href="/login" className="text-text-secondary hover:text-text-bright transition-colors duration-150">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-base-bg px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-base-border bg-base-card/75 p-6 shadow-card backdrop-blur-md sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-bright mb-2">Set new password</h1>
          <p className="text-text-secondary">Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-status-danger/10 text-status-danger text-sm border border-status-danger/30">
              {error}
            </div>
          )}
          <div>
            <label className="text-text-secondary text-sm font-medium mb-1.5 block">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200"
              placeholder="••••••••"
              required
              minLength={6}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-text-secondary text-sm font-medium mb-1.5 block">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
              className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200"
              placeholder="••••••••"
              required
              minLength={6}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-btn-primary text-text-bright font-semibold rounded-xl px-5 py-3 shadow-btn hover:shadow-glow-blue hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Resetting…" : "Reset password"}
          </button>
          <p className="text-center">
            <Link href="/login" className="text-sm text-text-secondary hover:text-text-bright transition-colors duration-150">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-base-bg px-4">
        <p className="text-text-secondary">Loading…</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
