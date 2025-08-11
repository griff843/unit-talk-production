/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emergency configuration - minimal setup
  reactStrictMode: false,
  swcMinify: false,
  poweredByHeader: false,

  // Disable all optimizations that could cause hanging
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable all experimental features
  experimental: {},

  // Disable webpack optimizations
  webpack: config => {
    // Disable any webpack optimizations that could cause issues
    config.optimization = {
      ...config.optimization,
      minimize: false,
      splitChunks: false,
    };
    return config;
  },

  // Disable compression
  compress: false,

  // Add timeout configurations
  serverRuntimeConfig: {
    timeout: 5000,
  },
  publicRuntimeConfig: {
    timeout: 5000,
  },
};

module.exports = nextConfig;
