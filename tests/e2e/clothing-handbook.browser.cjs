const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('vite');
const { chromium, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '../..');
const fixturePath = '/handbook.fixture.tsx';

async function assertFits(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1
    ),
    true,
    'The handbook must not overflow the viewport'
  );
  const clipped = await page.locator('button:visible').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const label = button.querySelector('.mantine-Button-label');
        return label && label.scrollWidth > label.clientWidth + 1;
      })
      .map((button) => button.textContent)
  );
  assert.deepEqual(clipped, [], 'Button labels must fit');
  const heading = page
    .getByRole('region', { name: 'Selected procedure' })
    .getByRole('heading')
    .first();
  const bounds = await heading.boundingBox();
  assert(
    bounds &&
      bounds.x >= 0 &&
      bounds.x + bounds.width <= page.viewportSize().width + 1
  );
}

async function main() {
  const artifacts = await fs.mkdtemp(
    path.join(os.tmpdir(), 'bms-handbook-browser-')
  );
  let procedures;
  const checks = [];
  const server = await createServer({
    root,
    configFile: false,
    envDir: __dirname,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
    resolve: { alias: { '@': path.join(root, 'src') } },
    esbuild: { jsx: 'automatic' },
    plugins: [
      {
        name: 'isolated-handbook-fixture',
        resolveId(id) {
          return id === fixturePath ? '\0handbook-fixture' : null;
        },
        load(id) {
          if (id !== '\0handbook-fixture') return null;
          return `
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { MantineProvider } from '@mantine/core';
          import '@mantine/core/styles.css';
          import { HandbookPage } from '/src/modules/clothing/operations/handbook/HandbookPage.tsx';
          createRoot(document.getElementById('root')).render(
            React.createElement(MantineProvider, null,
              React.createElement(HandbookPage, { procedures: ${JSON.stringify(procedures)} })
            )
          );
        `;
        },
        configureServer(vite) {
          vite.middlewares.use(async (request, response, next) => {
            if (request.url !== '/clothing/operations/handbook') {
              next();
              return;
            }
            response.setHeader('Content-Type', 'text/html');
            response.end(
              await vite.transformIndexHtml(
                '/',
                `
            <!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body><div id="root"></div><script type="module" src="${fixturePath}"></script></body></html>
          `
              )
            );
          });
        },
      },
    ],
  });
  let browser;
  try {
    const { loadHandbook } = await server.ssrLoadModule(
      '/src/modules/clothing/operations/handbook/loadHandbook.server.ts'
    );
    procedures = await loadHandbook();
    assert.equal(procedures.length, 74);
    await server.listen();
    const url = `http://127.0.0.1:${server.httpServer.address().port}/clothing/operations/handbook`;
    browser = await chromium.launch({ headless: true });
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 1000 },
      { name: 'tablet', width: 1024, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
      { name: 'narrow-mobile', width: 320, height: 740 },
    ]) {
      const context = await browser.newContext({
        viewport,
        permissions: ['clipboard-read', 'clipboard-write'],
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/**', async (route) => {
        if (new URL(route.request().url()).pathname.startsWith('/api/')) {
          errors.push('The handbook must not request business data');
          await route.abort();
        } else {
          await route.continue();
        }
      });
      await page.goto(url);
      const article = page.getByRole('region', { name: 'Selected procedure' });
      await expect(
        article.getByRole('heading', { name: 'Before You Start' })
      ).toBeVisible();

      await page
        .getByRole('textbox', { name: 'Search handbook' })
        .fill('lender breakdown');
      await expect(
        article.getByRole('heading', {
          name: 'Request A Supported Manual Entry Without Duplicating A Workflow',
        })
      ).toBeVisible();
      await page
        .getByRole('textbox', { name: 'Search handbook' })
        .fill('no-such-procedure-987654');
      await expect(
        article.getByRole('heading', { name: 'No matching procedures' })
      ).toBeVisible();
      await page.getByRole('button', { name: 'Clear filters' }).click();

      if (viewport.width < 768) {
        await page
          .getByRole('button', { name: 'Browse modules & issues' })
          .click();
      }
      if (viewport.width >= 1200) {
        await page
          .getByRole('navigation', { name: 'Handbook modules' })
          .getByRole('button', { name: /^Ledger/ })
          .click();
      } else {
        await page.getByRole('textbox', { name: 'Handbook module' }).click();
        await page.getByRole('option', { name: 'Ledger', exact: true }).click();
      }
      await page
        .getByRole('link', {
          name: /Read Brought Forward, Period Movement And Closing Balance/,
        })
        .click();
      await expect(
        article.getByRole('heading', {
          name: 'Read Brought Forward, Period Movement And Closing Balance',
        })
      ).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      assert.equal(new URL(page.url()).hash, '#A04');
      await assertFits(page);
      await page.screenshot({
        path: path.join(artifacts, `${viewport.name}-ledger.png`),
        fullPage: true,
      });

      await page.getByRole('button', { name: 'Copy procedure link' }).click();
      await expect(article.getByRole('status')).toHaveText('Link copied');
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        `${url}#A04`
      );

      await page.goto(`${url}#F03`);
      const related = article.getByRole('link', { name: 'E13', exact: true });
      await related.focus();
      await page.keyboard.press('Enter');
      const cancellationHeading = article.getByRole('heading', {
        name: 'E13: A Customer Cancels With Money Already Collected',
      });
      await expect(cancellationHeading).toBeVisible();
      await expect(cancellationHeading).toBeFocused();
      await page.goBack();
      await expect(
        article.getByRole('heading', {
          name: 'Can I Keep Only 10% When The Original Required Deposit Was 20%?',
        })
      ).toBeVisible();

      await page.goto(`${url}#TERMS`);
      await expect(article.getByRole('table')).toBeVisible();
      await assertFits(page);
      await page.screenshot({
        path: path.join(artifacts, `${viewport.name}-terms.png`),
        fullPage: true,
      });
      assert.deepEqual(
        errors,
        [],
        'No browser errors or business-data requests'
      );
      checks.push(
        `${viewport.name}: search, module selection, mobile browsing, deep links, keyboard, history, clipboard and overflow`
      );
      await context.close();
    }
    console.log(JSON.stringify({ passed: true, checks, artifacts }, null, 2));
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
