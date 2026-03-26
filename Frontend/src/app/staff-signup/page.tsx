import { Suspense } from "react";
import StaffSignupClient from "./StaffSignupClient";

export default function StaffSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f4f7fa] px-4 py-8">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-md border border-gray-100 p-8 text-center text-sm text-gray-500">
            Loading...
          </div>
        </div>
      }
    >
      <StaffSignupClient />
    </Suspense>
  );
}

