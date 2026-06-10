import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin workspace root (a stray lockfile exists in the user home dir).
  turbopack: { root: path.join(__dirname) },
  // Dev only: tenant subdomains (demo-a.localtest.me) must be allowed to
  // load dev JS chunks, or pages render server-HTML with no hydration.
  allowedDevOrigins: ["*.localtest.me", "localtest.me"],
};

export default nextConfig;
