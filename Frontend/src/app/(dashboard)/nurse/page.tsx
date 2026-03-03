"use client";

import { useState, FormEvent } from "react";
import { nursePatients } from "@/lib/mockData";
import { 
  Activity, HeartPulse, Thermometer, Wind, 
  CheckCircle, AlertTriangle, User, RefreshCw, Loader2 
} from "lucide-react";

type VitalsForm = {
  heartRate: string;
  bpSys: string;
  bpDia: string;
  spo2: string;
  temperature: string;
  respRate: string;
};

type AIResult = "Normal" | "Critical" | "Emergency" | null;

export default function NurseDashboardPage() {
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [formData, setFormData] = useState<VitalsForm>({
    heartRate: "",
    bpSys: "",
    bpDia: "",
    spo2: "",
    temperature: "",
    respRate: "",
  });
  
  const [errors, setErrors] = useState<Partial<Record<keyof VitalsForm, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AIResult>(null);
  const [showToast, setShowToast] = useState(false);

  const selectedPatient = nursePatients.find(p => p.id === selectedPatientId);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof VitalsForm, string>> = {};
    
    const hr = parseInt(formData.heartRate);
    if (!formData.heartRate || hr < 30 || hr > 220) newErrors.heartRate = "Valid range: 30-220";
    
    const sys = parseInt(formData.bpSys);
    if (!formData.bpSys || sys < 70 || sys > 200) newErrors.bpSys = "Range: 70-200";
    
    const dia = parseInt(formData.bpDia);
    if (!formData.bpDia || dia < 40 || dia > 130) newErrors.bpDia = "Range: 40-130";
    
    const spo2 = parseInt(formData.spo2);
    if (!formData.spo2 || spo2 < 50 || spo2 > 100) newErrors.spo2 = "Valid range: 50-100";
    
    const temp = parseFloat(formData.temperature);
    if (!formData.temperature || temp < 32 || temp > 43) newErrors.temperature = "Valid range: 32-43°C";
    
    const rr = parseInt(formData.respRate);
    if (!formData.respRate || rr < 8 || rr > 60) newErrors.respRate = "Valid range: 8-60";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateMockAIResult = (data: VitalsForm): AIResult => {
    const hr = parseInt(data.heartRate);
    const spo2 = parseInt(data.spo2);
    const sys = parseInt(data.bpSys);

    if (hr > 130 || hr < 40 || spo2 < 90 || sys < 80 || sys > 180) {
      return "Emergency";
    }
    if (hr > 100 || spo2 < 95 || sys > 140) {
      return "Critical";
    }
    return "Normal";
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    
    if (validateForm()) {
      setIsSubmitting(true);
      setResult(null);
      
      // Simulate API call and AI assessment
      setTimeout(() => {
        const aiAssessment = calculateMockAIResult(formData);
        setResult(aiAssessment);
        setIsSubmitting(false);
        
        // Show success toast
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }, 1500);
    }
  };

  const handleReset = () => {
    setFormData({ heartRate: "", bpSys: "", bpDia: "", spo2: "", temperature: "", respRate: "" });
    setErrors({});
    setResult(null);
    setSelectedPatientId("");
  };

  return (
    <div id="dashboard-content" className="w-full max-w-4xl mx-auto space-y-6 pb-12 transition-colors">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-semibold text-[#1e40af] dark:text-[#60a5fa]">Record Patient Vitals</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter latest vital signs to trigger AI assessment.</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
        {/* Patient Selection */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Select Patient
          </label>
          <select 
            value={selectedPatientId}
            onChange={(e) => {
              setSelectedPatientId(e.target.value);
              setResult(null); // Reset result when changing patient
            }}
            className="w-full md:w-1/2 p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 transition-colors"
          >
            <option value="">-- Choose a patient --</option>
            {nursePatients.map(p => (
              <option key={p.id} value={p.id}>
                {p.id} - {p.name} ({p.ward}, Bed {p.bed})
              </option>
            ))}
          </select>

          {selectedPatient && (
            <div className="mt-4 flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 inline-flex shadow-sm transition-colors">
              <div className="w-10 h-10 rounded-full bg-[#e6f2ff] dark:bg-[#1e3a8a] flex items-center justify-center text-[#0066cc] dark:text-[#60a5fa]">
                <User size={20} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedPatient.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedPatient.age} yrs • {selectedPatient.gender === 'M' ? 'Male' : 'Female'} • Bed {selectedPatient.bed}</p>
              </div>
            </div>
          )}
        </div>

        {/* Vitals Form */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Heart Rate */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <HeartPulse size={16} className="text-red-400" /> Heart Rate (bpm)
                </label>
                <input
                  type="number"
                  value={formData.heartRate}
                  onChange={(e) => setFormData({...formData, heartRate: e.target.value})}
                  disabled={!selectedPatientId || isSubmitting}
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-[#0066cc] transition-colors ${errors.heartRate ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white'}`}
                  placeholder="e.g. 75"
                />
                {errors.heartRate && <p className="text-xs text-red-500 mt-1">{errors.heartRate}</p>}
              </div>

              {/* Blood Pressure */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Activity size={16} className="text-blue-400" /> Blood Pressure (mmHg)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={formData.bpSys}
                      onChange={(e) => setFormData({...formData, bpSys: e.target.value})}
                      disabled={!selectedPatientId || isSubmitting}
                      className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-[#0066cc] transition-colors ${errors.bpSys ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white'}`}
                      placeholder="Sys"
                    />
                  </div>
                  <span className="text-gray-400 font-bold">/</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={formData.bpDia}
                      onChange={(e) => setFormData({...formData, bpDia: e.target.value})}
                      disabled={!selectedPatientId || isSubmitting}
                      className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-[#0066cc] transition-colors ${errors.bpDia ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white'}`}
                      placeholder="Dia"
                    />
                  </div>
                </div>
                {(errors.bpSys || errors.bpDia) && (
                  <p className="text-xs text-red-500 mt-1">{errors.bpSys || errors.bpDia}</p>
                )}
              </div>

              {/* SpO2 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Wind size={16} className="text-sky-400" /> SpO2 (%)
                </label>
                <input
                  type="number"
                  value={formData.spo2}
                  onChange={(e) => setFormData({...formData, spo2: e.target.value})}
                  disabled={!selectedPatientId || isSubmitting}
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-[#0066cc] transition-colors ${errors.spo2 ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white'}`}
                  placeholder="e.g. 98"
                />
                {errors.spo2 && <p className="text-xs text-red-500 mt-1">{errors.spo2}</p>}
              </div>

              {/* Temperature */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Thermometer size={16} className="text-orange-400" /> Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({...formData, temperature: e.target.value})}
                  disabled={!selectedPatientId || isSubmitting}
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-[#0066cc] transition-colors ${errors.temperature ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white'}`}
                  placeholder="e.g. 37.2"
                />
                {errors.temperature && <p className="text-xs text-red-500 mt-1">{errors.temperature}</p>}
              </div>

              {/* Respiratory Rate */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Activity size={16} className="text-purple-400" /> Resp. Rate (bpm)
                </label>
                <input
                  type="number"
                  value={formData.respRate}
                  onChange={(e) => setFormData({...formData, respRate: e.target.value})}
                  disabled={!selectedPatientId || isSubmitting}
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-[#0066cc] transition-colors ${errors.respRate ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white'}`}
                  placeholder="e.g. 16"
                />
                {errors.respRate && <p className="text-xs text-red-500 mt-1">{errors.respRate}</p>}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3 transition-colors">
              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Clear Form
              </button>
              <button
                type="submit"
                disabled={!selectedPatientId || isSubmitting}
                className="px-6 py-2.5 bg-[#0066cc] hover:bg-[#0052a3] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Activity size={18} />}
                Record Vitals
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* AI Result Card */}
      {result && (
        <div className={`rounded-xl p-6 shadow-sm border transition-colors ${
          result === 'Normal' ? 'bg-[#f0fdf4] dark:bg-green-900/10 border-[#10b981] dark:border-green-800' : 
          result === 'Critical' ? 'bg-[#fffbeb] dark:bg-orange-900/10 border-[#f59e0b] dark:border-orange-800' : 
          'bg-[#fef2f2] dark:bg-red-900/10 border-[#ef4444] dark:border-red-800 animate-pulse'
        }`}>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center shrink-0 ${
              result === 'Normal' ? 'bg-[#10b981]/20 text-[#10b981]' : 
              result === 'Critical' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 
              'bg-[#ef4444]/20 text-[#ef4444]'
            }`}>
              {result === 'Normal' ? <CheckCircle size={40} /> : <AlertTriangle size={40} />}
            </div>
            <div className="text-center sm:text-left flex-1">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                AI Condition: <span className={
                  result === 'Normal' ? 'text-[#10b981]' : 
                  result === 'Critical' ? 'text-[#f59e0b]' : 'text-[#ef4444]'
                }>{result}</span>
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                {result === 'Normal' && "Patient vitals are stable. Routine monitoring continues."}
                {result === 'Critical' && "Vitals indicate deterioration. Doctor has been notified for review."}
                {result === 'Emergency' && "CRITICAL ALERT: Emergency protocol triggered. Medical team dispatched."}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <RefreshCw size={16} /> Next Patient
            </button>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle size={20} className="text-[#10b981]" />
          <span className="font-medium">Vitals recorded and AI analyzed successfully.</span>
        </div>
      )}
    </div>
  );
}
