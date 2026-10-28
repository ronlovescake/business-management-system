const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const Papa = require('papaparse');
const { expect: playwrightExpect } = require('@playwright/test');
const {
  runPurchaseCase,
  deliverPurchase,
} = require('./clothing-reconciliation-scenarios.cjs');

const expect = playwrightExpect.configure({ timeout: 30000 });

async function runHistoricalLifecycle(args) {
  const {
    page,
    context,
    client,
    url,
    today,
    reports,
    net,
    close,
    checks,
    artifacts,
  } = args;
  const purchaseDate = '2026-09-27';
  const receiptDate = '2026-09-29';
  const cutoverDate = '2026-09-30';
  const installmentDate = '2026-10-02';
  const fulfillmentDate = '2026-10-03';
  assert.ok(
    fulfillmentDate < today,
    'The fixture needs actual historical dates, not a bypass for future events'
  );
  const fund = await context.request.post(
    `${url}/api/accounting/manual-journal`,
    {
      data: {
        date: '2026-09-26',
        ref: 'X04-OWNER-FUNDING',
        debitAccount: 'Cash',
        creditAccount: 'Owner Contribution',
        amount: 1000,
        description: 'Owned X04 capital funds the actual paid purchase',
      },
    }
  );
  assert.equal(fund.status(), 200, await fund.text());
  const { product, shipment } = await runPurchaseCase(
    { ...args, reports: (stage) => reports(stage, { from: '2026-09-01' }) },
    'Paid',
    {
      stage: 'X04',
      quantity: 100,
      unitPrice: 10,
      postingDate: purchaseDate,
      stopAfterBuild: true,
    }
  );
  await deliverPurchase({ page, client, url, shipment, date: purchaseDate });
  await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
  await page
    .getByPlaceholder('Search products by code, name, shipment code...')
    .fill(shipment.shipmentCode);
  await page
    .getByRole('gridcell', { name: shipment.shipmentCode, exact: true })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'Reclass to Stock on Hand', exact: true })
    .click();
  let dialog = page.getByRole('dialog', { name: /^reclass to stock on hand/i });
  await dialog
    .getByRole('textbox', { name: 'Posting Date', exact: false })
    .fill(purchaseDate);
  await dialog
    .getByRole('textbox', { name: 'Posting Date', exact: false })
    .press('Tab');
  await dialog
    .getByRole('button', { name: 'Create Reclass Entry', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: /^confirm reclass/i })
    .getByRole('button', { name: 'Create Reclass Entry', exact: true })
    .click();
  await expect
    .poll(() =>
      client.clothingInventoryReclassEntry.count({
        where: { productId: product.id, deletedAt: null },
      })
    )
    .toBe(1);
  const customer = await client.customer.create({
    data: {
      customerName: 'Reconciliation X04 actual historical events',
      date: receiptDate,
      phoneNumber: '',
      address: '',
      facebook: '',
      emailAddress: '',
      businessName: '',
      taxNumber: '',
      businessContactNumber: '',
      businessAddress: '',
      customerStatus: 'Active',
    },
  });
  const creationKey = randomUUID();
  const created = await context.request.post(`${url}/api/transactions`, {
    data: [
      {
        creationKey,
        'Order Date': '2026-09-28',
        Customers: customer.customerName,
        'Product Code': product.productCode,
        Quantity: 1,
        'Unit Price': 1000,
        'Line Total': 1000,
        Adjustment: 0,
        Discount: 0,
        'Order Status': 'Warehouse',
      },
    ],
    timeout: 120000,
  });
  assert.equal(created.status(), 201, await created.text());
  const order = await client.transaction.findUniqueOrThrow({
    where: { creationKey },
  });
  const recordPayment = async (amount, paymentDate, originalDeposit) => {
    await page.goto(`${url}/clothing/operations/transactions`, {
      timeout: 120000,
    });
    await page
      .getByRole('button', { name: 'Record Payment', exact: true })
      .click();
    const modal = page.getByRole('dialog', { name: /^record payments$/i });
    const customerInput = modal.getByRole('textbox', {
      name: 'Customer',
      exact: true,
    });
    if ((await customerInput.inputValue()) !== customer.customerName) {
      await customerInput.fill(customer.customerName);
      await page
        .getByRole('option', { name: customer.customerName, exact: true })
        .click();
    }
    await modal
      .getByRole('textbox', { name: 'Payment date', exact: true })
      .fill(paymentDate);
    await modal
      .getByRole('textbox', { name: 'Payment date', exact: true })
      .press('Tab');
    const method = modal.getByRole('textbox', { name: 'Method', exact: true });
    if ((await method.inputValue()) !== 'Cash') {
      await method.click();
      await page.getByRole('option', { name: 'Cash', exact: true }).click();
    }
    await modal
      .getByRole('checkbox', {
        name: 'Original Reservation Deposit',
        exact: true,
      })
      .setChecked(originalDeposit);
    if (originalDeposit) await modal.getByText('20%', { exact: true }).click();
    const row = modal
      .getByRole('row')
      .filter({
        has: page.getByRole('cell', { name: String(order.id), exact: true }),
      });
    await row.getByRole('textbox').fill(String(amount));
    const saved = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          '/api/transactions/payments/bulk' &&
        response.request().method() === 'POST'
    );
    await modal
      .getByRole('button', { name: 'Save and close', exact: true })
      .click();
    await page.getByRole('button', { name: 'Yes, save', exact: true }).click();
    const response = await saved;
    assert.equal(response.status(), 200, await response.text());
    await expect(modal).toHaveCount(0);
    assert.equal(
      await client.transactionPayment.count({
        where: {
          transactionId: order.id,
          paymentDate,
          amount,
          deletedAt: null,
        },
      }),
      1
    );
    return response;
  };
  await recordPayment(200, receiptDate, true);
  const preCutover = await reports('X04-actual-precutover-closing', {
    from: '2026-09-01',
    to: receiptDate,
  });
  for (const [account, value] of [
    ['Cash', 200],
    ['Stock on Hand', 1000],
    ['Customer Deposits', -200],
    ['Owner Contribution', -1000],
  ])
    close(
      preCutover.ledger.closingBalances[account] ?? 0,
      value,
      `Actual pre-cutover closing ${account}`
    );
  const originalReceipts = await client.transactionPayment.findMany({
    where: { transactionId: order.id },
    orderBy: { id: 'asc' },
  });
  const settings = await (
    await context.request.get(`${url}/api/settings/accounting`)
  ).json();
  const configured = await context.request.put(
    `${url}/api/settings/accounting`,
    {
      data: {
        clothingCutoverDate: cutoverDate,
        generalMerchandiseCutoverDate: settings.generalMerchandiseCutoverDate,
      },
    }
  );
  assert.equal(configured.status(), 200, await configured.text());
  assert.equal((await configured.json()).clothingCutoverDate, cutoverDate);
  assert.equal(
    (await configured.json()).generalMerchandiseCutoverDate,
    settings.generalMerchandiseCutoverDate
  );
  const entries = [
    'Cash',
    'Stock on Hand',
    'Customer Deposits',
    'Owner Contribution',
  ].map((account) => {
    const balance = preCutover.ledger.closingBalances[account];
    return {
      account,
      ref: 'X04-VERIFIED-CUTOVER',
      debit: Math.max(balance, 0),
      credit: Math.max(-balance, 0),
      description:
        'Owned opening balance copied from actual pre-cutover event closing, not guessed or seeded',
    };
  });
  const opening = await context.request.post(
    `${url}/api/accounting/opening-balance`,
    { data: { entries } }
  );
  assert.ok(opening.ok(), await opening.text());
  const openingReport = await reports('X04-explicit-cutover-opening', {
    from: cutoverDate,
    to: cutoverDate,
  });
  for (const [account, value] of [
    ['Cash', 200],
    ['Stock on Hand', 1000],
    ['Customer Deposits', -200],
    ['Owner Contribution', -1000],
  ])
    close(
      openingReport.ledger.closingBalances[account] ?? 0,
      value,
      `Explicit opening exactly preserves actual ${account}`
    );
  assert.deepEqual(
    await client.transactionPayment.findMany({
      where: { transactionId: order.id },
      orderBy: { id: 'asc' },
    }),
    originalReceipts,
    'Accounting cutover does not rewrite or manufacture original receipts'
  );
  const excluded = await reports('X04-precutover-explicitly-excluded', {
    from: '2026-09-01',
    to: receiptDate,
  });
  assert.equal(excluded.ledger.entries.length, 0);
  assert.equal(excluded.journal.entries.length, 0);
  await recordPayment(800, installmentDate, false);
  const beforeApprovalResponse = await context.request.patch(
    `${url}/api/transactions`,
    {
      data: {
        id: order.id,
        'Order Status': 'Shipped',
        'Packed Date': fulfillmentDate,
      },
      timeout: 120000,
    }
  );
  assert.equal(
    beforeApprovalResponse.status(),
    200,
    await beforeApprovalResponse.text()
  );
  const sales = await client.inventoryMovement.findMany({
    where: {
      sourceTransactionId: order.id,
      movementType: 'sale',
      deletedAt: null,
    },
  });
  assert.equal(sales.length, 1);
  assert.equal(sales[0].quantity, 1);
  assert.equal(sales[0].unitCost, 10);
  const earlier = await reports('X04-fulfilled-earlier-cutoff', {
    to: fulfillmentDate,
  });
  close(
    earlier.profit.stats.revenueTotal,
    1000,
    'Pre-cutover original deposit and October installment recognized together once at actual fulfillment'
  );
  close(
    earlier.profit.stats.cogsTotal,
    10,
    'Fulfilled carrying cost on the actual October sale day'
  );
  close(
    earlier.ledger.closingBalances.Cash,
    1000,
    'Actual cash1000 across the cutover, not only October installment800'
  );
  close(
    earlier.ledger.closingBalances['Customer Deposits'] ?? 0,
    0,
    'Opening deposit200 and current deposit800 both released exactly once'
  );
  const approvalResponse = await context.request.post(
    `${url}/api/transactions/${order.id}/cancellation`,
    {
      headers: { 'Idempotency-Key': randomUUID() },
      data: {
        kind: 'CANCELLED',
        mode: 'REFUND_ALL',
        reason:
          'Actual X04 emergency full-refund approval after month/cutover boundary',
      },
      timeout: 120000,
    }
  );
  assert.equal(approvalResponse.status(), 201, await approvalResponse.text());
  const decision = await client.clothingOrderCancellation.findUniqueOrThrow({
    where: { transactionId: order.id },
  });
  assert.equal(
    decision.decisionDate,
    today,
    'Approval retains the genuine server-owned current date'
  );
  assert.equal(Number(decision.pendingAmount), 1000);
  const approved = await reports('X04-actual-approval');
  close(approved.ledger.closingBalances.Cash, 1000, 'Approval is noncash');
  close(
    approved.ledger.closingBalances['Refunds Payable'],
    -1000,
    'Approved full known receipts become payable'
  );
  assert.deepEqual(
    await reports('X04-earlier-after-approval', { to: fulfillmentDate }),
    earlier,
    'A later cancellation cannot silently remove earlier fulfilled revenue or COGS'
  );
  await page.goto(`${url}/clothing/operations/customers/${customer.id}`, {
    timeout: 120000,
  });
  await page
    .getByRole('button', { name: 'Record payout', exact: true })
    .click();
  await page.getByLabel('Payout amount', { exact: false }).fill('300');
  await page.getByLabel('Actual payment date', { exact: false }).fill(today);
  const paid = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/customers/${customer.id}/refunds/payout` &&
      response.request().method() === 'POST'
  );
  await page
    .getByRole('button', { name: 'Save actual payout', exact: true })
    .click();
  const paidResponse = await paid;
  assert.equal(paidResponse.status(), 201, await paidResponse.text());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const payout = await reports('X04-actual-partial-payout');
  close(
    payout.ledger.closingBalances.Cash,
    700,
    'Only actual partial payout300 reduces cash'
  );
  close(
    payout.ledger.closingBalances['Refunds Payable'],
    -700,
    'Unpaid700 remains explicitly payable'
  );
  assert.deepEqual(
    await reports('X04-earlier-after-payout', { to: fulfillmentDate }),
    earlier
  );
  await page.getByRole('tab', { name: /Return\/Refund/ }).click();
  await page
    .getByRole('button', { name: 'Record Physical Return', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: /^record physical return$/i });
  await dialog
    .getByRole('textbox', { name: 'Transaction', exact: true })
    .click();
  await page
    .getByRole('option', { name: new RegExp(`#${order.id}\\b`) })
    .click();
  await dialog
    .getByRole('textbox', { name: 'Return Date', exact: false })
    .fill(today);
  await dialog
    .getByRole('textbox', { name: 'Returned Quantity', exact: false })
    .fill('0.5');
  await dialog
    .getByRole('textbox', { name: 'Restock Bucket', exact: false })
    .click();
  await page.getByRole('option', { name: 'sellable', exact: true }).click();
  const returned = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/customers/${customer.id}/refunds` &&
      response.request().method() === 'POST'
  );
  await dialog
    .getByRole('button', { name: 'Save Physical Return', exact: true })
    .click();
  assert.equal((await returned).status(), 201);
  await expect(dialog).toHaveCount(0);
  const final = await reports('X04-actual-partial-return');
  close(
    final.ledger.closingBalances.Cash,
    700,
    'Physical return pays no money'
  );
  close(
    final.ledger.closingBalances['Refunds Payable'],
    -700,
    'Physical return changes no outstanding monetary decision'
  );
  close(
    final.ledger.closingBalances['Stock on Hand'],
    995,
    'One sold10 minus actual half-unit returned5 leaves stock995'
  );
  close(
    final.profit.stats.cogsTotal,
    5,
    'Only the actual returned half reverses carrying cost'
  );
  close(
    final.profit.stats.revenueTotal,
    0,
    'Emergency full-refund approval reverses revenue once, not again on payout/physical return'
  );
  assert.deepEqual(
    await reports('X04-earlier-after-return', { to: fulfillmentDate }),
    earlier
  );
  assert.deepEqual(
    await reports('X04-cutover-after-all-events', {
      from: cutoverDate,
      to: cutoverDate,
    }),
    openingReport
  );
  assert.deepEqual(
    await reports('X04-precutover-after-all-events', {
      from: '2026-09-01',
      to: receiptDate,
    }),
    excluded
  );
  assert.deepEqual(
    await client.inventoryMovement.findMany({
      where: { id: { in: sales.map((sale) => sale.id) } },
    }),
    sales
  );
  assert.equal(
    Number(
      (
        await client.clothingOrderCancellation.findUniqueOrThrow({
          where: { id: decision.id },
        })
      ).pendingAmount
    ),
    700
  );
  assert.equal(
    await client.transactionPayment.count({
      where: { transactionId: order.id, deletedAt: null },
    }),
    2
  );
  assert.equal(
    await client.clothingRefundPayout.count({
      where: { cancellationId: decision.id },
    }),
    1
  );
  close(
    final.ledger.openingBalances.Cash,
    200,
    'October cash brought forward from explicit September cutover'
  );
  close(
    net(final.ledger.entries, 'Cash'),
    500,
    'October movement800 collection minus300 payout, independent of brought-forward200'
  );
  await page.goto(`${url}/clothing/accounting/ledger`, { timeout: 120000 });
  await page.getByPlaceholder('Filter by account', { exact: true }).click();
  await page.getByRole('option', { name: 'Cash', exact: true }).click();
  const balances = page.locator('[aria-label="Account balances"]');
  const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  });
  await expect(balances).toContainText(
    `Brought Forward: ${currency.format(200)}`
  );
  await expect(balances).toContainText(
    `Closing Balance: ${currency.format(700)}`
  );
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const csvPath = path.join(artifacts, 'X04-actual-month-cash-ledger.csv');
  await (await downloaded).saveAs(csvPath);
  const parsed = Papa.parse(fs.readFileSync(csvPath, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  assert.deepEqual(parsed.errors, []);
  const actual = parsed.data
    .map((row) => ({
      account: row.Account,
      debit: Number(row.Debit),
      credit: Number(row.Credit),
      balance: Number(row.Balance),
    }))
    .sort((first, second) => first.balance - second.balance);
  const expected = final.ledger.entries
    .filter((entry) => entry.account === 'Cash')
    .map((entry) => ({
      account: entry.account,
      debit: entry.debit,
      credit: entry.credit,
      balance: entry.balance,
    }))
    .sort((first, second) => first.balance - second.balance);
  assert.deepEqual(actual, expected);
  assert.equal(actual.length, 2);
  await page.screenshot({
    path: path.join(artifacts, 'X04-actual-brought-forward-cash.png'),
    fullPage: true,
  });
  checks.push(
    'X04: actual September paid purchase and original deposit200 -> explicit September30 cutover/opening copied from actual closing -> October installment800 and fulfillment -> real current-day cancellation1000 -> partial payout300 -> separate physical half-return; all five earlier/cutover/precutover reports unchanged after later events, cash brought-forward200 + movement500 = closing700, stock995/COGS5/refund payable700, real downloaded Cash CSV matches authoritative running balances; source receipts/sale history preserved and GM cutover unchanged'
  );
}

module.exports = { runHistoricalLifecycle };
