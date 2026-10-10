import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '29199',
        pathname: '/v0/b/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/v0/b/**',
      },
    ],
  },
  async rewrites() {
    // eslint-disable-next-line no-restricted-syntax -- next.config chạy trước app, chưa dùng được zod env schema
    const gateway = process.env.GATEWAY_URL || 'http://127.0.0.1:23100';
    return [{ source: '/api/v1/:path*', destination: `${gateway}/api/v1/:path*` }];
  },
};

export default nextConfig;
