import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ─── Performance Optimizations ───────────────────────────────────────
  compress: true,
  
  // Optimize images (use next/image everywhere)
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24h cache for images
  },

  // Faster server startup in production
  experimental: {
    // PPR allows streaming partial pages while data loads
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },

  // ─── Security Headers ─────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Cache static assets aggressively
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Cache public assets (fonts, images)
        source: '/public/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=3600' },
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
