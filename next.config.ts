import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // CV uploads can be up to 5 MB; default limit is 1 MB
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
