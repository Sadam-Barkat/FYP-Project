"use client";

import { useState } from "react";
import { UserPlus, User, Stethoscope, Heart } from "lucide-react";

// Mock lists for design; backend will replace with API data
const MOCK_DOCTORS = [
  { id: "1", name: "Dr. Ayesha Khan" },
  { id: "2", name: "Dr. Bilal Ahmed" },
  { id: "3", name: "Dr. Sara Ali" },
];

const MOCK_NURSES = [
  { id: "1", name: "Fatima Hassan" },
  { id: "2", name: "Sana Mahmood" },
  { id: "3", name: "Zainab Noor" },
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function ReceptionPage() {
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [nurseId, setNurseId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Backend will be implemented later; for now just show success state
    setSubmitted(true);
    setName("");
    setAge("");
    setGender("");
    setContact("");
    setAddress("");
    setBloodGroup("");
    setDoctorId("");
    setNurseId("");
  };

  return (
    <div id="dashboard-content" className="w-full max-w-3xl mx-auto space-y-6 pb-12 transition-colors">
      <div>
        <h2 className="text-3xl font-semibold text-[#0066cc] dark:text-[#60a5fa]">Add New Patient</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Register a new patient and assign a doctor and nurse. All fields with * are required.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Patient details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium text-gray-800 dark:text-gray-200">
              <User size={20} className="text-[#0066cc] dark:text-[#60a5fa]" />
              Patient details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
                  placeholder="e.g. Ali Ahmed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Age *</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
                  placeholder="e.g. 35"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact</label>
                <input
                  type="tel"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
                  placeholder="e.g. +92 300 1234567"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none resize-none"
                  placeholder="e.g. Lahore, Punjab"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Blood group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
                >
                  <option value="">Select (optional)</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Assign Doctor */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium text-gray-800 dark:text-gray-200">
              <Stethoscope size={20} className="text-[#0066cc] dark:text-[#60a5fa]" />
              Assign doctor *
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Doctor</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
              >
                <option value="">Select a doctor</option>
                {MOCK_DOCTORS.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assign Nurse */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium text-gray-800 dark:text-gray-200">
              <Heart size={20} className="text-[#0066cc] dark:text-[#60a5fa]" />
              Assign nurse *
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nurse</label>
              <select
                value={nurseId}
                onChange={(e) => setNurseId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none"
              >
                <option value="">Select a nurse</option>
                {MOCK_NURSES.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          </div>

          {submitted && (
            <div className="px-4 py-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 text-sm border border-green-200 dark:border-green-800">
              Patient form submitted. (Backend integration will be added later.)
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0066cc] text-white font-medium rounded-lg hover:bg-[#0052a3] dark:bg-[#60a5fa] dark:hover:bg-[#3b82f6] focus:ring-2 focus:ring-[#0066cc] focus:ring-offset-2 transition-colors"
            >
              <UserPlus size={18} />
              Add patient
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
