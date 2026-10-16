import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=(), usb=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  // Explicitly set the root directory to fix lockfile detection issue
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
