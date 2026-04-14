#!/usr/bin/env node

/**
 * Wrapper around `next build` that guarantees a Webpack build.
 * Useful when Turbopack dev artifacts or shell exports attempt to force
 * Turbopack into production builds, which Next.js does not yet support.
 */
const { spawn } = require('node:child_process');

const env = { ...process.env };

// Remove flags that might force Turbopack.
delete env.TURBOPACK;
delete env.NEXT_PRIVATE_TURBOPACK;
delete env.NEXT_FORCE_TURBOPACK;
delete env.NEXT_FORCE_TURBOPACK_DEV;

// Signal explicitly that we want Webpack for builds.
env.NEXT_FORCE_WEBPACK_BUILDS = '1';
// Disable Next.js font optimization to avoid build-time network fetches.
env.NEXT_DISABLE_FONT_OPTIMIZATION = '1';

const child = spawn('next', ['build', '--experimental-app-only'], {
  stdio: 'inherit',
  env,
  shell: false,
});

child.on('close', (code) => {
  process.exitCode = code ?? 0;
});

child.on('error', (error) => {
  console.error('Failed to launch Next.js build:', error);
  process.exit(1);
});
