import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { 900: "#0F2440", 700: "#1E3A5F", 500: "#33567F" },
        brand: {
          50: "#F3EFFF",
          100: "#E6DDFF",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
        },
        accent: { 500: "#F97316", 600: "#EA580C" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(2, 6, 23, 0.5), 0 10px 28px rgba(2, 6, 23, 0.35)",
        lift: "0 6px 12px rgba(2, 6, 23, 0.5), 0 20px 40px rgba(2, 6, 23, 0.4)",
      },
    },
  },
  plugins: [],
};
export default config;
