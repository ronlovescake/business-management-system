import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

const storageState = 'tests/e2e/.auth/clothing-operations.json';
const isCI = !!process.env.CI;
const playwrightEnvFile = process.env.PLAYWRIGHT_ENV_FILE || '.env.test';

// Load test environment variables for Prisma clients in tests
// Do not override CI-provided env vars (e.g., DATABASE_URL pointing to the
// service container port). The env file should only fill missing values.
dotenv.config({ path: playwrightEnvFile, override: false });

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  globalSetup: require.resolve('./tests/e2e/setup/global-setup'),
  fullyParallel: true,
  retries: 1,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
      ],
  use: {
    actionTimeout: 0,
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    ...(isCI ? {} : { storageState }),
    extraHTTPHeaders:
      process.env.BYPASS_AUTH_FOR_TESTS?.toLowerCase() === 'true'
        ? {
            'x-playwright-test': 'bypass-auth',
          }
        : undefined,
  },
  webServer: {
    command: 'node scripts/start-playwright-dev.js',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PLAYWRIGHT_ENV_FILE: playwrightEnvFile,
      BYPASS_AUTH_FOR_TESTS: process.env.BYPASS_AUTH_FOR_TESTS ?? 'true',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
