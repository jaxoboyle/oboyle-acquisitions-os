import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // O'Boyle Acquisition OS design system — early-2000s speedway /
        // industrial machinery / old-money CRE / black-and-white editorial.
        // Black and warm white are the foundation; green, silver, brass,
        // and red are controlled accents only. Every color resolves through
        // a CSS custom property so the whole app re-themes from one place
        // (globals.css).
        bg: {
          DEFAULT: "hsl(var(--bg) / <alpha-value>)",
          muted: "hsl(var(--bg-muted) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "hsl(var(--surface) / <alpha-value>)",
          elevated: "hsl(var(--surface-elevated) / <alpha-value>)",
          hover: "hsl(var(--surface-hover) / <alpha-value>)",
          border: "hsl(var(--surface-border) / <alpha-value>)",
        },
        text: {
          DEFAULT: "hsl(var(--text) / <alpha-value>)",
          muted: "hsl(var(--text-muted) / <alpha-value>)",
          subtle: "hsl(var(--text-subtle) / <alpha-value>)",
        },
        // Primary brand green — buttons, active nav, links, primary actions.
        brand: {
          DEFAULT: "hsl(var(--brand) / <alpha-value>)",
          hover: "hsl(var(--brand-hover) / <alpha-value>)",
          muted: "hsl(var(--brand-muted) / <alpha-value>)",
          text: "hsl(var(--brand-text) / <alpha-value>)",
        },
        // Antique brass — used sparingly: financial goals, progress,
        // borders, and important highlights only.
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          hover: "hsl(var(--accent-hover) / <alpha-value>)",
          muted: "hsl(var(--accent-muted) / <alpha-value>)",
          text: "hsl(var(--accent-text) / <alpha-value>)",
        },
        // Brushed silver — instrumentation, dividers, watch chrome.
        silver: {
          DEFAULT: "hsl(var(--silver) / <alpha-value>)",
          muted: "hsl(var(--silver-muted) / <alpha-value>)",
        },
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        // Speedway red — reserved for critical/overdue states only.
        danger: "hsl(var(--danger) / <alpha-value>)",
      },
      fontFamily: {
        // Old-money editorial serif for titles, financial figures, objective names.
        serif: ["var(--font-serif)", "Georgia", "serif"],
        // Clean sans for records, forms, tables, nav, chat.
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Monospaced numerals for timers, money, and performance data.
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        // Sharp / lightly-rounded — pit-garage and ledger corners, not SaaS.
        DEFAULT: "0.25rem",
        sm: "0.125rem",
        lg: "0.375rem",
        xl: "0.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
