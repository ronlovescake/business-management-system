import { defineConfig } from 'vitest/config';
import path from 'path';
import { config as loadEnv } from 'dotenv';

const envFile = process.env.VITEST_ENV_FILE || '.env.test';
loadEnv({ path: path.resolve(process.cwd(), envFile), override: true });

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
    ],
    exclude: ['tests/e2e/**/*', 'node_modules/**/*', '.next/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/',
        '.next/',
      ],
    },
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
