#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Module ↔ route permissions drift check.
 *
 * Reads `src/modules/index.ts` to find each `moduleRegistry.register(xModule)`
 * call, then resolves the corresponding module file and extracts each
 * route `path:` declared on it. Cross-checks each path against the
 * `ROUTE_PERMISSIONS` map in `src/core/routePermissions.ts` and emits a
 * warning if a registered module's route has no matching ACL prefix.
 *
 * This is the safest forward step toward IMPROVEMENTS_CHECKLIST.md §2.3
 * (auto-register modules via PluginManager/ModuleRegistry). It does not
 * generate code — it only surfaces drift between the two sources of
 * truth that exist today, so adding a new module without a matching ACL
 * entry will be caught in CI.
 *
 * Exit codes:
 *   0 — no drift, or drift only in the deferred (commented-out) section
 *   1 — drift in an actively-registered module
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULES_INDEX = path.join(REPO_ROOT, 'src', 'modules', 'index.ts');
const ROUTE_ACL_FILE = path.join(
  REPO_ROOT,
  'src',
  'core',
  'routePermissions.ts'
);

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function extractRouteAclPrefixes(src) {
  // Pull the keys of the ROUTE_PERMISSIONS object literal.
  const match = src.match(
    /export const ROUTE_PERMISSIONS[^=]*=\s*{([\s\S]*?)\n};/
  );
  if (!match) {
    return [];
  }
  const body = match[1];
  const keys = [];
  const re = /^\s*'([^']+)'\s*:/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

function findModuleFileForImport(importPath) {
  // Resolve `@/...` aliases to src/, and treat relative paths as relative to
  // src/modules/ (the location of the index file we parsed).
  let rel;
  if (importPath.startsWith('@/')) {
    rel = importPath.replace(/^@\//, 'src/');
  } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
    rel = path.posix.join('src/modules', importPath);
  } else {
    return null;
  }
  const candidates = [
    path.join(REPO_ROOT, `${rel}.ts`),
    path.join(REPO_ROOT, `${rel}.tsx`),
    path.join(REPO_ROOT, rel, 'index.ts'),
    path.join(REPO_ROOT, rel, 'index.tsx'),
    path.join(REPO_ROOT, rel, 'module.config.ts'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

function extractRoutePathsFromModule(moduleFileSrc) {
  // Look for `path: '/some/route'` entries inside this file.
  const paths = [];
  const re = /\bpath\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(moduleFileSrc)) !== null) {
    if (m[1].startsWith('/')) {
      paths.push(m[1]);
    }
  }
  return paths;
}

function main() {
  const indexSrc = readFileSafe(MODULES_INDEX);
  const aclSrc = readFileSafe(ROUTE_ACL_FILE);
  if (!indexSrc || !aclSrc) {
    console.error('[check-module-route-acl] Required source file missing.');
    process.exit(2);
  }

  const aclPrefixes = extractRouteAclPrefixes(aclSrc);
  if (aclPrefixes.length === 0) {
    console.error('[check-module-route-acl] No ACL entries parsed.');
    process.exit(2);
  }

  // Map of variable name -> import path
  const importMap = new Map();
  const importRe = /import\s*\{\s*([^}]+)\s*\}\s*from\s*'([^']+)';?/g;
  let im;
  while ((im = importRe.exec(indexSrc)) !== null) {
    const importPath = im[2];
    if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
      continue;
    }
    const names = im[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]);
    for (const name of names) {
      importMap.set(name, importPath);
    }
  }

  // Find active registrations (uncommented).
  const activeRe = /^[^\n/]*moduleRegistry\.register\(\s*(\w+)\s*\)/gm;
  const active = new Set();
  let am;
  while ((am = activeRe.exec(indexSrc)) !== null) {
    active.add(am[1]);
  }

  const drifts = [];

  for (const moduleVar of active) {
    const importPath = importMap.get(moduleVar);
    if (!importPath) {
      continue;
    }
    let file = findModuleFileForImport(importPath);
    if (!file) {
      continue;
    }
    let moduleSrc = readFileSafe(file);
    if (!moduleSrc) {
      continue;
    }
    // Follow `export { fooModule } from './module.config'` re-exports so we
    // see the real `routes` declaration.
    if (/\bindex\.tsx?$/.test(file)) {
      const reExport = moduleSrc.match(
        new RegExp(
          `export\\s*\\{[^}]*\\b${moduleVar}\\b[^}]*\\}\\s*from\\s*'([^']+)'`
        )
      );
      if (reExport) {
        const sibling = path.resolve(path.dirname(file), reExport[1]);
        const candidates = [
          `${sibling}.ts`,
          `${sibling}.tsx`,
          path.join(sibling, 'index.ts'),
          path.join(sibling, 'index.tsx'),
        ];
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            file = c;
            const next = readFileSafe(c);
            if (next) {
              moduleSrc = next;
            }
            break;
          }
        }
      }
    }
    const paths = extractRoutePathsFromModule(moduleSrc);
    for (const p of paths) {
      const matched = aclPrefixes.some((prefix) => p.startsWith(prefix));
      if (!matched) {
        drifts.push({
          moduleVar,
          path: p,
          file: path.relative(REPO_ROOT, file),
        });
      }
    }
  }

  if (drifts.length === 0) {
    console.log(
      `[check-module-route-acl] OK — every active module route is covered by an ACL prefix in src/core/routePermissions.ts.`
    );
    process.exit(0);
  }

  console.warn(
    `[check-module-route-acl] Drift detected: ${drifts.length} active module route(s) have no matching ACL prefix.`
  );
  for (const d of drifts) {
    console.warn(`  - ${d.moduleVar} declares ${d.path} (in ${d.file})`);
  }
  console.warn('');
  console.warn(
    'Add a matching prefix entry in src/core/routePermissions.ts (or relax this check if the route is intentionally public).'
  );
  process.exit(1);
}

main();
