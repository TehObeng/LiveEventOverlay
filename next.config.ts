import type { NextConfig } from 'next';
import { resolveBasePath } from './src/lib/url';

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

const basePath = resolveBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  basePath,
  output: 'standalone',
  env: {
    E2E_EVENT_NAME: process.env.E2E_EVENT_NAME,
    E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL,
    E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
    E2E_USE_MOCK_BACKEND: process.env.E2E_USE_MOCK_BACKEND,
  },
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
