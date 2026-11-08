import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Body and UI: IBM Plex Mono
        sans: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        // Wordmark: Ofelia Display ExtraBold Italic (Poppins is the stand-in until it is licensed)
        display: ['"Ofelia Display"', '"Poppins"', '"Helvetica Neue"', "Arial", "sans-serif"],
      },
      colors: {
        // Horizon Grid palette: deep teal, sage, olive
        canvas: "#233a41",
        surface: "#2a434b",
        surface2: "#2f4a52",
        line: "rgba(195, 209, 185, 0.2)",
        ink: "#c3d1b9",
        muted: "#8fa399",
        accent: "#c3d1b9",
        highlight: "#b2ad4a",
        onhighlight: "#1d2b30",
        good: "#8fd19e",
        warn: "#e0b35a",
        danger: "#ef6f61",
      },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        tile: "0 10px 30px rgba(8, 20, 24, 0.45)",
        glow: "0 0 0 4px rgba(178, 173, 74, 0.35), 0 14px 40px rgba(178, 173, 74, 0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;