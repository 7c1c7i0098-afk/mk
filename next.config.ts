import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the floating Next.js dev-tools badge in the corner during `next dev`.
  // Compile and runtime errors are still reported as usual.
  devIndicators: false,
  // Allow the dev server's JS chunks to load when the site is opened from a
  // phone on the local network (http://<LAN-IP>:3000). Without this Next blocks
  // /_next/* as a cross-origin dev request and the page never hydrates.
  allowedDevOrigins: ["192.168.0.*", "192.168.1.*", "10.0.0.*", "*.local"],
  // Native module — must not be bundled by the server compiler.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  images: {
    // Admin-uploaded artwork is served from /public/uploads.
    remotePatterns: [],
  },
};

export default nextConfig;
