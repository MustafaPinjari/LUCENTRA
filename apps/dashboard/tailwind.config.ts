import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080c14",
        surface: "#0f172a",
        "surface-raised": "#1e293b",
        "surface-card": "#131d33",
        border: "#1e293b",
        "border-subtle": "#334155",
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
        },
        verified: {
          DEFAULT: "#10b981",
          light: "#34d399",
          bg: "rgba(16, 185, 129, 0.12)",
        },
        unverified: {
          DEFAULT: "#ef4444",
          light: "#f87171",
          bg: "rgba(239, 68, 68, 0.12)",
        },
        warning: {
          DEFAULT: "#f59e0b",
          light: "#fbbf24",
          bg: "rgba(245, 158, 11, 0.12)",
        },
      },
    },
  },
  plugins: [],
};

export default config;

