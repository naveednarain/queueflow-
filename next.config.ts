import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable React StrictMode in development to prevent duplicate Supabase channels & re-renders
  reactStrictMode: false,

  // ─── Performance Optimizations ───────────────────────────────────────
  compress: true,
  
  // Optimize images (use next/image everywhere)
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24h cache for images
  },

  // Faster compilation and smaller client bundles
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns', 'sonner'],
  },

  // ─── Security Headers & Caching ───────────────────────────────────────
  async headers() {
    return [
      {
        // Cache public media and fonts aggressively
        source: '/(.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?))$',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        // Security headers for all pages
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
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
