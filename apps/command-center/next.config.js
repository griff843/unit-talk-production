/** @type {import('next').NextConfig} */
const nextConfig = {
  // Windows build optimization
  swcMinify: false, // Disable SWC minifier for Windows compatibility
  reactStrictMode: false, // Disable for debugging
  poweredByHeader: false,

  typescript: {
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
  webpack: (config, { dev, isServer }) => {
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

  // NOTE: Removed 'output: standalone' - causes symlink EINVAL errors
  // on Windows when repo is inside OneDrive/cloud-synced folders.
  // Use standard build output for local development.

  // Simple compression
  compress: true,
};

module.exports = nextConfig;
