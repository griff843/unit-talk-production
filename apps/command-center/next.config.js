/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15 compatible configuration
  reactStrictMode: false, // Disable for debugging
  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Next.js 15 experimental features
  experimental: {
    // instrumentationHook is no longer needed in Next.js 15
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

  // Output configuration for Windows compatibility
  output: 'standalone',

  // Simple compression
  compress: true,
};

module.exports = nextConfig;
