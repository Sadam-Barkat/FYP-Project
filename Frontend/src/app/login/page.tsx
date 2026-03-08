"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data?.detail === "string" ? data.detail : "Invalid email or password.");
        return;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", data.access_token ?? "");
        localStorage.setItem("userRole", data.user?.role ?? "admin");
      }

      const role = data.user?.role ?? "admin";
      if (role === "admin") router.push("/admin");
      else if (role === "doctor") router.push("/doctor");
      else if (role === "nurse") router.push("/nurse");
      else router.push("/admin");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7fa]">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#0066cc] mb-2">Real Time Intelligent Dashboard</h1>
          <p className="text-gray-500">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="px-4 py-2 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition-colors"
              placeholder="user@hospital.com"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition-colors"
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#0066cc] text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
