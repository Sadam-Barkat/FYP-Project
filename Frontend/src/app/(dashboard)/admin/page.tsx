"use client";

import { 
  BedSingle, DollarSign, UserSquare2, 
  AlertTriangle, TrendingUp, ChevronDown 
} from "lucide-react";

export default function AdminDashboard() {
  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-semibold text-[#0088cc]">Hospital Overview</h2>
      </div>

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Beds */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[180px]">
          <BedSingle className="absolute top-4 left-4 text-[#3b82f6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Total Beds</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">150</h3>
          </div>
          <ChevronDown className="text-gray-300 mt-4" size={20} />
        </div>

        {/* Active Patients Details (Expanded) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 min-h-[180px] flex flex-col relative">
          <h3 className="text-[#22c55e] font-semibold text-lg mb-3">Active Patients Details</h3>
          <ul className="space-y-1.5 text-sm text-gray-700 flex-1">
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
              Total active patients: 245
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
              ICU: 50 patients
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
              Emergency: 75 patients
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
              General ward: 90 patients
            </li>
            <li className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
              Cardiology: 30 patients
            </li>
          </ul>
          <p className="text-xs text-gray-400 italic text-center mt-2 cursor-pointer hover:text-gray-600">
            Click to collapse
          </p>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[180px]">
          <DollarSign className="absolute top-4 left-4 text-[#eab308]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Today's Revenue</p>
            <h3 className="text-3xl font-bold text-[#eab308] mt-3">PKR 85K</h3>
          </div>
          <ChevronDown className="text-gray-300 mt-4 cursor-pointer hover:text-gray-400" size={20} />
        </div>

        {/* Doctors on Duty */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[180px]">
          <UserSquare2 className="absolute top-4 left-4 text-[#14b8a6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Doctors on Duty</p>
            <h3 className="text-4xl font-bold text-[#14b8a6] mt-3">18</h3>
          </div>
          <ChevronDown className="text-gray-300 mt-4 cursor-pointer hover:text-gray-400" size={20} />
        </div>
      </div>

      {/* Bottom Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Emergency Cases */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#ef4444] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <AlertTriangle className="absolute top-4 left-4 text-[#ef4444]" fill="#fecaca" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Emergency Cases</p>
            <h3 className="text-4xl font-bold text-[#ef4444] mt-3">7</h3>
          </div>
          <ChevronDown className="text-gray-300 mt-4 cursor-pointer hover:text-gray-400" size={20} />
        </div>

        {/* ICU Occupancy */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#a855f7] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <TrendingUp className="absolute top-4 left-4 text-[#a855f7]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">ICU Occupancy</p>
            <h3 className="text-4xl font-bold text-[#a855f7] mt-3">88%</h3>
          </div>
          <ChevronDown className="text-gray-300 mt-4 cursor-pointer hover:text-gray-400" size={20} />
        </div>

        {/* Empty slots to match layout visually if needed, or charts can go here */}
        <div className="lg:col-span-2 hidden lg:block"></div>
      </div>

      {/* Charts Section (Placeholders for visual consistency with your previous requirements) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col items-center justify-center text-gray-400">
          <p className="font-semibold text-gray-800 mb-2">Patient Admission Trend</p>
          <p className="text-sm">(Chart Placeholder)</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col items-center justify-center text-gray-400">
          <p className="font-semibold text-gray-800 mb-2">Bed Occupancy by Department</p>
          <p className="text-sm">(Chart Placeholder)</p>
        </div>
      </div>
    </div>
  );
}
