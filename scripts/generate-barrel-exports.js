#!/usr/bin/env node

/**
 * Generate Barrel Exports Script
 *
 * Automatically creates index.ts barrel export files for all subdirectories
 * in the modules folder (services, hooks, components, types, utils).
 */

const fs = require('fs');
const path = require('path');

// Directories to create barrel exports for
const BARREL_DIRS = ['services', 'hooks', 'components', 'types', 'utils'];

/**
 * Get all TypeScript files in a directory (excluding index.ts and test files)
 */
function getTsFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => {
      return file.endsWith('.ts') || file.endsWith('.tsx');
    })
    .filter((file) => {
      return (
        file !== 'index.ts' &&
        !file.endsWith('.test.ts') &&
        !file.endsWith('.test.tsx') &&
        !file.endsWith('.spec.ts')
      );
    });
}

/**
 * Generate barrel export content
 */
function generateBarrelContent(files, dirName) {
  const header = `/**
 * ${dirName.charAt(0).toUpperCase() + dirName.slice(1)} Barrel Export
 */

`;

  const exports = files
    .map((file) => {
      const baseName = file.replace(/\.(ts|tsx)$/, '');
      return `export * from './${baseName}';`;
    })
    .join('\n');

  return header + exports + '\n';
}

/**
 * Create barrel export for a directory
 */
function createBarrelExport(dir) {
  const files = getTsFiles(dir);

  if (files.length === 0) {
    console.log(`⏭️  Skipping ${dir} (no files)`);
    return false;
  }

  const dirName = path.basename(dir);
  const content = generateBarrelContent(files, dirName);
  const indexPath = path.join(dir, 'index.ts');

  // Check if index.ts already exists
  if (fs.existsSync(indexPath)) {
    console.log(`✓  ${dir}/index.ts already exists`);
    return false;
  }

  fs.writeFileSync(indexPath, content);
  console.log(`✅ Created ${dir}/index.ts (${files.length} exports)`);
  return true;
}

/**
 * Recursively find and process all barrel directories
 */
function processDirectory(dir) {
  let created = 0;

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return created;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    // If this is a barrel directory, create barrel export
    if (BARREL_DIRS.includes(entry.name)) {
      if (createBarrelExport(fullPath)) {
        created++;
      }
    }

    // Recursively process subdirectories
    created += processDirectory(fullPath);
  }

  return created;
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Generating Barrel Exports...\n');

  const rootDir = path.join(__dirname, '../src/modules');
  const created = processDirectory(rootDir);

  console.log(`\n✨ Done! Created ${created} new barrel exports.`);
}

main();
