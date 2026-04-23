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
          bg: "#0a0c10",
          surface: "#0f1117",
          card: "#161b25",
          hover: "#1c2333",
          border: "#1e2d40",
          muted: "#243044",
        },
        brand: {
          primary: "#3b82f6",
          secondary: "#6366f1",
          glow: "#1d4ed8",
        },
        text: {
          primary: "#e8edf5",
          secondary: "#8896ad",
          muted: "#4f6070",
        },
        status: {
          success: "#22c55e",
          warning: "#f59e0b",
          danger: "#ef4444",
          info: "#38bdf8",
        },
      },
    },
  },
  plugins: [],
};