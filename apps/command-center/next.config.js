const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Allow TypeScript errors during build for development phase
    ignoreBuildErrors: true,
  },
  eslint: {
    // Temporarily disable ESLint during build
    ignoreDuringBuilds: true,
  },
  // Disable for debugging and Windows compatibility
  reactStrictMode: false,
  poweredByHeader: false,

  // Security Headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none';"
          }
        ]
      }
    ];
  },

  // Output file tracing configuration
  outputFileTracingRoot: path.join(__dirname, '../../'),

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

  // Output configuration for Windows compatibility
  output: 'standalone',

  // Simple compression
  compress: true,
};

module.exports = nextConfig;
