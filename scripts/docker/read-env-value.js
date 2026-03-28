#!/usr/bin/env node

const fs = require('fs');
const dotenv = require('dotenv');

const [, , envFile, key] = process.argv;

if (!envFile || !key) {
  process.exit(0);
}

if (!fs.existsSync(envFile)) {
  process.exit(0);
}

const parsed = dotenv.parse(fs.readFileSync(envFile));
process.stdout.write(parsed[key] ?? '');
