#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const summaryPath = path.join(
  ROOT,
  'docs',
  'reports',
  'REFACTOR_EXEC_SUMMARY_2026-02-14.md'
);
const reportsDir = path.join(ROOT, 'docs', 'reports');
const outputPath = path.join(
  ROOT,
  'docs',
  'reports',
  'REFACTOR_CHANGELOG_STREAM.md'
);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listReportFiles() {
  if (!fs.existsSync(reportsDir)) {
    return [];
  }

  return fs
    .readdirSync(reportsDir)
    .filter((name) => name.endsWith('.md') || name.endsWith('.json'))
    .sort();
}

function extractBacklogAddenda(summaryText) {
  const lines = summaryText.split(/\r?\n/);
  const sections = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('## Addendum — Backlog Execution Update')) {
      continue;
    }

    const title = line.replace(/^##\s+/, '').trim();
    const bullets = [];
    let cursor = i + 1;

    while (cursor < lines.length) {
      const currentLine = lines[cursor];
      if (currentLine.startsWith('## ')) {
        break;
      }

      if (
        currentLine.startsWith('- ') &&
        !currentLine.includes('Next active item is')
      ) {
        bullets.push(currentLine.replace(/^-\s+/, '').trim());
      }

      cursor += 1;
    }

    sections.push({ title, bullets: bullets.slice(0, 5) });
    i = cursor - 1;
  }

  return sections;
}

function buildOutput(summaryText) {
  const generatedAt = new Date().toISOString();
  const addenda = extractBacklogAddenda(summaryText);
  const reportFiles = listReportFiles();

  const out = [];
  out.push('# Refactor Changelog Stream');
  out.push('');
  out.push(`Generated: ${generatedAt}`);
  out.push('');
  out.push(
    'This compact stream summarizes backlog execution addenda and active report artifacts.'
  );
  out.push('');
  out.push('## Backlog Execution Stream');
  out.push('');

  if (!addenda.length) {
    out.push(
      '- No backlog execution addenda found in the refactor execution summary.'
    );
  } else {
    for (const section of addenda) {
      out.push(`### ${section.title}`);
      if (!section.bullets.length) {
        out.push('- No concise bullet items found for this addendum.');
      } else {
        for (const bullet of section.bullets) {
          out.push(`- ${bullet}`);
        }
      }
      out.push('');
    }
  }

  out.push('## Active Report Artifacts');
  out.push('');
  if (!reportFiles.length) {
    out.push('- No files found in `docs/reports`.');
  } else {
    for (const fileName of reportFiles) {
      out.push(`- docs/reports/${fileName}`);
    }
  }
  out.push('');
  out.push('## Source of Truth');
  out.push('');
  out.push('- docs/reports/REFACTOR_EXEC_SUMMARY_2026-02-14.md');

  return out.join('\n');
}

function main() {
  if (!fs.existsSync(summaryPath)) {
    console.error(`Missing summary file: ${summaryPath}`);
    process.exit(1);
  }

  const summaryText = readText(summaryPath);
  const output = buildOutput(summaryText);
  fs.writeFileSync(outputPath, output);
  console.log(`Generated ${path.relative(ROOT, outputPath)}`);
}

main();
