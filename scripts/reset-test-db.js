#!/usr/bin/env node
/* eslint-disable no-console */

const { execSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

const envFile = process.env.TEST_ENV_FILE || '.env.test';
const envPath = path.resolve(process.cwd(), envFile);

dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not configured for the test environment.');
  console.error('Set DATABASE_URL in .env.test or supply TEST_ENV_FILE.');
  process.exit(1);
}

const prismaArgs = ['npx', 'prisma'];

function run(command, description) {
  try {
    console.log(`▶ ${description}`);
    execSync(command, {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });
  } catch (error) {
    console.error(`❌ Failed to ${description}`);
    process.exit(error.status || 1);
  }
}

const shouldSeed = process.argv.includes('--seed');

run(
  `${prismaArgs.join(' ')} migrate reset --force --skip-generate --skip-seed --schema prisma/schema.prisma`,
  'reset test database'
);

if (shouldSeed) {
  run(
    `${prismaArgs.join(' ')} db seed --schema prisma/schema.prisma`,
    'seed test database'
  );
}
