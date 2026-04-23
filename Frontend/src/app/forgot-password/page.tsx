"use client";

import { useState } from "react";
import Link from "next/link";

import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = getApiBaseUrl();

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.detail === "string" ? data.detail : "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Request failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-base-bg px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-base-border bg-base-card/75 p-6 shadow-card backdrop-blur-md sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-bright mb-2">Forgot password</h1>
          <p className="text-text-secondary">Enter your email and we&apos;ll send you a link to reset your password.</p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-xl bg-status-success/10 text-status-success text-sm border border-status-success/30">
              If an account exists with this email, you will receive a link to reset your password. Please check your inbox (and spam folder).
            </div>
            <Link
              href="/login"
              className="block w-full text-center bg-transparent border border-base-border text-text-secondary rounded-xl px-5 py-2.5 hover:border-brand-blue/50 hover:text-text-bright transition-all duration-200 font-medium"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-status-danger/10 text-status-danger text-sm border border-status-danger/30">
                {error}
              </div>
            )}
            <div>
              <label className="text-text-secondary text-sm font-medium mb-1.5 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                className="bg-base-card border border-base-border text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200"
                placeholder="user@hospital.com"
                required
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-btn-primary text-text-bright font-semibold rounded-xl px-5 py-3 shadow-btn hover:shadow-glow-blue hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-center">
              <Link href="/login" className="text-sm text-text-secondary hover:text-text-bright transition-colors duration-150">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
