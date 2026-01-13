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

function parseDatabaseUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const dbName = (url.pathname || '').replace(/^\//, '');
    return { host: url.hostname, dbName };
  } catch {
    return null;
  }
}

const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
if (!parsed) {
  console.error('❌ Could not parse DATABASE_URL for the test environment.');
  process.exit(1);
}

if (
  !String(parsed.dbName || '')
    .toLowerCase()
    .includes('test')
) {
  console.error(
    '🛑 Refusing to reset a database that does not look like a TEST database.'
  );
  console.error(
    `Target detected from DATABASE_URL: host=${parsed.host} db=${parsed.dbName || '(none)'}`
  );
  console.error(
    'Use a dedicated test database (recommended name contains "test").'
  );
  process.exit(1);
}

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
