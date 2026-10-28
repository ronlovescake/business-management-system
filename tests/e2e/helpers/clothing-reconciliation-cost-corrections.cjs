const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { expect: playwrightExpect } = require('@playwright/test');
const {
  runPurchaseCase,
  deliverPurchase,
} = require('./clothing-reconciliation-scenarios.cjs');
const {
  verifyMissingValuation,
} = require('./clothing-reconciliation-report-checks.cjs');

const expect = playwrightExpect.configure({ timeout: 30000 });

async function runCostCorrectionLifecycle(args) {
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
  const date = (days) => {
    const value = new Date(`${today}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  };
  const purchaseDate = date(-4);
  const saleDate = date(-3);
  const correctionDate = date(-1);
  const { product, shipment } = await runPurchaseCase(args, 'Paid', {
    stage: 'I08',
    quantity: 100,
    unitPrice: 20,
    postingDate: purchaseDate,
    stopAfterBuild: true,
  });
  assert.equal(product.postingDate, purchaseDate);
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
  const reclassDate = dialog.getByRole('textbox', {
    name: 'Posting Date',
    exact: false,
  });
  await reclassDate.fill(purchaseDate);
  await reclassDate.press('Tab');
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
      customerName: 'Reconciliation I08 corrected return',
      date: purchaseDate,
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
  const creation = await context.request.post(`${url}/api/transactions`, {
    data: [
      {
        creationKey,
        'Order Date': saleDate,
        Customers: customer.customerName,
        'Product Code': product.productCode,
        Quantity: 4,
        'Unit Price': 50,
        'Line Total': 200,
        Discount: 0,
        Adjustment: 0,
        'Order Status': 'Warehouse',
      },
    ],
    timeout: 120000,
  });
  assert.equal(creation.status(), 201, await creation.text());
  const order = await client.transaction.findUniqueOrThrow({
    where: { creationKey },
  });
  const fulfillment = await context.request.patch(`${url}/api/transactions`, {
    data: {
      id: order.id,
      'Order Status': 'Accounts Receivable',
      'Packed Date': saleDate,
    },
    timeout: 120000,
  });
  assert.equal(fulfillment.status(), 200, await fulfillment.text());
  const sales = await client.inventoryMovement.findMany({
    where: {
      sourceTransactionId: order.id,
      movementType: 'sale',
      deletedAt: null,
    },
    orderBy: { id: 'asc' },
  });
  assert.equal(sales.length, 1);
  assert.equal(sales[0].quantity, 4);
  assert.equal(sales[0].unitCost, 20);
  const earlier = await reports('I08-earlier-sold-basis', { to: saleDate });
  close(
    earlier.profit.stats.cogsTotal,
    80,
    'Earlier sold cost is100 percent original recorded PHP20 basis'
  );
  const before = await reports('I08-before-actual-logistics');
  const savedLogistics = [];
  for (const action of [
    'Record Actual Cost',
    'Pay Payable',
    'Capitalize (Delivered)',
  ]) {
    await page.goto(`${url}/clothing/operations/shipments`, {
      timeout: 120000,
    });
    await page
      .getByRole('tab', { name: 'Logistics Costs', exact: true })
      .click();
    const shipmentInput = page.getByRole('textbox', {
      name: 'Shipment Code',
      exact: false,
    });
    await shipmentInput.fill(shipment.shipmentCode);
    await page
      .getByRole('option', { name: shipment.shipmentCode, exact: false })
      .click();
    const actionButton = page.getByRole('button', {
      name: new RegExp(`^${action.replace(/[()]/g, '\\$&')}`),
    });
    await actionButton.click();
    const postingDate = page.getByRole('textbox', {
      name: 'Posting Date',
      exact: false,
    });
    await postingDate.fill(correctionDate);
    await postingDate.press('Tab');
    await page
      .getByRole('textbox', { name: 'Actual Amount', exact: false })
      .fill('200');
    const pending = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          '/api/accounting/shipment-logistics' &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Post Entry', exact: true }).click();
    const response = await pending;
    assert.equal(response.status(), 201, await response.text());
    savedLogistics.push(response);
    const count = await client.clothingAccountingJournalLine.count({
      where: { sourceType: 'SHIPMENT_LOGISTICS', deletedAt: null },
    });
    const replay = await context.request.post(response.url(), {
      headers: {
        'Idempotency-Key': response.request().headers()['idempotency-key'],
      },
      data: response.request().postDataJSON(),
    });
    assert.equal(replay.status(), 200, await replay.text());
    assert.equal(
      await client.clothingAccountingJournalLine.count({
        where: { sourceType: 'SHIPMENT_LOGISTICS', deletedAt: null },
      }),
      count
    );
  }
  const capitalized = await reports('I08-actual-logistics-capitalized');
  close(
    net(capitalized.ledger.entries, 'Cash') -
      net(before.ledger.entries, 'Cash'),
    -200,
    'Actual logistics paid once'
  );
  close(
    net(capitalized.ledger.entries, 'Stock on Hand') -
      net(before.ledger.entries, 'Stock on Hand'),
    200,
    'Actual logistics capitalized once'
  );
  close(
    capitalized.profit.stats.cogsTotal,
    before.profit.stats.cogsTotal,
    'Logistics capitalization is not an immediate duplicate operating expense or COGS'
  );
  assert.deepEqual(
    await reports('I08-earlier-after-logistics', { to: saleDate }),
    earlier
  );
  const journal = await client.clothingAccountingJournalLine.findFirstOrThrow({
    where: {
      sourceType: 'SHIPMENT_LOGISTICS',
      account: 'Stock on Hand',
      debit: 200,
      deletedAt: null,
    },
  });
  await page.goto(`${url}/clothing/accounting/profit-loss`, {
    timeout: 120000,
  });
  await page
    .getByRole('button', { name: 'Dated cost corrections', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: /^dated cost corrections$/i });
  const lot = dialog.getByRole('textbox', { name: 'Product lot', exact: true });
  if (!(await lot.inputValue()).includes(product.productCode)) {
    await lot.fill(product.productCode);
    await page
      .getByRole('option', { name: new RegExp(`#${product.id}\\b`) })
      .click();
  }
  await dialog
    .getByRole('textbox', { name: 'Confirmed new unit cost', exact: true })
    .fill('22');
  await dialog
    .getByLabel('Correction date', { exact: true })
    .fill(correctionDate);
  await dialog
    .getByRole('textbox', { name: 'Posted capitalization', exact: true })
    .fill(shipment.shipmentCode);
  await page
    .getByRole('option', { name: new RegExp(`${shipment.shipmentCode}.*200`) })
    .click();
  await dialog
    .getByRole('textbox', { name: 'Correction reason', exact: true })
    .fill('Actual freight cost200 capitalized, allocate2 per purchased unit');
  const correctionSaved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        '/api/accounting/inventory-valuation' &&
      response.request().method() === 'PATCH'
  );
  await dialog
    .getByRole('button', { name: 'Record dated allocation', exact: true })
    .click();
  const correctionResponse = await correctionSaved;
  assert.equal(
    correctionResponse.status(),
    201,
    await correctionResponse.text()
  );
  const correction = (await correctionResponse.json()).data;
  assert.equal(correction.totalDelta, 200);
  assert.equal(correction.soldDelta, 8);
  assert.equal(correction.stockDelta, 192);
  assert.equal(correction.soldQuantity, 4);
  assert.equal(correction.stockQuantity, 96);
  const correctionPayload = correctionResponse.request().postDataJSON();
  const correctionKey = correctionResponse.request().headers()[
    'idempotency-key'
  ];
  const replay = await context.request.patch(correctionResponse.url(), {
    headers: { 'Idempotency-Key': correctionKey },
    data: correctionPayload,
  });
  assert.equal(replay.status(), 201, await replay.text());
  assert.equal(
    (
      await context.request.patch(correctionResponse.url(), {
        headers: { 'Idempotency-Key': correctionKey },
        data: { ...correctionPayload, newUnitCost: 23 },
      })
    ).status(),
    409
  );
  const corrected = await reports('I08-dated-sold-unsold-allocation');
  close(
    corrected.profit.stats.cogsTotal - capitalized.profit.stats.cogsTotal,
    8,
    'Only sold4 units take dated cost delta2'
  );
  close(
    net(corrected.ledger.entries, 'Stock on Hand') -
      net(capitalized.ledger.entries, 'Stock on Hand'),
    -8,
    'Unsold96 units retain the capitalized192 delta'
  );
  close(
    net(corrected.ledger.entries, 'Cash'),
    net(capitalized.ledger.entries, 'Cash'),
    'Cost allocation pays no supplier twice'
  );
  assert.equal(
    await client.clothingAccountingJournalLine.count({
      where: { sourceType: 'SHIPMENT_LOGISTICS', deletedAt: null },
    }),
    6
  );
  assert.equal(
    await client.clothingAccountingJournalLine.count({
      where: { sourceType: 'INVENTORY_COST_CORRECTION', deletedAt: null },
    }),
    2
  );
  assert.deepEqual(
    await reports('I08-earlier-after-correction', { to: saleDate }),
    earlier,
    'All five earlier reports remain byte-equivalent in data after current cost changes'
  );
  assert.deepEqual(
    await client.inventoryMovement.findMany({
      where: { id: { in: sales.map((sale) => sale.id) } },
      orderBy: { id: 'asc' },
    }),
    sales
  );
  await page.goto(`${url}/clothing/operations/customers/${customer.id}`, {
    timeout: 120000,
  });
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
    .getByRole('textbox', { name: 'Returned Quantity', exact: false })
    .fill('1');
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
  const returnResponse = await returned;
  assert.equal(returnResponse.status(), 201, await returnResponse.text());
  const movement = await client.inventoryMovement.findFirstOrThrow({
    where: {
      sourceTransactionId: order.id,
      movementType: 'return',
      deletedAt: null,
    },
  });
  assert.equal(
    movement.unitCost,
    20,
    'Immutable return snapshot retains original sale basis, not an edited historical row'
  );
  assert.equal(movement.sourceMovementId, sales[0].id);
  const final = await reports('I08-return-at-corrected-carrying-cost');
  close(
    final.profit.stats.cogsTotal - corrected.profit.stats.cogsTotal,
    -22,
    'Later actual return restores corrected carrying cost22'
  );
  close(
    net(final.ledger.entries, 'Stock on Hand') -
      net(corrected.ledger.entries, 'Stock on Hand'),
    22,
    'Corrected stock carrying value restored exactly once'
  );
  for (const account of ['Cash', 'Accounts Receivable', 'Refunds Payable'])
    close(
      net(final.ledger.entries, account),
      net(corrected.ledger.entries, account),
      `Physical return changes no ${account}`
    );
  assert.deepEqual(
    await reports('I08-earlier-after-return', { to: saleDate }),
    earlier
  );
  await page.screenshot({
    path: path.join(artifacts, 'I08-corrected-return.png'),
    fullPage: true,
  });
  await verifyMissingValuation(args);
  const invalid = await client.inventoryMovement.create({
    data: {
      productCode: 'I08-INVALID-COST',
      quantity: 1,
      unitCost: -1,
      fromBucket: 'sellable',
      toBucket: 'sold',
      postingDate: today,
      movementSource: 'manual',
    },
  });
  try {
    await page.goto(`${url}/clothing/accounting/profit-loss`, {
      timeout: 120000,
    });
    const notice = page
      .getByRole('alert')
      .filter({ hasText: 'Profit Incomplete' });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('I08-INVALID-COST');
    const response = await context.request.get(
      `${url}/api/accounting/inventory-valuation?from=2026-10-01&to=${today}`
    );
    assert.equal(response.status(), 200);
    assert.ok(
      (await response.json()).data.issues.some(
        (issue) =>
          issue.movementId === invalid.id && issue.reason === 'INVALID_COST'
      )
    );
    await page.screenshot({
      path: path.join(artifacts, 'I08-invalid-cost-visible.png'),
      fullPage: true,
    });
  } finally {
    await client.inventoryMovement.delete({ where: { id: invalid.id } });
  }
  assert.deepEqual(await reports('I08-final-owned-exceptions-removed'), final);
  assert.equal(journal.debit, 200);
  assert.equal(savedLogistics.length, 3);
  checks.push(
    'I08: actual backdated purchase/sale -> real Logistics Costs actual200/pay200/capitalize200 -> UI dated20-to22 cost allocation sold8/unsold192 -> later real physical return at corrected22 carrying value; original snapshots and all five earlier reports unchanged, no duplicate capitalization/payment, once-only replay/conflict, unknown and invalid costs visibly incomplete; owned exception fixtures removed'
  );
}

module.exports = { runCostCorrectionLifecycle };
