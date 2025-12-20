/* eslint-disable no-console */

const fs = require('fs');
const { spawnSync } = require('child_process');

process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || '0';

function fileExists(filePath) {
  try {
    return Boolean(filePath) && fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function getChromiumExecutablePath() {
  // Import after env var is set
  // eslint-disable-next-line global-require
  const { chromium } = require('playwright');
  return chromium.executablePath();
}

function runInstall() {
  console.log('[ensure-playwright-browsers] Installing Playwright Chromium...');
  const result = spawnSync('npx', ['playwright', 'install', 'chromium'], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(
      `[ensure-playwright-browsers] playwright install failed (exit ${result.status})`
    );
  }
}

try {
  const chromiumPath = getChromiumExecutablePath();
  if (fileExists(chromiumPath)) {
    console.log('[ensure-playwright-browsers] Chromium OK:', chromiumPath);
    process.exit(0);
  }

  console.warn(
    '[ensure-playwright-browsers] Chromium missing at expected path:',
    chromiumPath
  );

  runInstall();

  const chromiumPathAfter = getChromiumExecutablePath();
  if (!fileExists(chromiumPathAfter)) {
    throw new Error(
      `[ensure-playwright-browsers] Chromium still missing after install: ${chromiumPathAfter}`
    );
  }

  console.log(
    '[ensure-playwright-browsers] Chromium installed:',
    chromiumPathAfter
  );
  process.exit(0);
} catch (error) {
  console.error('[ensure-playwright-browsers] Failed:', error);
  process.exit(1);
}
