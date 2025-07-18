require('dotenv').config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Increase timeout for static page generation
  staticPageGenerationTimeout: 300, // 5 minutes
};

module.exports = nextConfig;