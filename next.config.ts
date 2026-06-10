import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin workspace root (a stray lockfile exists in the user home dir).
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
