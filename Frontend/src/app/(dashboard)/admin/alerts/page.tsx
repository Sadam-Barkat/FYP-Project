"use client";

import { useState, useEffect } from "react";
import { mockAlerts } from "@/lib/mockData";
import { AlertTriangle, Bell, Clock, Activity } from "lucide-react";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(mockAlerts);

  // Fake real-time updates for alerts
  useEffect(() => {
    const interval = setInterval(() => {
      setAlerts(prev => {
        // Randomly remove the oldest alert and add a new one sometimes
        if (Math.random() > 0.7 && prev.length > 0) {
          const newAlerts = [...prev];
          if (Math.random() > 0.5) {
            // Add a random generic alert
            const types: ("danger" | "warning" | "info")[] = ["danger", "warning", "info"];
            const depts = ["ICU", "Emergency", "Pharmacy", "Laboratory"];
            const randomType = types[Math.floor(Math.random() * types.length)];
            const randomDept = depts[Math.floor(Math.random() * depts.length)];
            
            newAlerts.unshift({
              id: `A-00${Math.floor(Math.random() * 1000) + 10}`,
              message: `System generated anomaly detected in ${randomDept}`,
              time: "Just now",
              type: randomType,
              department: randomDept
            });
          }
          // Keep array size manageable
          if (newAlerts.length > 8) newAlerts.pop();
          return newAlerts;
        }
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const dangerCount = alerts.filter(a => a.type === "danger").length;
  const warningCount = alerts.filter(a => a.type === "warning").length;

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-semibold text-[#0066cc]">Alerts & Monitoring</h2>
      </div>

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#ef4444] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <AlertTriangle className="absolute top-4 left-4 text-[#ef4444]" fill="#fecaca" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Critical Emergencies</p>
            <h3 className="text-4xl font-bold text-[#ef4444] mt-3 animate-pulse">{dangerCount}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-red-500 font-medium">Requires immediate action</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Bell className="absolute top-4 left-4 text-[#f97316]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Active Warnings</p>
            <h3 className="text-4xl font-bold text-[#f97316] mt-3">{warningCount}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Monitor closely</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#3b82f6] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Clock className="absolute top-4 left-4 text-[#3b82f6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Avg Response Time</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">2.4m</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">-0.3m vs yesterday</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Activity className="absolute top-4 left-4 text-[#22c55e]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Resolved Today</p>
            <h3 className="text-4xl font-bold text-[#22c55e] mt-3">45</h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Issues cleared</p>
        </div>
      </div>

      {/* Main Alerts List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-8">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <h3 className="text-xl font-semibold text-gray-800">Real-Time Alerts Feed</h3>
          <span className="bg-[#e6f2ff] text-[#0066cc] text-xs font-bold px-3 py-1 rounded-full flex items-center">
            <span className="w-2 h-2 rounded-full bg-[#0066cc] animate-ping mr-2"></span>
            Live Monitoring
          </span>
        </div>
        
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No active alerts currently.</p>
          ) : (
            alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`p-5 rounded-lg border-l-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md ${
                  alert.type === "danger" ? "border-l-[#ef4444] bg-[#fef2f2]" : 
                  alert.type === "warning" ? "border-l-[#f97316] bg-[#fff7ed]" : 
                  "border-l-[#3b82f6] bg-[#eff6ff]"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-1 rounded-full p-2 ${
                    alert.type === "danger" ? "bg-red-200 text-red-700" : 
                    alert.type === "warning" ? "bg-orange-200 text-orange-700" : 
                    "bg-blue-200 text-blue-700"
                  }`}>
                    {alert.type === "danger" ? <AlertTriangle size={20} /> : 
                     alert.type === "warning" ? <Bell size={20} /> : 
                     <Activity size={20} />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{alert.message}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium text-gray-700">Department:</span> {alert.department} 
                      <span className="mx-2">•</span> 
                      <span className="font-medium text-gray-700">ID:</span> {alert.id}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 border-gray-200/50 pt-3 sm:pt-0">
                  <span className="text-sm font-medium text-gray-500 flex items-center">
                    <Clock size={14} className="mr-1" />
                    {alert.time}
                  </span>
                  <button className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
                    alert.type === "danger" ? "text-red-700 hover:bg-red-200" : 
                    alert.type === "warning" ? "text-orange-700 hover:bg-orange-200" : 
                    "text-blue-700 hover:bg-blue-200"
                  }`}>
                    Acknowledge
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}