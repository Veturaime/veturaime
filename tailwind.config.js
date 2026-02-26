/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        deep: "#08111a",
        slateBlue: "#14273a",
        mint: "#48f2c2",
        sand: "#f0e7d5"
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        body: ["Plus Jakarta Sans", "sans-serif"]
      }
    }
  },
  plugins: []
};
