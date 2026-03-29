#!/usr/bin/env node

/**
 * Import Convention Checker
 *
 * Validates that imports follow the hybrid strategy:
 * - page.tsx files: Direct imports to components
 * - Other files: Barrel imports from module root
 */

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Track violations
const violations = [];
let filesChecked = 0;
let filesWithViolations = 0;

/**
 * Check if file is a route page
 */
function isRoutePage(filePath) {
  return filePath.includes('/app/') && filePath.endsWith('/page.tsx');
}

/**
 * Extract imports from file
 */
function extractImports(content) {
  const importRegex = /import\s+{[^}]+}\s+from\s+['"]([^'"]+)['"]/g;
  const imports = [];
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      full: match[0],
      path: match[1],
      line: content.substring(0, match.index).split('\n').length,
    });
  }

  return imports;
}

/**
 * Check if import is a barrel import
 */
function isBarrelImport(importPath) {
  // Barrel imports end at module level: @/modules/business/workspace/feature
  const barrelPattern = /^@\/modules\/[^/]+\/[^/]+\/[^/]+$/;
  return barrelPattern.test(importPath);
}

/**
 * Check if import is a direct component import
 */
function isDirectComponentImport(importPath) {
  // Direct imports include /components/ or /services/ etc
  return (
    importPath.includes('/components/') ||
    importPath.includes('/services/') ||
    importPath.includes('/hooks/') ||
    importPath.includes('/types/') ||
    importPath.includes('/utils/')
  );
}

/**
 * Check file for violations
 */
function checkFile(filePath) {
  filesChecked++;

  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = extractImports(content);
  const isPage = isRoutePage(filePath);
  const fileViolations = [];

  for (const imp of imports) {
    // Skip non-module imports
    if (!imp.path.startsWith('@/modules/')) {
      continue;
    }

    // Rule 1: page.tsx should use direct component imports
    if (isPage) {
      if (isBarrelImport(imp.path)) {
        fileViolations.push({
          line: imp.line,
          import: imp.full,
          rule: 'PAGE_SHOULD_USE_DIRECT',
          message: `Route page should use direct import to component, not barrel import`,
          suggestion: imp.path.replace(
            /^(@\/modules\/[^/]+\/[^/]+\/[^/]+)$/,
            '$1/components/ComponentName'
          ),
        });
      }
    }

    // Rule 2: Non-page files should use barrel imports
    if (!isPage && isDirectComponentImport(imp.path)) {
      fileViolations.push({
        line: imp.line,
        import: imp.full,
        rule: 'NON_PAGE_SHOULD_USE_BARREL',
        message: `Non-page file should use barrel import from module root`,
        suggestion: imp.path.replace(
          /^(@\/modules\/[^/]+\/[^/]+\/[^/]+)\/.*$/,
          '$1'
        ),
      });
    }
  }

  if (fileViolations.length > 0) {
    filesWithViolations++;
    violations.push({
      file: filePath,
      violations: fileViolations,
    });
  }
}

/**
 * Find TypeScript files recursively
 */
function findTypeScriptFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .next, etc
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      findTypeScriptFiles(fullPath, files);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      // Skip test files and d.ts files
      if (
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.') &&
        !entry.name.endsWith('.d.ts')
      ) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Print violations
 */
function printViolations() {
  if (violations.length === 0) {
    console.log(
      `${colors.green}✅ All imports follow conventions!${colors.reset}`
    );
    console.log(
      `${colors.blue}📊 Checked ${filesChecked} files${colors.reset}`
    );
    return true;
  }

  console.log(
    `${colors.red}❌ Found import convention violations:${colors.reset}\n`
  );

  for (const { file, violations: fileViolations } of violations) {
    console.log(`${colors.yellow}📁 ${file}${colors.reset}`);

    for (const violation of fileViolations) {
      console.log(
        `  ${colors.red}Line ${violation.line}:${colors.reset} ${violation.message}`
      );
      console.log(
        `    ${colors.blue}Current:${colors.reset} ${violation.import}`
      );
      console.log(
        `    ${colors.green}Suggest:${colors.reset} Use: ${violation.suggestion}`
      );
      console.log();
    }
  }

  console.log(`${colors.red}📊 Summary:${colors.reset}`);
  console.log(`  Files checked: ${filesChecked}`);
  console.log(`  Files with violations: ${filesWithViolations}`);
  console.log(
    `  Total violations: ${violations.reduce((sum, v) => sum + v.violations.length, 0)}`
  );
  console.log();
  console.log(
    `${colors.yellow}💡 See docs/README.md for current documentation and import-convention references${colors.reset}`
  );

  return false;
}

/**
 * Main execution
 */
function main() {
  console.log(
    `${colors.blue}🔍 Checking import conventions...${colors.reset}\n`
  );

  const srcDir = path.join(__dirname, '../src');
  const files = findTypeScriptFiles(srcDir);

  for (const file of files) {
    checkFile(file);
  }

  const passed = printViolations();

  process.exit(passed ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { checkFile, isRoutePage, isBarrelImport };
