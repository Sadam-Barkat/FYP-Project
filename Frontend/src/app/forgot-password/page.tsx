"use client";

import { useState } from "react";
import Link from "next/link";

const API_BASE_RAW = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
// Safety: if env accidentally includes `/api` (e.g. `.../api`), we would otherwise call `/api/api/...` and get 404.
const API_BASE = API_BASE_RAW.replace(/\/+$/, "").replace(/\/api\/?$/, "");

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
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7fa] px-4">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#0066cc] mb-2">Forgot password</h1>
          <p className="text-gray-500">Enter your email and we&apos;ll send you a link to reset your password.</p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-md bg-green-50 text-green-800 text-sm border border-green-200">
              If an account exists with this email, you will receive a link to reset your password. Please check your inbox (and spam folder).
            </div>
            <Link
              href="/login"
              className="block w-full text-center py-2.5 px-4 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="px-4 py-2 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition-colors"
                placeholder="user@hospital.com"
                required
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0066cc] text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-center">
              <Link href="/login" className="text-sm text-[#0066cc] hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
