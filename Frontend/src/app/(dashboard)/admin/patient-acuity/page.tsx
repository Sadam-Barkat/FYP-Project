import { redirect } from "next/navigation";

/** Briefings may link here; vitals acuity KPIs live on Analytics & Forecasts. */
export default function PatientAcuityPage() {
  redirect("/admin/analytics");
}
