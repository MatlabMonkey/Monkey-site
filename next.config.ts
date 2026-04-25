import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Explicitly set the root directory to fix lockfile detection issue
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    const redirects = [
      {
        source: "/arias",
        destination: "/ops/usage",
        permanent: true,
      },
    ];

    if (isProd) {
      redirects.push(
        {
          source: "/test-env",
          destination: "/",
          permanent: false,
        },
        {
          source: "/test-supabase",
          destination: "/",
          permanent: false,
        },
      );
    }

    return redirects;
  },
};

export default nextConfig;
