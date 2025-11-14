#!/usr/bin/env node
/* eslint-disable no-console */

const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

const envFile = process.env.PLAYWRIGHT_ENV_FILE || '.env.test';
const envPath = path.resolve(process.cwd(), envFile);

dotenv.config({ path: envPath });

const env = {
  ...process.env,
  BYPASS_AUTH_FOR_TESTS: process.env.BYPASS_AUTH_FOR_TESTS ?? 'true',
  PLAYWRIGHT_ENV_FILE: envFile,
  PORT: process.env.PORT || '3100',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3100',
};

const child = spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', 'dev', '--'],
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
