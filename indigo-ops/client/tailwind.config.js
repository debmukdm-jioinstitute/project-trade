/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ops: {
          bg: "#05070c",
          panel: "#0a0e17",
          panel2: "#0d1220",
          border: "#1c2536",
          border2: "#2a3652",
          indigo: "#4a5cf5",
          indigoBright: "#6c7bff",
          text: "#d7dde8",
          dim: "#6b7690",
          amber: "#e8b64a",
          red: "#ef4b5f",
          green: "#3ecf8e",
          cyan: "#4ad9e8",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
