/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"]
      },
      colors: {
        ink: "#f7f2eb",
        muted: "#b7b0a6",
        surface: "rgba(24, 26, 33, 0.85)",
        surface2: "rgba(34, 38, 48, 0.8)",
        stroke: "rgba(255, 255, 255, 0.12)",
        accent: "#ff8a00"
      },
      boxShadow: {
        glow: "0 40px 100px rgba(0, 0, 0, 0.45)",
        cta: "0 12px 30px rgba(255, 138, 0, 0.3)"
      },
      backgroundImage: {
        hero:
          "radial-gradient(circle at 15% 10%, #1b2433 0%, #0c0d10 55%), radial-gradient(circle at 85% 20%, #262235 0%, transparent 45%), radial-gradient(circle at 50% 90%, #1d1b12 0%, transparent 60%)"
      }
    }
  },
  plugins: []
};
