/** @type {import('next').NextConfig} */
const nextConfig = {
  // Minimal configuration for debugging
  swcMinify: false, // Disable for now
  reactStrictMode: false, // Disable for debugging
  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable experimental features for now
  experimental: {
    // Remove all experimental features
  },

  // Simple compression
  compress: true,
};

module.exports = nextConfig;
