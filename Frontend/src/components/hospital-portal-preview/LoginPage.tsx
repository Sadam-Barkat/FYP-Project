"use client";

import staff from "@/assets/hospital-staff.png";
import { getApiBaseUrl } from "@/lib/apiBase";
import {
  getDashboardPathForRole,
  resolveEffectiveRole,
} from "@/lib/postLoginRedirect";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EyeToggle } from "./EyeToggle";
import { GlowInput } from "./GlowInput";
import { NeonCard } from "./NeonCard";

const API_BASE = getApiBaseUrl();

export function LoginPage({ onBackToLanding }: { onBackToLanding?: () => void }) {
  const searchParams = useSearchParams();
  const fromLogout = searchParams.get("logout") === "1";

  /** New ids/names every mount so saved "admin" logins don't map to these fields */
  const fieldNonce = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `f_${Date.now()}`,
    [],
  );
  const emailId = `portal-email-${fieldNonce}`;
  const passId = `portal-password-${fieldNonce}`;
  const emailName = `signin_email_${fieldNonce}`;
  const passName = `signin_pass_${fieldNonce}`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** After logout: strip query + clear React + DOM repeatedly (autofill runs async) */
  useEffect(() => {
    if (!fromLogout || typeof window === "undefined") return;

    const stripLogoutQuery = () => {
      const u = new URL(window.location.href);
      if (!u.searchParams.has("logout")) return;
      u.searchParams.delete("logout");
      const q = u.searchParams.toString();
      window.history.replaceState(
        null,
        "",
        q ? `${u.pathname}?${q}` : u.pathname,
      );
    };

    const hardClear = () => {
      setEmail("");
      setPassword("");
      const elE = document.getElementById(emailId) as HTMLInputElement | null;
      const elP = document.getElementById(passId) as HTMLInputElement | null;
      if (elE) {
        elE.value = "";
        elE.defaultValue = "";
      }
      if (elP) {
        elP.value = "";
        elP.defaultValue = "";
      }
    };

    hardClear();
    stripLogoutQuery();
    const t1 = window.setTimeout(hardClear, 50);
    const t2 = window.setTimeout(hardClear, 200);
    const t3 = window.setTimeout(hardClear, 600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [fromLogout, emailId, passId]);

  /** Reduce Chrome autofill firing before first interaction (readonly blink) */
  useEffect(() => {
    const ids = [emailId, passId];
    const raf = requestAnimationFrame(() => {
      for (const id of ids) {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (!el) continue;
        el.readOnly = true;
      }
      requestAnimationFrame(() => {
        for (const id of ids) {
          const el = document.getElementById(id) as HTMLInputElement | null;
          if (!el) continue;
          el.readOnly = false;
        }
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [emailId, passId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          typeof data?.detail === "string"
            ? data.detail
            : "Invalid email or password.",
        );
        return;
      }

      const userEmail = (data.user?.email ?? email).toString();
      const effectiveRole = resolveEffectiveRole(
        data.user?.role ?? "admin",
        userEmail,
      );

      if (typeof window !== "undefined") {
        const firstName = (data.user?.first_name ?? "").toString().trim();
        const lastName = (data.user?.last_name ?? "").toString().trim();
        const displayName =
          [firstName, lastName].filter(Boolean).join(" ") ||
          (data.user?.email ?? "").toString();

        const token = data.access_token ?? "";
        localStorage.setItem("access_token", token);
        localStorage.setItem("userRole", effectiveRole);
        localStorage.setItem("userName", displayName);
        localStorage.setItem("userEmail", userEmail.trim());
        if (data.user?.id != null) {
          const idStr = String(data.user.id);
          localStorage.setItem("userId", idStr);
          sessionStorage.setItem("userId", idStr);
        }
        sessionStorage.setItem("access_token", token);
        sessionStorage.setItem("userRole", effectiveRole);
        sessionStorage.setItem("userName", displayName);
        sessionStorage.setItem("userEmail", userEmail.trim());

        const maxAge = 60 * 30;
        document.cookie = `access_token=${data.access_token ?? ""}; Path=/; Max-Age=${maxAge}`;
        document.cookie = `userRole=${effectiveRole}; Path=/; Max-Age=${maxAge}`;
      }

      // Full navigation so Set-Cookie / document.cookie is always sent on the next load (middleware)
      const nextPath = getDashboardPathForRole(effectiveRole);
      window.location.assign(nextPath);
    } catch (err) {
      console.error("Login error", err);
      setError(
        err instanceof TypeError && err.message === "Failed to fetch"
          ? "Cannot connect to the server. Make sure the backend is running at " +
            API_BASE
          : "Login failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="mx-auto flex min-h-0 w-full max-w-[min(100%,22.5rem)] flex-1 flex-col overflow-hidden px-2 max-h-[calc(100dvh-1.25rem)] sm:max-w-[min(100%,26rem)] sm:px-3 md:max-h-[calc(100dvh-3.5rem)] md:max-w-[min(100%,920px)] md:px-5"
      initial={{ opacity: 0, x: 80 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.45,
        ease: "easeInOut",
        delay: 0.06,
      }}
    >
      <NeonCard className="group flex h-full max-h-full min-h-0 w-full flex-1 flex-col overflow-hidden !rounded-[17px] shadow-[0_0_40px_rgba(26,111,255,0.08)] md:!rounded-[22px] md:h-[min(440px,calc(100dvh-3.5rem))] md:max-h-[min(82vh,calc(100dvh-3.5rem))] md:flex-none md:w-full md:shadow-[0_0_56px_rgba(26,111,255,0.1)] md:flex-row md:items-stretch lg:!rounded-[24px]">
        <section
          className="flex w-full shrink-0 flex-col justify-center px-4 py-3 sm:px-5 sm:py-4 md:min-w-0 md:flex-1 md:px-7 md:py-7 lg:px-8 lg:py-8"
          style={{
            background:
              "linear-gradient(165deg, rgba(8,14,36,0.98) 0%, rgba(5,10,26,0.99) 50%, rgba(6,12,30,0.98) 100%)",
          }}
        >
          <h2 className="text-center text-lg font-bold tracking-[0.42em] text-white drop-shadow-sm sm:text-xl sm:tracking-[0.48em] md:text-[1.45rem]">
            L O G I N
          </h2>
          <div
            className="mx-auto mb-3 mt-1.5 h-[2px] w-[64px] rounded-full bg-gradient-to-r from-[#ff2d78] via-[#1a6fff] to-[#00e5ff] shadow-[0_0_12px_rgba(26,111,255,0.45)] sm:mb-4 sm:mt-2 sm:w-[72px] md:mb-6"
            aria-hidden
          />

          <form
            onSubmit={handleLogin}
            className="w-full [color-scheme:dark]"
            autoComplete="off"
          >
            {/* Absorb stray browser autofill so real fields stay empty after logout */}
            <input
              type="text"
              name={`trap_text_${fieldNonce}`}
              autoComplete="off"
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute h-0 w-0 opacity-0"
              readOnly
            />
            <input
              type="password"
              name={`trap_pw_${fieldNonce}`}
              autoComplete="off"
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute h-0 w-0 opacity-0"
              readOnly
            />

            {error ? (
              <div
                className="mb-2 rounded-lg border border-red-500/40 bg-red-950/50 px-2.5 py-2 text-center text-[11px] leading-snug text-red-200 md:mb-4 md:px-3 md:py-2.5 md:text-sm"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <GlowInput
              id={emailId}
              name={emailName}
              label="EMAIL"
              placeholder="user@hospital.com"
              type="email"
              autoComplete={fromLogout ? "off" : "username"}
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              required
              disabled={isLoading}
            />

            <GlowInput
              id={passId}
              name={passName}
              label="PASSWORD"
              placeholder="Enter your password"
              type={showPassword ? "text" : "password"}
              autoComplete={fromLogout ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              required
              disabled={isLoading}
              rightSlot={
                <EyeToggle
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              }
            />

            <motion.button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full rounded-lg bg-[#1a6fff] py-2.5 text-[11px] font-bold uppercase tracking-[0.26em] text-white shadow-[0_0_26px_rgba(26,111,255,0.55)] focus:outline-none focus-visible:shadow-[0_0_32px_rgba(26,111,255,0.75)] disabled:cursor-not-allowed disabled:opacity-60 md:mt-2 md:py-3 md:text-xs"
              whileHover={
                isLoading ? undefined : { scale: 1.02, backgroundColor: "#2a7fff" }
              }
              whileTap={isLoading ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
            >
              {isLoading ? "SIGNING IN..." : "LOGIN"}
            </motion.button>

            <Link
              href="/forgot-password"
              className="mt-2 block text-center text-[11px] text-[#5d9fff] underline-offset-4 transition-colors hover:text-[#8eb9ff] hover:underline md:mt-4 md:text-sm"
            >
              Forgot Password?
            </Link>

            <button
              type="button"
              onClick={() => {
                if (onBackToLanding) onBackToLanding();
                else if (typeof window !== "undefined") window.location.assign("/");
              }}
              className="mt-1 block w-full text-center text-[11px] font-normal !text-black/80 hover:!text-white hover:underline underline-offset-4 md:mt-2"
            >
              Back to landing
            </button>
          </form>
        </section>

        <div
          className="portal-column-divider hidden md:block"
          aria-hidden
        />

        <section className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#030814] md:min-h-0 md:min-w-0 md:flex-1">
          {/*
            Wide group photo: use flex-1 so this band shrinks with the viewport — no inner scroll.
            object-contain keeps all three in frame (letterboxing uses column bg).
          */}
          <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-[#030814] md:h-full md:flex-1">
            <div className="relative h-full min-h-[120px] w-full transition-transform duration-[620ms] ease-out group-hover:scale-[1.01] md:absolute md:inset-0 md:min-h-0 md:group-hover:scale-[1.02]">
              <Image
                src={staff}
                alt="Hospital team"
                fill
                quality={92}
                sizes="(max-width: 768px) 100vw, 360px"
                className="object-contain object-center contrast-[1.02] md:p-2"
              />
            </div>
            <div
              className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(to_top,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.35)_42%,transparent_72%)] md:block"
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_85%_60%_at_50%_20%,rgba(26,111,255,0.1),transparent_60%)] md:block" />
          </div>

          <div className="relative z-10 flex shrink-0 flex-col items-center border-t border-white/[0.06] bg-[#050a18] px-3 pb-2.5 pt-2 text-center sm:pb-3 sm:pt-3 md:absolute md:inset-0 md:justify-end md:border-t-0 md:bg-transparent md:pb-7 md:pt-0">
            <p className="text-xs font-bold tracking-[0.32em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.75)] sm:text-sm sm:tracking-[0.38em] md:text-[1.35rem] md:tracking-[0.48em]">
              W E L C O M E
            </p>
            <div
              className="mx-auto mb-1 mt-1 h-[2px] w-[44px] rounded-full bg-gradient-to-r from-[#ff2d78] via-[#1a6fff] to-[#00e5ff] shadow-[0_0_12px_rgba(26,111,255,0.45)] sm:mb-1.5 sm:mt-1.5 sm:w-[48px] md:mb-2 md:mt-2 md:w-[56px]"
              aria-hidden
            />
            <p className="max-w-[14rem] text-[0.62rem] font-light leading-tight tracking-[0.1em] text-[#dce7f5] sm:text-[0.68rem] sm:tracking-[0.12em] md:max-w-none md:text-[0.78rem] md:tracking-[0.14em]">
              Where Care Meets Excellence
            </p>
          </div>
        </section>
      </NeonCard>
    </motion.div>
  );
}
