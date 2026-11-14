import type { Config } from "tailwindcss";

const channel = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const status = (name: string) => ({
  DEFAULT: channel(name),
  foreground: channel(`${name}-foreground`),
  soft: channel(`${name}-soft`),
  "soft-foreground": channel(`${name}-soft-foreground`),
  border: channel(`${name}-border`),
});

// Tailwind only exposes semantic names backed by the CSS tokens in src/app/globals.css.
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.25rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        xl: "var(--radius)",
        lg: "calc(var(--radius) - 2px)",
        md: "calc(var(--radius) - 4px)",
      },
      boxShadow: { soft: "var(--shadow-soft)", lift: "var(--shadow-lift)" },
      transitionTimingFunction: { out: "var(--ease-out)" },
      transitionDuration: { fast: "var(--duration-fast)", base: "var(--duration-base)", slow: "var(--duration-slow)" },
      height: { header: "var(--header-height)" },
      colors: {
        border: channel("border"),
        input: channel("input"),
        ring: channel("ring"),
        background: channel("background"),
        foreground: channel("foreground"),
        primary: { DEFAULT: channel("primary"), foreground: channel("primary-foreground") },
        secondary: { DEFAULT: channel("secondary"), foreground: channel("secondary-foreground") },
        muted: { DEFAULT: channel("muted"), foreground: channel("muted-foreground") },
        accent: { DEFAULT: channel("accent"), foreground: channel("accent-foreground") },
        card: { DEFAULT: channel("card"), foreground: channel("card-foreground") },
        destructive: status("destructive"),
        success: status("success"),
        warning: status("warning"),
        info: status("info"),
        inverse: { DEFAULT: channel("inverse"), foreground: channel("inverse-foreground"), muted: channel("inverse-muted"), accent: channel("inverse-accent"), border: channel("inverse-border") },
      },
      keyframes: {
        "pop-in": { from: { opacity: "0", transform: "translateY(8px) scale(0.97)" }, to: { opacity: "1", transform: "none" } },
        spin: { to: { transform: "rotate(360deg)" } },
      },
      animation: { "pop-in": "pop-in var(--duration-base) var(--ease-out) both" },
    },
  },
  plugins: [],
};

export default config;
