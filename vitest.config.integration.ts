import { defineConfig } from 'vitest/config';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import { resolveVitestEnvFile } from './tests/resolveVitestEnvFile';

const envFile = resolveVitestEnvFile(
  process.env.INTEGRATION_ENV_FILE || '.env.test'
);
loadEnv({ path: envFile, override: true });

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./tests/integration/setup.ts'],
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
    globals: true,
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: process.env.CI
      ? { junit: 'reports/integration-junit.xml' }
      : undefined,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
