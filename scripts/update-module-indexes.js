#!/usr/bin/env node

/**
 * Update Module Index Files
 *
 * Updates all module index.ts files to use barrel exports from subdirectories
 */

const fs = require('fs');
const path = require('path');

const MODULES_TO_UPDATE = [
  'src/modules/clothing/operations/due-dates',
  'src/modules/clothing/operations/prices',
  'src/modules/clothing/operations/shipments',
  'src/modules/clothing/operations/sorting-distribution',
  'src/modules/clothing/operations/transactions',
];

const TEMPLATE = `/**
 * {MODULE_NAME} Module Public API
 *
 * Central export point for {MODULE_NAME} module
 */

// =============================================================================
// MODULE CONFIGURATION
// =============================================================================

export { {moduleName}Module } from './module.config';

// =============================================================================
// TYPES
// =============================================================================

export * from './types';

// =============================================================================
// SERVICES
// =============================================================================

export * from './services';

// =============================================================================
// HOOKS
// =============================================================================

export * from './hooks';

// =============================================================================
// COMPONENTS
// =============================================================================

export * from './components';
`;

function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function toTitleCase(str) {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function updateModuleIndex(modulePath) {
  const moduleName = path.basename(modulePath);
  const indexPath = path.join(modulePath, 'index.ts');

  if (!fs.existsSync(indexPath)) {
    console.log(`⏭️  Skipping ${moduleName} (no index.ts)`);
    return false;
  }

  const content = TEMPLATE.replace(
    /{MODULE_NAME}/g,
    toTitleCase(moduleName)
  ).replace(/{moduleName}/g, toCamelCase(moduleName));

  fs.writeFileSync(indexPath, content);
  console.log(`✅ Updated ${moduleName}/index.ts`);
  return true;
}

function main() {
  console.log('🚀 Updating Module Index Files...\n');

  let updated = 0;
  for (const modulePath of MODULES_TO_UPDATE) {
    if (updateModuleIndex(modulePath)) {
      updated++;
    }
  }

  console.log(`\n✨ Done! Updated ${updated} module index files.`);
}

main();
