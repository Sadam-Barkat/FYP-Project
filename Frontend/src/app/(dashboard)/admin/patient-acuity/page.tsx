"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy / LLM-generated link. Vitals acuity detail lives on Analytics (anchored section).
 * Client navigation preserves the #fragment (server redirect often drops it).
 */
export default function PatientAcuityPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/analytics#analytics-vitals-condition-mix");
  }, [router]);
  return (
    <div className="dashboard-page-shell max-w-7xl py-10 text-sm text-gray-500">
      Opening Analytics → Vitals condition mix…
    </div>
  );
}
