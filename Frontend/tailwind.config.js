/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "480px",
      },
      colors: {
        base: {
          bg: "#070b14",
          surface: "#0b0f1a",
          card: "#0d1424",
          elevated: "#111827",
          hover: "#151f35",
          border: "#1a2744",
          glow: "#1e3a5f",
          muted: "#1c2a3e",
        },
        brand: {
          blue: "#3b82f6",
          indigo: "#6366f1",
          purple: "#8b5cf6",
          glow: "rgba(59,130,246,0.35)",
        },
        grad: {
          blue1: "#0f2657",
          blue2: "#0a1d4e",
          teal1: "#0a2e2e",
          teal2: "#061f1f",
          amber1: "#2e1f06",
          amber2: "#1f1500",
          red1: "#2e0a0a",
          red2: "#1a0505",
          purple1: "#1a0f35",
          purple2: "#110a25",
          green1: "#0a2e15",
          green2: "#061a0d",
        },
        text: {
          primary: "#e2e8f5",
          secondary: "#7a90b0",
          muted: "#3d5470",
          bright: "#ffffff",
        },
        status: {
          success: "#10b981",
          successGlow: "rgba(16,185,129,0.25)",
          warning: "#f59e0b",
          warningGlow: "rgba(245,158,11,0.25)",
          danger: "#ef4444",
          dangerGlow: "rgba(239,68,68,0.35)",
          info: "#38bdf8",
          infoGlow: "rgba(56,189,248,0.25)",
        },
        dash: {
          bg: "#05070f",
          surface: "#080c18",
          card: "#0a0f1e",
          elevated: "#0d1326",
          border: "#141d35",
          muted: "#111828",
        },
        kpi: {
          blue: "#3b82f6",
          purple: "#a855f7",
          cyan: "#06b6d4",
          red: "#ef4444",
          green: "#22c55e",
          orange: "#f97316",
        },
        tx: {
          primary: "#e8eeff",
          secondary: "#6b82a8",
          muted: "#384d6a",
          bright: "#ffffff",
          blue: "#3b82f6",
          cyan: "#06b6d4",
          green: "#22c55e",
          red: "#ef4444",
          orange: "#f97316",
          yellow: "#eab308",
          purple: "#a855f7",
        },
      },
      backgroundImage: {
        "card-blue": "linear-gradient(135deg, #0f2657 0%, #0a1d4e 100%)",
        "card-teal": "linear-gradient(135deg, #0a2e2e 0%, #061f1f 100%)",
        "card-amber": "linear-gradient(135deg, #2e1f06 0%, #1f1500 100%)",
        "card-red": "linear-gradient(135deg, #2e0a0a 0%, #1a0505 100%)",
        "card-purple": "linear-gradient(135deg, #1a0f35 0%, #110a25 100%)",
        "card-green": "linear-gradient(135deg, #0a2e15 0%, #061a0d 100%)",
        "btn-primary": "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
        "btn-danger": "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
        "kpi-blue": "linear-gradient(180deg, #0b1830 0%, #060d1f 100%)",
        "kpi-purple": "linear-gradient(180deg, #120b28 0%, #0a0618 100%)",
        "kpi-cyan": "linear-gradient(180deg, #071e28 0%, #040f18 100%)",
        "kpi-red": "linear-gradient(180deg, #200808 0%, #100404 100%)",
        "kpi-green": "linear-gradient(180deg, #071f10 0%, #040f08 100%)",
        "kpi-orange": "linear-gradient(180deg, #1e1005 0%, #100803 100%)",
        panel: "linear-gradient(180deg, #0c1120 0%, #090e1c 100%)",
        "btn-export": "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
        "btn-logout": "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        "card-blue":
          "0 4px 24px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
        "card-red":
          "0 4px 32px rgba(239,68,68,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
        "card-amber":
          "0 4px 24px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.04)",
        "card-teal":
          "0 4px 24px rgba(20,184,166,0.15), inset 0 1px 0 rgba(255,255,255,0.04)",
        "card-green":
          "0 4px 24px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.04)",
        "glow-blue": "0 0 20px rgba(59,130,246,0.4)",
        "glow-red": "0 0 20px rgba(239,68,68,0.4)",
        "glow-green": "0 0 20px rgba(16,185,129,0.3)",
        "glow-amber": "0 0 20px rgba(245,158,11,0.3)",
        btn: "0 0 20px rgba(59,130,246,0.3)",
        nav: "0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.4)",
        "kpi-blue":
          "0 0 0 1px rgba(59,130,246,0.4), 0 0 20px rgba(59,130,246,0.1)",
        "kpi-purple":
          "0 0 0 1px rgba(168,85,247,0.4), 0 0 20px rgba(168,85,247,0.1)",
        "kpi-cyan":
          "0 0 0 1px rgba(6,182,212,0.4), 0 0 20px rgba(6,182,212,0.1)",
        "kpi-red":
          "0 0 0 1px rgba(239,68,68,0.5), 0 0 24px rgba(239,68,68,0.15)",
        "kpi-green":
          "0 0 0 1px rgba(34,197,94,0.4), 0 0 20px rgba(34,197,94,0.1)",
        "kpi-orange":
          "0 0 0 1px rgba(249,115,22,0.4), 0 0 20px rgba(249,115,22,0.1)",
        "kpi-blue-hover":
          "0 0 0 1px rgba(59,130,246,0.6), 0 0 32px rgba(59,130,246,0.2)",
        "kpi-purple-hover":
          "0 0 0 1px rgba(168,85,247,0.6), 0 0 32px rgba(168,85,247,0.2)",
        "kpi-cyan-hover":
          "0 0 0 1px rgba(6,182,212,0.6), 0 0 32px rgba(6,182,212,0.2)",
        "kpi-red-hover":
          "0 0 0 1px rgba(239,68,68,0.7), 0 0 36px rgba(239,68,68,0.25)",
        "kpi-green-hover":
          "0 0 0 1px rgba(34,197,94,0.6), 0 0 32px rgba(34,197,94,0.2)",
        "kpi-orange-hover":
          "0 0 0 1px rgba(249,115,22,0.6), 0 0 32px rgba(249,115,22,0.2)",
        panel: "0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "live-ping": {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        "live-pulse": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "live-ping": "live-ping 1.8s ease-out infinite",
        "live-pulse": "live-pulse 2s ease-in-out infinite",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};