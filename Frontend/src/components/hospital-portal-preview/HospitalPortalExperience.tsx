"use client";

import { AnimatePresence } from "framer-motion";
import { Suspense, useState } from "react";
import { LandingPage } from "./LandingPage";
import { LoginPage } from "./LoginPage";

export type HospitalPortalExperienceProps = {
  /** When true (e.g. /login route), skip landing and show sign-in immediately */
  initialShowLogin?: boolean;
};

export default function HospitalPortalExperience({
  initialShowLogin = false,
}: HospitalPortalExperienceProps) {
  const [showLogin, setShowLogin] = useState(initialShowLogin);

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#050508] px-[max(10px,env(safe-area-inset-left))] pt-[max(6px,env(safe-area-inset-top))] pr-[max(10px,env(safe-area-inset-right))] pb-[max(6px,env(safe-area-inset-bottom))] md:px-5 md:py-6">
      {/* Slow drifting aurora — unique ambient depth */}
      <div className="portal-unique-ambient" aria-hidden>
        <span className="portal-orb portal-orb-a" />
        <span className="portal-orb portal-orb-b" />
        <span className="portal-orb portal-orb-c" />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-[#070712]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_65%_at_50%_-15%,rgba(26,111,255,0.35),transparent_58%),radial-gradient(ellipse_55%_45%_at_95%_65%,rgba(255,45,120,0.14),transparent_52%),radial-gradient(ellipse_45%_40%_at_8%_80%,rgba(0,229,255,0.08),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,12,0.2)_0%,rgba(5,6,12,0.92)_100%)]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col items-stretch justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          {!showLogin ? (
            <div
              key="landing-wrap"
              className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden"
            >
              <LandingPage key="landing" onLoginClick={() => setShowLogin(true)} />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,22.5rem)] flex-1 flex-col justify-center sm:max-w-[min(100%,26rem)] md:max-w-[min(100%,920px)]">
                  <div className="h-[min(440px,70vh)] w-full animate-pulse rounded-[17px] bg-white/[0.06] md:rounded-[22px]" />
                </div>
              }
            >
              <div className="flex min-h-0 w-full flex-1 flex-col items-stretch overflow-hidden">
                <LoginPage key="login" onBackToLanding={() => setShowLogin(false)} />
              </div>
            </Suspense>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
