/** @type {import('next').NextConfig} */
const nextConfig = {
  // SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: Enable standalone for Docker production
  output: 'standalone',

  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Performance optimizations
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
      '@hello-pangea/dnd',
      'recharts',
    ],
  },

  // Bundle optimization
  webpack: (config, { isServer }) => {
    // Code splitting optimization
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          enforce: true,
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
        },
      },
    };

    // Tree shaking for lucide-react
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'lucide-react': 'lucide-react/dist/esm/icons',
      };
    }

    return config;
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // Compression
  compress: true,

  // Static optimization
  poweredByHeader: false,
  generateEtags: false,
};

module.exports = nextConfig;
