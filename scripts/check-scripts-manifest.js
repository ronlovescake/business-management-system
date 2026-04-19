#!/usr/bin/env node
/**
 * Guard: every script in `scripts/` (top level only) must be referenced in
 * `scripts/SCRIPTS_MANIFEST.md`. The manifest is the single source of truth
 * for script organization (we deliberately do not move scripts into
 * subfolders — see the manifest header for rationale). This guard fails CI
 * if a new script lands without a corresponding manifest row.
 */
const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname);
const MANIFEST = path.join(SCRIPTS_DIR, 'SCRIPTS_MANIFEST.md');

const SKIP_FILES = new Set([
  'SCRIPTS_MANIFEST.md',
  'check-scripts-manifest.js',
]);
// Subdirectories are documented in aggregate (see manifest "Docker / Infra").
const SKIP_DIRS = true;

function listScripts() {
  return fs
    .readdirSync(SCRIPTS_DIR, { withFileTypes: true })
    .filter((d) => {
      if (SKIP_DIRS && d.isDirectory()) {
        return false;
      }
      if (!d.isFile()) {
        return false;
      }
      if (SKIP_FILES.has(d.name)) {
        return false;
      }
      // Only consider scripts (sh, js, ts, sql, html for known assets).
      return /\.(js|ts|sh|sql|html)$/.test(d.name);
    })
    .map((d) => d.name);
}

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('[check-scripts-manifest] FAIL: SCRIPTS_MANIFEST.md missing');
    process.exit(1);
  }
  const manifest = fs.readFileSync(MANIFEST, 'utf8');
  const scripts = listScripts();
  const missing = scripts.filter((name) => !manifest.includes(name));
  if (missing.length > 0) {
    console.error(
      '[check-scripts-manifest] FAIL: the following scripts are not listed in SCRIPTS_MANIFEST.md:'
    );
    for (const m of missing) {
      console.error(`  - ${m}`);
    }
    console.error(
      '\nAdd a row for each script (see manifest conventions). The manifest is the source of truth for script organization.'
    );
    process.exit(1);
  }
  console.log(
    `[check-scripts-manifest] OK — all ${scripts.length} top-level scripts are documented in SCRIPTS_MANIFEST.md.`
  );
}

main();
