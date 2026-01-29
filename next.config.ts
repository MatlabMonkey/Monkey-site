import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Explicitly set the root directory to fix lockfile detection issue
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
