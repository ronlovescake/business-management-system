const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { fork, spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const { chromium, expect: playwrightExpect } = require('@playwright/test');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '../..');
const expect = playwrightExpect.configure({ timeout: 30000 });

async function serve() {
  const next = require('next');
  const config = require(path.join(root, 'next.config.js'));
  const app = next({
    dev: true,
    dir: root,
    conf: { ...config, distDir: process.env.RECONCILIATION_DIST_DIR },
  });
  await app.prepare();
  const server = http.createServer(app.getRequestHandler());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.NEXTAUTH_URL = `http://127.0.0.1:${server.address().port}`;
  process.send({ url: process.env.NEXTAUTH_URL });
  process.on('SIGTERM', () => {
    server.close();
    void app.close().finally(() => process.exit(0));
  });
}

async function main() {
  const base = dotenv.parse(fs.readFileSync(path.join(root, '.env.test')));
  const database = new URL(base.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
  assert.equal(
    database.port,
    '5433',
    'Only the isolated local test server is permitted'
  );
  assert.match(database.pathname, /test/i);
  const databaseName = `bms_reconciliation_test_${randomUUID().replaceAll('-', '')}`;
  const artifacts = fs.mkdtempSync(
    path.join(os.tmpdir(), 'bms-reconciliation-')
  );
  const admin = new PrismaClient({
    datasources: { db: { url: database.toString() } },
  });
  database.pathname = `/${databaseName}`;
  const env = {
    ...base,
    DATABASE_URL: database.toString(),
    DIRECT_URL: database.toString(),
    NEXTAUTH_SECRET: randomUUID(),
    NEXTAUTH_URL: 'http://127.0.0.1',
    BYPASS_AUTH_FOR_TESTS: 'false',
    ACCOUNTING_CUTOVER_DATE: '2026-01-17',
    ACCOUNTING_CUTOVER_DATE_CLOTHING: '2026-01-17',
    RECONCILIATION_DIST_DIR: `.next-reconciliation-${databaseName}`,
    NEXT_TELEMETRY_DISABLED: '1',
  };
  const envFile = path.join(artifacts, '.env.test');
  fs.writeFileSync(
    envFile,
    Object.entries(env)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join('\n'),
    { mode: 0o600 }
  );
  const checks = [];
  const findings = [];
  let created = false;
  let client;
  let child;
  let browser;
  let page;
  let failure;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    if (process.argv.includes('--migration-replay-only')) {
      client = new PrismaClient({
        datasources: { db: { url: database.toString() } },
      });
      await client.$executeRawUnsafe(
        'CREATE TABLE public.inventory_movements (id INTEGER PRIMARY KEY, quantity DOUBLE PRECISION NOT NULL, "unitCost" DOUBLE PRECISION)'
      );
      await client.$executeRawUnsafe(
        'CREATE TABLE public.split_batch_components (id INTEGER PRIMARY KEY, "componentPrice" DOUBLE PRECISION)'
      );
      await client.$executeRawUnsafe(
        'INSERT INTO public.inventory_movements (id, quantity, "unitCost") VALUES (1, 4, 20)'
      );
      await client.$executeRawUnsafe(
        'INSERT INTO public.split_batch_components (id, "componentPrice") VALUES (1, 50)'
      );
      const before = {
        movements: await client.$queryRawUnsafe(
          'SELECT * FROM public.inventory_movements ORDER BY id'
        ),
        components: await client.$queryRawUnsafe(
          'SELECT * FROM public.split_batch_components ORDER BY id'
        ),
      };
      for (const migration of [
        '20261028000001_inventory_movement_cost_provenance',
        '20261028000002_split_acquisition_cost',
      ]) {
        const sql = fs.readFileSync(
          path.join(root, 'prisma/migrations', migration, 'migration.sql'),
          'utf8'
        );
        const replay = spawnSync(
          process.execPath,
          [
            'node_modules/prisma/build/index.js',
            'db',
            'execute',
            '--stdin',
            '--schema',
            'prisma/schema.prisma',
          ],
          {
            cwd: root,
            env: { ...process.env, ...env },
            input: sql,
            encoding: 'utf8',
          }
        );
        assert.equal(
          replay.status,
          0,
          `Actual migration DDL replay failed: ${migration}: ${replay.stderr}`
        );
      }
      assert.deepEqual(
        await client.$queryRawUnsafe(
          'SELECT id, quantity, "unitCost" FROM public.inventory_movements ORDER BY id'
        ),
        before.movements
      );
      assert.deepEqual(
        await client.$queryRawUnsafe(
          'SELECT id, "componentPrice" FROM public.split_batch_components ORDER BY id'
        ),
        before.components
      );
      assert.deepEqual(
        await client.$queryRawUnsafe(
          'SELECT "costBasis", "sourceMovementId" FROM public.inventory_movements WHERE id = 1'
        ),
        [{ costBasis: null, sourceMovementId: null }]
      );
      assert.deepEqual(
        await client.$queryRawUnsafe(
          'SELECT "acquisitionUnitCost" FROM public.split_batch_components WHERE id = 1'
        ),
        [{ acquisitionUnitCost: null }]
      );
      await client.$executeRawUnsafe(
        'INSERT INTO public.inventory_movements (id, quantity, "unitCost", "costBasis") VALUES (2, 1, 0, \'FREE_GOODS\')'
      );
      await client.$executeRawUnsafe(
        'INSERT INTO public.inventory_movements (id, quantity, "unitCost", "costBasis", "sourceMovementId") VALUES (3, 1, 0, \'FREE_GOODS\', 2)'
      );
      await assert.rejects(
        client.$executeRawUnsafe(
          'INSERT INTO public.inventory_movements (id, quantity, "sourceMovementId") VALUES (4, 1, 999999)'
        )
      );
      await assert.rejects(
        client.$executeRawUnsafe(
          'DELETE FROM public.inventory_movements WHERE id = 2'
        )
      );
      await client.$executeRawUnsafe(
        'UPDATE public.inventory_movements SET id = 20 WHERE id = 2'
      );
      assert.deepEqual(
        await client.$queryRawUnsafe(
          'SELECT "sourceMovementId", "unitCost", "costBasis" FROM public.inventory_movements WHERE id = 3'
        ),
        [{ sourceMovementId: 20, unitCost: 0, costBasis: 'FREE_GOODS' }]
      );
      await client.$executeRawUnsafe(
        'UPDATE public.split_batch_components SET "acquisitionUnitCost" = 0 WHERE id = 1'
      );
      assert.deepEqual(
        await client.$queryRawUnsafe(
          'SELECT "componentPrice", "acquisitionUnitCost" FROM public.split_batch_components WHERE id = 1'
        ),
        [{ componentPrice: 50, acquisitionUnitCost: 0 }]
      );
      const index = await client.$queryRawUnsafe(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'inventory_movements' AND indexname = 'inventory_movements_sourceMovementId_idx'"
      );
      assert.equal(index.length, 1);
      checks.push(
        'Actual additive migration DDL replay: both unchanged SQL files apply to prior-shaped owned tables; legacy quantity/cost/selling-price values preserved, new provenance/acquisition costs remain null without backfill, explicit zero round-trips, missing source and source deletion reject, source ID update cascades, source-link index exists'
      );
      fs.writeFileSync(
        path.join(artifacts, 'migration-replay.json'),
        JSON.stringify(
          {
            databaseName,
            legacyBefore: before,
            checks,
            migrations: [
              '20261028000001_inventory_movement_cost_provenance',
              '20261028000002_split_acquisition_cost',
            ],
          },
          null,
          2
        )
      );
      return;
    }
    const setupLog = fs.openSync(
      path.join(artifacts, 'schema.log'),
      'w',
      0o600
    );
    const setup = spawnSync(
      process.execPath,
      ['scripts/reset-test-db.js', '--seed'],
      {
        cwd: root,
        env: { ...process.env, ...env, TEST_ENV_FILE: envFile },
        stdio: ['ignore', setupLog, setupLog],
      }
    );
    fs.closeSync(setupLog);
    assert.equal(
      setup.status,
      0,
      `Scratch schema setup failed; see ${artifacts}/schema.log`
    );
    client = new PrismaClient({
      datasources: { db: { url: database.toString() } },
    });
    if (
      process.argv.includes('--gates') ||
      process.argv.includes('--integration-only')
    ) {
      const summaryPath = path.join(
        root,
        'docs/reports/REFACTOR_EXEC_SUMMARY_2026-02-14.md'
      );
      fs.copyFileSync(
        summaryPath,
        path.join(artifacts, 'pre-gates-summary.md')
      );
      const commands = process.argv.includes('--integration-only')
        ? [
            [
              'supplier-customer-integration',
              'npx',
              [
                '--no-install',
                'vitest',
                'run',
                '--config',
                'vitest.config.integration.ts',
                'tests/integration/clothing-supplier-credits.integration.test.ts',
                'tests/integration/clothing-customer-money.integration.test.ts',
                'tests/integration/transaction-save-concurrency.integration.test.ts',
                '--reporter=dot',
              ],
            ],
          ]
        : [
            'guardrails:check',
            'lint',
            'typecheck',
            'test:unit',
            'test:integration',
            'test:hardening',
            'test:coverage:enforce',
            'inventory:ledger:controls',
            'accounting:transactions:sanitycheck',
          ].map((script) => [script, 'npm', ['run', script]]);
      for (const [name, executable, args] of commands) {
        const logPath = path.join(
          artifacts,
          `${name.replaceAll(':', '-')}.log`
        );
        const descriptor = fs.openSync(logPath, 'w', 0o600);
        console.log(`Running ${name} against disposable ${databaseName}`);
        const result = spawnSync(executable, args, {
          cwd: root,
          env: {
            ...process.env,
            ...env,
            TEST_ENV_FILE: envFile,
            VITEST_ENV_FILE: envFile,
            INTEGRATION_ENV_FILE: envFile,
          },
          stdio: ['ignore', descriptor, descriptor],
        });
        fs.closeSync(descriptor);
        const output = fs.readFileSync(logPath, 'utf8');
        console.log(output.split('\n').slice(-14).join('\n'));
        assert.equal(result.status, 0, `${name} failed; see ${logPath}`);
        checks.push(`${name}: passed`);
      }
      return;
    }
    const email = 'reconciliation@example.test';
    const password = randomUUID();
    await client.user.create({
      data: {
        email,
        password: await hash(password, 10),
        name: 'Reconciliation Administrator',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    const appLog = fs.openSync(path.join(artifacts, 'app.log'), 'w', 0o600);
    child = fork(__filename, ['--server'], {
      cwd: root,
      env: { ...process.env, ...env, NODE_ENV: 'development' },
      stdio: ['ignore', appLog, appLog, 'ipc'],
    });
    fs.closeSync(appLog);
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Isolated app did not start')),
        120000
      );
      child.once('message', (message) => {
        clearTimeout(timer);
        resolve(message.url);
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`App exited before ready: ${code}`));
      });
    });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      timezoneId: 'Asia/Manila',
    });
    await context.tracing.start({ screenshots: true, snapshots: true });
    page = await context.newPage();
    const financialRequests = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        /\/api\/.+\/(cancellation|refunds\/payout|payments\/bulk)$/.test(
          request.url()
        )
      ) {
        financialRequests.push({
          url: request.url(),
          data: request.postDataJSON(),
          key: request.headers()['idempotency-key'],
        });
      }
    });
    page.setDefaultTimeout(30000);
    const initialSession = page.waitForResponse(
      (response) => response.url().endsWith('/api/auth/session'),
      { timeout: 120000 }
    );
    await page.goto(`${url}/login`, { timeout: 120000 });
    await initialSession;
    await page.getByLabel('Email', { exact: false }).fill(email);
    await page.getByLabel('Password', { exact: false }).fill(password);
    const signedIn = page.waitForResponse((response) =>
      response.url().endsWith('/api/auth/callback/credentials')
    );
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    assert.equal((await signedIn).status(), 200);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 120000 });
    const session = await (
      await context.request.get(`${url}/api/auth/session`)
    ).json();
    assert.equal(
      session.user?.role,
      'SUPER_ADMIN',
      'Credentials must establish a real administrator session'
    );
    checks.push('Real credentials login with auth bypass disabled');
    await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
    await expect(
      page.getByRole('button', { name: /add product/i }).first()
    ).toBeVisible({ timeout: 120000 });
    await page.screenshot({
      path: path.join(artifacts, 'products.png'),
      fullPage: true,
    });
    checks.push(
      'Authenticated real Products page loads against isolated database'
    );
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const net = (entries, account) =>
      entries
        .filter((entry) => entry.account === account)
        .reduce(
          (sum, entry) => sum + Number(entry.debit) - Number(entry.credit),
          0
        );
    const close = (actual, expected, message) =>
      assert.ok(
        Math.abs(actual - expected) < 0.005,
        `${message}: expected ${expected}, actual ${actual}`
      );
    async function reports(stage, { from = '2026-10-01', to = today } = {}) {
      const result = {};
      for (const [name, endpoint] of Object.entries({
        journal: 'journal',
        ledger: 'ledger',
        profit: 'profit-loss',
        details: 'profit-loss/details',
        balance: 'balance-sheet',
      })) {
        const query =
          name === 'balance' ? `asOf=${to}` : `from=${from}&to=${to}`;
        const response = await context.request.get(
          `${url}/api/accounting/${endpoint}?${query}`,
          { timeout: 120000 }
        );
        assert.equal(response.status(), 200, `${stage}: ${endpoint}`);
        result[name] = (await response.json()).data;
      }
      const periodOpenings =
        await client.clothingAccountingOpeningBalance.findMany({
          where: {
            deletedAt: null,
            date: {
              gte: new Date(`${from}T00:00:00.000Z`),
              lte: new Date(`${to}T23:59:59.999Z`),
            },
          },
          select: { account: true, debit: true, credit: true },
        });
      for (const account of [
        'Cash',
        'Customer Deposits',
        'Refunds Payable',
        'Accounts Receivable',
        'Sales Revenue',
        'Sales Returns',
        'Forfeited Deposits',
        'Inventory in Transit',
        'Stock on Hand',
        'Supplier Credits',
        'Supplier Payable',
        'COGS',
      ]) {
        close(
          net(result.journal.entries, account) + net(periodOpenings, account),
          net(result.ledger.entries, account),
          `${stage}: journal activity plus explicit period openings/ledger ${account}`
        );
      }
      close(
        result.details.rows
          .filter((row) => row.type === 'Revenue')
          .reduce((sum, row) => sum + Number(row.amount), 0),
        result.profit.stats.revenueTotal,
        `${stage}: P&L details/revenue`
      );
      close(
        result.balance.stats.balance,
        0,
        `${stage}: balance sheet balances`
      );
      fs.writeFileSync(
        path.join(artifacts, `${stage}.json`),
        JSON.stringify(result, null, 2)
      );
      return result;
    }
    if (process.argv.includes('--cost-corrections-only')) {
      const {
        runCostCorrectionLifecycle,
      } = require('./helpers/clothing-reconciliation-cost-corrections.cjs');
      await runCostCorrectionLifecycle({
        page,
        client,
        context,
        databaseUrl: env.DATABASE_URL,
        url,
        today,
        reports,
        net,
        close,
        checks,
        artifacts,
      });
      await context.tracing.stop({ path: path.join(artifacts, 'trace.zip') });
      return;
    }
    if (process.argv.includes('--historical-only')) {
      const {
        runHistoricalLifecycle,
      } = require('./helpers/clothing-reconciliation-historical.cjs');
      await runHistoricalLifecycle({
        page,
        client,
        context,
        databaseUrl: env.DATABASE_URL,
        url,
        today,
        reports,
        net,
        close,
        checks,
        artifacts,
      });
      await context.tracing.stop({ path: path.join(artifacts, 'trace.zip') });
      return;
    }
    if (process.argv.includes('--composites-only')) {
      const {
        runCompositeLifecycle,
      } = require('./helpers/clothing-reconciliation-composites.cjs');
      await runCompositeLifecycle({
        page,
        client,
        context,
        databaseUrl: env.DATABASE_URL,
        url,
        today,
        reports,
        net,
        close,
        checks,
        artifacts,
      });
      await context.tracing.stop({ path: path.join(artifacts, 'trace.zip') });
      return;
    }
    if (
      process.argv.includes('--lifecycle-only') ||
      process.argv.includes('--shortage-only') ||
      process.argv.includes('--free-goods-only')
    ) {
      const {
        runPurchaseLifecycle,
        runShortageLifecycle,
        runFreeGoodsLifecycle,
      } = require('./helpers/clothing-reconciliation-scenarios.cjs');
      const runLifecycle = process.argv.includes('--free-goods-only')
        ? runFreeGoodsLifecycle
        : process.argv.includes('--shortage-only')
          ? runShortageLifecycle
          : runPurchaseLifecycle;
      await runLifecycle({
        page,
        client,
        context,
        databaseUrl: env.DATABASE_URL,
        url,
        today,
        reports,
        net,
        close,
        checks,
        artifacts,
      });
      await context.tracing.stop({ path: path.join(artifacts, 'trace.zip') });
      return;
    }
    for (const scenario of [
      {
        id: 'C02-C03',
        status: 'Cancelled',
        payments: [200, 300],
        rate: 20,
        retained: 200,
        payouts: [100, 200],
      },
      {
        id: 'C06',
        status: 'Voided',
        payments: [200, 300],
        rate: 20,
        retained: 0,
        payouts: [100, 400],
      },
      {
        id: 'C04',
        status: 'Cancelled',
        payments: [100, 300],
        rate: 10,
        retained: 0,
        payouts: [400],
      },
      {
        id: 'C05',
        status: 'Cancelled',
        payments: [200, 800],
        rate: 20,
        retained: 0,
        payouts: [1000],
        beforeCancel: 'Prepared',
      },
      {
        id: 'C01',
        status: 'Cancelled',
        payments: [],
        rate: 20,
        retained: 0,
        payouts: [],
      },
      {
        id: 'C07',
        status: 'Voided',
        payments: [],
        rate: 20,
        retained: 0,
        payouts: [],
      },
      {
        id: 'C04-20',
        status: 'Cancelled',
        payments: [200, 300],
        rate: 20,
        retained: 0,
        payouts: [500],
      },
      {
        id: 'C09',
        status: 'Cancelled',
        payments: [200],
        rate: 20,
        retained: 0,
        payouts: [200],
        beforeCancel: 'Accounts Receivable',
      },
      {
        id: 'C08',
        status: 'Cancelled',
        payments: [200, 800],
        rate: 20,
        retained: 0,
        payouts: [1000],
        beforeCancel: 'Prepared',
      },
      {
        id: 'C08-Shipped',
        status: 'Cancelled',
        payments: [200, 800],
        rate: 20,
        retained: 0,
        payouts: [1000],
        beforeCancel: 'Shipped',
      },
      ...[null, 'sellable', 'damaged_hold', 'scrap'].map((bucket) => ({
        id: `C11-${bucket ?? 'money-only'}`,
        status: 'Cancelled',
        payments: [200, 800],
        rate: 20,
        retained: 0,
        payouts: [],
        beforeCancel: 'Shipped',
        ordinaryRefund: true,
        bucket,
      })),
      {
        id: 'C10',
        status: 'Cancelled',
        payments: [200, 800],
        rate: 20,
        retained: 0,
        payouts: [100],
        beforeCancel: 'Shipped',
        ordinaryRefund: true,
        bucket: null,
        priorRefundAmount: 900,
        continueAfterRefund: true,
      },
      {
        id: 'X02',
        status: 'Cancelled',
        payments: [200, 600],
        rate: 20,
        retained: 200,
        payouts: [400, 200],
        race: true,
      },
    ].filter(
      (scenario) =>
        !process.argv.includes('--supplier-only') &&
        (!process.argv.includes('--cancel-returns-only') ||
          scenario.id.startsWith('C08')) &&
        (!process.argv.includes('--returns-only') ||
          scenario.id.startsWith('C11')) &&
        (!process.argv.includes('--review-only') || scenario.id === 'C10') &&
        (!process.argv.includes('--paid-overdue-only') ||
          scenario.id === 'C05') &&
        (!process.argv.includes('--reminders-only') ||
          scenario.id === 'C02-C03') &&
        (!process.argv.includes('--concurrency-only') || scenario.id === 'X02')
    )) {
      const customer = await client.customer.create({
        data: {
          customerName: `Reconciliation ${scenario.id}`,
          date: today,
          phoneNumber: '',
          address: '',
          facebook: '',
          emailAddress: '',
          businessName: '',
          taxNumber: '',
          businessAddress: '',
          businessContactNumber: '',
          customerStatus: 'Active',
        },
      });
      const shipment = await client.shipment.create({
        data: {
          shipmentCode: `RECON-${scenario.id.toUpperCase()}`,
          shipmentStatus: 'Delivered',
          dateDelivered: today,
        },
      });
      const product = await client.product.create({
        data: {
          product: 'Reconciliation Dress',
          productCode: shipment.shipmentCode,
          shipmentCode: shipment.shipmentCode,
          payment: 'Paid',
          paymentMethod: 'CASH',
          postingDate: today,
          unitPrice: 10,
          exchangeRates: 1,
          quantity: 100,
          grandTotal: 1000,
          cogs: 1000,
        },
      });
      await client.inventoryMovement.create({
        data: {
          productId: product.id,
          productCode: product.productCode,
          quantity: 100,
          fromBucket: 'opening_inventory',
          toBucket: 'sellable',
          movementSource: 'product',
        },
      });
      await client.price.create({
        data: {
          productId: product.id,
          productCode: product.productCode,
          lowerLimit: 100,
          upperLimit: 10000,
          currentPrice: 100000,
        },
      });
      if (scenario.ordinaryRefund) {
        await client.clothingInventoryTransitBuildEntry.create({
          data: {
            shipmentId: shipment.id,
            shipmentCode: shipment.shipmentCode,
            postingDate: new Date(today),
            amount: 1000,
            debitAccount: 'Inventory in Transit',
            creditAccount: 'Cash',
            idempotencyKey: `PRODUCT_TRANSIT_BUILD:${product.id}:GRAND_TOTAL`,
          },
        });
        await client.clothingInventoryReclassEntry.create({
          data: {
            productId: product.id,
            productCode: product.productCode,
            shipmentId: shipment.id,
            shipmentCode: shipment.shipmentCode,
            postingDate: new Date(today),
            amount: 1000,
            fromAccount: 'Inventory in Transit',
            toAccount: 'Stock on Hand',
            triggerStatus: 'Delivered',
            idempotencyKey: `RECON-OPENING-STOCK:${product.id}`,
          },
        });
      }
      const before = await reports(`${scenario.id}-opening`);
      const priorRefundAmount = scenario.priorRefundAmount ?? 0;
      let collected = 0;
      let paymentCount = 0;
      await page.goto(`${url}/clothing/operations/transactions`, {
        timeout: 120000,
      });
      await page
        .getByRole('textbox', { name: /^Search transactions by customer/ })
        .fill(customer.customerName);
      await page
        .getByRole('treegrid')
        .getByRole('row')
        .first()
        .getByRole('gridcell')
        .nth(1)
        .dblclick();
      let editor = page.getByRole('combobox');
      await editor.pressSequentially(customer.customerName);
      await page
        .getByRole('option', { name: customer.customerName, exact: true })
        .click();
      await expect
        .poll(() =>
          client.transaction.count({ where: { customerId: customer.id } })
        )
        .toBe(1);
      await page.reload();
      await page
        .getByRole('gridcell', { name: customer.customerName, exact: true })
        .click();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('F2');
      editor = page.getByRole('combobox');
      await editor.pressSequentially(product.productCode);
      await page
        .getByRole('option', { name: product.productCode, exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (
              await client.transaction.findFirstOrThrow({
                where: { customerId: customer.id },
              })
            ).productId
        )
        .toBe(product.id);
      await page
        .getByRole('gridcell', { name: product.productCode, exact: true })
        .click();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('F2');
      await page.keyboard.press('Control+A');
      await page.keyboard.type('1');
      await page.keyboard.press('Enter');
      await expect
        .poll(async () =>
          Number(
            (
              await client.transaction.findFirstOrThrow({
                where: { customerId: customer.id },
              })
            ).lineTotal
          )
        )
        .toBe(1000);
      const order = await client.transaction.findFirstOrThrow({
        where: { customerId: customer.id },
      });
      assert.equal(order.orderStatus, 'Warehouse');
      assert.equal(order.quantity, 1);
      assert.equal(
        await client.inventoryMovement.count({
          where: {
            sourceTransactionId: order.id,
            movementType: 'reserve',
            deletedAt: null,
          },
        }),
        1
      );
      checks.push(
        `${scenario.id}: created order through real Transactions grid; gross 1000, product identity and one reservation persisted`
      );
      if (scenario.id === 'C05') {
        await client.transaction.update({
          where: { id: order.id },
          data: { orderDate: '2026-10-01', invoiceDate: '2026-10-01' },
        });
      }
      for (const amount of scenario.payments) {
        const initial = paymentCount === 0;
        if (scenario.race && !initial) {
          const {
            verifyFinancialConcurrency,
          } = require('./helpers/clothing-reconciliation-atomicity.cjs');
          financialRequests.push(
            await verifyFinancialConcurrency({
              client,
              context,
              databaseUrl: env.DATABASE_URL,
              endpoint: `${url}/api/transactions/payments/bulk`,
              data: {
                payments: [
                  {
                    transactionId: order.id,
                    paymentDate: today,
                    amount,
                    method: 'Cash',
                    isReservation: false,
                  },
                ],
              },
              successStatus: 200,
              rejectedStatus: 400,
              phase: 'collection',
              checks,
            })
          );
        } else {
          await page
            .getByRole('button', { name: 'Record Payment', exact: true })
            .click();
          const dialog = page.getByRole('dialog', { name: 'Record Payments' });
          await dialog
            .getByRole('textbox', { name: 'Customer', exact: true })
            .fill(customer.customerName);
          await page
            .getByRole('option', { name: customer.customerName, exact: true })
            .click();
          const method = dialog.getByRole('textbox', {
            name: 'Method',
            exact: true,
          });
          if ((await method.inputValue()) !== 'Cash') {
            await method.click();
            await page
              .getByRole('option', { name: 'Cash', exact: true })
              .click();
          }
          await dialog
            .getByRole('checkbox', {
              name: 'Original Reservation Deposit',
              exact: true,
            })
            .setChecked(initial);
          if (initial)
            await dialog
              .getByText(`${scenario.rate}%`, { exact: true })
              .click();
          const paymentRow = dialog.getByRole('row').filter({
            has: page.getByRole('cell', {
              name: String(order.id),
              exact: true,
            }),
          });
          await paymentRow.getByRole('textbox').fill(String(amount));
          await dialog
            .getByRole('button', { name: 'Save and close', exact: true })
            .click();
          await page
            .getByRole('button', { name: 'Yes, save', exact: true })
            .click();
          await expect(dialog).toHaveCount(0);
        }
        collected += amount;
        paymentCount += 1;
        await expect
          .poll(() =>
            client.transactionPayment.count({
              where: { transactionId: order.id },
            })
          )
          .toBe(paymentCount);
        const saved = await client.transaction.findUniqueOrThrow({
          where: { id: order.id },
        });
        assert.equal(Number(saved.adjustment), collected);
        assert.equal(Number(saved.initialDepositAmount), scenario.payments[0]);
        assert.equal(Number(saved.initialDepositRate), scenario.rate);
        const afterPayment = await reports(
          `${scenario.id}-collection-${paymentCount}`
        );
        close(
          net(afterPayment.ledger.entries, 'Cash') -
            net(before.ledger.entries, 'Cash'),
          collected,
          `${scenario.id}: cash collected once`
        );
        const collectionRequest = financialRequests
          .filter((entry) =>
            entry.url.endsWith('/api/transactions/payments/bulk')
          )
          .at(-1);
        assert.ok(collectionRequest?.key);
        const collectionReplay = await context.request.post(
          collectionRequest.url,
          {
            headers: { 'Idempotency-Key': collectionRequest.key },
            data: collectionRequest.data,
          }
        );
        assert.equal(collectionReplay.status(), 200);
        const changedCollection = structuredClone(collectionRequest.data);
        changedCollection.payments[0].amount =
          Number(changedCollection.payments[0].amount) + 1;
        const collectionConflict = await context.request.post(
          collectionRequest.url,
          {
            headers: { 'Idempotency-Key': collectionRequest.key },
            data: changedCollection,
          }
        );
        assert.equal(collectionConflict.status(), 409);
        assert.equal(
          await client.transactionPayment.count({
            where: { transactionId: order.id },
          }),
          paymentCount
        );
        assert.deepEqual(
          await client.transaction.findUniqueOrThrow({
            where: { id: order.id },
          }),
          saved
        );
        assert.deepEqual(
          await reports(`${scenario.id}-collection-${paymentCount}-replayed`),
          afterPayment
        );
        checks.push(
          `${scenario.id}: payment UI saved ${amount}; paid ${saved.adjustment}; original deposit ${scenario.payments[0]} at ${scenario.rate}%; captured request replayed once and changed amount conflicts without report changes`
        );
      }
      if (scenario.beforeCancel) {
        await page.reload();
        await page
          .getByRole('textbox', { name: 'Search product code...', exact: true })
          .fill(product.productCode);
        await page
          .getByRole('gridcell', { name: product.productCode, exact: true })
          .click();
        for (let column = 2; column < 8; column += 1)
          await page.keyboard.press('ArrowRight');
        await page.keyboard.press('F2');
        const editor = page.getByRole('combobox');
        await editor.press('Control+A');
        await editor.pressSequentially(scenario.beforeCancel);
        await page
          .getByRole('option', { name: scenario.beforeCancel, exact: true })
          .click();
        await expect
          .poll(
            async () =>
              (
                await client.transaction.findUniqueOrThrow({
                  where: { id: order.id },
                })
              ).orderStatus
          )
          .toBe(scenario.beforeCancel);
        await expect
          .poll(() =>
            client.inventoryMovement.count({
              where: {
                sourceTransactionId: order.id,
                movementType: 'sale',
                deletedAt: null,
              },
            })
          )
          .toBe(1);
        const fulfilled = await reports(`${scenario.id}-fulfilled`);
        close(
          net(fulfilled.ledger.entries, 'Accounts Receivable') -
            net(before.ledger.entries, 'Accounts Receivable'),
          scenario.beforeCancel === 'Accounts Receivable' ? 800 : 0,
          `${scenario.id}: fulfilled receivable`
        );
      }
      if (scenario.id === 'C05') {
        const overdueCustomer = await client.customer.create({
          data: {
            customerName: 'Reconciliation overdue positive control',
            date: today,
            phoneNumber: '',
            address: '',
            facebook: '',
            emailAddress: '',
            businessName: '',
            taxNumber: '',
            businessAddress: '',
            businessContactNumber: '',
            customerStatus: 'Active',
          },
        });
        const overdueOrder = await client.transaction.create({
          data: {
            customerId: overdueCustomer.id,
            customers: overdueCustomer.customerName,
            productId: product.id,
            productCode: product.productCode,
            shipmentCode: shipment.shipmentCode,
            orderDate: '2026-10-01',
            invoiceDate: '2026-10-01',
            orderStatus: 'Prepared',
            quantity: 1,
            unitPrice: 1000,
            lineTotal: 1000,
            adjustment: 0,
          },
        });
        try {
          await page.goto(`${url}/clothing/operations/transactions`, {
            timeout: 120000,
          });
          await page
            .getByRole('tab', { name: 'Due Dates', exact: true })
            .click();
          const dueDates = page.getByRole('tabpanel', {
            name: 'Due Dates',
            exact: true,
          });
          await expect(
            dueDates.getByText(overdueCustomer.customerName, { exact: true })
          ).toBeVisible();
          await expect(
            dueDates.getByText(customer.customerName, { exact: true })
          ).toHaveCount(0);
          const paidOrder = await client.transaction.findUniqueOrThrow({
            where: { id: order.id },
          });
          assert.equal(paidOrder.orderStatus, 'Prepared');
          assert.equal(Number(paidOrder.adjustment), 1000);
          assert.equal(Number(paidOrder.lineTotal), 0);
          assert.equal(
            await client.clothingOrderCancellation.count({
              where: { transactionId: order.id },
            }),
            0
          );
          await page.screenshot({
            path: path.join(artifacts, 'C05-paid-not-overdue.png'),
            fullPage: true,
          });
          checks.push(
            'C05: actual Due Dates shows unpaid old-invoice control but excludes fully paid Prepared order; no automatic cancellation, original receipts retained'
          );
        } finally {
          await client.transaction.delete({ where: { id: overdueOrder.id } });
          await client.customer.delete({ where: { id: overdueCustomer.id } });
        }
        await page.goto(`${url}/clothing/operations/transactions`, {
          timeout: 120000,
        });
      }
      if (scenario.ordinaryRefund) {
        if (scenario.id === 'C10') {
          const reviewUrl = `${url}/api/transactions/${order.id}/cancellation`;
          const rejection = async (pattern) => {
            const response = await context.request.post(reviewUrl, {
              headers: { 'Idempotency-Key': randomUUID() },
              data: {
                kind: 'CANCELLED',
                mode: 'RETAIN_DEPOSIT',
                reason: 'Legacy money requires review',
              },
            });
            assert.equal(response.status(), 409);
            assert.match(await response.text(), pattern);
            assert.equal(
              await client.clothingOrderCancellation.count({
                where: { transactionId: order.id },
              }),
              0
            );
          };
          await client.transaction.update({
            where: { id: order.id },
            data: { initialDepositAmount: null, initialDepositRate: null },
          });
          try {
            await rejection(/confirm the original deposit agreement/);
          } finally {
            await client.transaction.update({
              where: { id: order.id },
              data: { initialDepositAmount: 200, initialDepositRate: 20 },
            });
          }
          await client.transaction.update({
            where: { id: order.id },
            data: { adjustment: 1001 },
          });
          try {
            const preview = await context.request.get(reviewUrl);
            assert.equal((await preview.json()).data.reviewRequired, true);
            await rejection(/legacy paid amount is not explained/);
          } finally {
            await client.transaction.update({
              where: { id: order.id },
              data: { adjustment: 1000 },
            });
          }
          assert.equal(
            await client.transactionPayment.count({
              where: { transactionId: order.id },
            }),
            2
          );
          checks.push(
            'C10: unknown original deposit and unexplained legacy paid balance reject with explicit review; no cancellation or payment history lost'
          );
        }
        await page.goto(`${url}/clothing/operations/customers/${customer.id}`, {
          timeout: 120000,
        });
        await page.getByRole('tab', { name: /Return\/Refund/ }).click();
        await page
          .getByRole('button', { name: 'Record Refund', exact: true })
          .click();
        const refundDialog = page.getByRole('dialog', {
          name: /^record refund$/i,
        });
        await refundDialog
          .getByRole('textbox', { name: 'Transaction', exact: true })
          .click();
        await page
          .getByRole('option', { name: new RegExp(`#${order.id}\\b`) })
          .click();
        const refundAmount = priorRefundAmount || 100;
        await refundDialog
          .getByRole('textbox', { name: 'Refund Amount', exact: true })
          .fill(String(refundAmount));
        if (scenario.bucket) {
          await refundDialog
            .getByRole('textbox', {
              name: 'Returned Quantity (optional)',
              exact: true,
            })
            .fill('1');
          await refundDialog
            .getByRole('textbox', {
              name: 'Restock Bucket (optional)',
              exact: true,
            })
            .click();
          await page
            .getByRole('option', { name: scenario.bucket, exact: true })
            .click();
        }
        await refundDialog
          .getByRole('button', { name: 'Save Refund', exact: true })
          .click();
        await expect(refundDialog).toHaveCount(0);
        await page.reload();
        const refund = await client.transactionRefund.findFirstOrThrow({
          where: { transactionId: order.id },
        });
        close(
          Number(refund.amount),
          refundAmount,
          `${scenario.id}: actual refund`
        );
        assert.equal(refund.returnedQuantity, scenario.bucket ? 1 : null);
        assert.equal(refund.restockBucket, scenario.bucket);
        const movements = await client.inventoryMovement.findMany({
          where: { productCode: product.productCode, deletedAt: null },
        });
        const returns = movements.filter(
          (movement) => movement.movementType === 'return'
        );
        assert.equal(returns.length, scenario.bucket ? 1 : 0);
        if (scenario.bucket) {
          assert.equal(returns[0].fromBucket, 'sold');
          assert.equal(returns[0].toBucket, scenario.bucket);
          assert.equal(returns[0].sourceTransactionId, order.id);
          close(
            Number(returns[0].unitCost),
            10,
            `${scenario.id}: original sold-cost snapshot`
          );
        }
        assert.equal(
          movements.filter((movement) => movement.movementType === 'sale')
            .length,
          1
        );
        const remainingSellable = movements.reduce(
          (sum, movement) =>
            sum +
            (movement.toBucket === 'sellable' ? movement.quantity : 0) -
            (movement.fromBucket === 'sellable' ? movement.quantity : 0),
          0
        );
        close(
          remainingSellable,
          scenario.bucket === 'sellable' ? 100 : 99,
          `${scenario.id}: selected physical bucket only`
        );
        const refunded = await reports(`${scenario.id}-refunded`);
        close(
          net(refunded.ledger.entries, 'Cash') -
            net(before.ledger.entries, 'Cash'),
          1000 - refundAmount,
          `${scenario.id}: collected less actual refund`
        );
        close(
          refunded.profit.stats.revenueTotal - before.profit.stats.revenueTotal,
          1000 - refundAmount,
          `${scenario.id}: net revenue`
        );
        close(
          net(refunded.ledger.entries, 'Stock on Hand') -
            net(before.ledger.entries, 'Stock on Hand'),
          ['sellable', 'damaged_hold'].includes(scenario.bucket) ? 0 : -10,
          `${scenario.id}: owned stock carrying cost`
        );
        close(
          refunded.profit.stats.cogsTotal - before.profit.stats.cogsTotal,
          ['sellable', 'damaged_hold'].includes(scenario.bucket) ? 0 : 10,
          `${scenario.id}: returned cost is not duplicated or guessed`
        );
        assert.equal(
          await client.clothingOrderCancellation.count({
            where: { transactionId: order.id },
          }),
          0
        );
        await page.screenshot({
          path: path.join(artifacts, `${scenario.id}-complete.png`),
          fullPage: true,
        });
        checks.push(
          `${scenario.id}: real Customer refund paid ${refundAmount}; ${scenario.bucket ?? 'no physical return'}; original receipt/sale preserved, bucket quantity and cost snapshot/report bridge verified`
        );
        if (!scenario.continueAfterRefund) continue;
        const insufficient = await context.request.post(
          `${url}/api/transactions/${order.id}/cancellation`,
          {
            headers: { 'Idempotency-Key': randomUUID() },
            data: {
              kind: 'CANCELLED',
              mode: 'RETAIN_DEPOSIT',
              reason: 'Cannot retain more than remaining money',
            },
          }
        );
        assert.equal(insufficient.status(), 409);
        assert.match(
          await insufficient.text(),
          /Earlier refunds leave less than the original deposit/
        );
        assert.deepEqual(
          await reports('C10-insufficient-retention-rejected'),
          refunded
        );
        checks.push(
          'C10: earlier refund 900 leaves only 100; retaining original deposit 200 rejects without rewriting history or reports'
        );
        await page.goto(`${url}/clothing/operations/transactions`, {
          timeout: 120000,
        });
      }
      if (scenario.id === 'C06') {
        const rejected = await context.request.post(
          `${url}/api/transactions/${order.id}/cancellation`,
          {
            headers: { 'Idempotency-Key': randomUUID() },
            data: {
              kind: 'VOIDED',
              mode: 'RETAIN_DEPOSIT',
              reason: 'Invalid supplier-void retention attempt',
            },
          }
        );
        assert.equal(rejected.status(), 400);
        assert.match(
          await rejected.text(),
          /cannot retain the customer deposit/
        );
        assert.equal(
          await client.clothingOrderCancellation.count({
            where: { transactionId: order.id },
          }),
          0
        );
        checks.push(
          'C06: real authenticated API rejects retaining a deposit on supplier-failure Voided before the valid UI approval'
        );
      }
      if (scenario.id === 'C02-C03') {
        const {
          verifyFinancialRollback,
        } = require('./helpers/clothing-reconciliation-atomicity.cjs');
        await verifyFinancialRollback({
          client,
          context,
          endpoint: `${url}/api/transactions/payments/bulk`,
          data: {
            payments: [
              {
                transactionId: order.id,
                paymentDate: today,
                amount: 1,
                method: 'Cash',
                isReservation: false,
              },
            ],
          },
          phase: 'collection',
          reports,
          checks,
        });
        await verifyFinancialRollback({
          client,
          context,
          endpoint: `${url}/api/transactions/${order.id}/cancellation`,
          data: {
            kind: 'CANCELLED',
            mode: 'RETAIN_DEPOSIT',
            reason: 'Injected cancellation failure',
          },
          phase: 'cancellation',
          reports,
          checks,
        });
      }
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Record Payment', exact: true })
      ).toBeVisible();
      if (scenario.continueAfterRefund || scenario.beforeCancel === 'Shipped') {
        await page
          .getByRole('tabpanel', { name: 'Main Transactions', exact: true })
          .getByText('Show More', { exact: true })
          .click();
        await page
          .getByText('Shipped', { exact: true })
          .filter({ visible: true })
          .click();
        await page.keyboard.press('Escape');
      }
      await page
        .getByRole('textbox', { name: 'Search product code...', exact: true })
        .fill(product.productCode);
      await page
        .getByRole('gridcell', { name: product.productCode, exact: true })
        .click();
      for (let column = 2; column < 8; column += 1)
        await page.keyboard.press('ArrowRight');
      await page.keyboard.press('F2');
      const statusEditor = page.getByRole('combobox');
      await statusEditor.press('Control+A');
      await statusEditor.pressSequentially(scenario.status);
      await page
        .getByRole('option', { name: scenario.status, exact: true })
        .click();
      if (collected > 0) {
        const cancellation = page.getByRole('dialog', {
          name:
            scenario.status === 'Voided'
              ? 'Supplier failure decision'
              : 'Cancellation decision',
        });
        if (scenario.status === 'Cancelled')
          await cancellation
            .getByRole('radio', {
              name: scenario.retained
                ? 'Keep the agreed original deposit'
                : 'Emergency full refund',
            })
            .check();
        else
          await expect(
            cancellation.getByRole('radio', {
              name: 'Keep the agreed original deposit',
            })
          ).toHaveCount(0);
        await cancellation
          .getByLabel('Decision reason', { exact: false })
          .fill('Customer cancellation approved in isolated reconciliation');
        await cancellation
          .getByRole('button', { name: 'Approve cancellation', exact: true })
          .click();
        await expect(cancellation).toHaveCount(0);
      }
      await expect
        .poll(() =>
          client.clothingOrderCancellation.count({
            where: { transactionId: order.id },
          })
        )
        .toBe(1);
      const decision = await client.clothingOrderCancellation.findUniqueOrThrow(
        { where: { transactionId: order.id } }
      );
      assert.equal(
        (
          await client.transaction.findUniqueOrThrow({
            where: { id: order.id },
          })
        ).orderStatus,
        scenario.status
      );
      assert.equal(
        await client.transactionStatusChange.count({
          where: { transactionId: order.id, newStatus: scenario.status },
        }),
        1
      );
      assert.equal(
        await client.transactionPayment.count({
          where: { transactionId: order.id, deletedAt: null },
        }),
        paymentCount
      );
      assert.equal(
        Number(decision.receivableCreditAmount),
        scenario.beforeCancel === 'Accounts Receivable' ? 800 : 0
      );
      assert.equal(Number(decision.retainedAmount), scenario.retained);
      assert.equal(
        Number(decision.pendingAmount),
        collected - priorRefundAmount - scenario.retained
      );
      assert.equal(
        await client.transactionRefund.count({
          where: { transactionId: order.id },
        }),
        priorRefundAmount ? 1 : 0
      );
      const approval = await reports(`${scenario.id}-approval`);
      close(
        net(approval.ledger.entries, 'Accounts Receivable') -
          net(before.ledger.entries, 'Accounts Receivable'),
        0,
        `${scenario.id}: no unpaid receivable survives approved closure`
      );
      close(
        net(approval.ledger.entries, 'Cash') -
          net(before.ledger.entries, 'Cash'),
        collected - priorRefundAmount,
        `${scenario.id}: approval does not move cash`
      );
      close(
        net(approval.ledger.entries, 'Refunds Payable') -
          net(before.ledger.entries, 'Refunds Payable'),
        -(collected - priorRefundAmount - scenario.retained),
        `${scenario.id}: refund liability`
      );
      close(
        approval.profit.stats.revenueTotal - before.profit.stats.revenueTotal,
        scenario.retained,
        `${scenario.id}: only retained deposit remains income`
      );
      const cancellationRequest = financialRequests
        .filter((entry) =>
          entry.url.endsWith(`/api/transactions/${order.id}/cancellation`)
        )
        .at(-1);
      assert.ok(cancellationRequest?.key);
      const cancellationReplay = await context.request.post(
        cancellationRequest.url,
        {
          headers: { 'Idempotency-Key': cancellationRequest.key },
          data: cancellationRequest.data,
        }
      );
      assert.equal(cancellationReplay.status(), 201);
      const cancellationConflict = await context.request.post(
        cancellationRequest.url,
        {
          headers: { 'Idempotency-Key': cancellationRequest.key },
          data: {
            ...cancellationRequest.data,
            reason: `${cancellationRequest.data.reason} changed`,
          },
        }
      );
      assert.equal(cancellationConflict.status(), 409);
      assert.deepEqual(
        await client.clothingOrderCancellation.findUniqueOrThrow({
          where: { transactionId: order.id },
        }),
        decision
      );
      assert.deepEqual(
        await reports(`${scenario.id}-approval-replayed`),
        approval
      );
      checks.push(
        `${scenario.id}: captured cancellation request replayed without duplicate decision; changed reason conflicts and all five reports remain unchanged`
      );
      if (scenario.id === 'C02-C03') {
        const {
          verifyRefundVisibility,
          verifyLedgerFilters,
          verifyExpenseReconciliation,
        } = require('./helpers/clothing-reconciliation-report-checks.cjs');
        await verifyRefundVisibility({
          page,
          context,
          url,
          today,
          customer,
          pending: 300,
          paid: 0,
          checks,
          artifacts,
        });
        await verifyLedgerFilters({
          page,
          context,
          client,
          url,
          today,
          checks,
          artifacts,
        });
        await verifyExpenseReconciliation({
          page,
          context,
          client,
          url,
          today,
          checks,
          artifacts,
          reports,
          net,
          findings,
        });
        assert.deepEqual(
          await reports('X05-owned-ledger-fixture-removed'),
          approval
        );
        const {
          verifyFinancialRollback,
        } = require('./helpers/clothing-reconciliation-atomicity.cjs');
        await verifyFinancialRollback({
          client,
          context,
          endpoint: `${url}/api/customers/${customer.id}/refunds/payout`,
          data: {
            cancellationId: decision.id,
            amount: 1,
            paymentDate: today,
            method: 'Cash',
          },
          phase: 'payout',
          reports,
          checks,
        });
      }
      const stock = await client.inventoryMovement.findMany({
        where: { productId: product.id, deletedAt: null },
      });
      close(
        stock
          .filter((movement) => movement.toBucket === 'reserved')
          .reduce((sum, movement) => sum + movement.quantity, 0) -
          stock
            .filter((movement) => movement.fromBucket === 'reserved')
            .reduce((sum, movement) => sum + movement.quantity, 0),
        0,
        `${scenario.id}: no remaining reservation`
      );
      assert.equal(
        stock.filter((movement) => movement.toBucket === 'sold').length,
        scenario.beforeCancel ? 1 : 0
      );
      close(
        stock
          .filter((movement) => movement.toBucket === 'sellable')
          .reduce((sum, movement) => sum + movement.quantity, 0) -
          stock
            .filter((movement) => movement.fromBucket === 'sellable')
            .reduce((sum, movement) => sum + movement.quantity, 0),
        scenario.beforeCancel ? 99 : 100,
        `${scenario.id}: cancellation preserves sold stock without invented goods return`
      );
      checks.push(
        `${scenario.id}: real ${scenario.status} UI retained ${scenario.retained}, approved ${collected - priorRefundAmount - scenario.retained}, no remaining reservation${scenario.beforeCancel ? ', sold unit preserved' : ''}; five reports agree and approval leaves cash unchanged`
      );
      if (scenario.id === 'C06')
        await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${url}/clothing/operations/customers/${customer.id}`, {
        timeout: 120000,
      });
      if (scenario.id === 'C06')
        await page
          .getByRole('button', { name: 'Collapse side panel', exact: true })
          .click();
      let paidRefund = 0;
      for (const amount of scenario.payouts) {
        paidRefund += amount;
        const remaining =
          collected - priorRefundAmount - scenario.retained - paidRefund;
        if (scenario.race && paidRefund === amount) {
          const {
            verifyFinancialConcurrency,
          } = require('./helpers/clothing-reconciliation-atomicity.cjs');
          financialRequests.push(
            await verifyFinancialConcurrency({
              client,
              context,
              databaseUrl: env.DATABASE_URL,
              endpoint: `${url}/api/customers/${customer.id}/refunds/payout`,
              data: {
                cancellationId: decision.id,
                paymentDate: today,
                amount,
                method: 'Cash',
              },
              successStatus: 201,
              rejectedStatus: 409,
              phase: 'payout',
              checks,
            })
          );
        } else {
          await page
            .getByRole('button', { name: 'Record payout', exact: true })
            .click();
          await page
            .getByLabel('Payout amount', { exact: false })
            .fill(String(amount));
          await page
            .getByLabel('Actual payment date', { exact: false })
            .fill(today);
          await page
            .getByRole('button', { name: 'Save actual payout', exact: true })
            .click();
          await expect(page.getByRole('dialog')).toHaveCount(0);
        }
        await expect
          .poll(async () =>
            Number(
              (
                await client.clothingOrderCancellation.findUniqueOrThrow({
                  where: { id: decision.id },
                })
              ).pendingAmount
            )
          )
          .toBe(remaining);
        await page.reload();
        const afterPayout = await reports(
          `${scenario.id}-payout-${paidRefund}`
        );
        close(
          net(afterPayout.ledger.entries, 'Cash') -
            net(before.ledger.entries, 'Cash'),
          collected - priorRefundAmount - paidRefund,
          `${scenario.id}: payout cash bridge`
        );
        close(
          net(afterPayout.ledger.entries, 'Refunds Payable') -
            net(before.ledger.entries, 'Refunds Payable'),
          -remaining,
          `${scenario.id}: remaining refund liability`
        );
        close(
          afterPayout.profit.stats.netProfit,
          approval.profit.stats.netProfit,
          `${scenario.id}: payout is not a second expense`
        );
        checks.push(
          `${scenario.id}: real Customers payout ${amount}; pending ${remaining} after reload; cash/liability/P&L bridges agree`
        );
        if (scenario.id === 'C02-C03') {
          const {
            verifyRefundVisibility,
          } = require('./helpers/clothing-reconciliation-report-checks.cjs');
          await verifyRefundVisibility({
            page,
            context,
            url,
            today,
            customer,
            pending: remaining,
            paid: paidRefund,
            checks,
            artifacts,
          });
          await page.goto(
            `${url}/clothing/operations/customers/${customer.id}`,
            { timeout: 120000 }
          );
        }
      }
      assert.equal(
        await client.clothingRefundPayout.count({
          where: { cancellationId: decision.id },
        }),
        scenario.payouts.length
      );
      const refunds = await client.transactionRefund.findMany({
        where: { transactionId: order.id },
      });
      assert.equal(
        refunds.reduce((sum, refund) => sum + Number(refund.amount), 0),
        collected - scenario.retained
      );
      await page.screenshot({
        path: path.join(artifacts, `${scenario.id}-customer-complete.png`),
        fullPage: true,
      });
      if (scenario.id === 'C06') {
        checks.push(
          'C06: both actual supplier-void payouts completed at a 390px mobile viewport'
        );
        await page.setViewportSize({ width: 1440, height: 1100 });
      }
      if (scenario.payouts.length) {
        const request = financialRequests
          .filter((entry) =>
            entry.url.endsWith(`/api/customers/${customer.id}/refunds/payout`)
          )
          .at(-1);
        assert.ok(request?.key);
        const financialBefore = await reports(
          `${scenario.id}-before-replay-controls`
        );
        const replay = await context.request.post(request.url, {
          headers: { 'Idempotency-Key': request.key },
          data: request.data,
        });
        assert.equal(replay.status(), 201);
        const conflict = await context.request.post(request.url, {
          headers: { 'Idempotency-Key': request.key },
          data: { ...request.data, amount: Number(request.data.amount) + 1 },
        });
        assert.equal(conflict.status(), 409);
        const excess = await context.request.post(request.url, {
          headers: { 'Idempotency-Key': randomUUID() },
          data: { ...request.data, amount: 1 },
        });
        assert.equal(excess.status(), 409);
        const removed = await context.request.delete(
          `${url}/api/transactions/${order.id}`
        );
        assert.equal(
          removed.ok(),
          false,
          `${scenario.id}: closed order deletion must be rejected`
        );
        assert.equal(removed.status(), 409);
        const collection = await context.request.post(
          `${url}/api/customers/${customer.id}/payments`,
          {
            headers: { 'Idempotency-Key': randomUUID() },
            data: {
              transactionId: order.id,
              paymentDate: today,
              amount: 1,
              method: 'Cash',
            },
          }
        );
        assert.equal(collection.status(), 400);
        assert.match(await collection.text(), /closed|cancelled|voided/i);
        const financialEdit = await context.request.patch(
          `${url}/api/transactions`,
          { data: { id: order.id, Quantity: 2 } }
        );
        assert.equal(financialEdit.status(), 400);
        assert.match(await financialEdit.text(), /closed order/);
        const bulkEdit = await context.request.put(`${url}/api/transactions`, {
          data: [{ id: order.id, Quantity: 2 }],
        });
        assert.equal(bulkEdit.status(), 400);
        assert.match(await bulkEdit.text(), /closed order/);
        const reopen = await context.request.patch(`${url}/api/transactions`, {
          data: { id: order.id, 'Order Status': 'Warehouse' },
        });
        assert.equal(reopen.status(), 400);
        assert.match(await reopen.text(), /closed order/);
        assert.equal(
          (
            await context.request.put(
              `${url}/api/transactions/${order.id}?action=restore`
            )
          ).status(),
          400
        );
        const beforeImport = await client.transaction.count();
        const imported = await context.request.post(`${url}/api/transactions`, {
          data: [
            {
              'Order Date': today,
              Customers: customer.customerName,
              'Product Code': product.productCode,
              Quantity: 1,
              'Unit Price': 1000,
              Adjustment: collected,
              'Order Status': scenario.status,
            },
          ],
        });
        assert.equal(imported.status(), 400);
        assert.equal(await client.transaction.count(), beforeImport);
        assert.equal(
          await client.transactionPayment.count({
            where: { transactionId: order.id, deletedAt: null },
          }),
          paymentCount
        );
        assert.equal(
          (
            await client.transaction.findUniqueOrThrow({
              where: { id: order.id },
            })
          ).deletedAt,
          null
        );
        assert.equal(
          await client.clothingRefundPayout.count({
            where: { cancellationId: decision.id },
          }),
          scenario.payouts.length
        );
        assert.equal(
          await client.transactionRefund.count({
            where: { transactionId: order.id },
          }),
          scenario.payouts.length + (priorRefundAmount ? 1 : 0)
        );
        assert.deepEqual(
          await reports(`${scenario.id}-after-replay-controls`),
          financialBefore
        );
        checks.push(
          `${scenario.id}: authenticated HTTP payout replay is idempotent; conflict, excess payout, new collection, single/bulk financial edits, reopening, deletion/restoration and paid closed-status import rejected without changing five reports`
        );
        if (scenario.id === 'C02-C03') {
          const {
            snapshot,
          } = require('./helpers/clothing-reconciliation-atomicity.cjs');
          const original = await snapshot(client);
          const originalOrder = original.transaction.find(
            (transaction) => transaction.id === order.id
          );
          await client.transaction.update({
            where: { id: order.id },
            data: { deletedAt: new Date() },
          });
          try {
            const deleted = await snapshot(client);
            const deletedReports = await reports(
              'C12-legacy-deleted-before-restore'
            );
            for (let attempt = 0; attempt < 2; attempt += 1) {
              const restore = await context.request.put(
                `${url}/api/transactions/${order.id}?action=restore`
              );
              assert.equal(
                restore.status(),
                404,
                'C12: historically deleted financial row fails closed through the live restore route'
              );
              assert.deepEqual(
                await snapshot(client),
                deleted,
                'C12: restoration does not rewrite receipts, approvals, payouts or inventory'
              );
              assert.deepEqual(
                await reports(`C12-legacy-deleted-after-restore-${attempt}`),
                deletedReports
              );
            }
          } finally {
            await client.transaction.update({
              where: { id: order.id },
              data: {
                deletedAt: originalOrder.deletedAt,
                updatedAt: originalOrder.updatedAt,
              },
            });
          }
          assert.deepEqual(
            await snapshot(client),
            original,
            'C12: only the owned historical-deletion marker was reversed'
          );
          assert.deepEqual(
            await reports('C12-owned-marker-removed'),
            financialBefore
          );
          checks.push(
            'C12: repeated restore of an owned historically deleted paid/cancelled order returns 404; complete receipts, approval, payout, inventory and report snapshots unchanged; only synthetic deletion marker removed; no historical recovery workflow is certified'
          );
        }
      }
      if (scenario.beforeCancel) {
        const returned = await context.request.post(
          `${url}/api/customers/${customer.id}/refunds`,
          {
            data: {
              transactionId: order.id,
              refundDate: today,
              amount: 1,
              returnedQuantity: 1,
              restockBucket: 'sellable',
              reason: 'Physical return after cancellation',
            },
          }
        );
        assert.equal(returned.status(), 400);
        assert.match(await returned.text(), /approved cancellation/);
        checks.push(
          `${scenario.id}: generic monetary refund after approved cancellation rejects without replacing the approved payout path`
        );
        if (scenario.id.startsWith('C08')) {
          const {
            runCancellationReturn,
          } = require('./helpers/clothing-reconciliation-scenarios.cjs');
          await runCancellationReturn({
            page,
            client,
            context,
            databaseUrl: env.DATABASE_URL,
            url,
            today,
            product,
            customer,
            order,
            reports,
            net,
            close,
            checks,
            artifacts,
            stage: scenario.id,
          });
        }
      }
      console.log(
        `${scenario.id}: financial UI sequence and five-report checks passed`
      );
    }
    if (
      process.argv.includes('--cancel-returns-only') ||
      process.argv.includes('--returns-only') ||
      process.argv.includes('--review-only') ||
      process.argv.includes('--paid-overdue-only') ||
      process.argv.includes('--reminders-only') ||
      process.argv.includes('--concurrency-only')
    ) {
      await context.tracing.stop({ path: path.join(artifacts, 'trace.zip') });
      return;
    }
    const sourceShipment = await client.shipment.create({
      data: { shipmentCode: 'RECON-SUPPLIER', shipmentStatus: 'In Transit' },
    });
    const source = await client.product.create({
      data: {
        product: 'Missing Supplier Purchase',
        productCode: 'RECON-SUPPLIER',
        shipmentCode: sourceShipment.shipmentCode,
        supplierReference: 'Recorded Supplier',
        postingDate: today,
        payment: 'Paid',
        paymentMethod: 'CASH',
        quantity: 100,
        unitPrice: 50,
        exchangeRates: 1,
        grandTotal: 5000,
        cogs: 5000,
      },
    });
    await client.inventoryMovement.create({
      data: {
        productId: source.id,
        productCode: source.productCode,
        quantity: 100,
        fromBucket: 'opening_inventory',
        toBucket: 'sellable',
        movementSource: 'product',
        notes: `Receipt for product #${source.id}`,
      },
    });
    await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
    await page
      .getByPlaceholder('Search products by code, name, shipment code...')
      .fill(source.productCode);
    await page
      .getByRole('gridcell', { name: sourceShipment.shipmentCode, exact: true })
      .first()
      .click();
    await page
      .getByRole('button', { name: 'Transit Build-Up', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Post Transit Build-Up', exact: true })
      .click();
    await expect
      .poll(() =>
        client.clothingInventoryTransitBuildEntry.count({
          where: {
            idempotencyKey: {
              startsWith: `PRODUCT_TRANSIT_BUILD:${source.id}:`,
            },
          },
        })
      )
      .toBe(1);
    const beforeTransferFunding =
      await client.clothingInventoryTransitBuildEntry.findMany({
        where: {
          idempotencyKey: { startsWith: `PRODUCT_TRANSIT_BUILD:${source.id}:` },
        },
      });
    const beforeTransferReports = await reports('I05-before-transfer');
    const destinationShipment = await client.shipment.create({
      data: { shipmentCode: 'RECON-TRANSFER', shipmentStatus: 'In Transit' },
    });
    await page.reload();
    await page
      .getByPlaceholder('Search products by code, name, shipment code...')
      .fill(source.productCode);
    await page
      .getByRole('gridcell', { name: sourceShipment.shipmentCode, exact: true })
      .first()
      .click();
    for (let column = 0; column < 10; column += 1)
      await page.keyboard.press('ArrowRight');
    await page
      .getByRole('gridcell', { name: source.productCode, exact: true })
      .last()
      .dblclick();
    let productDialog = page.getByRole('dialog', { name: /^edit product$/i });
    await productDialog
      .getByRole('textbox', { name: 'Supplier resolution', exact: true })
      .click();
    await page
      .getByRole('option', { name: 'Transfer delayed product', exact: true })
      .click();
    await productDialog
      .getByLabel('Destination shipment code', { exact: true })
      .fill(destinationShipment.shipmentCode);
    await productDialog
      .getByLabel('Transfer reason', { exact: true })
      .fill('Supplier moved the entire delayed purchase');
    await productDialog
      .getByRole('button', { name: 'Transfer Product', exact: true })
      .click();
    const transferSaved = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/api/products/${source.id}/supplier-resolution`) &&
        response.request().method() === 'POST'
    );
    await page
      .getByRole('dialog', { name: 'Transfer Delayed Product', exact: true })
      .getByRole('button', { name: 'Transfer Product', exact: true })
      .click();
    assert.equal((await transferSaved).status(), 200);
    const transferred = await client.product.findUniqueOrThrow({
      where: { id: source.id },
    });
    assert.equal(transferred.shipmentCode, destinationShipment.shipmentCode);
    for (const field of [
      'quantity',
      'grandTotal',
      'postingDate',
      'payment',
      'paymentMethod',
      'productCode',
    ])
      assert.equal(transferred[field], source[field]);
    const transfers = await client.clothingProductShipmentTransfer.findMany({
      where: { productId: source.id },
    });
    assert.equal(transfers.length, 1);
    assert.equal(transfers[0].fromShipmentCode, sourceShipment.shipmentCode);
    assert.equal(transfers[0].toShipmentCode, destinationShipment.shipmentCode);
    const afterTransferFunding =
      await client.clothingInventoryTransitBuildEntry.findMany({
        where: {
          idempotencyKey: { startsWith: `PRODUCT_TRANSIT_BUILD:${source.id}:` },
        },
      });
    const fundingIdentity = (entries) =>
      entries.map((entry) => ({
        id: entry.id,
        key: entry.idempotencyKey,
        amount: String(entry.amount),
        date: entry.postingDate,
        account: entry.creditAccount,
      }));
    assert.deepEqual(
      fundingIdentity(afterTransferFunding),
      fundingIdentity(beforeTransferFunding)
    );
    assert.ok(
      afterTransferFunding.every(
        (entry) => entry.shipmentCode === destinationShipment.shipmentCode
      )
    );
    const afterTransferReports = await reports('I05-after-transfer');
    for (const account of ['Cash', 'Inventory in Transit', 'Accounts Payable'])
      close(
        net(afterTransferReports.ledger.entries, account),
        net(beforeTransferReports.ledger.entries, account),
        `I05: unchanged ${account}`
      );
    checks.push(
      'I05: actual Products Transit Build-Up then delayed-product transfer preserves quantity, amount, date, funding and report balances; one transfer audit links both shipments'
    );
    await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
    await page
      .getByPlaceholder('Search products by code, name, shipment code...')
      .fill(source.productCode);
    await page
      .getByRole('gridcell', {
        name: destinationShipment.shipmentCode,
        exact: true,
      })
      .first()
      .click();
    for (let column = 0; column < 10; column += 1)
      await page.keyboard.press('ArrowRight');
    await page
      .getByRole('gridcell', { name: source.productCode, exact: true })
      .last()
      .dblclick();
    productDialog = page.getByRole('dialog', { name: /^edit product$/i });
    await productDialog
      .getByRole('textbox', { name: 'Supplier resolution', exact: true })
      .click();
    await page
      .getByRole('option', { name: 'Record supplier credit', exact: true })
      .click();
    await productDialog
      .getByLabel('Supplier credit reference', { exact: true })
      .fill('RECON-CREDIT-5000');
    await productDialog
      .getByRole('button', { name: 'Record Supplier Credit', exact: true })
      .click();
    const issueSaved = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/api/products/${source.id}/supplier-resolution`) &&
        response.request().method() === 'POST'
    );
    await page
      .getByRole('dialog', {
        name: 'Confirm Supplier Nonfulfillment',
        exact: true,
      })
      .getByRole('button', { name: 'Record Supplier Credit', exact: true })
      .click();
    const issueResponse = await issueSaved;
    assert.ok(
      issueResponse.ok(),
      `Issue credit: ${await issueResponse.text()}`
    );
    const issuedPayload = issueResponse.request().postDataJSON();
    assert.equal(
      (
        await context.request.post(issueResponse.url(), { data: issuedPayload })
      ).status(),
      200
    );
    assert.equal(
      (
        await context.request.post(issueResponse.url(), {
          data: { ...issuedPayload, reference: 'Conflicting reference' },
        })
      ).status(),
      409
    );
    checks.push(
      'X01 supplier slice: actual issue response replayed without duplication; changed reference conflicts'
    );
    await expect
      .poll(() =>
        client.clothingSupplierCredit.count({
          where: { sourceProductId: source.id },
        })
      )
      .toBe(1);
    let credit = await client.clothingSupplierCredit.findUniqueOrThrow({
      where: { sourceProductId: source.id },
    });
    assert.equal(Number(credit.amount), 5000);
    assert.equal(Number(credit.availableAmount), 5000);
    assert.equal(
      (await client.product.findUniqueOrThrow({ where: { id: source.id } }))
        .supplierFulfillmentStatus,
      'CREDIT_ISSUED'
    );
    const originalFunding =
      await client.clothingInventoryTransitBuildEntry.findMany({
        where: {
          idempotencyKey: { startsWith: `PRODUCT_TRANSIT_BUILD:${source.id}:` },
        },
      });
    assert.equal(originalFunding.length, 1);
    assert.equal(Number(originalFunding[0].amount), 5000);
    assert.equal(originalFunding[0].creditAccount, 'Cash');
    const sourceJournal = await client.clothingAccountingJournalLine.findMany({
      where: { sourceType: 'PRODUCT', sourceId: String(source.id) },
    });
    close(
      net(sourceJournal, 'Supplier Credits'),
      5000,
      'Supplier asset issued'
    );
    close(net(sourceJournal, 'Cash'), 0, 'Credit issue is not a cash refund');
    const issuedReport = await reports('I03-credit-issued');
    const invalidTarget = await client.product.create({
      data: {
        product: 'Invalid application guard fixture',
        productCode: 'RECON-CREDIT-GUARDS',
        shipmentCode: sourceShipment.shipmentCode,
        supplierReference: 'Recorded Supplier',
        postingDate: today,
        payment: 'Paid',
        paymentMethod: 'CASH',
        quantity: 100,
        grandTotal: 6000,
        cogs: 6000,
      },
    });
    const invalidApplication = {
      action: 'APPLY_CREDIT',
      requestId: randomUUID(),
      supplierReference: 'Recorded Supplier',
      creditId: credit.id,
      amount: 100,
      postingDate: today,
    };
    const applicationUrl = `${url}/api/products/${invalidTarget.id}/supplier-resolution`;
    const rejectedSupplier = await context.request.post(applicationUrl, {
      data: { ...invalidApplication, supplierReference: 'Wrong Supplier' },
    });
    assert.equal(rejectedSupplier.status(), 400);
    assert.match(await rejectedSupplier.text(), /same supplier/);
    await client.clothingSupplierCredit.update({
      where: { id: credit.id },
      data: { currency: 'USD' },
    });
    try {
      const rejectedCurrency = await context.request.post(applicationUrl, {
        data: invalidApplication,
      });
      assert.equal(rejectedCurrency.status(), 400);
      assert.match(await rejectedCurrency.text(), /PHP credit/);
    } finally {
      await client.clothingSupplierCredit.update({
        where: { id: credit.id },
        data: { currency: 'PHP' },
      });
    }
    const rejectedBalance = await context.request.post(applicationUrl, {
      data: { ...invalidApplication, amount: 5000.01 },
    });
    assert.equal(rejectedBalance.status(), 409);
    assert.match(await rejectedBalance.text(), /Insufficient available/);
    const rejectedSelf = await context.request.post(
      `${url}/api/products/${source.id}/supplier-resolution`,
      {
        data: invalidApplication,
      }
    );
    assert.equal(rejectedSelf.status(), 409);
    assert.match(
      await rejectedSelf.text(),
      /already been resolved|different purchase/
    );
    const existingBuild =
      await client.clothingInventoryTransitBuildEntry.create({
        data: {
          shipmentCode: sourceShipment.shipmentCode,
          postingDate: new Date(`${today}T00:00:00Z`),
          amount: 6000,
          debitAccount: 'Inventory in Transit',
          creditAccount: 'Cash',
          idempotencyKey: `PRODUCT_TRANSIT_BUILD:${invalidTarget.id}:GRAND_TOTAL`,
        },
      });
    try {
      const rejectedPosted = await context.request.post(applicationUrl, {
        data: invalidApplication,
      });
      assert.equal(rejectedPosted.status(), 409);
      assert.match(await rejectedPosted.text(), /before posting/);
      assert.equal(
        Number(
          (
            await client.clothingInventoryTransitBuildEntry.findUniqueOrThrow({
              where: { id: existingBuild.id },
            })
          ).amount
        ),
        6000
      );
    } finally {
      await client.$executeRaw`DELETE FROM public.clothing_inventory_transit_build_entries WHERE id = ${existingBuild.id}`;
    }
    assert.equal(
      Number(
        (
          await client.clothingSupplierCredit.findUniqueOrThrow({
            where: { id: credit.id },
          })
        ).availableAmount
      ),
      5000
    );
    assert.equal(
      await client.clothingSupplierCreditApplication.count({
        where: { targetProductId: invalidTarget.id },
      }),
      0
    );
    assert.equal(
      await client.clothingInventoryTransitBuildEntry.count({
        where: {
          idempotencyKey: {
            startsWith: `PRODUCT_TRANSIT_BUILD:${invalidTarget.id}:`,
          },
        },
      }),
      0
    );
    assert.deepEqual(await reports('I04-invalid-applications'), issuedReport);
    checks.push(
      'I04: authenticated wrong-supplier, foreign-currency, insufficient-balance, self-funding and already-posted application requests reject without consuming credit or changing reports'
    );
    const {
      verifyCreditRollback,
    } = require('./helpers/clothing-reconciliation-atomicity.cjs');
    await verifyCreditRollback({
      client,
      context,
      endpoint: applicationUrl,
      data: invalidApplication,
      reports,
      checks,
    });
    const guardedProduct = await client.product.findUniqueOrThrow({
      where: { id: invalidTarget.id },
    });
    for (const kind of ['sold', 'reclassified']) {
      const evidence =
        kind === 'sold'
          ? await client.inventoryMovement.create({
              data: {
                productId: invalidTarget.id,
                productCode: invalidTarget.productCode,
                quantity: 1,
                fromBucket: 'sellable',
                toBucket: 'sold',
                movementSource: 'transaction',
                movementType: 'sale',
                unitCost: 60,
              },
            })
          : await client.clothingInventoryReclassEntry.create({
              data: {
                productId: invalidTarget.id,
                productCode: invalidTarget.productCode,
                shipmentCode: sourceShipment.shipmentCode,
                postingDate: new Date(today),
                amount: 6000,
                fromAccount: 'Inventory in Transit',
                toAccount: 'Stock on Hand',
                triggerStatus: 'Delivered',
                idempotencyKey: `RECON-TRANSFER-GUARD:${invalidTarget.id}`,
              },
            });
      try {
        const beforeReject = await reports(`I05-${kind}-guard-opening`);
        const rejectedTransfer = await context.request.post(applicationUrl, {
          data: {
            action: 'TRANSFER',
            requestId: randomUUID(),
            shipmentCode: destinationShipment.shipmentCode,
            reason: `Reject ${kind} purchase transfer`,
          },
        });
        assert.equal(
          rejectedTransfer.status(),
          409,
          `I05: reject ${kind} transfer`
        );
        assert.match(
          await rejectedTransfer.text(),
          /separate accounting correction/
        );
        assert.deepEqual(
          await client.product.findUniqueOrThrow({
            where: { id: invalidTarget.id },
          }),
          guardedProduct
        );
        assert.equal(
          await client.clothingProductShipmentTransfer.count({
            where: { productId: invalidTarget.id },
          }),
          0
        );
        assert.deepEqual(
          await reports(`I05-${kind}-guard-rejected`),
          beforeReject
        );
      } finally {
        if (kind === 'sold')
          await client.inventoryMovement.delete({ where: { id: evidence.id } });
        else
          await client.clothingInventoryReclassEntry.delete({
            where: { id: evidence.id },
          });
      }
    }
    assert.deepEqual(await reports('I05-guard-fixtures-removed'), issuedReport);
    checks.push(
      'I05: real sold and reclassified product fixtures reject transfer with HTTP 409, unchanged product/audit and identical reports; only owned guard fixtures removed'
    );
    await page.goto(`${url}/clothing/operations/inventory`, {
      timeout: 120000,
    });
    await page
      .getByRole('textbox', { name: 'Sellable filter', exact: true })
      .click();
    await page
      .getByRole('option', { name: 'All Product Codes', exact: true })
      .click();
    const creditedStock = page.getByRole('row').filter({
      has: page
        .locator('td:first-child')
        .getByText(source.productCode, { exact: true }),
    });
    await expect(creditedStock.getByRole('cell').nth(7)).toHaveText('0');
    await page.screenshot({
      path: path.join(artifacts, 'I03-credit-zero-stock.png'),
      fullPage: true,
    });
    checks.push(
      'I03: real Edit Product issued full 5000 credit, Inventory shows zero actual stock, and original 5000 Cash-funded acquisition remains without a cash refund'
    );
    for (const [name, amount, remaining] of [
      ['Replacement First', 2000, 3000],
      ['Replacement Final', 3000, 0],
    ]) {
      await page.goto(`${url}/clothing/operations/products`, {
        timeout: 120000,
      });
      await page
        .getByRole('button', { name: 'Add Product', exact: true })
        .click();
      productDialog = page.getByRole('dialog', { name: /^add new product$/i });
      await productDialog
        .getByLabel('Shipment Code', { exact: true })
        .fill(sourceShipment.shipmentCode);
      await productDialog
        .getByRole('textbox', { name: 'Product Name', exact: false })
        .fill(name);
      await productDialog
        .getByRole('textbox', { name: 'Unit Price', exact: true })
        .fill('30');
      await productDialog
        .getByRole('textbox', { name: 'Quantity', exact: true })
        .fill('100');
      await productDialog
        .getByRole('textbox', { name: 'Exchange Rate', exact: true })
        .fill('1');
      await productDialog
        .getByRole('textbox', { name: 'Transaction Fee', exact: false })
        .click();
      await page.getByRole('option', { name: 'No', exact: true }).click();
      await productDialog
        .getByRole('textbox', { name: 'Payment', exact: true })
        .click();
      await page
        .getByRole('option', { name: /Paid/, exact: false })
        .filter({ hasText: /^.*Paid$/ })
        .first()
        .click();
      const method = productDialog.getByRole('textbox', {
        name: 'Payment Method',
        exact: true,
      });
      if ((await method.inputValue()) !== 'Cash') {
        await method.click();
        await page.getByRole('option', { name: 'Cash', exact: true }).click();
      }
      await productDialog
        .getByRole('textbox', { name: 'Supplier', exact: true })
        .fill('Recorded Supplier');
      await page.getByRole('option', { name: /^recorded supplier$/i }).click();
      if (name === 'Replacement First') {
        await productDialog
          .getByRole('textbox', {
            name: 'Available supplier credit',
            exact: true,
          })
          .click();
        await page.getByRole('option', { name: /RECON-CREDIT-5000/ }).click();
        await productDialog
          .getByLabel('Credit to apply (PHP)', { exact: true })
          .fill(String(amount));
      }
      await productDialog
        .getByRole('button', { name: 'Add Product', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Yes, save product', exact: true })
        .click();
      await expect(productDialog).toHaveCount(0);
      await page.setViewportSize({ width: 1440, height: 1100 });
      const target = await client.product.findFirstOrThrow({
        where: { product: name },
      });
      if (name === 'Replacement Final') {
        assert.equal(
          await client.clothingInventoryTransitBuildEntry.count({
            where: {
              idempotencyKey: {
                startsWith: `PRODUCT_TRANSIT_BUILD:${target.id}:`,
              },
            },
          }),
          0
        );
        await page.reload();
        await page
          .getByPlaceholder('Search products by code, name, shipment code...')
          .fill(target.productCode);
        await page
          .getByRole('gridcell', {
            name: sourceShipment.shipmentCode,
            exact: true,
          })
          .first()
          .click();
        for (let column = 0; column < 10; column += 1)
          await page.keyboard.press('ArrowRight');
        await page
          .getByRole('gridcell', { name: target.productCode, exact: true })
          .last()
          .dblclick();
        productDialog = page.getByRole('dialog', { name: /^edit product$/i });
        await productDialog
          .getByRole('textbox', { name: 'Supplier resolution', exact: true })
          .click();
        await page
          .getByRole('option', { name: 'Apply available credit', exact: true })
          .click();
        await productDialog
          .getByRole('textbox', {
            name: 'Available supplier credit',
            exact: true,
          })
          .click();
        await page.getByRole('option', { name: /RECON-CREDIT-5000/ }).click();
        await productDialog
          .getByLabel('Credit to apply (PHP)', { exact: true })
          .fill(String(amount));
        await page.setViewportSize({ width: 390, height: 844 });
        await productDialog
          .getByLabel('Credit to apply (PHP)', { exact: true })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(artifacts, 'I04-mobile-saved-credit-application.png'),
          fullPage: true,
        });
        await productDialog
          .getByRole('button', { name: 'Apply Credit', exact: true })
          .click();
        const applied = page.waitForResponse(
          (response) =>
            response
              .url()
              .endsWith(`/api/products/${target.id}/supplier-resolution`) &&
            response.request().method() === 'POST'
        );
        await page
          .getByRole('dialog', { name: 'Apply Supplier Credit', exact: true })
          .getByRole('button', { name: 'Apply Credit', exact: true })
          .click();
        const appliedResponse = await applied;
        assert.equal(appliedResponse.status(), 200);
        const appliedPayload = appliedResponse.request().postDataJSON();
        assert.equal(
          (
            await context.request.post(appliedResponse.url(), {
              data: appliedPayload,
            })
          ).status(),
          200
        );
        assert.equal(
          (
            await context.request.post(appliedResponse.url(), {
              data: { ...appliedPayload, amount: 1 },
            })
          ).status(),
          409
        );
        assert.equal(
          await client.clothingSupplierCreditApplication.count({
            where: { targetProductId: target.id },
          }),
          1
        );
        await page.setViewportSize({ width: 1440, height: 1100 });
        await page.goto(`${url}/clothing/operations/products`, {
          timeout: 120000,
        });
        checks.push(
          'I04: saved unposted replacement was reopened and credit applied through real Edit Product at mobile width'
        );
      }
      assert.equal(Number(target.grandTotal), 3000);
      credit = await client.clothingSupplierCredit.findUniqueOrThrow({
        where: { id: credit.id },
      });
      assert.equal(Number(credit.availableAmount), remaining);
      const builds = await client.clothingInventoryTransitBuildEntry.findMany({
        where: {
          idempotencyKey: { startsWith: `PRODUCT_TRANSIT_BUILD:${target.id}:` },
        },
      });
      close(
        builds.reduce((sum, entry) => sum + Number(entry.amount), 0),
        3000,
        `${name}: gross purchase funding`
      );
      close(
        builds
          .filter((entry) => entry.creditAccount === 'Supplier Credits')
          .reduce((sum, entry) => sum + Number(entry.amount), 0),
        amount,
        `${name}: supplier funding`
      );
      const appliedReport = await reports(`I03-${name.replaceAll(' ', '-')}`);
      close(
        net(appliedReport.ledger.entries, 'Supplier Credits'),
        remaining,
        `${name}: ledger available credit`
      );
      close(
        net(appliedReport.ledger.entries, 'Cash') -
          net(issuedReport.ledger.entries, 'Cash'),
        -1000,
        `${name}: only one 1000 funding remainder`
      );
      checks.push(
        `I03/I04: real Add Product saved ${name} at gross 3000, used ${amount}, remaining credit ${remaining}; five reports agree`
      );
      await page.reload();
    }
    assert.deepEqual(
      await client.clothingInventoryTransitBuildEntry.findMany({
        where: {
          idempotencyKey: { startsWith: `PRODUCT_TRANSIT_BUILD:${source.id}:` },
        },
      }),
      originalFunding
    );
    await page.screenshot({
      path: path.join(artifacts, 'supplier-credit-exhausted.png'),
      fullPage: true,
    });
    const raceOpening = await reports('X02-credit-race-opening');
    const raceSource = await client.product.create({
      data: {
        product: 'Credit race source',
        productCode: 'RECON-CREDIT-RACE-SOURCE',
        shipmentCode: sourceShipment.shipmentCode,
        supplierReference: 'Race Supplier',
        postingDate: today,
        payment: 'Paid',
        paymentMethod: 'CASH',
        quantity: 100,
        unitPrice: 10,
        exchangeRates: 1,
        grandTotal: 1000,
        cogs: 1000,
      },
    });
    const issuedRace = await context.request.post(
      `${url}/api/products/${raceSource.id}/supplier-resolution`,
      {
        data: {
          action: 'ISSUE_CREDIT',
          requestId: randomUUID(),
          supplierReference: 'Race Supplier',
          reference: 'RECON-CREDIT-RACE-1000',
          postingDate: today,
        },
      }
    );
    assert.equal(issuedRace.status(), 200);
    const raceCredit = (await issuedRace.json()).data;
    const raceTargets = [];
    for (const suffix of ['A', 'B'])
      raceTargets.push(
        await client.product.create({
          data: {
            product: `Race target ${suffix}`,
            productCode: `RECON-CREDIT-RACE-${suffix}`,
            shipmentCode: sourceShipment.shipmentCode,
            supplierReference: 'Race Supplier',
            postingDate: today,
            payment: 'Paid',
            paymentMethod: 'CASH',
            quantity: 100,
            unitPrice: 10,
            exchangeRates: 1,
            grandTotal: 1000,
            cogs: 1000,
          },
        })
      );
    const raceIds = [raceSource.id, ...raceTargets.map((target) => target.id)];
    try {
      const {
        verifyFinancialConcurrency,
      } = require('./helpers/clothing-reconciliation-atomicity.cjs');
      const winner = await verifyFinancialConcurrency({
        client,
        context,
        databaseUrl: env.DATABASE_URL,
        supplier: true,
        requests: raceTargets.map((target) => ({
          endpoint: `${url}/api/products/${target.id}/supplier-resolution`,
          data: {
            action: 'APPLY_CREDIT',
            requestId: randomUUID(),
            supplierReference: 'Race Supplier',
            creditId: raceCredit.id,
            amount: 600,
            postingDate: today,
          },
        })),
        successStatus: 200,
        rejectedStatus: 409,
        phase: 'supplier credit',
        checks,
      });
      const applications =
        await client.clothingSupplierCreditApplication.findMany({
          where: { creditId: raceCredit.id },
        });
      assert.equal(applications.length, 1);
      close(
        Number(
          (
            await client.clothingSupplierCredit.findUniqueOrThrow({
              where: { id: raceCredit.id },
            })
          ).availableAmount
        ),
        400,
        'X02: credit cannot be overspent'
      );
      const afterRace = await reports('X02-credit-raced');
      for (const target of raceTargets) {
        const builds = await client.clothingInventoryTransitBuildEntry.findMany(
          {
            where: {
              idempotencyKey: {
                startsWith: `PRODUCT_TRANSIT_BUILD:${target.id}:`,
              },
            },
          }
        );
        const used = target.id === applications[0].targetProductId;
        assert.equal(builds.length, used ? 2 : 0);
        close(
          builds.reduce((sum, build) => sum + Number(build.amount), 0),
          used ? 1000 : 0,
          'X02: only winner acquires funding'
        );
      }
      assert.equal(
        (
          await context.request.post(winner.url, { data: winner.data })
        ).status(),
        200
      );
      assert.equal(
        (
          await context.request.post(winner.loser.endpoint, {
            data: winner.loser.data,
          })
        ).status(),
        409
      );
      assert.deepEqual(await reports('X02-credit-replayed'), afterRace);
      checks.push(
        'X02 supplier: two 600 applications against 1000 credit leave one application, 400 available, one intact 1000 gross acquisition and no loser funding; winner replay/loser retry preserve reports'
      );
    } finally {
      await client.clothingSupplierCreditApplication.deleteMany({
        where: { creditId: raceCredit.id },
      });
      await client.clothingSupplierCredit.delete({
        where: { id: raceCredit.id },
      });
      await client.clothingAccountingJournalLine.deleteMany({
        where: { sourceType: 'PRODUCT', sourceId: String(raceSource.id) },
      });
      await client.clothingInventoryTransitBuildEntry.deleteMany({
        where: {
          OR: raceIds.map((id) => ({
            idempotencyKey: { startsWith: `PRODUCT_TRANSIT_BUILD:${id}:` },
          })),
        },
      });
      await client.inventoryMovement.deleteMany({
        where: { productId: { in: raceIds } },
      });
      await client.product.deleteMany({ where: { id: { in: raceIds } } });
    }
    assert.deepEqual(await reports('X02-credit-fixtures-removed'), raceOpening);
    const shortShipment = await client.shipment.create({
      data: {
        shipmentCode: 'RECON-SHORTAGE',
        shipmentStatus: 'Delivered',
        dateDelivered: today,
      },
    });
    const shortProduct = await client.product.create({
      data: {
        product: 'Partial Supplier Shortage',
        productCode: 'RECON-SHORTAGE',
        shipmentCode: shortShipment.shipmentCode,
        supplierReference: 'Short Supplier',
        postingDate: today,
        payment: 'Paid',
        paymentMethod: 'CASH',
        quantity: 1000,
        unitPrice: 10,
        exchangeRates: 1,
        grandTotal: 10000,
        cogs: 10000,
      },
    });
    await client.inventoryMovement.create({
      data: {
        productId: shortProduct.id,
        productCode: shortProduct.productCode,
        quantity: 1000,
        fromBucket: 'opening_inventory',
        toBucket: 'sellable',
        movementSource: 'product',
        notes: `Receipt for product #${shortProduct.id}`,
      },
    });
    const creditCount = await client.clothingSupplierCredit.count();
    await page.goto(`${url}/clothing/operations/inventory`, {
      timeout: 120000,
    });
    await page.getByRole('button', { name: 'Adjustment', exact: true }).click();
    let adjustment = page.getByRole('dialog', { name: /^adjustments$/i });
    await adjustment
      .getByRole('textbox', { name: 'Product Code', exact: false })
      .fill(shortProduct.productCode);
    await page
      .getByRole('option', { name: new RegExp(shortProduct.productCode) })
      .click();
    await adjustment
      .getByRole('textbox', { name: 'Supplier Short', exact: false })
      .fill('120');
    await adjustment
      .getByRole('button', { name: 'Save Adjustment', exact: true })
      .click();
    await expect(adjustment).toHaveCount(0);
    const shortage = await client.inventoryMovement.findFirstOrThrow({
      where: {
        productId: shortProduct.id,
        toBucket: 'supplier_short',
        deletedAt: null,
      },
    });
    assert.equal(shortage.quantity, 120);
    const stockRow = page.getByRole('row').filter({
      has: page.getByRole('cell', {
        name: shortProduct.productCode,
        exact: true,
      }),
    });
    await expect(stockRow.getByRole('cell').nth(7)).toHaveText('880');
    await page.getByRole('tab', { name: 'Adjustments', exact: true }).click();
    const shortageRow = page.getByRole('row').filter({
      has: page.getByRole('cell', {
        name: shortProduct.productCode,
        exact: true,
      }),
    });
    await shortageRow
      .getByRole('button', {
        name: 'Edit supplier short resolution',
        exact: true,
      })
      .click();
    adjustment = page.getByRole('dialog');
    await adjustment
      .getByRole('textbox', { name: 'Supplier short resolution', exact: true })
      .click();
    await page
      .getByRole('option', { name: 'Supplier credit received', exact: true })
      .click();
    await adjustment
      .getByLabel('Supplier credit reference', { exact: true })
      .fill('PARTIAL-CREDIT-5000');
    await adjustment
      .getByLabel('Supplier credit amount', { exact: true })
      .fill('5000');
    await expect(
      adjustment.getByText(
        'This records supplier follow-up only; it does not post an accounting entry.',
        { exact: true }
      )
    ).toBeVisible();
    await adjustment.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(adjustment).toHaveCount(0);
    await page.reload();
    const savedShortage = await client.inventoryMovement.findUniqueOrThrow({
      where: { id: shortage.id },
    });
    assert.equal(savedShortage.supplierShortResolution, 'CREDIT_RECEIVED');
    assert.equal(savedShortage.supplierCreditReference, 'PARTIAL-CREDIT-5000');
    assert.equal(Number(savedShortage.supplierCreditAmount), 5000);
    assert.equal(await client.clothingSupplierCredit.count(), creditCount);
    const shortReport = await reports('I02-follow-up-not-spendable');
    close(
      net(shortReport.ledger.entries, 'Supplier Credits'),
      0,
      'Follow-up does not create supplier-credit asset'
    );
    const partialTransfer = await context.request.post(
      `${url}/api/products/${shortProduct.id}/supplier-resolution`,
      {
        data: {
          action: 'TRANSFER',
          requestId: randomUUID(),
          shipmentCode: destinationShipment.shipmentCode,
          reason: 'Must not transfer partly received purchase',
        },
      }
    );
    assert.equal(
      partialTransfer.status(),
      409,
      'I05: partial-shortage purchase must not transfer as wholly unreceived'
    );
    assert.equal(
      (
        await client.product.findUniqueOrThrow({
          where: { id: shortProduct.id },
        })
      ).shipmentCode,
      shortShipment.shipmentCode
    );
    assert.equal(
      await client.clothingProductShipmentTransfer.count({
        where: { productId: shortProduct.id },
      }),
      0
    );
    assert.deepEqual(
      await reports('I05-partial-transfer-rejected'),
      shortReport
    );
    checks.push(
      'I05: partial-shortage transfer rejects without changing shipment, audit or reports'
    );
    await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
    await page
      .getByRole('button', { name: 'Add Product', exact: true })
      .click();
    productDialog = page.getByRole('dialog', { name: /^add new product$/i });
    await productDialog
      .getByRole('textbox', { name: 'Supplier', exact: true })
      .fill('Short Supplier');
    await page
      .getByRole('option', { name: 'Short Supplier', exact: true })
      .click();
    await productDialog
      .getByRole('textbox', { name: 'Available supplier credit', exact: true })
      .click();
    await expect(
      page.getByText('No available credits', { exact: true })
    ).toBeVisible();
    await page.screenshot({
      path: path.join(artifacts, 'partial-shortage-no-issued-credit.png'),
      fullPage: true,
    });
    checks.push(
      'I02: real Inventory adjustment persisted 120 short / 880 stock and 5000 follow-up; Add Product and ledger correctly contain no issued credit for that note; partial issuance remains unsupported'
    );
    const restricted = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      timezoneId: 'Asia/Manila',
    });
    try {
      const anonymous = await restricted.request.post(
        `${url}/api/products/${source.id}/supplier-resolution`,
        { data: issuedPayload, maxRedirects: 0 }
      );
      assert.equal(anonymous.status(), 401);
      const reportPaths = [
        'ledger',
        'journal',
        'profit-loss',
        'profit-loss/details',
        'balance-sheet',
      ];
      for (const reportPath of reportPaths) {
        assert.equal(
          (
            await restricted.request.get(
              `${url}/api/accounting/${reportPath}?from=2026-10-01&to=${today}&asOf=${today}`
            )
          ).status(),
          401
        );
      }
      const expenseRequests = [
        ['GET', '/api/expenses'],
        ['GET', '/api/expenses/1'],
        ['POST', '/api/expenses'],
        ['PUT', '/api/expenses'],
        ['PATCH', '/api/expenses'],
        ['DELETE', '/api/expenses'],
        ['DELETE', '/api/expenses/1'],
      ];
      for (const [method, endpoint] of expenseRequests) {
        const response = await restricted.request.fetch(`${url}${endpoint}`, {
          method,
          data: method === 'GET' ? undefined : {},
        });
        assert.equal(response.status(), 401, `Anonymous ${method} ${endpoint}`);
      }
      for (const [method, endpoint] of [
        ['POST', '/api/transactions'],
        ['PUT', '/api/transactions'],
        ['PATCH', '/api/transactions'],
        ['POST', '/api/transactions/payments/bulk'],
        ['POST', '/api/transactions/1/cancellation'],
        ['POST', '/api/customers/1/refunds/payout'],
        ['POST', '/api/inventory/movements'],
        ['POST', '/api/accounting/manual-journal'],
        ['PUT', '/api/accounting/manual-journal'],
        ['DELETE', '/api/accounting/manual-journal'],
      ]) {
        const response = await restricted.request.fetch(`${url}${endpoint}`, {
          method,
          data: {},
        });
        assert.equal(response.status(), 401, `Anonymous ${method} ${endpoint}`);
      }
      const ordinaryEmail = 'reconciliation-user@example.test';
      await client.user.create({
        data: {
          email: ordinaryEmail,
          password: await hash(password, 10),
          name: 'Reconciliation User',
          role: 'USER',
          isActive: true,
        },
      });
      const ordinaryPage = await restricted.newPage();
      const ordinarySession = ordinaryPage.waitForResponse((response) =>
        response.url().endsWith('/api/auth/session')
      );
      await ordinaryPage.goto(`${url}/login`, { timeout: 120000 });
      await ordinarySession;
      await ordinaryPage
        .getByLabel('Email', { exact: false })
        .fill(ordinaryEmail);
      await ordinaryPage
        .getByLabel('Password', { exact: false })
        .fill(password);
      const ordinaryLogin = ordinaryPage.waitForResponse((response) =>
        response.url().endsWith('/api/auth/callback/credentials')
      );
      await ordinaryPage
        .getByRole('button', { name: /sign in|log in/i })
        .click();
      assert.equal((await ordinaryLogin).status(), 200);
      await expect(ordinaryPage).not.toHaveURL(/\/login/, { timeout: 120000 });
      assert.equal(
        (await (await restricted.request.get(`${url}/api/auth/session`)).json())
          .user.role,
        'USER'
      );
      const denied = await restricted.request.post(
        `${url}/api/products/${source.id}/supplier-resolution`,
        { data: issuedPayload }
      );
      assert.equal(denied.status(), 403);
      assert.equal(
        (
          await restricted.request.get(`${url}/api/products/supplier-credits`)
        ).status(),
        403
      );
      for (const reportPath of reportPaths) {
        const response = await restricted.request.get(
          `${url}/api/accounting/${reportPath}?from=2026-10-01&to=${today}&asOf=${today}`
        );
        assert.equal(response.status(), 403, `USER accounting ${reportPath}`);
      }
      for (const method of ['POST', 'PUT', 'DELETE']) {
        const response = await restricted.request.fetch(
          `${url}/api/accounting/manual-journal`,
          { method, data: {} }
        );
        assert.equal(response.status(), 403, `USER manual journal ${method}`);
      }
      for (const [method, endpoint] of expenseRequests) {
        const response = await restricted.request.fetch(`${url}${endpoint}`, {
          method,
          data: method === 'GET' ? undefined : {},
        });
        assert.equal(response.status(), 403, `USER ${method} ${endpoint}`);
      }
      const {
        snapshot,
      } = require('./helpers/clothing-reconciliation-atomicity.cjs');
      const authCustomer = await client.customer.create({
        data: {
          customerName: 'Reconciliation USER permission fixture',
          date: today,
          phoneNumber: '',
          address: '',
          facebook: '',
          emailAddress: '',
          businessName: '',
          taxNumber: '',
          businessAddress: '',
          businessContactNumber: '',
          customerStatus: 'Active',
        },
      });
      const authOrder = await client.transaction.create({
        data: {
          customerId: authCustomer.id,
          customers: authCustomer.customerName,
          productId: shortProduct.id,
          productCode: shortProduct.productCode,
          shipmentCode: shortShipment.shipmentCode,
          orderDate: today,
          orderStatus: 'Warehouse',
          quantity: 1,
          unitPrice: 1000,
          adjustment: 200,
          lineTotal: 800,
          initialDepositAmount: 200,
          initialDepositRate: 20,
          payments: {
            create: {
              paymentDate: today,
              amount: 200,
              method: 'Cash',
              isReservation: true,
            },
          },
        },
      });
      const collectionData = {
        payments: [
          {
            transactionId: authOrder.id,
            paymentDate: today,
            amount: 300,
            method: 'Cash',
            isReservation: false,
          },
        ],
      };
      const collectionKey = randomUUID();
      const collection = await restricted.request.post(
        `${url}/api/transactions/payments/bulk`,
        { headers: { 'Idempotency-Key': collectionKey }, data: collectionData }
      );
      assert.equal(
        collection.status(),
        200,
        'X06: USER can collect on an open order'
      );
      assert.equal(
        Number(
          (
            await client.transaction.findUniqueOrThrow({
              where: { id: authOrder.id },
            })
          ).adjustment
        ),
        500
      );
      const beforeDeniedDecision = await snapshot(client);
      const beforeDeniedReports = await reports('X06-before-USER-decision');
      const decisionData = {
        kind: 'CANCELLED',
        mode: 'REFUND_ALL',
        reason: 'Permission boundary fixture',
      };
      const deniedDecision = await restricted.request.post(
        `${url}/api/transactions/${authOrder.id}/cancellation`,
        { headers: { 'Idempotency-Key': randomUUID() }, data: decisionData }
      );
      assert.equal(
        deniedDecision.status(),
        403,
        'X06: USER cannot decide money on a paid order'
      );
      assert.deepEqual(await snapshot(client), beforeDeniedDecision);
      assert.deepEqual(
        await reports('X06-after-USER-decision-denied'),
        beforeDeniedReports
      );
      const approved = await context.request.post(
        `${url}/api/transactions/${authOrder.id}/cancellation`,
        { headers: { 'Idempotency-Key': randomUUID() }, data: decisionData }
      );
      assert.equal(
        approved.status(),
        201,
        'X06: administrator can approve the eligible refund'
      );
      const authDecision =
        await client.clothingOrderCancellation.findUniqueOrThrow({
          where: { transactionId: authOrder.id },
        });
      assert.equal(Number(authDecision.pendingAmount), 500);
      const closed = await snapshot(client);
      const closedReports = await reports('X06-closed-before-USER-bulk');
      for (const [method, data] of [
        ['PUT', [{ id: authOrder.id, Quantity: 2 }]],
        ['PATCH', { id: authOrder.id, 'Order Status': 'Warehouse' }],
        [
          'POST',
          [
            {
              'Order Date': today,
              Customers: authCustomer.customerName,
              'Product Code': shortProduct.productCode,
              Quantity: 1,
              'Unit Price': 1000,
              Adjustment: 500,
              'Order Status': 'Cancelled',
            },
          ],
        ],
      ]) {
        const response = await restricted.request.fetch(
          `${url}/api/transactions`,
          { method, data }
        );
        assert.equal(
          response.status(),
          400,
          `X06: USER closed-order ${method} cannot bypass financial guards`
        );
        assert.deepEqual(await snapshot(client), closed);
      }
      assert.deepEqual(
        await reports('X06-closed-after-USER-bulk'),
        closedReports
      );
      const payoutKey = randomUUID();
      const payoutData = {
        cancellationId: authDecision.id,
        paymentDate: today,
        amount: 100,
        method: 'Cash',
      };
      const payout = await restricted.request.post(
        `${url}/api/customers/${authCustomer.id}/refunds/payout`,
        { headers: { 'Idempotency-Key': payoutKey }, data: payoutData }
      );
      assert.equal(
        payout.status(),
        201,
        'X06: USER can execute an already approved payout'
      );
      assert.equal(
        Number(
          (
            await client.clothingOrderCancellation.findUniqueOrThrow({
              where: { id: authDecision.id },
            })
          ).pendingAmount
        ),
        400
      );
      const paid = await snapshot(client);
      const paidReports = await reports('X06-USER-payout');
      assert.equal(
        (
          await restricted.request.post(
            `${url}/api/customers/${authCustomer.id}/refunds/payout`,
            { headers: { 'Idempotency-Key': payoutKey }, data: payoutData }
          )
        ).status(),
        201
      );
      assert.deepEqual(await snapshot(client), paid);
      assert.deepEqual(await reports('X06-USER-payout-replayed'), paidReports);
      close(
        net(paidReports.ledger.entries, 'Cash') -
          net(closedReports.ledger.entries, 'Cash'),
        -100,
        'X06: actual USER payout, not approval, moves cash'
      );
      close(
        net(paidReports.ledger.entries, 'Refunds Payable') -
          net(closedReports.ledger.entries, 'Refunds Payable'),
        100,
        'X06: actual USER payout reduces the approved liability'
      );
      checks.push(
        'X06 operational roles: USER collection succeeds; paid-order cancellation decision rejects 403 without any writes; administrator approves 500; USER closed financial bulk edit/reopen/import reject without writes; USER executes approved 100 payout exactly once, leaving 400 pending; cash and liability move only at payout'
      );
      await ordinaryPage.goto(`${url}/clothing/operations/products`, {
        timeout: 120000,
      });
      await expect(
        ordinaryPage.getByRole('dialog', {
          name: 'Access Restricted',
          exact: true,
        })
      ).toBeVisible();
      await expect(
        ordinaryPage.getByRole('button', { name: 'Add Product', exact: true })
      ).toHaveCount(0);
      checks.push(
        'X06: anonymous report, bulk/import, collection, approval, payout, inventory, manual-journal and all Expenses list/single/create/bulk/update/delete requests return 401 before business reads; real USER gets 403 on five accounting reports, all Expenses methods, manual-journal POST/PUT/DELETE and supplier issue/list, plus Products Access Restricted with no Add Product; allowed operational collection and approved payout are tested separately'
      );
    } finally {
      await restricted.close();
    }
    await context.tracing.stop({ path: path.join(artifacts, 'trace.zip') });
  } catch (error) {
    failure = error;
    if (page) {
      fs.writeFileSync(
        path.join(artifacts, 'failure-accessibility.txt'),
        await page
          .locator('body')
          .ariaSnapshot()
          .catch(() => 'Page unavailable')
      );
      await page
        .screenshot({
          path: path.join(artifacts, 'failure.png'),
          fullPage: true,
        })
        .catch(() => undefined);
      await page
        .context()
        .tracing.stop({ path: path.join(artifacts, 'failure-trace.zip') })
        .catch(() => undefined);
    }
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
        child.kill('SIGTERM');
      });
    }
    if (client) await client.$disconnect();
    if (created) {
      await admin.$queryRaw`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${databaseName} AND pid <> pg_backend_pid()`;
      await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
      const remaining =
        await admin.$queryRaw`SELECT datname FROM pg_database WHERE datname = ${databaseName}`;
      assert.equal(remaining.length, 0);
    }
    await admin.$disconnect();
    fs.rmSync(envFile, { force: true });
    fs.rmSync(path.join(root, env.RECONCILIATION_DIST_DIR), {
      recursive: true,
      force: true,
    });
    const result = {
      checks,
      findings,
      success: !failure,
      reconciliationComplete: false,
      databaseName,
      scratchDatabaseRemoved: created,
      artifacts,
      failure: failure?.message ?? null,
    };
    fs.writeFileSync(
      path.join(artifacts, 'result.json'),
      JSON.stringify(result, null, 2)
    );
    console.log(JSON.stringify(result, null, 2));
  }
  if (failure) throw failure;
}

(process.argv.includes('--server') ? serve() : main()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
