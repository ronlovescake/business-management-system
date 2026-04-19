#!/usr/bin/env node
/**
 * Run a list of npm scripts only when DATABASE_URL is set.
 *
 * Many of our integrity scripts (accounting:transactions:sanitycheck,
 * inventory:ledger:controls, …) connect to a real database. We want them
 * to be part of `npm run test:full` so a developer who *has* a DB cannot
 * regress the accounting/inventory invariants — but we also do not want
 * `test:full` to fail on machines that have no DB configured (the rest
 * of the suite is fully self-contained).
 *
 * Usage: node scripts/run-if-db.js <npm-script-name> [<npm-script-name> …]
 *
 * Behavior:
 *   - DATABASE_URL unset → log a SKIP line for each script, exit 0.
 *   - DATABASE_URL set   → run each script with `npm run -s <name>`,
 *                          exit on first failure.
 */
const { spawnSync } = require('node:child_process');

const scripts = process.argv.slice(2);
if (scripts.length === 0) {
  console.error('[run-if-db] usage: run-if-db.js <script> [<script> …]');
  process.exit(2);
}

if (!process.env.DATABASE_URL) {
  for (const s of scripts) {
    console.log(
      `[run-if-db] SKIP npm run ${s} — DATABASE_URL is not set ` +
        '(set it locally or in CI to enable database-integrity checks).'
    );
  }
  process.exit(0);
}

for (const s of scripts) {
  console.log(`[run-if-db] npm run ${s}`);
  const res = spawnSync('npm', ['run', '-s', s], {
    stdio: 'inherit',
    shell: false,
  });
  if (res.status !== 0) {
    console.error(`[run-if-db] FAIL: npm run ${s} exited ${res.status}`);
    process.exit(res.status ?? 1);
  }
}
