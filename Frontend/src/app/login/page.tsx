"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save mock auth state
    if (typeof window !== "undefined") {
      localStorage.setItem("userRole", role);
    }
    
    // Fake login: redirect based on selected role
    if (role === "admin") router.push("/admin");
    else if (role === "doctor") router.push("/doctor");
    else if (role === "nurse") router.push("/nurse");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7fa]">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#0066cc] mb-2">Real Time Intelligent Dashboard</h1>
          <p className="text-gray-500">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition-colors"
              placeholder="user@hospital.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Simulate Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none bg-white transition-colors"
            >
              <option value="admin">Administrator</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-[#0066cc] text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium mt-2"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
