#!/usr/bin/env node
/**
 * Script to replace hardcoded localhost URLs with environment-based URLs
 * Part of Task 14: Hardcoded localhost URLs cleanup
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Files to process
const patterns = [
  'tests/**/*.test.ts',
  'tests/**/*.spec.ts',
  'src/**/*.ts',
  'src/**/*.tsx',
];

// Exclude patterns
const excludePatterns = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
];

async function main() {
  console.log('🔍 Finding files with hardcoded localhost URLs...\n');

  let totalFiles = 0;
  let totalReplacements = 0;

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: excludePatterns,
      absolute: true,
    });

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      let newContent = content;
      let fileReplacements = 0;

      // Check if file has hardcoded localhost URLs
      if (
        content.includes('localhost:3000') ||
        content.includes('http://localhost')
      ) {
        // Skip if file already imports getTestApiUrl or TEST_BASE_URL
        const alreadyFixed =
          content.includes('getTestApiUrl') ||
          content.includes('TEST_BASE_URL') ||
          content.includes('getBaseUrl');

        if (!alreadyFixed) {
          // For test files
          if (filePath.includes('/tests/')) {
            // Add import if not present
            if (!content.includes('@/core/testing/test-helpers')) {
              // Find the last import statement
              const importMatches = [
                ...content.matchAll(/^import .* from .*;$/gm),
              ];
              if (importMatches.length > 0) {
                const lastImport = importMatches[importMatches.length - 1];
                const insertPos = lastImport.index + lastImport[0].length;
                newContent =
                  newContent.slice(0, insertPos) +
                  "\nimport { getTestApiUrl } from '@/core/testing/test-helpers';" +
                  newContent.slice(insertPos);
              }
            }

            // Replace hardcoded URLs with getTestApiUrl calls
            // Pattern: 'http://localhost:3000/api/something'
            newContent = newContent.replace(
              /'http:\/\/localhost:3000(\/api\/[^'?]*)(\\?[^']*)?'/g,
              (match, path, query) => {
                fileReplacements++;
                if (query) {
                  // Parse query string into params object
                  const params = query
                    .slice(1)
                    .split('&')
                    .map((p) => {
                      const [key, value] = p.split('=');
                      return `${key}: '${value}'`;
                    })
                    .join(', ');
                  return `getTestApiUrl('${path}', { ${params} })`;
                }
                return `getTestApiUrl('${path}')`;
              }
            );

            // Pattern: "http://localhost:3000/api/something"
            newContent = newContent.replace(
              /"http:\/\/localhost:3000(\/api\/[^"?]*)(\\?[^"]*)?"/g,
              (match, path, query) => {
                fileReplacements++;
                if (query) {
                  const params = query
                    .slice(1)
                    .split('&')
                    .map((p) => {
                      const [key, value] = p.split('=');
                      return `${key}: '${value}'`;
                    })
                    .join(', ');
                  return `getTestApiUrl('${path}', { ${params} })`;
                }
                return `getTestApiUrl('${path}')`;
              }
            );
          }
          // For source files (non-test)
          else {
            // Add import if not present
            if (!content.includes('@/lib/env')) {
              const importMatches = [
                ...content.matchAll(/^import .* from .*;$/gm),
              ];
              if (importMatches.length > 0) {
                const lastImport = importMatches[importMatches.length - 1];
                const insertPos = lastImport.index + lastImport[0].length;
                newContent =
                  newContent.slice(0, insertPos) +
                  "\nimport { getBaseUrl } from '@/lib/env';" +
                  newContent.slice(insertPos);
              }
            }

            // Replace simple fetch calls
            newContent = newContent.replace(
              /fetch\(['"]http:\/\/localhost:3000(\/[^'"]*)['"]\)/g,
              (match, path) => {
                fileReplacements++;
                return `fetch(\`\${getBaseUrl()}${path}\`)`;
              }
            );

            // Replace template literals
            newContent = newContent.replace(
              /`http:\/\/localhost:3000(\/[^`]*)`/g,
              (match, path) => {
                fileReplacements++;
                return `\`\${getBaseUrl()}${path}\``;
              }
            );
          }

          if (fileReplacements > 0) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(
              `✅ ${path.relative(process.cwd(), filePath)}: ${fileReplacements} replacements`
            );
            totalFiles++;
            totalReplacements += fileReplacements;
          }
        }
      }
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(
    `📊 Updated ${totalFiles} files with ${totalReplacements} replacements`
  );
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
