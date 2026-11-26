import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: { split: "860px" },
      colors: {
        bg: v("bg"),
        card: v("card"),
        card2: v("card2"),
        label: v("label"),
        label2: v("label2"),
        label3: v("label3"),
        sep: v("sep"),
        fill: v("fill"),
        blue: v("blue"),
        green: v("green"),
        red: v("red"),
        orange: v("orange"),
        gray: v("gray"),
      },
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "SF Pro Text", "SF Pro Display",
          "Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif",
        ],
        mono: ["SF Mono", "ui-monospace", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: { ios: "14px" },
      borderWidth: { hair: "0.5px" },
      boxShadow: { sheet: "0 -8px 40px rgba(0,0,0,.18)", pop: "0 10px 40px rgba(0,0,0,.2)" },
    },
  },
  plugins: [],
};

export default config;
