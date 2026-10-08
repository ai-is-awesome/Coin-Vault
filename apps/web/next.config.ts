import type { NextConfig } from 'next';

// The browser only ever talks to this Next.js server; /api/* is proxied to the Express API.
// Same origin means the API's httpOnly session cookie is first-party and no CORS is needed.
// Note: rewrites are resolved at `next dev` / `next build` time.
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (apps/web/Dockerfile sets NEXT_OUTPUT).
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
