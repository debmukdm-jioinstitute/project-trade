/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ops: {
          bg: "#f4f5f8",
          panel: "#ffffff",
          panel2: "#eef1f6",
          border: "#dde2ea",
          border2: "#c3cad6",
          indigo: "#4a5cf5",
          indigoBright: "#3140d6",
          text: "#1a1f2b",
          dim: "#6b7280",
          amber: "#b45309",
          red: "#dc2626",
          green: "#15803d",
          cyan: "#0e7490",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
