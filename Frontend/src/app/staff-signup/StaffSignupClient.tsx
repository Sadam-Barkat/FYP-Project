"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = getApiBaseUrl();

const DEPARTMENTS = [
  "Cardiology",
  "Emergency",
  "ICU",
  "Pediatrics",
  "Surgery",
  "Radiology",
  "Laboratory",
  "Pharmacy",
  "General Medicine",
  "Orthopedics",
  "Neurology",
  "Reception",
  "Other",
];

interface InvitationInfo {
  email: string;
  staff_type: string;
}

export default function StaffSignupClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [department, setDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing invitation token.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const validate = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `${API_BASE}/api/staff-invitations/validate?token=${encodeURIComponent(token)}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail ?? "Failed to validate invitation.");
        }
        const data: InvitationInfo = await res.json();
        if (!cancelled) {
          setInvitation(data);
        }
      } catch (err) {
        console.error("Failed to validate staff invitation", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to validate invitation.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    if (!firstName.trim() || !lastName.trim() || !password.trim() || !age || !gender || !department.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/staff-invitations/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          password: password.trim(),
          age: typeof age === "string" ? parseInt(age, 10) : age,
          gender,
          phone: phone.trim() || null,
          address: address.trim() || null,
          department: department.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Failed to complete signup.");
      }
      setSuccessMessage("Your staff account has been created successfully. You can now log in.");
    } catch (err) {
      console.error("Failed to complete staff signup", err);
      setError(err instanceof Error ? err.message : "Failed to complete signup.");
    } finally {
      setSubmitting(false);
    }
  };

  const goToLogin = () => {
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-[#f4f7fa] px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl border border-gray-100 bg-white p-6 shadow-md sm:p-8">
        <h1 className="text-2xl font-semibold text-[#0066cc] mb-2 text-center">
          Staff Signup
        </h1>
        <p className="text-sm text-gray-600 mb-6 text-center">
          Complete your profile to activate your staff account.
        </p>

        {loading && (
          <p className="text-sm text-gray-500 text-center">Validating invitation...</p>
        )}

        {!loading && error && !successMessage && (
          <p className="text-sm text-red-500 text-center mb-4">{error}</p>
        )}

        {!loading && invitation && !successMessage && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={invitation.email}
                  disabled
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 text-sm cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  value={invitation.staff_type}
                  disabled
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  First name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Last name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Age *
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Gender *
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Department *
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                >
                  <option value="">Select</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full mt-2 bg-[#0066cc] text-white py-2 rounded-lg hover:bg-[#0052a3] disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Complete Signup"}
            </button>
          </form>
        )}

        {successMessage && (
          <div className="text-center">
            <p className="text-sm text-green-600 mb-4">{successMessage}</p>
            <button
              type="button"
              onClick={goToLogin}
              className="px-4 py-2 bg-[#0066cc] text-white rounded-lg hover:bg-[#0052a3]"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

