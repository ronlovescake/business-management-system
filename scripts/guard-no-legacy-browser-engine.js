#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const SELF_PATH = path.relative(ROOT, __filename).replace(/\\/g, '/');
const BLOCKED_PATTERN = /puppeteer/gi;

function getTrackedFiles() {
  const output = execSync('git ls-files', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((filePath) => filePath !== SELF_PATH);
}

function isBinaryBuffer(buffer) {
  const maxProbeLength = Math.min(buffer.length, 4096);
  for (let index = 0; index < maxProbeLength; index += 1) {
    if (buffer[index] === 0) {
      return true;
    }
  }
  return false;
}

function findOffendingLines(content) {
  const lines = content.split('\n');
  const matches = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (BLOCKED_PATTERN.test(lines[index])) {
      matches.push({
        line: index + 1,
        text: lines[index].trim(),
      });
    }
    BLOCKED_PATTERN.lastIndex = 0;
  }

  return matches;
}

function main() {
  let files = [];

  try {
    files = getTrackedFiles();
  } catch (error) {
    console.error(
      `❌ Failed to collect tracked files: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  const violations = [];

  for (const relativePath of files) {
    const absolutePath = path.join(ROOT, relativePath);

    let rawBuffer;
    try {
      rawBuffer = fs.readFileSync(absolutePath);
    } catch {
      continue;
    }

    if (isBinaryBuffer(rawBuffer)) {
      continue;
    }

    const content = rawBuffer.toString('utf8');
    const matches = findOffendingLines(content);

    if (matches.length > 0) {
      violations.push({ file: relativePath, matches });
    }
  }

  if (violations.length === 0) {
    console.log(
      '✅ Guard check passed: no legacy Puppeteer references found in tracked files.'
    );
    return;
  }

  console.error('❌ Guard check failed: legacy Puppeteer references detected.');

  for (const violation of violations) {
    console.error(`\n- ${violation.file}`);
    for (const match of violation.matches.slice(0, 5)) {
      console.error(`  L${match.line}: ${match.text}`);
    }
    if (violation.matches.length > 5) {
      console.error(`  ...and ${violation.matches.length - 5} more match(es)`);
    }
  }

  process.exit(1);
}

main();
