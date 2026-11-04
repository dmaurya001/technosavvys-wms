import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          950: "#060f08",
          900: "#09170e",
          850: "#0c1f13",
          800: "#102a1a",
          750: "#153622",
          700: "#1b432b",
          600: "#245a3a",
          500: "#2f754c",
          400: "#3fa069",
          300: "#60c88c",
          200: "#94e2b5",
          100: "#cbf2dc",
          50: "#effaf4",
        },
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
      },
      boxShadow: {
        'glass': '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glass-hover': '0 30px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(16, 185, 129, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
        'glow-emerald': '0 0 35px rgba(16, 185, 129, 0.25)',
      },
      animation: {
        'float-slow': 'float 6s ease-in-out infinite',
        'pulse-subtle': 'pulseGlow 4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
