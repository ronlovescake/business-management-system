#!/usr/bin/env node
/* eslint-disable no-console */

const { spawnSync } = require('child_process');

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  command,
  [
    '--no-install',
    'tsx',
    'scripts/verify-restore.ts',
    ...process.argv.slice(2),
  ],
  {
    stdio: 'inherit',
    env: process.env,
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
