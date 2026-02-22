require('dotenv').config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: Enable standalone for Docker production
  output: 'standalone',

  staticPageGenerationTimeout: 300, // 5 minutes

  // Windows build optimization (Sprint: RELEASE-READINESS-ENV-NORMALIZATION-042)
  swcMinify: false,
  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Windows-specific optimizations
  experimental: {
    instrumentationHook: false,
  },

  // Disable webpack cache on Windows to prevent EINVAL errors
  webpack: (config, { dev }) => {
    if (!dev && process.platform === 'win32') {
      config.cache = false;
    }
    return config;
  },

  compress: true,
};

module.exports = nextConfig;
