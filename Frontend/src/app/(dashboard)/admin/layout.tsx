"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const BILLING_ONLY_PREFIX = "/admin/billing-finance";

/**
 * Finance users are restricted to Billing & Finance; other /admin routes redirect here.
 */
export default function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;
    const role =
      sessionStorage.getItem("userRole") ?? localStorage.getItem("userRole") ?? "";
    if (role !== "finance") return;
    if (pathname === BILLING_ONLY_PREFIX || pathname.startsWith(`${BILLING_ONLY_PREFIX}/`)) return;
    router.replace(BILLING_ONLY_PREFIX);
  }, [pathname, router]);

  return <>{children}</>;
}
