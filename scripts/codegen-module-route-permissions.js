#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Codegen: emit `src/core/routePermissions.modules.generated.ts`.
 *
 * Walks `src/modules/index.ts`, finds each `moduleRegistry.register(xModule)`
 * call, resolves the module file, and extracts the declared
 * `permissions: [...]` and `routes: [{ path: '...' }]` entries. Emits a
 * generated TypeScript file that catalogs this for tooling and drift
 * checks.
 *
 * The middleware itself does NOT import this generated file. The hand-
 * maintained `src/core/routePermissions.ts` remains the single runtime
 * source of truth (so the edge bundle stays free of any registry code).
 * This codegen exists so:
 *
 *   - `npm run guardrails:check` can verify the generated catalog matches
 *     what `src/modules/index.ts` registers (drift detection).
 *   - Reviewers can see a flat list of "module → declared paths →
 *     module-level permissions" in source control.
 *   - A future runtime promotion (where the registry derives the ACL
 *     directly) has a typed shape to migrate to.
 *
 * Usage:
 *   node scripts/codegen-module-route-permissions.js          # write file
 *   node scripts/codegen-module-route-permissions.js --check  # exit 1 on drift
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULES_INDEX = path.join(REPO_ROOT, 'src', 'modules', 'index.ts');
const OUT_PATH = path.join(
  REPO_ROOT,
  'src',
  'core',
  'routePermissions.modules.generated.ts'
);

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
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

function extractPaths(src) {
  const paths = [];
  const re = /\bpath\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[1].startsWith('/')) {
      paths.push(m[1]);
    }
  }
  return paths;
}

function extractPermissions(src) {
  const m = src.match(/\bpermissions\s*:\s*\[([^\]]*)\]/);
  if (!m) {
    return [];
  }
  const items = [];
  const re = /'([^']+)'/g;
  let mm;
  while ((mm = re.exec(m[1])) !== null) {
    items.push(mm[1]);
  }
  return items;
}

function buildCatalog() {
  const indexSrc = readFileSafe(MODULES_INDEX);
  if (!indexSrc) {
    throw new Error('src/modules/index.ts not found');
  }

  // Parse imports.
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

  // Find active registrations.
  const activeRe = /^[^\n/]*moduleRegistry\.register\(\s*(\w+)\s*\)/gm;
  const active = [];
  let am;
  while ((am = activeRe.exec(indexSrc)) !== null) {
    active.push(am[1]);
  }

  const catalog = [];
  for (const moduleVar of active) {
    const importPath = importMap.get(moduleVar);
    if (!importPath) {
      continue;
    }
    let file = findModuleFileForImport(importPath);
    if (!file) {
      continue;
    }
    let src = readFileSafe(file);
    if (!src) {
      continue;
    }

    // If the resolved file is a barrel `index.ts` that just re-exports from a
    // sibling `module.config.ts`, follow the re-export so we read the real
    // declarations.
    if (/\bindex\.tsx?$/.test(file)) {
      const reExport = src.match(
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
              src = next;
            }
            break;
          }
        }
      }
    }

    catalog.push({
      moduleVar,
      file: path.relative(REPO_ROOT, file).replace(/\\/g, '/'),
      paths: extractPaths(src).sort(),
      permissions: extractPermissions(src),
    });
  }

  catalog.sort((a, b) => a.moduleVar.localeCompare(b.moduleVar));
  return catalog;
}

function renderFile(catalog) {
  const header = [
    '/**',
    ' * AUTO-GENERATED FILE. Do not edit by hand.',
    ' *',
    ` * Regenerate with: npm run codegen:route-permissions`,
    ' *',
    ' * This file catalogs every module currently registered via',
    ' * `moduleRegistry.register()` in `src/modules/index.ts`, including the',
    ' * route paths and permission strings each module declares.',
    ' *',
    ' * The auth middleware does NOT import this file. The hand-maintained',
    ' * `src/core/routePermissions.ts` remains the single runtime source of',
    ' * truth (keeping the edge bundle free of any registry code). This file',
    ' * exists for drift detection (`scripts/check-module-route-acl.js`) and',
    ' * for reviewer visibility.',
    ' */',
    '',
    '/* eslint-disable */',
    '',
    'export type ModuleRouteCatalogEntry = {',
    '  moduleVar: string;',
    '  file: string;',
    '  paths: string[];',
    '  /** Module-level permission strings (e.g. "admin", "operations"). */',
    '  permissions: string[];',
    '};',
    '',
    'export const MODULE_ROUTE_CATALOG: ModuleRouteCatalogEntry[] = ',
  ].join('\n');
  const body = JSON.stringify(catalog, null, 2);
  return `${header}${body};\n`;
}

function main() {
  const catalog = buildCatalog();
  const next = renderFile(catalog);
  const checkMode = process.argv.includes('--check');

  if (checkMode) {
    const current = readFileSafe(OUT_PATH);
    if (current !== next) {
      console.error(
        '[codegen:route-permissions] Drift detected. Run `npm run codegen:route-permissions` and commit the result.'
      );
      process.exit(1);
    }
    console.log(
      '[codegen:route-permissions] OK — generated file is up to date.'
    );
    return;
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, next, 'utf8');
  console.log(
    `[codegen:route-permissions] Wrote ${path.relative(REPO_ROOT, OUT_PATH)} (${catalog.length} modules).`
  );
}

main();
