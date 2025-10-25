require('dotenv').config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed standalone output for development
  staticPageGenerationTimeout: 300, // 5 minutes
  eslint: {
    // Allow warnings during build, but still fail on errors
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Ensure TypeScript errors fail the build
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
