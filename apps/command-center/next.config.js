/** @type {import('next').NextConfig} */
const nextConfig = {
  // SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: Enable standalone for Docker production
  output: 'standalone',

  // Windows build optimization
  swcMinify: false, // Disable SWC minifier for Windows compatibility
  reactStrictMode: false, // Disable for debugging
  poweredByHeader: false,

  typescript: {
    // Type checking enabled - all errors must be fixed
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Windows-specific optimizations
  experimental: {
    // Disable trace generation on Windows to prevent EPERM errors
    instrumentationHook: false,
  },

  // Disable webpack cache and minification for Windows builds
  webpack: (config, { dev }) => {
    if (!dev && process.platform === 'win32') {
      // Disable filesystem cache on Windows production builds
      config.cache = false;
    }

    // Disable Terser minification to prevent syntax errors
    if (config.optimization && config.optimization.minimizer) {
      config.optimization.minimizer = [];
    }

    return config;
  },

  // Simple compression
  compress: true,
};

module.exports = nextConfig;
