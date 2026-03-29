import type { NextConfig } from 'next';
import { buildAllowedDevOrigins } from './src/lib/dev-origins';

const baseHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: buildAllowedDevOrigins({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    ALLOWED_DEV_ORIGINS: process.env.ALLOWED_DEV_ORIGINS,
  }),
  async headers() {
    return [
      {
        source: '/overlay',
        headers: baseHeaders,
      },
      {
        source: '/((?!overlay).*)',
        headers: [
          ...baseHeaders,
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'",
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
