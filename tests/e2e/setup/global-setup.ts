import path from 'path';
import { execSync } from 'child_process';
import { config as loadEnv } from 'dotenv';

const envFile = process.env.PLAYWRIGHT_ENV_FILE || '.env.test';
loadEnv({ path: path.resolve(process.cwd(), envFile), override: true });

export default async function globalSetup(): Promise<void> {
  try {
    execSync('node scripts/reset-test-db.js --seed', {
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_ENV_FILE: envFile,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });
  } catch (error) {
    process.stderr.write(
      'Failed to reset and seed the test database before Playwright tests.\n'
    );
    throw error;
  }
}
