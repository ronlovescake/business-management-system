import { defineConfig } from 'vitest/config';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import { resolveVitestEnvFile } from './tests/resolveVitestEnvFile';

const envFile = resolveVitestEnvFile(
  process.env.VITEST_ENV_FILE || '.env.test'
);
loadEnv({ path: envFile, override: true });

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
      // Coverage floor (added 2026-04-19 per IMPROVEMENTS_CHECKLIST.md §5).
      //
      // Baseline measured 2026-04-19: lines ~11.1%, branches ~51.9%,
      // functions ~29.6%, statements ~11.1%. Floors below are set just
      // under that baseline so a regression breaks CI but normal day-to-day
      // changes do not. Ratchet these up as coverage grows; do not ratchet
      // them down without a good reason.
      //
      // Enforcement is opt-in via `COVERAGE_ENFORCE=true` so existing local
      // workflows are not disrupted. CI should set the env var.
      thresholds:
        process.env.COVERAGE_ENFORCE === 'true'
          ? {
              lines: 10,
              statements: 10,
              functions: 25,
              branches: 45,
            }
          : undefined,
    },
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
