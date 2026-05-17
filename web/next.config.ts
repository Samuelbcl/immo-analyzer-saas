import type { NextConfig } from "next";
import path from "path";

const BACKEND_API_URL =
  process.env.BACKEND_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
