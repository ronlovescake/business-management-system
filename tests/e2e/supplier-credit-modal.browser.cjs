const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createServer } = require('vite');
const { chromium, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '../..');
const artifacts = '/tmp/bms-supplier-browser-artifacts';
const fixturePath = '/tests/e2e/supplier-credit-modal.fixture.tsx';
const checks = [];
const credits = [
  {
    id: 'credit-fixture',
    supplierReference: 'supplier a',
    reference: 'CREDIT-42',
    currency: 'PHP',
    amount: 19511.37,
    availableAmount: 19511.37,
    sourceProduct: {
      id: 9001,
      productCode: 'PREVIOUS-ORDER',
      product: 'Previous missing order',
    },
    applications: [],
  },
];

async function assertFits(page, section) {
  const overflow = await section.evaluate((element) => {
    const sectionRect = element.getBoundingClientRect();
    return Array.from(
      element.querySelectorAll('input, button, label, [role="alert"]')
    )
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return (
          rect.width > 0 &&
          (rect.left < Math.max(sectionRect.left, 0) - 1 ||
            rect.right > Math.min(sectionRect.right, innerWidth) + 1)
        );
      })
      .map((node) => ({
        text: node.textContent,
        width: node.getBoundingClientRect().width,
      }));
  });
  assert.deepEqual(
    overflow,
    [],
    'Supplier controls must fit their section and viewport'
  );
  const clipped = await section.locator('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const label = button.querySelector('.mantine-Button-label');
        return label && label.scrollWidth > label.clientWidth + 1;
      })
      .map((button) => button.textContent)
  );
  assert.deepEqual(clipped, [], 'Supplier action labels must not be clipped');
}

async function main() {
  await fs.mkdir(artifacts, { recursive: true });
  const server = await createServer({
    root,
    configFile: false,
    envDir: __dirname,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
    resolve: { alias: { '@': path.join(root, 'src') } },
    esbuild: { jsx: 'automatic' },
    define: { 'process.env': '{}' },
    plugins: [
      {
        name: 'supplier-credit-isolated-browser-fixture',
        enforce: 'pre',
        resolveId(id) {
          return id === '@/lib/logger' ? '\0fixture-logger' : null;
        },
        load(id) {
          return id === '\0fixture-logger'
            ? 'export const logger = { debug() {}, info() {}, warn() {}, error() {} };'
            : null;
        },
        configureServer(vite) {
          vite.middlewares.use(async (request, response, next) => {
            if (!request.url.startsWith('/?') && request.url !== '/') {
              next();
              return;
            }
            response.setHeader('Content-Type', 'text/html');
            response.end(
              await vite.transformIndexHtml(
                '/',
                `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="${fixturePath}"></script></body></html>`
              )
            );
          });
        },
      },
    ],
  });
  let browser;
  try {
    await server.listen();
    const address = server.httpServer.address();
    const url = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 1100 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      const requests = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
        process.stderr.write(`Browser runtime error: ${error.message}\n`);
      });
      await page.route('**/api/**', async (route) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        if (!pathname.startsWith('/api/')) {
          await route.continue();
          return;
        }
        requests.push({
          pathname,
          method: request.method(),
          body: request.postDataJSON(),
        });
        if (pathname === '/api/settings/payment-cards') {
          await route.fulfill({ json: [] });
        } else if (pathname === '/api/products/supplier-credits') {
          const issued = page.url().includes('scenario=issued');
          await route.fulfill({
            json: {
              success: true,
              data: issued
                ? [
                    {
                      ...credits[0],
                      availableAmount: 18511.37,
                      sourceProduct: { ...credits[0].sourceProduct, id: 42 },
                      applications: [
                        {
                          id: 'application-fixture',
                          amount: 1000,
                          targetProduct: { productCode: 'REPLACEMENT-ORDER' },
                        },
                      ],
                    },
                  ]
                : credits,
            },
          });
        } else if (
          pathname === '/api/products/42/supplier-resolution' &&
          request.method() === 'POST'
        ) {
          await route.fulfill({
            json: { success: true, data: { id: 'resolution-fixture' } },
          });
        } else {
          await route.abort('blockedbyclient');
          errors.push(`Unexpected API request: ${pathname}`);
        }
      });
      const open = async (scenario) => {
        await page.goto(`${url}/?scenario=${scenario}`);
        await expect(page.getByRole('dialog')).toBeVisible();
        const section = page.getByRole('region', {
          name: 'Supplier funding and fulfillment',
        });
        if (scenario !== 'user') {
          await section.scrollIntoViewIfNeeded();
          await expect(section).toBeVisible();
        }
        return section;
      };

      let section = await open('edit');
      await page
        .getByRole('textbox', { name: 'Supplier resolution', exact: true })
        .click();
      await page
        .getByRole('option', { name: 'Record supplier credit', exact: true })
        .click();
      await expect(section).toContainText('19,511.37');
      await expect(
        page.getByRole('button', {
          name: 'Record Supplier Credit',
          exact: true,
        })
      ).toBeDisabled();
      await page
        .getByRole('textbox', {
          name: 'Supplier credit reference',
          exact: true,
        })
        .fill('CREDIT-42');
      await assertFits(page, section);
      await page.screenshot({
        path: path.join(artifacts, `${viewport.name}-credit-issue.png`),
        fullPage: true,
      });
      await page
        .getByRole('button', { name: 'Record Supplier Credit', exact: true })
        .click();
      await expect(page.locator('.swal2-popup')).toBeVisible();
      await page.locator('.swal2-confirm').click();
      await expect(page.locator('body')).toHaveAttribute(
        'data-supplier-resolved',
        'true'
      );
      const issuance = requests
        .filter((request) => request.body?.action === 'ISSUE_CREDIT')
        .at(-1);
      assert(
        issuance && !('amount' in issuance.body),
        'Issuance amount must be derived by the server'
      );
      checks.push(
        `${viewport.name}: confirmed issue without client-supplied amount`
      );

      section = await open('new');
      await page
        .getByRole('textbox', {
          name: 'Available supplier credit',
          exact: true,
        })
        .click();
      await page.getByRole('option', { name: /CREDIT-42/ }).click();
      await page
        .getByRole('textbox', { name: 'Credit to apply (PHP)', exact: true })
        .fill('1000');
      await expect(section).toContainText(/Remaining funding:\s*.*2,000\.00/);
      const form = JSON.parse(
        await page.getByTestId('supplier-form').textContent()
      );
      assert.equal(form.unitPrice, 30);
      assert.equal(form.quantity, 100);
      assert.equal(form.supplierCreditId, 'credit-fixture');
      assert.equal(form.supplierCreditAmount, 1000);
      await assertFits(page, section);
      await page.screenshot({
        path: path.join(artifacts, `${viewport.name}-credit-application.png`),
        fullPage: true,
      });
      checks.push(
        `${viewport.name}: partial application retains full gross purchase`
      );

      section = await open('edit');
      await page
        .getByRole('textbox', { name: 'Supplier resolution', exact: true })
        .click();
      await page
        .getByRole('option', { name: 'Transfer delayed product', exact: true })
        .click();
      await page
        .getByRole('textbox', {
          name: 'Destination shipment code',
          exact: true,
        })
        .fill('KPC 23930A-240');
      await page
        .getByRole('textbox', { name: 'Transfer reason', exact: true })
        .fill('Supplier confirmed later dispatch');
      await assertFits(page, section);
      await page
        .getByRole('button', { name: 'Transfer Product', exact: true })
        .click();
      await page.locator('.swal2-confirm').click();
      await expect(page.locator('body')).toHaveAttribute(
        'data-supplier-resolved',
        'true'
      );
      assert(
        requests.some(
          (request) =>
            request.body?.action === 'TRANSFER' &&
            request.body.shipmentCode === 'KPC 23930A-240'
        )
      );
      checks.push(`${viewport.name}: confirmed transfer to later shipment`);

      section = await open('issued');
      await expect(section).toContainText('18,511.37');
      await expect(section).toContainText('REPLACEMENT-ORDER');
      await expect(
        page.getByRole('textbox', { name: 'Supplier resolution', exact: true })
      ).toHaveCount(0);
      await assertFits(page, section);
      checks.push(`${viewport.name}: issued balance and usage remain visible`);

      const before = requests.filter(
        (request) => request.pathname === '/api/products/supplier-credits'
      ).length;
      await open('user');
      await expect(
        page.getByRole('region', { name: 'Supplier funding and fulfillment' })
      ).toHaveCount(0);
      assert.equal(
        requests.filter(
          (request) => request.pathname === '/api/products/supplier-credits'
        ).length,
        before
      );
      assert.deepEqual(errors, []);
      checks.push(
        `${viewport.name}: nonadministrator controls and credit requests hidden`
      );
      await context.close();
    }
    process.stdout.write(
      JSON.stringify(
        {
          success: true,
          checks,
          screenshots: artifacts,
          databaseAccess: false,
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    if (browser) {
      await browser.close();
    }
    await server.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
