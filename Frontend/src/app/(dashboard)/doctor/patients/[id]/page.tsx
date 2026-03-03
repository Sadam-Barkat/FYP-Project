"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { assignedPatients, vitalsHistoryByPatient, DoctorPatient, VitalsHistoryPoint } from "@/lib/mockData";
import { 
  ArrowLeft, HeartPulse, Activity, Thermometer, 
  Wind, AlertTriangle, ChevronDown, Clock 
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from "recharts";

function getStatusClasses(status: DoctorPatient['status']) {
  switch (status) {
    case "Normal":
      return "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20";
    case "Critical":
      return "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20";
    case "Emergency":
      return "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20 animate-pulse";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [patient, setPatient] = useState<DoctorPatient | null>(null);
  const [history, setHistory] = useState<VitalsHistoryPoint[]>([]);

  // Load initial data
  useEffect(() => {
    if (id) {
      const found = assignedPatients.find(p => p.id === id);
      if (found) {
        setPatient(found);
        setHistory(vitalsHistoryByPatient[id] || []);
      }
    }
  }, [id]);

  // Fake real-time updates for chart and vitals
  useEffect(() => {
    if (!patient) return;
    
    const interval = setInterval(() => {
      // Create a slight fluctuation in current vitals
      setPatient(prev => {
        if (!prev) return prev;
        const hrChange = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return {
          ...prev,
          lastUpdated: "Just now",
          lastVitals: {
            ...prev.lastVitals,
            heartRate: Math.max(40, prev.lastVitals.heartRate + hrChange)
          }
        };
      });

      // Periodically add a new data point to history chart to simulate live tracking
      if (Math.random() > 0.7) {
        setHistory(prev => {
          if (!prev.length) return prev;
          const lastPoint = prev[prev.length - 1];
          const newPoint = {
            ...lastPoint,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            heartRate: lastPoint.heartRate + (Math.floor(Math.random() * 5) - 2),
            spo2: Math.min(100, Math.max(80, lastPoint.spo2 + (Math.floor(Math.random() * 3) - 1)))
          };
          const newHistory = [...prev, newPoint];
          if (newHistory.length > 8) newHistory.shift(); // Keep array small
          return newHistory;
        });
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [patient?.id]);

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading patient data...
      </div>
    );
  }

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{patient.name}</h2>
            <p className="text-sm text-gray-500">
              ID: {patient.id} • {patient.age} yrs, {patient.gender === 'M' ? 'Male' : 'Female'} • {patient.ward}, Bed {patient.bed}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to discharge this patient?")) {
                const index = assignedPatients.findIndex(p => p.id === patient.id);
                if (index !== -1) assignedPatients.splice(index, 1);
                alert("Patient discharged successfully.");
                router.push("/doctor");
              }
            }}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            Discharge Patient
          </button>
          <div className={`px-5 py-2.5 rounded-xl border-2 flex items-center gap-3 shadow-sm ${getStatusClasses(patient.status)}`}>
            <div className="w-3 h-3 rounded-full bg-current"></div>
            <span className="font-bold text-lg">{patient.status} Condition</span>
          </div>
        </div>
      </div>

      {/* Emergency Banner */}
      {patient.status === 'Emergency' && (
        <div className="bg-red-500 text-white rounded-xl p-4 flex items-center gap-3 shadow-sm animate-pulse">
          <AlertTriangle size={24} />
          <div>
            <p className="font-bold">CRITICAL ATTENTION REQUIRED</p>
            <p className="text-sm text-red-100">AI has detected severe deterioration in vital signs. Immediate intervention recommended.</p>
          </div>
        </div>
      )}

      {/* Vitals Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-red-400"></div>
          <HeartPulse className="text-red-400 mb-2" size={28} />
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Heart Rate</p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-gray-900">{patient.lastVitals.heartRate}</h3>
            <span className="text-sm font-medium text-gray-500">bpm</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-blue-400"></div>
          <Activity className="text-blue-400 mb-2" size={28} />
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Blood Pressure</p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-gray-900">{patient.lastVitals.bloodPressure}</h3>
            <span className="text-sm font-medium text-gray-500">mmHg</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-sky-400"></div>
          <Wind className="text-sky-400 mb-2" size={28} />
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">SpO2</p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-gray-900">{patient.lastVitals.spo2}</h3>
            <span className="text-sm font-medium text-gray-500">%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-orange-400"></div>
          <Thermometer className="text-orange-400 mb-2" size={28} />
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Temperature</p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-gray-900">{patient.lastVitals.temperature}</h3>
            <span className="text-sm font-medium text-gray-500">°C</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-purple-400"></div>
          <Activity className="text-purple-400 mb-2" size={28} />
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Resp Rate</p>
          <div className="flex items-baseline gap-1 mt-1">
            <h3 className="text-3xl font-bold text-gray-900">{patient.lastVitals.respRate}</h3>
            <span className="text-sm font-medium text-gray-500">/min</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-[400px]">
          <h3 className="font-semibold text-gray-800 mb-4">Vitals Trend (Last 24 Hours)</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={history} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Line yAxisId="left" type="monotone" dataKey="heartRate" name="Heart Rate" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="spo2" name="SpO2 %" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line yAxisId="left" type="monotone" dataKey="bloodPressureSys" name="BP Sys" stroke="#3b82f6" strokeWidth={3} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          {/* Active Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center justify-between">
              Active Alerts
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {patient.alerts.length}
              </span>
            </h3>
            
            {patient.alerts.length > 0 ? (
              <ul className="space-y-3">
                {patient.alerts.map((alert, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={16} />
                    <span className="text-sm font-medium text-orange-900">{alert}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6 text-gray-500 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
                  <Activity className="text-green-500" size={20} />
                </div>
                <p className="text-sm">No active alerts</p>
                <p className="text-xs text-gray-400 mt-1">Patient vitals are stable</p>
              </div>
            )}
          </div>

          {/* Vitals History List (Collapsible fake) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Recent Readings Log</h3>
            <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
              {history.slice(-3).reverse().map((point, idx) => (
                <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-2">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-gray-100 text-gray-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <Clock size={16} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded border border-gray-100 bg-gray-50 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900 text-sm">{point.time}</span>
                    </div>
                    <p className="text-xs text-gray-600">HR: {point.heartRate} | BP: {point.bloodPressureSys}/{point.bloodPressureDia}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Load more history <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
