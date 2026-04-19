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
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-[#f4f7fa] px-4 py-8">
        <div className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm sm:p-8">
          <p className="text-green-600 font-medium mb-4">Your password has been reset. Redirecting you to sign in…</p>
          <Link href="/login" className="text-[#0066cc] hover:underline">Go to sign in</Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-[#f4f7fa] px-4 py-8">
        <div className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <Link href="/forgot-password" className="text-[#0066cc] hover:underline">Request a new reset link</Link>
          <span className="mx-2 text-gray-400">|</span>
          <Link href="/login" className="text-[#0066cc] hover:underline">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-[#f4f7fa] px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#0066cc] mb-2">Set new password</h1>
          <p className="text-gray-500">Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="px-4 py-2 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition-colors"
              placeholder="••••••••"
              required
              minLength={6}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition-colors"
              placeholder="••••••••"
              required
              minLength={6}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#0066cc] text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Resetting…" : "Reset password"}
          </button>
          <p className="text-center">
            <Link href="/login" className="text-sm text-[#0066cc] hover:underline">
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
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-[#f4f7fa] px-4">
        <p className="text-gray-500">Loading…</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
