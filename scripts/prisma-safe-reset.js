#!/usr/bin/env node
/* eslint-disable no-console */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadEnvFiles() {
  const cwd = process.cwd();
  const candidates = ['.env', '.env.local'];

  for (const file of candidates) {
    const fullPath = path.resolve(cwd, file);
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath });
    }
  }
}

function parseDatabaseUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const dbName = (url.pathname || '').replace(/^\//, '');
    return {
      protocol: url.protocol,
      host: url.hostname,
      port: url.port,
      dbName,
    };
  } catch {
    return null;
  }
}

function isLikelyNonProd({ host, dbName }) {
  const safeHosts = new Set(['localhost', '127.0.0.1']);
  const name = (dbName || '').toLowerCase();
  const looksLikeDevDb =
    name.includes('dev') || name.includes('test') || name.includes('local');
  return safeHosts.has(host) && looksLikeDevDb;
}

function main() {
  loadEnvFiles();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      '❌ DATABASE_URL is not set. Refusing to run prisma migrate reset.'
    );
    console.error('Set DATABASE_URL in .env or .env.local.');
    process.exit(1);
  }

  const parsed = parseDatabaseUrl(databaseUrl);
  if (!parsed) {
    console.error(
      '❌ Could not parse DATABASE_URL. Refusing to run prisma migrate reset.'
    );
    process.exit(1);
  }

  const allowFlag = String(process.env.PRISMA_ALLOW_RESET || '').toLowerCase();
  const allowReset =
    allowFlag === '1' || allowFlag === 'true' || allowFlag === 'yes';

  if (!allowReset) {
    console.error(
      '🛑 Refusing to run `prisma migrate reset` without explicit opt-in.'
    );
    console.error(
      'This command DROPS and recreates the schema and WILL DELETE DATA.'
    );
    console.error('');
    console.error('If you really intend to reset a DEV/TEST database, run:');
    console.error('  PRISMA_ALLOW_RESET=true npm run db:reset');
    console.error('');
    console.error('Target detected from DATABASE_URL:');
    console.error(`  host=${parsed.host} db=${parsed.dbName || '(none)'}`);
    process.exit(1);
  }

  if (!isLikelyNonProd(parsed)) {
    console.error(
      '🛑 Refusing to run `prisma migrate reset` on a database that does not look like DEV/TEST.'
    );
    console.error('This protects against accidental data loss.');
    console.error('');
    console.error('Target detected from DATABASE_URL:');
    console.error(`  host=${parsed.host} db=${parsed.dbName || '(none)'}`);
    console.error('');
    console.error(
      'If this is actually a safe dev DB, rename it to include "dev" or "test" (recommended),'
    );
    console.error('or switch your DATABASE_URL to a dedicated dev database.');
    process.exit(1);
  }

  const extraArgs = process.argv.slice(2).join(' ');
  const cmd = `npx prisma migrate reset ${extraArgs}`.trim();
  console.log(`▶ Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: process.env });
}

main();
