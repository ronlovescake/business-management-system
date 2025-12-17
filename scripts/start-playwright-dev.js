#!/usr/bin/env node
/* eslint-disable no-console */

const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

const isCI =
  String(process.env.CI || '').toLowerCase() === 'true' ||
  String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true';

const envFile = process.env.PLAYWRIGHT_ENV_FILE || '.env.test';
const envPath = path.resolve(process.cwd(), envFile);

dotenv.config({ path: envPath });

const env = {
  ...process.env,
  BYPASS_AUTH_FOR_TESTS: process.env.BYPASS_AUTH_FOR_TESTS ?? 'true',
  PLAYWRIGHT_ENV_FILE: envFile,
  PORT: process.env.PORT || '3100',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3100',
  // CI is more stable on webpack; Turbopack currently rejects some config options.
  TURBOPACK: isCI ? '0' : (process.env.TURBOPACK ?? '1'),
};

const devScript =
  process.env.PLAYWRIGHT_DEV_SCRIPT ||
  (isCI ? 'dev:playwright:webpack' : 'dev:playwright');
console.log(`▶ Starting Next.js via npm run ${devScript}`);

const child = spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', devScript, '--'],
  {
    stdio: 'inherit',
    env,
  }
);

child.on('exit', (code) => {
  if (typeof code === 'number') {
    process.exit(code);
  } else {
    process.exit(1);
  }
});
