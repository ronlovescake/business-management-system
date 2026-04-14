/* eslint-disable @typescript-eslint/no-var-requires */

// Ensure Node.js runtime uses Philippines timezone by default
process.env.TZ = 'Asia/Manila';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  optimizeFonts: false,
  experimental: {
    optimizePackageImports: [
      '@mantine/core',
      '@mantine/hooks',
      '@mantine/notifications',
      '@tabler/icons-react',
      '@glideapps/glide-data-grid',
      'recharts', // Heavy charting library - tree-shake unused components
    ],
    // Keep invoice templates/settings available in standalone/server output
    outputFileTracingIncludes: {
      '/api/generate-in-transit-invoice': [
        'templates/**',
        'settings/invoice-settings.json',
      ],
      '/api/generate-invoice': [
        'templates/**',
        'settings/invoice-settings.json',
      ],
    },
    // Turbopack is enabled via CLI flag: next dev --turbo
  },
  transpilePackages: ['@tabler/icons-react'],

  // Security headers for XSS protection
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Required for Next.js and Mantine
              "style-src 'self' 'unsafe-inline'", // Required for Mantine
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },

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

      if (isServer) {
        const handlebarsRequest = 'handlebars';
        const asCommonJs = (request) => `commonjs ${request}`;

        if (Array.isArray(config.externals)) {
          config.externals.push(asCommonJs(handlebarsRequest));
        } else if (typeof config.externals === 'function') {
          const originalExternals = config.externals;
          config.externals = (context, request, callback) => {
            if (request === handlebarsRequest) {
              return callback(null, asCommonJs(handlebarsRequest));
            }
            return originalExternals(context, request, callback);
          };
        } else if (config.externals) {
          config.externals = [
            ...[].concat(config.externals),
            asCommonJs(handlebarsRequest),
          ];
        } else {
          config.externals = [asCommonJs(handlebarsRequest)];
        }
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

const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true })
    : (config) => config;

const { withSentryConfig } = require('@sentry/nextjs');

const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry webpack plugin.
  // Keep in mind that the following options are set automatically, and overriding them is not recommended:
  //   release, url, configFile, urlPrefix, include, ignore

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // An auth token is required for uploading source maps.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: true, // Suppresses all logs

  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options
};

const isTurbopackDev =
  process.env.TURBOPACK === '1' && process.env.NODE_ENV !== 'production';
const hasSentryBuildCredentials = [
  process.env.SENTRY_ORG,
  process.env.SENTRY_PROJECT,
  process.env.SENTRY_AUTH_TOKEN,
].every((value) => typeof value === 'string' && value.trim().length > 0);
const enableSentry =
  !isTurbopackDev &&
  process.env.NEXT_DISABLE_SENTRY !== '1' &&
  hasSentryBuildCredentials;

// Make sure adding Sentry options is the last code to run before exporting
module.exports = enableSentry
  ? withSentryConfig(withBundleAnalyzer(nextConfig), sentryWebpackPluginOptions)
  : withBundleAnalyzer(nextConfig);
