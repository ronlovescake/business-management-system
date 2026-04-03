import { defineConfig } from 'vitest/config';
import path from 'path';
import { config as loadEnv } from 'dotenv';

const envFile = process.env.VITEST_ENV_FILE || '.env.test';
loadEnv({ path: path.resolve(process.cwd(), envFile), override: true });

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/hardening/**/*.test.ts'],
    exclude: ['tests/e2e/**/*', 'node_modules/**/*', '.next/**/*'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
