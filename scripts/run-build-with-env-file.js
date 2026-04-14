#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function decodeQuotedValue(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function loadEnvFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Environment file not found: ${filePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalizedLine = line.startsWith('export ')
      ? line.slice('export '.length)
      : line;
    const separatorIndex = normalizedLine.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    let value = normalizedLine.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
      if (normalizedLine[separatorIndex + 1] === '"') {
        value = decodeQuotedValue(value);
      }
    }

    process.env[key] = value;
  }
}

const [, , envFile = '.env.docker', ...npmArgs] = process.argv;

try {
  loadEnvFile(envFile);
} catch (error) {
  console.error(`Failed to load environment file: ${envFile}`);
  console.error(error instanceof Error ? error.message : String(error));
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