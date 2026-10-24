#!/usr/bin/env node
/* eslint-disable no-console */

const { execSync } = require('child_process');
const { readFileSync } = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envFile = process.env.TEST_ENV_FILE || '.env.test';
const envPath = path.resolve(process.cwd(), envFile);

// Resetting and seeding must always use the explicit test env file rather than
// any inherited shell DATABASE_URL.
dotenv.config({ path: envPath, override: true });

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

function run(command, description, input) {
  try {
    console.log(`▶ ${description}`);
    execSync(command, {
      stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
      input,
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
  `${prismaArgs.join(' ')} db execute --stdin --schema prisma/schema.prisma`,
  'reset test schemas and bootstrap the investor-code sequence',
  [
    'BEGIN;',
    'DROP SCHEMA IF EXISTS general_merchandise CASCADE;',
    'DROP SCHEMA IF EXISTS public CASCADE;',
    'CREATE SCHEMA public;',
    'CREATE SCHEMA general_merchandise;',
    'CREATE SEQUENCE public."ClothingInvestorCodeSequence" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;',
    'COMMIT;',
  ].join('\n')
);

run(
  `${prismaArgs.join(' ')} db push --schema prisma/schema.prisma --skip-generate`,
  'align test database schema'
);

run(
  `${prismaArgs.join(' ')} db execute --file prisma/migrations/20261018120000_order_customer_identity/migration.sql --schema prisma/schema.prisma`,
  'install customer identity backfill and synchronization rules'
);

run(
  `${prismaArgs.join(' ')} db execute --file prisma/migrations/20261019100000_link_gm_customers_to_clothing/migration.sql --schema prisma/schema.prisma`,
  'install canonical Clothing-to-GM customer links'
);

for (const [migration, definition] of [
  [
    '20261020120000_clothing_product_identity',
    'CREATE FUNCTION public.resolve_clothing_product_identity()',
  ],
  [
    '20261020130000_general_merchandise_product_identity',
    'CREATE FUNCTION general_merchandise.resolve_product_identity()',
  ],
]) {
  const sql = readFileSync(
    path.join(
      __dirname,
      '..',
      'prisma',
      'migrations',
      migration,
      'migration.sql'
    ),
    'utf8'
  );
  const start = sql.indexOf(definition);
  if (
    start === -1 ||
    start !== sql.lastIndexOf(definition) ||
    !sql.trimEnd().endsWith('COMMIT;')
  ) {
    console.error(
      `Cannot locate the test trigger definitions in ${migration}.`
    );
    process.exit(1);
  }
  run(
    `${prismaArgs.join(' ')} db execute --stdin --schema prisma/schema.prisma`,
    `install test product-identity rules from ${migration}`,
    `BEGIN;\n${sql.slice(start)}`
  );
}

if (shouldSeed) {
  run(
    `${prismaArgs.join(' ')} db seed --schema prisma/schema.prisma`,
    'seed test database'
  );
}
