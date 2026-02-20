#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'docs', 'reports');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function readLatestAuditData() {
  if (!fs.existsSync(REPORTS_DIR)) {
    return null;
  }

  const candidates = fs
    .readdirSync(REPORTS_DIR)
    .filter((name) =>
      /^REFACTOR_AUDIT_DATA_\d{4}-\d{2}-\d{2}\.json$/.test(name)
    )
    .sort();

  if (!candidates.length) {
    return null;
  }

  const fileName = candidates[candidates.length - 1];
  const filePath = path.join(REPORTS_DIR, fileName);

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      fileName,
      data: JSON.parse(content),
    };
  } catch {
    return {
      fileName,
      data: null,
    };
  }
}

function walk(dirPath, files = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function countLines(text) {
  if (!text) {
    return 0;
  }
  return text.split(/\r?\n/).length;
}

function getLargestSourceFiles(limit = 30) {
  const srcRoot = path.join(ROOT, 'src');
  if (!fs.existsSync(srcRoot)) {
    return [];
  }

  const files = walk(srcRoot);
  const ranked = files
    .map((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      return {
        file: path.relative(ROOT, filePath).replaceAll('\\\\', '/'),
        lines: countLines(content),
      };
    })
    .sort((a, b) => b.lines - a.lines);

  return ranked.slice(0, limit);
}

function buildMarkdown() {
  const now = new Date();
  const timestamp = now.toISOString();
  const latestAudit = readLatestAuditData();
  const largestNow = getLargestSourceFiles(30);

  const output = [];
  output.push('# Weekly Refactor Snapshot');
  output.push('');
  output.push(`Generated: ${timestamp}`);
  output.push('');

  if (!latestAudit) {
    output.push('## Latest Audit Data');
    output.push('');
    output.push(
      '- No `REFACTOR_AUDIT_DATA_*.json` file found in `docs/reports`.'
    );
  } else {
    output.push('## Latest Audit Data');
    output.push('');
    output.push(`- Source file: \`${latestAudit.fileName}\``);

    const distribution = latestAudit.data?.large?.distribution;
    if (distribution) {
      output.push('- Large-file distribution:');
      output.push(`  - >=500: ${distribution['500'] ?? 'N/A'}`);
      output.push(`  - >=800: ${distribution['800'] ?? 'N/A'}`);
      output.push(`  - >=1000: ${distribution['1000'] ?? 'N/A'}`);
      output.push(`  - >=1200: ${distribution['1200'] ?? 'N/A'}`);
      output.push(`  - >=1500: ${distribution['1500'] ?? 'N/A'}`);
    } else {
      output.push('- Could not parse large-file distribution from audit JSON.');
    }
  }

  output.push('');
  output.push('## Current Largest Source Files (Top 30)');
  output.push('');

  if (!largestNow.length) {
    output.push('- No source files found under `src`.');
  } else {
    for (const item of largestNow) {
      output.push(`- ${item.file}: ${item.lines}`);
    }
  }

  output.push('');
  output.push('## Notes');
  output.push('');
  output.push(
    '- This snapshot is generated weekly by CI and uploaded as an artifact.'
  );
  output.push(
    '- Use this report to track large-file drift between refactor cycles.'
  );

  return output.join('\n');
}

process.stdout.write(buildMarkdown());
