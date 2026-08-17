import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Branch productivity template uploads (xlsx) exceed the 1 MB default.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
