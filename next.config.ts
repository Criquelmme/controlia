import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config) {
    if (process.env.VERCEL === "1") {
      // The Supabase backend uses process.env on Vercel. Keep the optional
      // Worker-only import out of the Node.js bundle; its fallback is caught.
      const existing = config.externals;
      config.externals = [
        ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
        { "cloudflare:workers": "commonjs cloudflare:workers" },
      ];
    }
    return config;
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
      { key: 'Pragma', value: 'no-cache' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }];
  },
};

export default nextConfig;
