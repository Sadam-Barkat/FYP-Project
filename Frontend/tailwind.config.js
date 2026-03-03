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
      colors: {
        primary: "#1e40af",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
        neutral: {
          50: "#f8fafc",
          200: "#e2e8f0",
          500: "#64748b",
          900: "#0f172a",
        },
      },
    },
  },
  plugins: [],
};