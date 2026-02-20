#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();

const WARN_FILE_LINE_THRESHOLD = 500;
const PLAN_FILE_LINE_THRESHOLD = 800;
const BLOCK_FILE_LINE_THRESHOLD = 1000;

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const RISK_MARKERS = [
  {
    label: 'as unknown as',
    regex: /\bas\s+unknown\s+as\b/,
  },
  {
    label: 'TODO/FIXME',
    regex: /\b(TODO|FIXME)\b/,
  },
  {
    label: 'eslint-disable @typescript-eslint/no-explicit-any',
    regex: /eslint-disable\s+@typescript-eslint\/no-explicit-any/,
  },
];

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function safeRun(command) {
  try {
    return run(command);
  } catch {
    return '';
  }
}

function getBaseRef() {
  if (process.env.GUARDRAILS_BASE && process.env.GUARDRAILS_BASE.trim()) {
    return process.env.GUARDRAILS_BASE.trim();
  }

  if (process.env.GITHUB_BASE_REF && process.env.GITHUB_BASE_REF.trim()) {
    const remoteBase = `origin/${process.env.GITHUB_BASE_REF.trim()}`;
    safeRun(
      `git fetch origin ${process.env.GITHUB_BASE_REF.trim()} --depth=200`
    );
    const mergeBase = safeRun(`git merge-base HEAD ${remoteBase}`);
    if (mergeBase) {
      return mergeBase;
    }
  }

  const previous = safeRun('git rev-parse HEAD~1');
  if (previous) {
    return previous;
  }

  return 'HEAD';
}

function getChangedFiles(baseRef) {
  if (baseRef === 'HEAD') {
    return [];
  }

  const output = safeRun(
    `git diff --name-status --diff-filter=ACMRTUXB ${baseRef}...HEAD`
  );
  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const status = parts[0] || 'M';
      const filePath = parts[parts.length - 1];
      return { status, filePath };
    })
    .filter(({ filePath }) => fs.existsSync(path.join(ROOT, filePath)));
}

function isCodeFile(filePath) {
  return CODE_EXTENSIONS.has(path.extname(filePath));
}

function getAddedLines(baseRef, filePath) {
  const diff = safeRun(
    `git diff --unified=0 --no-color ${baseRef}...HEAD -- "${filePath}"`
  );
  if (!diff) {
    return [];
  }

  return diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

function countLines(filePath) {
  const content = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
  if (!content) {
    return 0;
  }
  return content.split('\n').length;
}

function getBaseFileLineCount(baseRef, filePath) {
  if (baseRef === 'HEAD') {
    return 0;
  }

  const content = safeRun(`git show ${baseRef}:"${filePath}"`);
  if (!content) {
    return 0;
  }

  return content.split('\n').length;
}

function shouldEnforceSize({ status, filePath, baseRef, currentLineCount }) {
  if (status === 'A') {
    return true;
  }

  const oldLineCount = getBaseFileLineCount(baseRef, filePath);
  const crossedWarning =
    oldLineCount < WARN_FILE_LINE_THRESHOLD &&
    currentLineCount >= WARN_FILE_LINE_THRESHOLD;
  const crossedPlan =
    oldLineCount < PLAN_FILE_LINE_THRESHOLD &&
    currentLineCount >= PLAN_FILE_LINE_THRESHOLD;
  const crossedBlock =
    oldLineCount < BLOCK_FILE_LINE_THRESHOLD &&
    currentLineCount >= BLOCK_FILE_LINE_THRESHOLD;

  return crossedWarning || crossedPlan || crossedBlock;
}

function main() {
  const baseRef = getBaseRef();
  const changedFiles = getChangedFiles(baseRef);

  const errors = [];
  const warnings = [];

  if (!changedFiles.length) {
    console.log('✅ Guardrails: no changed files detected.');
    process.exit(0);
  }

  changedFiles.forEach(({ status, filePath }) => {
    const normalized = filePath.replace(/\\/g, '/');

    if (/^tmp-.*\.ts$/i.test(path.basename(normalized))) {
      errors.push(
        `${normalized}: new root-level tmp script is not allowed; use scripts/tmp/ instead.`
      );
    }

    const lineCount = countLines(normalized);
    const enforceSize = shouldEnforceSize({
      status,
      filePath: normalized,
      baseRef,
      currentLineCount: lineCount,
    });

    if (enforceSize) {
      if (
        lineCount >= PLAN_FILE_LINE_THRESHOLD &&
        process.env.GUARDRAILS_ALLOW_LARGE_FILES !== '1'
      ) {
        errors.push(
          `${normalized}: ${lineCount} lines (>=${PLAN_FILE_LINE_THRESHOLD}) requires decomposition plan/follow-up; split before merge or set GUARDRAILS_ALLOW_LARGE_FILES=1 with documented exception.`
        );
      } else if (lineCount >= WARN_FILE_LINE_THRESHOLD) {
        warnings.push(
          `${normalized}: ${lineCount} lines (>=${WARN_FILE_LINE_THRESHOLD}) warning threshold reached.`
        );
      }

      if (lineCount >= BLOCK_FILE_LINE_THRESHOLD) {
        errors.push(
          `${normalized}: ${lineCount} lines (>=${BLOCK_FILE_LINE_THRESHOLD}) hard-stop threshold exceeded.`
        );
      }
    }

    if (!isCodeFile(normalized)) {
      return;
    }

    const addedLines = getAddedLines(baseRef, normalized);
    if (!addedLines.length) {
      return;
    }

    addedLines.forEach((line, index) => {
      RISK_MARKERS.forEach((marker) => {
        if (marker.regex.test(line)) {
          errors.push(
            `${normalized}: added line ${index + 1} contains blocked risk marker (${marker.label}).`
          );
        }
      });
    });
  });

  if (warnings.length) {
    console.log('⚠️ Guardrails warnings:');
    warnings.forEach((warning) => console.log(`  - ${warning}`));
  }

  if (errors.length) {
    console.error('❌ Guardrails violations found:');
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log('✅ Guardrails check passed.');
}

main();
