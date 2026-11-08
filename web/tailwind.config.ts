import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        
        canvas: "#000000",
        surface: "#1c1c1e",
        surface2: "#2c2c2e",
        line: "#3a3a3c",
        ink: "#f5f5f7",
        muted: "#98989d",
        accent: "#0a84ff",
        good: "#30d158",
        warn: "#ff9f0a",
        danger: "#ff453a",
        highlight: "#ffd60a",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        tile: "0 8px 30px rgba(0, 0, 0, 0.45)",
        glow: "0 0 0 4px rgba(255, 214, 10, 0.35), 0 12px 40px rgba(255, 214, 10, 0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;