import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable React StrictMode to prevent duplicate Supabase channels in dev
  reactStrictMode: false,

  // ─── Bundle Optimizations ─────────────────────────────────────────────────
  compress: true,

  // Tree-shake heavy packages — only import what's used
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      'sonner',
      '@supabase/supabase-js',
    ],
  },

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },

  // ─── Security & Caching Headers ───────────────────────────────────────────
  async headers() {
    return [
      {
        // Long-lived cache for static assets (fonts, images, icons)
        source: '/(.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?))$',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache Next.js static chunks aggressively (they are content-hashed)
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Security headers for all pages
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
