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
