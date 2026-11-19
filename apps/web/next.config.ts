import type { NextConfig } from 'next';

const nestApiUrl = process.env.NEST_API_URL ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/api/v1/:path*', destination: `${nestApiUrl}/api/v1/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
