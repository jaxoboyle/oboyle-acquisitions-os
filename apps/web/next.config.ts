import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Stray lockfiles elsewhere on the filesystem (a legacy Tauri app at the
  // repo root, and one outside the repo entirely) make Next.js guess the
  // wrong workspace root for file tracing. Pin it explicitly to this app.
  outputFileTracingRoot: path.join(__dirname),

  // PWA headers and service worker
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
