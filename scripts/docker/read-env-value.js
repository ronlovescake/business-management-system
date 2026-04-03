#!/usr/bin/env node

const fs = require('fs');

function stripInlineComment(value) {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote && previous !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === '#' && !inSingleQuote && !inDoubleQuote) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value.trim();
}

function normalizeQuotedValue(value) {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    const unquoted = value.slice(1, -1);

    if (first === '"') {
      return unquoted
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }

    return unquoted;
  }

  return value;
}

function parseEnvFile(content) {
  const parsed = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const normalizedLine = trimmed.startsWith('export ')
      ? trimmed.slice(7).trimStart()
      : trimmed;

    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    const rawValue = normalizedLine.slice(separatorIndex + 1).trim();
    parsed[key] = normalizeQuotedValue(stripInlineComment(rawValue));
  }

  return parsed;
}

function readEnvValue(envFile, key) {
  if (!envFile || !key || !fs.existsSync(envFile)) {
    return '';
  }

  const parsed = parseEnvFile(fs.readFileSync(envFile, 'utf8'));
  return parsed[key] ?? '';
}

if (require.main === module) {
  const [, , envFile, key] = process.argv;

  if (!envFile || !key) {
    process.exit(0);
  }

  process.stdout.write(readEnvValue(envFile, key));
}

module.exports = {
  parseEnvFile,
  readEnvValue,
};
