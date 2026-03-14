"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPatientsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/staff");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[200px] text-gray-500">
      Redirecting to Staff & Patients…
    </div>
  );
}
