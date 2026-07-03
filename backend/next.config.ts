import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.86.4", "192.168.86.4:3000", "192.168.86.5", "192.168.86.5:3000", "192.168.86.5:3001", "localhost:3000", "localhost:3001"],
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
  },
};

export default nextConfig;
