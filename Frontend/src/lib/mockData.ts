export type Status = "Normal" | "Critical" | "Emergency";

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  department: string;
  bed: string;
  status: Status;
  lastUpdated: string;
}

export interface KPI {
  title: string;
  value: number | string;
  trend: "up" | "down" | "neutral";
  trendValue: string;
  status: "good" | "warning" | "danger";
}

export interface Alert {
  id: string;
  message: string;
  time: string;
  type: "warning" | "danger" | "info";
  department: string;
}

// ---------------- DOCTOR DATA ---------------- //

export interface LastVitals {
  heartRate: number;
  bloodPressure: string;
  spo2: number;
  temperature: number;
  respRate: number;
}

export interface DoctorPatient {
  id: string;
  name: string;
  age: number;
  gender: "M" | "F";
  bed: string;
  ward: string;
  status: Status;
  lastUpdated: string;
  lastVitals: LastVitals;
  alerts: string[];
}

export interface VitalsHistoryPoint {
  time: string;
  heartRate: number;
  bloodPressureSys: number;
  bloodPressureDia: number;
  spo2: number;
  temperature: number;
  respRate: number;
}

export interface DoctorAnalytics {
  totalTreated: number;
  discharges: number;
  avgRecovery: number;
  recoveryRate: number;
  alertsResolved: number;
  conditions: {
    normal: number;
    critical: number;
    emergency: number;
  };
  treatmentTrend: { week: string; count: number }[];
  recentDischarges: { name: string; date: string; outcome: string }[];
}

export const mockDoctorAnalytics: DoctorAnalytics = {
  totalTreated: 150,
  discharges: 120,
  avgRecovery: 5.2,
  recoveryRate: 80,
  alertsResolved: 45,
  conditions: {
    normal: 40,
    critical: 30,
    emergency: 30,
  },
  treatmentTrend: [
    { week: "Week 1", count: 25 },
    { week: "Week 2", count: 28 },
    { week: "Week 3", count: 32 },
    { week: "Week 4", count: 30 },
    { week: "Week 5", count: 35 },
  ],
  recentDischarges: [
    { name: "John Doe", date: "Today", outcome: "Recovered" },
    { name: "Alice Smith", date: "Yesterday", outcome: "Transferred" },
    { name: "Bob Johnson", date: "2 days ago", outcome: "Recovered" },
    { name: "Emma Brown", date: "3 days ago", outcome: "Recovered" },
  ],
};

// ---------------- OVERVIEW DATA ---------------- //
export const mockKPIs: KPI[] = [
  { title: "Total Patients", value: 142, trend: "up", trendValue: "+5%", status: "good" },
  { title: "Critical Patients", value: 18, trend: "up", trendValue: "+2", status: "warning" },
  { title: "Emergencies", value: 3, trend: "down", trendValue: "-1", status: "danger" },
  { title: "Available Beds", value: 24, trend: "down", trendValue: "-4", status: "warning" },
];

export const mockPatients: Patient[] = [
  { id: "P-1001", name: "Ahmed Khan", age: 45, gender: "M", department: "ICU", bed: "ICU-01", status: "Critical", lastUpdated: "2 mins ago" },
  { id: "P-1002", name: "Sara Ali", age: 32, gender: "F", department: "Wards", bed: "W-12", status: "Normal", lastUpdated: "15 mins ago" },
  { id: "P-1003", name: "Muhammad Usman", age: 68, gender: "M", department: "Emergency", bed: "ER-05", status: "Emergency", lastUpdated: "Just now" },
  { id: "P-1004", name: "Fatima Bilal", age: 28, gender: "F", department: "Wards", bed: "W-08", status: "Normal", lastUpdated: "1 hour ago" },
  { id: "P-1005", name: "Zainab Tariq", age: 55, gender: "F", department: "ICU", bed: "ICU-04", status: "Critical", lastUpdated: "5 mins ago" },
];

export const mockAlerts: Alert[] = [
  { id: "A-001", message: "Patient P-1003 SpO2 dropped below 90%", time: "2 mins ago", type: "danger", department: "Emergency" },
  { id: "A-002", message: "Pharmacy stock low: Paracetamol", time: "15 mins ago", type: "warning", department: "Pharmacy" },
  { id: "A-003", message: "ICU Bed capacity at 90%", time: "1 hour ago", type: "warning", department: "ICU" },
  { id: "A-004", message: "Doctor shift change in 10 mins", time: "5 mins ago", type: "info", department: "HR" },
];

export const mockChartData = [
  { time: "08:00", normal: 100, critical: 15, emergency: 2 },
  { time: "10:00", normal: 105, critical: 14, emergency: 3 },
  { time: "12:00", normal: 110, critical: 16, emergency: 1 },
  { time: "14:00", normal: 115, critical: 18, emergency: 4 },
  { time: "16:00", normal: 120, critical: 17, emergency: 3 },
  { time: "18:00", normal: 121, critical: 18, emergency: 3 },
];

// ---------------- PATIENTS & BEDS ---------------- //
export const mockBedsData = [
  { department: "ICU", total: 50, occupied: 45 },
  { department: "Emergency", total: 80, occupied: 75 },
  { department: "General Ward", total: 100, occupied: 90 },
  { department: "Cardiology", total: 40, occupied: 30 },
  { department: "Neurology", total: 30, occupied: 15 },
];

export const mockAdmissionsTrend = [
  { day: "Mon", admissions: 42, discharges: 30 },
  { day: "Tue", admissions: 50, discharges: 35 },
  { day: "Wed", admissions: 45, discharges: 40 },
  { day: "Thu", admissions: 60, discharges: 50 },
  { day: "Fri", admissions: 55, discharges: 45 },
  { day: "Sat", admissions: 30, discharges: 60 },
  { day: "Sun", admissions: 25, discharges: 40 },
];

// ---------------- PHARMACY ---------------- //
export const mockPharmacyStock = [
  { id: "MED-01", name: "Paracetamol", category: "Analgesic", quantity: 12, unit: "Boxes", status: "Low", reorderLevel: 20 },
  { id: "MED-02", name: "Amoxicillin", category: "Antibiotic", quantity: 5, unit: "Bottles", status: "Critical", reorderLevel: 15 },
  { id: "MED-03", name: "Ibuprofen", category: "Analgesic", quantity: 85, unit: "Boxes", status: "Good", reorderLevel: 30 },
  { id: "MED-04", name: "Omeprazole", category: "NSAID", quantity: 45, unit: "Boxes", status: "Good", reorderLevel: 20 },
  { id: "MED-05", name: "Salbutamol", category: "Bronchodilator", quantity: 8, unit: "Inhalers", status: "Low", reorderLevel: 15 },
];

export const mockPharmacyTrend = [
  { month: "Jan", dispensed: 4000, received: 4500 },
  { month: "Feb", dispensed: 3800, received: 3000 },
  { month: "Mar", dispensed: 4200, received: 5000 },
  { month: "Apr", dispensed: 4500, received: 4000 },
  { month: "May", dispensed: 5100, received: 6000 },
  { month: "Jun", dispensed: 4800, received: 4200 },
];

// ---------------- LABORATORY ---------------- //
export const mockLabTests = [
  { type: "Blood Test (CBC)", pending: 15, completed: 85, turnaroundTime: "2.5 hrs" },
  { type: "Lipid Profile", pending: 8, completed: 42, turnaroundTime: "4 hrs" },
  { type: "Liver Function", pending: 12, completed: 30, turnaroundTime: "3.5 hrs" },
  { type: "Urinalysis", pending: 5, completed: 60, turnaroundTime: "1.5 hrs" },
  { type: "COVID-19 PCR", pending: 2, completed: 18, turnaroundTime: "12 hrs" },
];

export const mockLabTrend = [
  { date: "10/01", normal: 120, abnormal: 15 },
  { date: "10/02", normal: 135, abnormal: 12 },
  { date: "10/03", normal: 110, abnormal: 25 },
  { date: "10/04", normal: 145, abnormal: 18 },
  { date: "10/05", normal: 130, abnormal: 20 },
  { date: "10/06", normal: 150, abnormal: 14 },
  { date: "10/07", normal: 160, abnormal: 16 },
];

// ---------------- BILLING & FINANCE ---------------- //
export const mockInvoices = [
  { id: "INV-10021", patient: "Ahmed Khan", amount: "PKR 45,000", status: "Paid", date: "Today" },
  { id: "INV-10022", patient: "Sara Ali", amount: "PKR 12,500", status: "Pending", date: "Today" },
  { id: "INV-10023", patient: "Muhammad Usman", amount: "PKR 150,000", status: "Pending", date: "Yesterday" },
  { id: "INV-10024", patient: "Zainab Tariq", amount: "PKR 85,000", status: "Insurance", date: "Yesterday" },
];

export const mockRevenueTrend = [
  { day: "Mon", revenue: 120, expenses: 80 },
  { day: "Tue", revenue: 135, expenses: 85 },
  { day: "Wed", revenue: 110, expenses: 90 },
  { day: "Thu", revenue: 150, expenses: 75 },
  { day: "Fri", revenue: 165, expenses: 95 },
  { day: "Sat", revenue: 180, expenses: 110 },
  { day: "Sun", revenue: 140, expenses: 60 },
];

// ---------------- HR & STAFF ---------------- //
export const mockStaff = [
  { id: "DOC-01", name: "Dr. Ayesha", role: "Cardiologist", department: "Cardiology", status: "On Duty" },
  { id: "DOC-02", name: "Dr. Bilal", role: "General Surgeon", department: "Surgery", status: "On Leave" },
  { id: "NUR-01", name: "Nurse Fatima", role: "Head Nurse", department: "ICU", status: "On Duty" },
  { id: "NUR-02", name: "Nurse Sana", role: "Staff Nurse", department: "Emergency", status: "Off Duty" },
  { id: "TECH-01", name: "Mr. Ali", role: "Lab Technician", department: "Laboratory", status: "On Duty" },
];

export const mockAttendanceTrend = [
  { date: "01/10", present: 95, absent: 5, late: 2 },
  { date: "02/10", present: 94, absent: 6, late: 3 },
  { date: "03/10", present: 98, absent: 2, late: 1 },
  { date: "04/10", present: 90, absent: 10, late: 4 },
  { date: "05/10", present: 96, absent: 4, late: 2 },
];

// ---------------- ANALYTICS & FORECASTS ---------------- //
export const mockForecastData = [
  { month: "Aug", actual: 1200, forecast: 1180 },
  { month: "Sep", actual: 1350, forecast: 1300 },
  { month: "Oct", actual: 1420, forecast: 1400 },
  { month: "Nov", actual: null, forecast: 1550 },
  { month: "Dec", actual: null, forecast: 1600 },
  { month: "Jan", actual: null, forecast: 1450 },
];

// Assigned patients for Doctor role (personalized)
export const assignedPatients: DoctorPatient[] = [
  {
    id: "P-1003",
    name: "Muhammad Usman",
    age: 68,
    gender: "M",
    bed: "ER-05",
    ward: "Emergency",
    status: "Emergency",
    lastUpdated: "Just now",
    lastVitals: {
      heartRate: 132,
      bloodPressure: "88/56",
      spo2: 88,
      temperature: 38.9,
      respRate: 30,
    },
    alerts: ["SpO2 below 90%", "Hypotension detected"],
  },
  {
    id: "P-1001",
    name: "Ahmed Khan",
    age: 45,
    gender: "M",
    bed: "ICU-01",
    ward: "ICU",
    status: "Critical",
    lastUpdated: "2 mins ago",
    lastVitals: {
      heartRate: 118,
      bloodPressure: "92/60",
      spo2: 92,
      temperature: 38.2,
      respRate: 26,
    },
    alerts: ["Tachycardia trend", "Rising temperature"],
  },
  {
    id: "P-1005",
    name: "Zainab Tariq",
    age: 55,
    gender: "F",
    bed: "ICU-04",
    ward: "ICU",
    status: "Critical",
    lastUpdated: "5 mins ago",
    lastVitals: {
      heartRate: 104,
      bloodPressure: "110/70",
      spo2: 95,
      temperature: 37.9,
      respRate: 22,
    },
    alerts: ["ICU stay > 5 days"],
  },
  {
    id: "P-1002",
    name: "Sara Ali",
    age: 32,
    gender: "F",
    bed: "W-12",
    ward: "General Ward",
    status: "Normal",
    lastUpdated: "15 mins ago",
    lastVitals: {
      heartRate: 84,
      bloodPressure: "118/76",
      spo2: 98,
      temperature: 36.9,
      respRate: 18,
    },
    alerts: [],
  },
  {
    id: "P-1004",
    name: "Fatima Bilal",
    age: 28,
    gender: "F",
    bed: "W-08",
    ward: "General Ward",
    status: "Normal",
    lastUpdated: "1 hour ago",
    lastVitals: {
      heartRate: 78,
      bloodPressure: "120/80",
      spo2: 99,
      temperature: 36.7,
      respRate: 16,
    },
    alerts: ["Planned discharge in 24h"],
  },
];

// Detailed vitals history per patient (used in doctor detail view)
export const vitalsHistoryByPatient: Record<string, VitalsHistoryPoint[]> = {
  "P-1003": [
    { time: "08:00", heartRate: 128, bloodPressureSys: 90, bloodPressureDia: 58, spo2: 90, temperature: 38.4, respRate: 28 },
    { time: "10:00", heartRate: 130, bloodPressureSys: 88, bloodPressureDia: 56, spo2: 89, temperature: 38.7, respRate: 29 },
    { time: "12:00", heartRate: 132, bloodPressureSys: 86, bloodPressureDia: 55, spo2: 88, temperature: 38.9, respRate: 30 },
    { time: "14:00", heartRate: 135, bloodPressureSys: 84, bloodPressureDia: 54, spo2: 87, temperature: 39.1, respRate: 32 },
  ],
  "P-1001": [
    { time: "08:00", heartRate: 110, bloodPressureSys: 98, bloodPressureDia: 64, spo2: 94, temperature: 37.9, respRate: 24 },
    { time: "10:00", heartRate: 112, bloodPressureSys: 96, bloodPressureDia: 62, spo2: 93, temperature: 38.0, respRate: 25 },
    { time: "12:00", heartRate: 118, bloodPressureSys: 92, bloodPressureDia: 60, spo2: 92, temperature: 38.2, respRate: 26 },
    { time: "14:00", heartRate: 115, bloodPressureSys: 94, bloodPressureDia: 61, spo2: 93, temperature: 38.0, respRate: 24 },
  ],
  "P-1005": [
    { time: "08:00", heartRate: 98, bloodPressureSys: 112, bloodPressureDia: 72, spo2: 96, temperature: 37.5, respRate: 20 },
    { time: "10:00", heartRate: 102, bloodPressureSys: 110, bloodPressureDia: 70, spo2: 95, temperature: 37.8, respRate: 21 },
    { time: "12:00", heartRate: 104, bloodPressureSys: 110, bloodPressureDia: 70, spo2: 95, temperature: 37.9, respRate: 22 },
    { time: "14:00", heartRate: 100, bloodPressureSys: 112, bloodPressureDia: 72, spo2: 96, temperature: 37.6, respRate: 21 },
  ],
  "P-1002": [
    { time: "08:00", heartRate: 80, bloodPressureSys: 118, bloodPressureDia: 76, spo2: 98, temperature: 36.8, respRate: 18 },
    { time: "10:00", heartRate: 82, bloodPressureSys: 118, bloodPressureDia: 76, spo2: 98, temperature: 36.9, respRate: 18 },
    { time: "12:00", heartRate: 84, bloodPressureSys: 118, bloodPressureDia: 76, spo2: 98, temperature: 36.9, respRate: 18 },
    { time: "14:00", heartRate: 83, bloodPressureSys: 118, bloodPressureDia: 76, spo2: 99, temperature: 36.8, respRate: 17 },
  ],
  "P-1004": [
    { time: "08:00", heartRate: 76, bloodPressureSys: 120, bloodPressureDia: 80, spo2: 98, temperature: 36.7, respRate: 16 },
    { time: "10:00", heartRate: 78, bloodPressureSys: 120, bloodPressureDia: 80, spo2: 99, temperature: 36.7, respRate: 16 },
    { time: "12:00", heartRate: 78, bloodPressureSys: 120, bloodPressureDia: 80, spo2: 99, temperature: 36.7, respRate: 16 },
    { time: "14:00", heartRate: 77, bloodPressureSys: 120, bloodPressureDia: 80, spo2: 99, temperature: 36.7, respRate: 16 },
  ],
};
