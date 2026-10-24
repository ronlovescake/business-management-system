import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const baseURL = 'http://localhost:5002';
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(
  /\/$/,
  ''
);
const containers = execFileSync(
  'docker',
  ['ps', '--filter', 'publish=5002', '--format', '{{json .}}'],
  { encoding: 'utf8' }
)
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { ID: string });
assert.equal(
  containers.length,
  1,
  'Exactly one development container must publish port 5002'
);
const container = containers[0].ID;
const labels = JSON.parse(
  execFileSync(
    'docker',
    ['inspect', container, '--format', '{{json .Config.Labels}}'],
    { encoding: 'utf8' }
  )
) as Record<string, string>;
assert.equal(
  labels['com.docker.compose.project.working_dir'],
  root,
  'Refusing a container outside this development checkout'
);
assert.equal(labels['com.docker.compose.service'], 'app');

const id = `manual-invoice-browser-${randomUUID()}`;
const email = `${id}@example.invalid`;
const password = randomBytes(32).toString('base64url');
const name = 'Temporary Manual Invoice Browser Verification';
const accountOperation = `
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const db = new PrismaClient();
(async () => {
  if (!/^manual-invoice-browser-[a-f0-9-]{36}$/.test(input.id) || input.email !== input.id + '@example.invalid') throw new Error('Invalid fixture identity');
  if (input.action === 'create') {
    await db.user.create({ data: { id: input.id, email: input.email, name: input.name, password: await hash(input.password, 12), role: 'ADMIN', isActive: true } });
  } else if (input.action === 'remove') {
    const removed = await db.user.deleteMany({ where: { id: input.id, email: input.email, name: input.name } });
    if (removed.count !== 1) throw new Error('Fixture account was not removed exactly once');
  } else throw new Error('Unsupported action');
})().catch(() => { console.error('Temporary verification account operation failed'); process.exitCode = 1; }).finally(() => db.$disconnect());
`;
function account(action: 'create' | 'remove') {
  execFileSync(
    'docker',
    ['exec', '-i', container, 'node', '-e', accountOperation],
    {
      input: JSON.stringify({ action, id, email, password, name }),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
}

type BrowserState = { copied: string[]; opened: string[]; failCopy: boolean };
declare global {
  interface Window {
    __manualInvoiceVerification: BrowserState;
  }
}

async function main() {
  let created = false;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const requestedApis: string[] = [];
  const blockedWrites: string[] = [];
  const browserErrors: string[] = [];
  const customer = 'Synthetic Manual Invoice Customer';
  const noFacebook = 'Synthetic Customer Without Messenger';
  const checkout = 'https://checkout.example.invalid/1-5kg';
  const payment = 'https://payment.example.invalid/channels';
  const messenger = 'www.facebook.com/messages/t/synthetic-fixture-do-not-send';
  try {
    account('create');
    created = true;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: 'block',
    });
    const csrf = await context.request.get('/api/auth/csrf');
    assert.equal(csrf.status(), 200);
    const csrfPayload = (await csrf.json()) as { csrfToken: string };
    await context.request.post('/api/auth/callback/credentials', {
      form: {
        csrfToken: csrfPayload.csrfToken,
        email,
        password,
        callbackUrl: `${baseURL}/clothing/operations/checkout-links`,
        json: 'true',
      },
      maxRedirects: 0,
    });
    const session = (await (
      await context.request.get('/api/auth/session')
    ).json()) as { user?: { id: string } };
    assert.equal(
      session.user?.id,
      id,
      'The temporary development account must authenticate normally'
    );

    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== baseURL) {
        return route.abort();
      }
      if (!url.pathname.startsWith('/api/')) {
        return route.continue();
      }
      requestedApis.push(url.pathname);
      if (request.method() !== 'GET') {
        blockedWrites.push(`${request.method()} ${url.pathname}`);
        return route.fulfill({
          status: 403,
          json: {
            error: 'Browser verification never persists application data',
          },
        });
      }
      const fixtures: Record<string, unknown> = {
        '/api/auth/session': session,
        '/api/conversations': [],
        '/api/conversations/unread-count': { unreadCount: 0 },
        '/api/customers': [
          {
            id: 987001,
            'Customer Name': customer,
            'Business Name': '',
            Facebook: messenger,
          },
          {
            id: 987002,
            'Customer Name': noFacebook,
            'Business Name': '',
            Facebook: '',
          },
        ],
        '/api/transactions': [customer, noFacebook].map(
          (customerName, index) => ({
            id: 987001 + index,
            Customers: customerName,
            'Invoice Date': '2026-10-25',
            'Order Status': 'Prepared',
          })
        ),
        '/api/invoices/customer-orders': {
          success: true,
          orders: [customer, noFacebook].map((customerName, index) => ({
            id: `${987001 + index}`,
            customerName,
            actualWeight: '1.20',
            productCode: 'SYNTHETIC-ONLY',
            quantity: 1,
            orderStatus: 'Prepared',
            weightPerPiece: '1.20',
          })),
        },
        '/api/products': [],
        '/api/checkout-links': {
          success: true,
          data: [
            {
              id: '987001',
              weight: '1.5',
              width: '1',
              length: '1',
              height: '1',
              checkoutLinks: checkout,
              productPortals: '',
              productNames: '',
            },
          ],
        },
        '/api/invoice-settings': {
          success: true,
          data: {
            messageTemplate:
              'Hi {GREETING}\nInvoice: {DRIVE_FILES}\nCheckout: {SHOPEE_LINK}\nPayment: {PAYMENT_CHANNELS_URL}',
            paymentChannelsUrl: payment,
          },
        },
      };
      return route.fulfill({
        json: fixtures[url.pathname] ?? { success: true, data: [] },
      });
    });
    await context.addInitScript({
      content: `(() => {
      window.__manualInvoiceVerification = { copied: [], opened: [], failCopy: false };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async (text) => {
          if (window.__manualInvoiceVerification.failCopy) throw new Error('Synthetic clipboard rejection');
          window.__manualInvoiceVerification.copied.push(text);
        },
      } });
      document.execCommand = () => false;
      window.open = (url) => {
        window.__manualInvoiceVerification.opened.push(String(url));
        return { closed: false };
      };
    })();`,
    });
    const page = await context.newPage();
    page.on('pageerror', (error) =>
      browserErrors.push(error.message.split('\n')[0])
    );
    await page.goto('/clothing/operations/checkout-links', {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByRole('tab', { name: 'Invoicing', exact: true })
    ).toBeVisible({ timeout: 20000 });
    const row = page.getByRole('row').filter({ hasText: customer });
    await expect(row).toBeVisible();
    await expect(row.getByRole('link', { name: checkout })).toHaveAttribute(
      'href',
      checkout
    );
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: noFacebook })
        .getByTitle('Click to copy message and open Facebook Messenger')
    ).toHaveCount(0);
    await page.evaluate(() => {
      window.__manualInvoiceVerification.failCopy = true;
    });
    await row
      .getByTitle('Click to copy message and open Facebook Messenger')
      .click();
    await expect(
      page.getByText('Could not copy message to clipboard', { exact: true })
    ).toBeVisible();
    await expect(row.getByRole('checkbox')).not.toBeChecked();
    assert.equal(
      (await page.evaluate(() => window.__manualInvoiceVerification.opened))
        .length,
      0
    );

    await page.evaluate(() => {
      window.__manualInvoiceVerification.failCopy = false;
    });
    await row
      .getByTitle('Click to copy message and open Facebook Messenger')
      .click();
    await expect(row.getByRole('checkbox')).toBeChecked();
    const result = await page.evaluate(
      () => window.__manualInvoiceVerification
    );
    assert.equal(result.copied.length, 1);
    assert.ok(result.copied[0].includes(checkout));
    assert.ok(result.copied[0].includes(payment));
    assert.ok(
      !/\{(?:DRIVE_FILES|SHOPEE_LINK|GREETING|PAYMENT_CHANNELS_URL)\}/.test(
        result.copied[0]
      )
    );
    assert.ok(
      !result.copied[0].includes('2026-10-25'),
      'The local invoice date must not become a Drive URL'
    );
    assert.deepEqual(result.opened, [`https://${messenger}`]);
    await page.screenshot({
      path: 'test-results/manual-invoice-safe-desktop.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole('button', { name: 'Collapse side panel', exact: true })
      .click();
    await expect(
      page.getByRole('tab', { name: 'Invoicing', exact: true })
    ).toBeInViewport();
    await row.getByText(customer, { exact: true }).scrollIntoViewIfNeeded();
    await expect(row.getByText(customer, { exact: true })).toBeInViewport();
    await expect(row.getByRole('checkbox')).toBeChecked();
    await page.screenshot({
      path: 'test-results/manual-invoice-safe-mobile.png',
      fullPage: true,
    });
    assert.ok(!requestedApis.includes('/api/google-drive/sync-files'));
    assert.equal(
      blockedWrites.filter((write) =>
        /invoices|customers|transactions|checkout-links/.test(write)
      ).length,
      0
    );
    process.stdout.write(
      JSON.stringify({
        baseURL,
        normalTemporaryLogin: true,
        syntheticCustomerRows: 2,
        clipboardFailureGuard: true,
        copiedMessage: true,
        normalizedMessengerHandoff: 'intercepted; no external delivery',
        automaticDriveSyncRequested: false,
        screenshots: ['desktop', 'mobile'],
        applicationWrites: blockedWrites,
      }) + '\n'
    );
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        requestedApis: Array.from(new Set(requestedApis)),
        browserErrors,
        blockedWrites,
      }) + '\n'
    );
    const page = browser?.contexts()[0]?.pages()[0];
    if (page) {
      await page.screenshot({
        path: 'test-results/manual-invoice-safe-failure.png',
        fullPage: true,
      });
    }
    throw error;
  } finally {
    try {
      await browser?.close();
    } finally {
      if (created) {
        account('remove');
        process.stdout.write(
          'Removed only the temporary browser verification account.\n'
        );
      }
    }
  }
}

main().catch((error: unknown) => {
  process.stderr.write('Safe manual invoice verification failed:\n');
  process.stderr.write(
    (error instanceof Error
      ? error.message.split('\n').slice(0, 5).join('\n')
      : 'Unknown failure') + '\n'
  );
  process.exitCode = 1;
});
