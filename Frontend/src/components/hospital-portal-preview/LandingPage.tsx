"use client";

import staff from "@/assets/hospital-staff.png";
import { motion, type Variants } from "framer-motion";
import Image from "next/image";

const landingEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

type LandingPageProps = {
  onLoginClick: () => void;
};

const contentStagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.14, delayChildren: 0.2 },
  },
};

const itemFade: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: landingEase },
  },
};

export function LandingPage({ onLoginClick }: LandingPageProps) {
  return (
    <motion.div
      className="mx-auto flex min-h-0 max-h-full justify-center px-0"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        x: -80,
        transition: { duration: 0.45, ease: "easeInOut" },
      }}
      transition={{
        duration: 0.5,
        ease: landingEase,
      }}
    >
      <div className="landing-neon-outer">
        <div
          style={{
            position: "relative",
            zIndex: 1,
            borderRadius: "14px",
            overflow: "hidden",
            height: "100%",
            background: "#0a0a1a",
          }}
        >
          <Image
            src={staff}
            alt="staff"
            fill
            priority
            quality={92}
            sizes="(max-width: 768px) 92vw, 880px"
            className="object-contain object-center"
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.20)",
              pointerEvents: "none",
            }}
          />

          <div className="landing-bottom-scrim" aria-hidden />

          <div className="landing-inner-vignette" aria-hidden />

          {/* HUD corner brackets — sci‑fi portal framing */}
          <div className="landing-hud-corners" aria-hidden>
            <span className="landing-hud-corner landing-hud-corner-tl" />
            <span className="landing-hud-corner landing-hud-corner-tr" />
            <span className="landing-hud-corner landing-hud-corner-bl" />
            <span className="landing-hud-corner landing-hud-corner-br" />
          </div>

          {/* Pinned to bottom band — no vertical centering over the staff */}
          <motion.div
            variants={contentStagger}
            initial="hidden"
            animate="show"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 3,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingBottom: "14px",
              paddingTop: "8px",
              pointerEvents: "none",
            }}
          >
            <motion.h1
              variants={itemFade}
              className="landing-welcome-title"
            >
              W E L C O M E
            </motion.h1>

            <motion.span
              variants={itemFade}
              className="landing-accent-line"
              style={{
                display: "block",
                width: "70px",
                height: "2px",
                borderRadius: "2px",
                background: "linear-gradient(90deg, #ff2d78, #0044ff)",
                margin: "10px auto 18px",
              }}
            />

            <motion.button
              type="button"
              variants={itemFade}
              className="landing-cta"
              whileHover={{
                scale: 1.03,
                borderColor: "#00d4ff",
                boxShadow:
                  "0 0 28px rgba(0, 212, 255, 0.35), 0 0 48px rgba(26, 111, 255, 0.2)",
              }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              onClick={onLoginClick}
              style={{
                padding: "13px 12px",
                border: "2px solid #1a6fff",
                borderRadius: "8px",
                background: "rgba(8, 18, 70, 0.55)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                color: "white",
                fontSize: "0.72rem",
                letterSpacing: "0.3em",
                fontWeight: 600,
                textTransform: "uppercase",
                cursor: "pointer",
                pointerEvents: "auto",
                transition:
                  "border-color 0.25s ease, box-shadow 0.25s ease",
              }}
            >
              LOGIN TO PORTAL
            </motion.button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
