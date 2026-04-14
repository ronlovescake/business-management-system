#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function decodeQuotedValue(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
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

const projectRoot = process.cwd();
const envFiles = ['.env.local', '.env'];

for (const file of envFiles) {
  const filePath = path.join(projectRoot, file);
  loadEnvFile(filePath);
}

const errors = [];
const dbUrl = (process.env.DATABASE_URL || '').trim();

if (!dbUrl) {
  errors.push(
    'DATABASE_URL is missing. Set a PostgreSQL connection string in your environment or in .env/.env.local before running npm run build.'
  );
} else if (!/^postgres(?:ql)?:\/\//i.test(dbUrl)) {
  errors.push(
    'DATABASE_URL must be a valid PostgreSQL connection string (e.g., postgresql://user:password@host:5432/db).'
  );
}

if (errors.length > 0) {
  console.error('\n❌ Environment validation failed. Build aborted.\n');
  for (const [index, message] of errors.entries()) {
    console.error(` ${index + 1}. ${message}`);
  }
  console.error('\nFix the issue above and rerun npm run build.\n');
  process.exit(1);
}
