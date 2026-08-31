/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Lora", "ui-serif", "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0faf4",
          100: "#dbf0e3",
          200: "#b8e0c8",
          300: "#8ccba5",
          400: "#59ad7e",
          500: "#2f9160",
          600: "#1f7a4c",
          700: "#19613c",
          800: "#164e32",
          900: "#123f2a",
        },
        ink: {
          50: "#eef1f7",
          100: "#dbe1ee",
          400: "#4a5a7d",
          700: "#1c3457",
          800: "#16294a",
          900: "#0f1f3a",
          950: "#0a1428",
        },
        // Premium tier accent (Perfect10ant Verified / Plus) — used sparingly
        // for badges/CTAs, never as a base UI color, per the design
        // direction: gold = premium/milestones/elite benefits.
        gold: {
          50: "#fdf8ec",
          100: "#faedc4",
          300: "#eec870",
          500: "#c8942f",
          600: "#a97624",
          700: "#8a5f1e",
          900: "#4a3210",
        },
      },
    },
  },
  plugins: [],
};
