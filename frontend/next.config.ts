import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow next/image to serve IPFS-hosted asset images. We add Pinata, the
  // public gateway, and the legacy ipfs.io gateway — sellers may upload
  // through any of them. Add more here if a new gateway gets used.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "gateway.pinata.cloud", pathname: "/ipfs/**" },
      { protocol: "https", hostname: "ipfs.io", pathname: "/ipfs/**" },
      { protocol: "https", hostname: "cloudflare-ipfs.com", pathname: "/ipfs/**" },
      { protocol: "https", hostname: "dweb.link", pathname: "/ipfs/**" },
    ],
  },
  // Prisma's query engine is a native binary — Next's tracing sometimes drops
  // it when bundling for serverless. This flag keeps it out of the bundle.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
