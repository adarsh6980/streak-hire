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
        paper: {
          DEFAULT: "#f4ecd9",
          light: "#faf5e9",
          dark: "#e8dcc0",
        },
        kraft: {
          DEFAULT: "#d8c39c",
          dark: "#b89f74",
        },
        ink: {
          DEFAULT: "#211a12",
          soft: "#4a4033",
        },
        stamp: {
          DEFAULT: "#c8401f",
          dark: "#9c2f15",
          light: "#e0592f",
        },
        airmail: {
          DEFAULT: "#1f3f6b",
          light: "#2f5b93",
        },
        offer: "#2f6b45",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },
      backgroundImage: {
        "kraft-texture":
          "radial-gradient(circle at 20% 20%, rgba(0,0,0,0.035) 0, transparent 45%), radial-gradient(circle at 80% 60%, rgba(0,0,0,0.03) 0, transparent 50%), radial-gradient(circle at 50% 90%, rgba(0,0,0,0.025) 0, transparent 40%)",
        "airmail-stripe":
          "repeating-linear-gradient(-45deg, #c8401f 0, #c8401f 14px, #faf5e9 14px, #faf5e9 20px, #1f3f6b 20px, #1f3f6b 34px, #faf5e9 34px, #faf5e9 40px)",
      },
      boxShadow: {
        stamp: "0 1px 0 rgba(33,26,18,0.08), 0 8px 24px -12px rgba(33,26,18,0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
