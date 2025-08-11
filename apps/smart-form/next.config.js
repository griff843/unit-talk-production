require('dotenv').config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed standalone output for development
  staticPageGenerationTimeout: 300, // 5 minutes
};

module.exports = nextConfig;
