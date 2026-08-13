import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep development chunks apart from production builds. This prevents an
  // active `next dev` session from losing its chunks when `next build` runs.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  reactStrictMode: true,
};

export default nextConfig;
