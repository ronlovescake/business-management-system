#!/usr/bin/env node

/**
 * Script to replace hardcoded localhost URLs with getTestApiUrl() helper
 * This will update all test files to use the centralized URL helper
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Find all test files
async function findTestFiles() {
  const patterns = ['tests/**/*.test.ts', 'tests/**/*.spec.ts'];

  const files = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd: process.cwd() });
    files.push(...matches.map((f) => path.join(process.cwd(), f)));
  }

  return [...new Set(files)]; // Remove duplicates
}

function replaceUrlsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let modified = false;

  // Check if already has the import
  const hasImport =
    content.includes("from '@/core/testing/test-helpers'") &&
    content.includes('getTestApiUrl');

  // Pattern 1: URLs with query strings (single quotes)
  // 'http://localhost:3000/api/path?param=value'
  const queryUrlPattern = /'http:\/\/localhost:3000(\/api\/[^'?]+)\?([^']+)'/g;
  content = content.replace(queryUrlPattern, (match, path, query) => {
    modified = true;
    // Parse query string into object
    const params = {};
    query.split('&').forEach((pair) => {
      const [key, value] = pair.split('=');
      params[key] = value;
    });
    const paramsStr = JSON.stringify(params);
    return `getTestApiUrl('${path}', ${paramsStr})`;
  });

  // Pattern 2: URLs with query strings (double quotes)
  const doubleQueryPattern =
    /"http:\/\/localhost:3000(\/api\/[^"?]+)\?([^"]+)"/g;
  content = content.replace(doubleQueryPattern, (match, path, query) => {
    modified = true;
    const params = {};
    query.split('&').forEach((pair) => {
      const [key, value] = pair.split('=');
      params[key] = value;
    });
    const paramsStr = JSON.stringify(params);
    return `getTestApiUrl('${path}', ${paramsStr})`;
  });

  // Pattern 3: Simple URLs without query strings (single quotes)
  // 'http://localhost:3000/api/path'
  const simpleUrlPattern = /'http:\/\/localhost:3000(\/api\/[^'?]+)'/g;
  content = content.replace(simpleUrlPattern, (match, path) => {
    modified = true;
    return `getTestApiUrl('${path}')`;
  });

  // Pattern 4: Simple URLs without query strings (double quotes)
  // "http://localhost:3000/api/path"
  const doubleQuotePattern = /"http:\/\/localhost:3000(\/api\/[^"?]+)"/g;
  content = content.replace(doubleQuotePattern, (match, path) => {
    modified = true;
    return `getTestApiUrl('${path}')`;
  });

  // Add import if we made changes and don't have it
  if (modified && !hasImport) {
    // Find where to insert import (after other imports)
    const importRegex = /^import .+ from .+;$/gm;
    let lastImportIndex = 0;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      lastImportIndex = match.index + match[0].length;
    }

    if (lastImportIndex > 0) {
      content =
        content.slice(0, lastImportIndex) +
        "\nimport { getTestApiUrl } from '@/core/testing/test-helpers';" +
        content.slice(lastImportIndex);
    } else {
      // No imports found, add at the beginning
      content =
        "import { getTestApiUrl } from '@/core/testing/test-helpers';\n\n" +
        content;
    }
  }

  // Write back if modified
  if (modified || content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

async function main() {
  console.log('🔍 Finding test files...');
  const testFiles = await findTestFiles();
  console.log(`📁 Found ${testFiles.length} test files\n`);

  let modifiedCount = 0;
  let errorCount = 0;

  for (const file of testFiles) {
    try {
      const relativePath = path.relative(process.cwd(), file);
      const wasModified = replaceUrlsInFile(file);

      if (wasModified) {
        console.log(`✅ ${relativePath}`);
        modifiedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Modified: ${modifiedCount} files`);
  console.log(`   Errors: ${errorCount} files`);
  console.log(`   Total processed: ${testFiles.length} files`);
}

main().catch(console.error);
