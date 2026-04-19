#!/usr/bin/env node
/**
 * Doc / npm-script drift check.
 *
 * Greps every Markdown file in the repo for `npm run <name>` references and
 * verifies each <name> exists in package.json#scripts. Fails (exit code 1) if
 * any referenced script is missing.
 *
 * Run manually:
 *   node scripts/check-doc-command-drift.js
 *
 * Wired into `npm run guardrails:check` (see package.json).
 *
 * Notes:
 * - Code blocks are scanned, not just prose.
 * - Anchors / partial command names like `npm run -s` are normalized.
 * - Scripts that are intentionally illustrative (e.g. `<module-name>`) can be
 *   excluded by listing them in the IGNORE set below.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PKG_JSON_PATH = path.join(REPO_ROOT, 'package.json');

/** Script names that appear in docs as placeholders, not real targets. */
const IGNORE = new Set([
  // generic placeholders
  '<script>',
  '<task>',
  '<name>',
  // template snippets that intentionally read like commands
  '\u2026',
]);

/** Folders to skip entirely. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'coverage',
  'playwright-report',
  'test-results',
  'archives',
  '.husky',
  '.vscode',
  '.playwright-mcp',
]);

function loadScriptNames() {
  const pkg = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
  return new Set(Object.keys(pkg.scripts || {}));
}

/** Recursively yield .md file paths under root. */
function* walkMarkdown(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && SKIP_DIRS.has(entry.name)) {
      continue;
    }
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walkMarkdown(full);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      yield full;
    }
  }
}

/**
 * Extract npm script names referenced in a markdown file.
 * Matches:
 *   npm run foo
 *   npm run -s foo
 *   npm run --silent foo
 *   npm run foo:bar -- --baz
 */
const NPM_RUN_RE = /\bnpm\s+run\s+(?:-s\s+|--silent\s+)?([a-zA-Z0-9:_-]+)/g;

function extractReferences(content) {
  const refs = new Set();
  let m;
  while ((m = NPM_RUN_RE.exec(content)) !== null) {
    const name = m[1];
    if (!IGNORE.has(name)) {
      refs.add(name);
    }
  }
  return refs;
}

function main() {
  const scripts = loadScriptNames();
  const missing = []; // { file, name }

  for (const file of walkMarkdown(REPO_ROOT)) {
    const content = fs.readFileSync(file, 'utf8');
    const refs = extractReferences(content);
    for (const ref of refs) {
      if (!scripts.has(ref)) {
        missing.push({ file: path.relative(REPO_ROOT, file), name: ref });
      }
    }
  }

  if (missing.length === 0) {
    console.log(
      `[doc-command-drift] OK \u2014 every npm script referenced in markdown is defined in package.json.`
    );
    process.exit(0);
  }

  console.error(
    `[doc-command-drift] FAIL \u2014 ${missing.length} reference(s) to npm scripts that don't exist:\n`
  );
  const grouped = new Map();
  for (const { file, name } of missing) {
    if (!grouped.has(file)) {
      grouped.set(file, new Set());
    }
    grouped.get(file).add(name);
  }
  for (const [file, names] of grouped) {
    console.error(`  ${file}`);
    for (const name of names) {
      console.error(`    - ${name}`);
    }
  }
  console.error(
    `\nFix by either (a) adding the missing script to package.json, (b) updating the doc, or (c) adding the placeholder to IGNORE in scripts/check-doc-command-drift.js.`
  );
  process.exit(1);
}

main();
