import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "192.168.86.4", "192.168.86.4:3000", "192.168.86.5", "192.168.86.5:3000",
    "192.168.86.5:3001", "localhost:3000", "localhost:3001"
  ],
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
  },
  outputFileTracingIncludes: {
    "**/*": ["client/libquery_engine-*.node"],
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: "/api/docs/:path*",
        destination: `${backendUrl}/api/docs/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=self, microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
