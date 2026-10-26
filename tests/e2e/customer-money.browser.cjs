const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createServer } = require('vite');
const { chromium, expect } = require('@playwright/test');
const Papa = require('papaparse');

const root = path.resolve(__dirname, '../..');
const artifacts = '/tmp/bms-customer-money-browser';

async function main() {
  await fs.mkdir(artifacts, { recursive: true });
  const server = await createServer({
    root, configFile: false, envDir: __dirname, logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
    resolve: { alias: { '@': path.join(root, 'src') }, dedupe: ['react', 'react-dom'] },
    esbuild: { jsx: 'automatic' }, define: { 'process.env': '{}' },
    plugins: [{
      name: 'customer-money-isolated-fixture',
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          if (request.url !== '/' && !request.url.startsWith('/?')) return next();
          response.setHeader('Content-Type', 'text/html');
          response.end(await vite.transformIndexHtml('/', '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/e2e/customer-money.fixture.tsx"></script></body></html>'));
        });
      },
    }],
  });
  let browser;
  const checks = [];
  try {
    await server.listen();
    const url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
      for (const domain of ['clothing', 'gm']) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const errors = [];
        const requests = [];
        const decision = { id: 'approval', transactionId: 10, customerId: 1, customerName: 'Customer', productCode: 'SKU',
          kind: 'CANCELLED', decisionDate: '2026-10-21', reason: 'Customer cancellation', createdBy: 'admin',
          approvedAmount: 300, paidAmount: 100, pendingAmount: 200, ageDays: 5, payouts: [] };
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/api/**', async (route) => {
          const request = route.request();
          const pathname = new URL(request.url()).pathname;
          if (!pathname.startsWith('/api/')) return route.continue();
          requests.push({ pathname, method: request.method(), body: request.postDataJSON(), key: request.headers()['idempotency-key'] });
          if (pathname === '/api/accounting/opening-balance') return route.fulfill({ json: { success: true, data: { entries: [], cutoverDate: '2026-01-17' } } });
          if (pathname === '/api/accounting/ledger') return route.fulfill({ json: { success: true, data: {
            entries: [{ id: 'one', date: '2026-10-24', ref: 'INCLUDED', account: 'Cash', debit: 25, credit: 0, balance: 125, description: 'Visible receipt' },
              { id: 'two', date: '2026-10-25', ref: 'OTHER', account: 'Cash', debit: 0, credit: 10, balance: 115, description: 'Other payout' }],
            openingBalances: { Cash: 100, 'Prior only': 50 }, closingBalances: { Cash: 115, 'Prior only': 50 },
            stats: { totalDebits: 25, totalCredits: 10, netChange: 15, accounts: 1, period: 'This Month' },
          } } });
          if (pathname === '/api/transactions/30/cancellation') {
            const scenario = new URL(page.url()).searchParams.get('scenario');
            if (request.method() === 'GET') return route.fulfill({ json: { success: true, data: {
              transactionId: 30, orderStatus: 'Invoiced', grossAmount: 1000, collectedAmount: scenario === 'unpaid' ? 0 : 400,
              priorRefundAmount: 0, initialDepositAmount: scenario === 'legacy' ? null : 100, initialDepositRate: scenario === 'legacy' ? null : 10,
              hasReceivableSale: false, reviewRequired: false, closed: false,
            } } });
            const body = request.postDataJSON(); assert.match(request.headers()['idempotency-key'], /^[0-9a-f-]{36}$/i);
            assert.equal(body.kind, scenario === 'supplier' ? 'VOIDED' : 'CANCELLED');
            assert.equal(body.mode, ['unpaid', 'supplier'].includes(scenario) ? 'REFUND_ALL' : 'RETAIN_DEPOSIT');
            if (scenario === 'legacy') assert.deepEqual(body.originalDeposit, { amount: 200, rate: 20 });
            return route.fulfill({ json: { success: true, data: { id: 'new-approval' } } });
          }
          if (pathname === '/api/accounting/inventory-valuation') {
            if (request.method() === 'GET') return route.fulfill({ json: { success: true, data: {
              products: [{ id: 5, productCode: 'SKU', shipmentCode: 'SHIP', quantity: 10, unitCost: 100 }],
              capitalizations: [{ id: 'posted-cost', ref: 'SKU', date: '2026-10-25', amount: 200 }], history: [],
            } } });
            assert.match(request.headers()['idempotency-key'], /^[0-9a-f-]{36}$/i);
            const body = request.postDataJSON();
            if (request.method() === 'PATCH') {
              assert.equal(body.productId, 5); assert.equal(body.expectedUnitCost, 100); assert.equal(body.newUnitCost, 120);
              assert.equal(body.capitalizationLineId, 'posted-cost');
            } else { assert.equal(body.movementId, 42); assert.equal(body.reason, 'Supplier provided genuinely free goods'); }
            return route.fulfill({ json: { success: true, data: body } });
          }
          if (pathname === '/api/customers/refund-pending') {
            return route.fulfill({ json: { success: true, data: { scope: 'clothing', asOf: '2026-10-26', from: null,
              pendingAmount: decision.pendingAmount, transactionCount: 1, oldestAgeDays: 5, paidApprovedRefundAmount: decision.paidAmount,
              retainedDepositAmount: 100, paidRefundTrends: [], items: [decision], history: [decision] } } });
          }
          if (pathname === '/api/customers/1/refunds/payout' && request.method() === 'POST') {
            const payout = request.postDataJSON();
            assert.equal(payout.amount, 100);
            assert.equal(payout.cancellationId, 'approval');
            assert.match(request.headers()['idempotency-key'], /^[0-9a-f-]{36}$/i);
            decision.pendingAmount -= 100;
            decision.paidAmount += 100;
            decision.payouts.push({ id: 'payout', refundId: 2, amount: 100, paymentDate: payout.paymentDate, method: payout.method, createdBy: 'Collector' });
            return route.fulfill({ json: { success: true, data: { id: 'payout' } } });
          }
          if (/^\/api\/(general-merchandise\/)?customers\/1\/refunds$/.test(pathname)) {
            return route.fulfill({ json: { success: true, data: [{ id: 1, transactionId: 10, refundDate: '2026-10-22', amount: 100, reason: 'Partial payout' }] } });
          }
          errors.push(`Unexpected API request: ${request.method()} ${pathname}`);
          return route.abort('blockedbyclient');
        });
        await page.goto(`${url}/?domain=${domain}`);
        await page.getByRole('tab', { name: /Return\/Refund/ }).click();
        await expect(page.getByRole('button', { name: 'Record Refund', exact: true })).toBeEnabled();
        if (domain === 'clothing') {
          await expect(page.getByRole('button', { name: 'Delete refund' })).toHaveCount(0);
          await page.getByRole('button', { name: 'Refund Pending', exact: true }).click();
          await expect(page.getByRole('link', { name: 'Customer', exact: true })).toHaveAttribute('href', '/clothing/operations/customers/1?refund=approval');
          await page.screenshot({ path: path.join(artifacts, `${viewport.name}-reminder.png`), fullPage: true });
          await page.keyboard.press('Escape');
        } else {
          await expect(page.getByRole('button', { name: 'Delete refund' })).toBeVisible();
          assert.equal(requests.some((request) => request.pathname === '/api/customers/refund-pending'), false);
        }
        await page.getByRole('button', { name: 'Record Refund', exact: true }).click();
        await page.getByRole('textbox', { name: /^Transaction/ }).click();
        await expect(page.getByRole('option', { name: /#20/ })).toBeVisible();
        await expect(page.getByRole('option', { name: /#10/ })).toHaveCount(domain === 'clothing' ? 0 : 1);
        await page.getByRole('option', { name: /#20/ }).click();
        await page.screenshot({ path: path.join(artifacts, `${viewport.name}-${domain}-goods-refund.png`), fullPage: true });
        const overflow = await page.getByRole('dialog').evaluate((dialog) => Array.from(dialog.querySelectorAll('input, button, label')).filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
        }).map((element) => element.textContent));
        assert.deepEqual(overflow, [], 'Refund controls must fit the viewport');
        await page.getByRole('button', { name: 'Close refund form' }).click();
        if (domain === 'clothing') {
          await page.getByRole('button', { name: 'Record payout', exact: true }).click();
          await page.getByLabel('Payout amount', { exact: false }).fill('100');
          await page.getByRole('button', { name: 'Save actual payout', exact: true }).click();
          await expect(page.getByText('₱100.00 pending', { exact: true })).toBeVisible();
          await expect(page.getByRole('dialog')).toHaveCount(0);
          assert.equal(requests.filter((request) => request.pathname.endsWith('/refunds/payout')).length, 1);
          await page.screenshot({ path: path.join(artifacts, `${viewport.name}-partial-payout.png`), fullPage: true });
          await page.goto(`${url}/?view=valuation`);
          await expect(page.getByText('Profit Incomplete', { exact: true })).toBeVisible();
          await page.screenshot({ path: path.join(artifacts, `${viewport.name}-incomplete-valuation.png`), fullPage: true });
          await page.getByRole('button', { name: 'Dated cost corrections', exact: true }).click();
          await page.getByLabel('Confirmed new unit cost', { exact: true }).fill('120');
          await page.getByLabel('Correction reason', { exact: true }).fill('Confirmed freight already capitalized');
          await expect(page.getByRole('button', { name: 'Record dated allocation' })).toBeDisabled();
          await page.getByRole('textbox', { name: 'Posted capitalization' }).click();
          await page.getByRole('option', { name: /SKU \| 2026-10-25/ }).click();
          const costOverflow = await page.getByRole('dialog').evaluate((dialog) => Array.from(dialog.querySelectorAll('input, button, label')).filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
          }).map((element) => element.textContent));
          assert.deepEqual(costOverflow, [], 'Valuation controls must fit the viewport');
          await page.screenshot({ path: path.join(artifacts, `${viewport.name}-cost-correction.png`), fullPage: true });
          await page.getByRole('button', { name: 'Record dated allocation', exact: true }).click();
          await expect(page.getByRole('dialog')).toHaveCount(0);
          await page.getByRole('button', { name: 'Confirm zero cost', exact: true }).click();
          await page.getByLabel('Confirmation reason', { exact: false }).fill('Supplier provided genuinely free goods');
          await page.getByRole('dialog').evaluate(async (dialog) => Promise.all(dialog.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => null))));
          await page.screenshot({ path: path.join(artifacts, `${viewport.name}-zero-cost-confirmation.png`), fullPage: true });
          await page.getByRole('button', { name: 'Confirm zero-cost goods', exact: true }).click();
          await expect(page.getByText('Profit Incomplete', { exact: true })).toHaveCount(0);
          assert.equal(requests.filter((request) => request.pathname === '/api/accounting/inventory-valuation' && request.method === 'PATCH').length, 1);
          assert.equal(requests.filter((request) => request.pathname === '/api/accounting/inventory-valuation' && request.method === 'POST').length, 1);
          for (const scenario of ['paid', 'unpaid', 'legacy', 'supplier']) {
            const previous = requests.filter((request) => request.pathname === '/api/transactions/30/cancellation' && request.method === 'POST').length;
            await page.goto(`${url}/?view=cancellation&scenario=${scenario}`);
            await page.getByRole('button', { name: scenario === 'supplier' ? 'Void order' : 'Cancel order', exact: true }).click();
            if (scenario === 'unpaid') {
              await expect.poll(() => requests.filter((request) => request.pathname === '/api/transactions/30/cancellation' && request.method === 'POST').length).toBe(previous + 1);
              await expect(page.getByRole('dialog')).toHaveCount(0);
              continue;
            }
            await expect(page.getByRole('dialog')).toBeVisible();
            if (scenario === 'supplier') await expect(page.getByRole('radio', { name: 'Keep the agreed original deposit' })).toHaveCount(0);
            else await page.getByRole('radio', { name: 'Keep the agreed original deposit' }).check();
            await page.getByLabel('Decision reason', { exact: false }).fill(scenario === 'supplier' ? 'Supplier could not fulfill' : 'Customer cancellation reviewed');
            if (scenario === 'legacy') {
              await expect(page.getByLabel('Confirmed original deposit amount', { exact: false })).toHaveValue('');
              await expect(page.getByRole('button', { name: 'Approve cancellation' })).toBeDisabled();
              await page.getByText('20%', { exact: true }).click();
              await page.getByLabel('Confirmed original deposit amount', { exact: false }).fill('200');
              await page.getByRole('checkbox', { name: "I confirmed the customer's original deposit agreement" }).check();
            }
            await page.getByRole('dialog').evaluate(async (dialog) => Promise.all(dialog.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => null))));
            const cancellationOverflow = await page.getByRole('dialog').evaluate((dialog) => Array.from(dialog.querySelectorAll('input, button, label')).filter((element) => {
              const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
            }).map((element) => element.textContent));
            assert.deepEqual(cancellationOverflow, [], 'Cancellation controls must fit the viewport');
            await page.screenshot({ path: path.join(artifacts, `${viewport.name}-${scenario}-cancellation.png`), fullPage: true });
            await page.getByRole('button', { name: 'Approve cancellation', exact: true }).click();
            await expect(page.getByRole('dialog')).toHaveCount(0);
            assert.equal(requests.filter((request) => request.pathname === '/api/transactions/30/cancellation' && request.method === 'POST').length, previous + 1);
          }
          await page.goto(`${url}/?view=ledger`);
          await page.getByRole('textbox', { name: 'Ledger account', exact: true }).click();
          await page.getByRole('option', { name: 'Prior only', exact: true }).click();
          await expect(page.getByText('Opening: ₱50.00', { exact: true })).toBeVisible();
          await expect(page.getByText('Closing: ₱50.00', { exact: true })).toBeVisible();
          await expect(page.getByText('Period movement: ₱0.00', { exact: true })).toBeVisible();
          await expect(page.getByText('No ledger entries found', { exact: true })).toBeVisible();
          await page.screenshot({ path: path.join(artifacts, `${viewport.name}-ledger-prior-only.png`), fullPage: true });
          await page.getByRole('textbox', { name: 'Ledger account', exact: true }).click();
          await page.getByRole('option', { name: 'Cash', exact: true }).click();
          await page.getByLabel('Ledger search', { exact: true }).fill('INCLUDED');
          await expect(page.getByText('Closing: ₱115.00', { exact: true })).toBeVisible();
          await expect(page.getByText('Period movement: ₱15.00', { exact: true })).toBeVisible();
          await expect(page.getByRole('cell', { name: '₱125.00', exact: true })).toBeVisible();
          const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export ledger CSV', exact: true }).click();
          const download = await downloadEvent; const stream = await download.createReadStream(); const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          const csv = Papa.parse(Buffer.concat(chunks).toString('utf8'), { header: true, skipEmptyLines: true });
          assert.equal(csv.data.length, 1); assert.equal(csv.data[0].Ref, 'INCLUDED'); assert.equal(csv.data[0].Balance, '125.00');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Ledger scrolling must remain inside its table');
          const crampedHeaders = await page.getByRole('table').locator('th').evaluateAll((headers) => headers.filter((header) => header.scrollWidth > header.clientWidth + 1).map((header) => header.textContent));
          assert.deepEqual(crampedHeaders, [], 'Ledger headings must not overlap adjacent columns');
          await page.getByRole('cell', { name: '₱125.00', exact: true }).scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(artifacts, `${viewport.name}-ledger-search.png`), fullPage: true });
          await page.goto(`${url}/?view=inventory`);
          const onhand = page.getByRole('row').filter({ has: page.getByText('ONHAND', { exact: true }) });
          const transit = page.getByRole('row').filter({ has: page.getByText('TRANSIT', { exact: true }) });
          for (const [row, values] of [[onhand, ['10', '4', '6', '0', '0']], [transit, ['0', '0', '0', '4', '6']]]) {
            for (const [index, value] of [7, 8, 10, 11, 12].map((column, offset) => [column, values[offset]])) await expect(row.getByRole('cell').nth(index)).toHaveText(value);
          }
          await transit.getByRole('cell').nth(11).scrollIntoViewIfNeeded();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Inventory scrolling must remain inside its table');
          await page.screenshot({ path: path.join(artifacts, `${viewport.name}-inventory-locations.png`), fullPage: true });
        }
        assert.deepEqual(errors, [], 'Browser runtime and API requests must be clean');
        checks.push(`${viewport.name} ${domain}: refund controls, approval isolation and viewport fit${domain === 'clothing' ? ', reminder, partial payout, dated valuation, cancellation variants, prior-only/search-stable ledger CSV and physical/transit inventory grid' : ''}`);
        await context.close();
      }
    }
    console.log(JSON.stringify({ checks, artifacts }, null, 2));
  } finally {
    await browser?.close();
    await server.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
