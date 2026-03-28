#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const projectRoot = process.cwd();
const envFiles = ['.env.local', '.env'];

for (const file of envFiles) {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false });
  }
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
