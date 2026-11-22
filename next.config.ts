import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: process.cwd(),
    rules: {
      "globals.css": { loaders: ["@tailwindcss/turbopack"], as: "globals.css" },
    },
  },
  outputFileTracingIncludes: {
    "/api/export": [
      "./node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf",
    ],
  },
};
export default config;
