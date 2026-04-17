import type { NextConfig } from 'next';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version?: string;
};

function resolveBuildCommit() {
  const envCommit =
    process.env.NEXT_PUBLIC_BUILD_COMMIT ||
    process.env.COMMIT_REF ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA;

  if (envCommit) {
    return envCommit.slice(0, 7);
  }

  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const buildVersion = packageJson.version || '0.0.0';
const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();
const buildCommit = resolveBuildCommit();

const nextConfig: NextConfig = {
  basePath,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_LIVE_DATA_BACKEND: process.env.LIVE_DATA_BACKEND || 'local',
    NEXT_PUBLIC_BUILD_VERSION: buildVersion,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
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
  async redirects() {
    if (basePath) {
      return [];
    }

    return [
      {
        source: '/liveeventoverlay',
        destination: '/',
        permanent: true,
      },
      {
        source: '/liveeventoverlay/:path*',
        destination: '/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
