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
        navy: {
          950: "#070D1A",
          900: "#0B1220",
          850: "#0F1830",
          800: "#131F3A",
          700: "#1B2B4D",
          600: "#24365F",
        },
        brand: {
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
        },
      },
      fontFamily: {
        sans: ["'Be Vietnam Pro'", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 30px rgba(2, 6, 23, 0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
