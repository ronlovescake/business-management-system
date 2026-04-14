#!/usr/bin/env node

const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');

const [, , envFile = '.env.docker', ...npmArgs] = process.argv;

const result = dotenv.config({ path: path.resolve(process.cwd(), envFile) });

if (result.error) {
  console.error(`Failed to load environment file: ${envFile}`);
  console.error(result.error.message);
  process.exit(1);
}

const args = npmArgs.length > 0 ? npmArgs : ['run', 'build'];

const child = spawn('npm', args, {
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

child.on('close', (code) => {
  process.exitCode = code ?? 0;
});

child.on('error', (error) => {
  console.error('Failed to launch npm command:', error);
  process.exit(1);
});