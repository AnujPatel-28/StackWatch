import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: { ink: "#102128", mist: "#f4f8f7", mint: "#b8f2d0", teal: "#1f8f78", coral: "#f07861", amber: "#a96617" },
      boxShadow: { soft: "0 20px 60px rgba(16, 33, 40, 0.08)" },
    },
  },
  plugins: [],
};

export default config;
