#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SUMMARY_PATH = path.join(
  ROOT,
  'docs',
  'REFACTOR_EXEC_SUMMARY_2026-02-14.md'
);
const TARGET_PATH = path.join(
  ROOT,
  'src',
  'modules',
  'general-merchandise',
  'employees'
);
const CHECKLIST_HEADING = '## Addendum — Live TODO Checklist (Feb 21, 2026)';

function toReadableDate(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function updateChecklistBlock(content, pathExists) {
  const headingIndex = content.indexOf(CHECKLIST_HEADING);
  if (headingIndex < 0) {
    throw new Error(`Checklist heading not found: ${CHECKLIST_HEADING}`);
  }

  const nextSectionIndex = content.indexOf('\n---\n', headingIndex);
  const blockEndIndex =
    nextSectionIndex >= 0 ? nextSectionIndex : content.length;

  const before = content.slice(0, headingIndex);
  const block = content.slice(headingIndex, blockEndIndex);
  const after = content.slice(blockEndIndex);

  const completedDate = toReadableDate();
  const nextActiveLine = pathExists
    ? 'Current active item: **None** — LIV queue complete.'
    : 'Current active item: **LIV-1**';
  const liv1Line = pathExists
    ? `- [x] **LIV-1:** Track \`src/modules/general-merchandise/employees/**\` introduction and switch status from N/A to covered when path is created (completed ${completedDate}).`
    : '- [ ] **LIV-1:** Track `src/modules/general-merchandise/employees/**` introduction and switch status from N/A to covered when path is created.';

  let updatedBlock = block;

  updatedBlock = updatedBlock.replace(
    /^Current active item:.*$/m,
    nextActiveLine
  );

  updatedBlock = updatedBlock.replace(
    /^- \[[ x]\] \*\*LIV-1:\*\* .*$/m,
    liv1Line
  );

  return before + updatedBlock + after;
}

function main() {
  if (!fs.existsSync(SUMMARY_PATH)) {
    console.error(`Missing summary file: ${path.relative(ROOT, SUMMARY_PATH)}`);
    process.exit(1);
  }

  const pathExists =
    fs.existsSync(TARGET_PATH) && fs.statSync(TARGET_PATH).isDirectory();
  const original = fs.readFileSync(SUMMARY_PATH, 'utf8');
  const updated = updateChecklistBlock(original, pathExists);

  if (updated !== original) {
    fs.writeFileSync(SUMMARY_PATH, updated, 'utf8');
    console.log(
      `Updated LIV-1 status in ${path.relative(ROOT, SUMMARY_PATH)} (${pathExists ? 'completed' : 'pending'})`
    );
    return;
  }

  console.log(
    `LIV-1 status already up to date in ${path.relative(ROOT, SUMMARY_PATH)} (${pathExists ? 'completed' : 'pending'})`
  );
}

main();
