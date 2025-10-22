/* eslint-disable @typescript-eslint/no-var-requires */

// Ensure Node.js runtime uses Philippines timezone by default
process.env.TZ = 'Asia/Manila';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
    // Turbopack is enabled via CLI flag: next dev --turbo
  },
  transpilePackages: ['@tabler/icons-react'],

  // Webpack-specific optimizations (only used when NOT using Turbopack)
  ...(process.env.TURBOPACK !== '1' && {
    compiler: {
      // Remove console.log/warn/info in production, but keep console.error and console.warn
      removeConsole:
        process.env.NODE_ENV === 'production'
          ? { exclude: ['error', 'warn'] }
          : false,
    },
    webpack: (config, { dev, isServer }) => {
      if (dev && !isServer) {
        // Increase cache efficiency in development
        config.cache = {
          type: 'filesystem',
          buildDependencies: {
            config: [__filename],
          },
        };
        // Optimize module resolution
        config.snapshot = {
          managedPaths: [/^(.+?[\\/]node_modules[\\/])/],
        };
      }
      return config;
    },
    onDemandEntries: {
      // Period (in ms) where the server will keep pages in the buffer
      maxInactiveAge: 60 * 1000, // 60 seconds
      // Number of pages that should be kept simultaneously without being disposed
      pagesBufferLength: 5,
    },
  }),
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);
