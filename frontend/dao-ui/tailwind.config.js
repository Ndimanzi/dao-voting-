/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#f5efe5",
        clay: "#df6f41",
        ink: "#11212d",
        mint: "#7ec4b8",
      },
      fontFamily: {
        title: ["Fraunces", "serif"],
        body: ["Space Grotesk", "sans-serif"],
      },
      boxShadow: {
        panel: "0 20px 45px rgba(0, 0, 0, 0.12)",
      },
      keyframes: {
        reveal: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        reveal: "reveal 0.65s ease-out both",
      },
    },
  },
  plugins: [],
};
