import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", ".dark"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      spacing: {
        // Used for data tables and truncation widths.
        // Tailwind spacing unit is 0.25rem (4px).
        90: "360px",
        225: "900px",
        250: "1000px",
        300: "1200px",
      },
      borderRadius: {
        sm: "0.25rem", // 4px
        md: "0.375rem", // 6px
        lg: "0.5rem", // 8px
        xl: "0.75rem", // 12px
        "2xl": "1rem", // 16px
      },
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
          50: "rgb(240 253 244 / <alpha-value>)", // #F0FDF4
          100: "rgb(220 252 231 / <alpha-value>)", // #DCFCE7
          200: "rgb(187 247 208 / <alpha-value>)", // #BBF7D0
          300: "rgb(134 239 172 / <alpha-value>)", // #86EFAC
          400: "rgb(74 222 128 / <alpha-value>)", // #4ADE80
          500: "rgb(34 197 94 / <alpha-value>)", // #22C55E - main brand
          600: "rgb(22 163 74 / <alpha-value>)", // #16A34A
          700: "rgb(21 128 61 / <alpha-value>)", // #15803D
          800: "rgb(22 101 52 / <alpha-value>)", // #166534
          900: "rgb(20 83 45 / <alpha-value>)", // #14532D
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        sidebar: {
          DEFAULT: "rgb(var(--sidebar) / <alpha-value>)",
          foreground: "rgb(var(--sidebar-foreground) / <alpha-value>)",
          primary: "rgb(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground": "rgb(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "rgb(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "rgb(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "rgb(var(--sidebar-border) / <alpha-value>)",
          ring: "rgb(var(--sidebar-ring) / <alpha-value>)",
        },
        sam: {
          success: "rgb(var(--sam-success) / <alpha-value>)",
          "success-soft": "rgb(var(--sam-success-soft) / <alpha-value>)",
          warning: "rgb(var(--sam-warning) / <alpha-value>)",
          "warning-soft": "rgb(var(--sam-warning-soft) / <alpha-value>)",
          error: "rgb(var(--sam-error) / <alpha-value>)",
          "error-soft": "rgb(var(--sam-error-soft) / <alpha-value>)",
          info: "rgb(var(--sam-info) / <alpha-value>)",
          "info-soft": "rgb(var(--sam-info-soft) / <alpha-value>)",
        },
        // Neutral gray scale from design system
        gray: {
          50: "rgb(250 250 250 / <alpha-value>)", // #FAFAFA
          100: "rgb(245 245 245 / <alpha-value>)", // #F5F5F5
          200: "rgb(229 229 229 / <alpha-value>)", // #E5E5E5
          300: "rgb(212 212 212 / <alpha-value>)", // #D4D4D4
          400: "rgb(163 163 163 / <alpha-value>)", // #A3A3A3
          500: "rgb(115 115 115 / <alpha-value>)", // #737373
          600: "rgb(82 82 82 / <alpha-value>)", // #525252
          700: "rgb(64 64 64 / <alpha-value>)", // #404040
          800: "rgb(38 38 38 / <alpha-value>)", // #262626
          900: "rgb(23 23 23 / <alpha-value>)", // #171717
        },
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        focus: "0 0 0 3px rgba(34, 197, 94, 0.2)", // Green focus ring
      },
    },
  },
  plugins: [],
};

export default config;
