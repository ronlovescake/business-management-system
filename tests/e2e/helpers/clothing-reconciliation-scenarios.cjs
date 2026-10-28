const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { expect: playwrightExpect } = require('@playwright/test');

const expect = playwrightExpect.configure({ timeout: 30000 });

async function runPurchaseCase(
  { page, client, context, url, today, reports, net, close, checks, artifacts },
  payment,
  purchase = {}
) {
  const stage = purchase.stage || `I01-${payment.toLowerCase()}`;
  const code = purchase.stage
    ? `RECON-${stage}`
    : `RECON-LIFECYCLE-${payment.toUpperCase()}`;
  const quantity = purchase.quantity || 100;
  const unitPrice = purchase.unitPrice || 100;
  const gross = quantity * unitPrice;
  const opening = await reports(`${stage}-opening`);
  await page.goto(`${url}/clothing/operations/shipments`, { timeout: 120000 });
  await page.getByRole('button', { name: 'Add Shipment', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: /^add new shipment$/i });
  if (purchase.postingDate) {
    await dialog
      .getByRole('textbox', { name: 'Date Created', exact: false })
      .fill(purchase.postingDate);
    await dialog
      .getByRole('textbox', { name: 'Date Created', exact: false })
      .press('Tab');
  }
  await dialog
    .getByRole('textbox', { name: 'Shipment Code', exact: false })
    .fill(code);
  for (const [label, value] of [
    ['No. Of Sacks', '1'],
    ['Total CBM', '1'],
    ['Weight (kg)', '10'],
    ['Fee (', '0'],
  ]) {
    await dialog
      .getByRole('textbox', {
        name: new RegExp(label.replace(/[()]/g, '\\$&')),
      })
      .fill(value);
  }
  await dialog
    .getByRole('textbox', { name: 'Shipment Status', exact: false })
    .click();
  await page.getByRole('option', { name: 'In Transit', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Add Shipment', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => client.shipment.count({ where: { shipmentCode: code } }))
    .toBe(1);
  const shipment = await client.shipment.findFirstOrThrow({
    where: { shipmentCode: code },
  });
  await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
  await page.getByRole('button', { name: 'Add Product', exact: true }).click();
  dialog = page.getByRole('dialog', { name: /^add new product$/i });
  if (purchase.postingDate)
    for (const label of ['Posting Date', 'Order Date']) {
      await dialog
        .getByRole('textbox', { name: label, exact: true })
        .fill(purchase.postingDate);
      await dialog
        .getByRole('textbox', { name: label, exact: true })
        .press('Tab');
    }
  await dialog.getByLabel('Shipment Code', { exact: true }).fill(code);
  await dialog
    .getByRole('textbox', { name: 'Product Name', exact: false })
    .fill(
      purchase.stage ? `${stage} Purchase` : `Lifecycle ${payment} Purchase`
    );
  for (const [label, value] of [
    ['Unit Price', String(unitPrice)],
    ['Quantity', String(quantity)],
    ['Exchange Rate', '1'],
  ]) {
    await dialog.getByRole('textbox', { name: label, exact: true }).fill(value);
  }
  if (purchase.stage === 'I02') {
    await dialog
      .getByRole('textbox', { name: 'Supplier', exact: true })
      .fill('I02 Supplier');
    await page.getByRole('option', { name: /^Add supplier/ }).click();
  }
  await dialog
    .getByRole('textbox', { name: 'Transaction Fee', exact: false })
    .click();
  await page.getByRole('option', { name: 'No', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Payment', exact: true }).click();
  await page
    .getByRole('option', { name: new RegExp(`\\b${payment}$`) })
    .click();
  const method = dialog.getByRole('textbox', {
    name: 'Payment Method',
    exact: true,
  });
  if ((await method.inputValue()) !== 'Cash') {
    await method.click();
    await page.getByRole('option', { name: 'Cash', exact: true }).click();
  }
  const savedProductResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/products' &&
      response.request().method() === 'POST'
  );
  await dialog
    .getByRole('button', { name: 'Add Product', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Yes, save product', exact: true })
    .click();
  const savedProduct = await savedProductResponse;
  assert.ok(
    savedProduct.ok(),
    `I01: product save returned ${savedProduct.status()}: ${await savedProduct.text()}`
  );
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => client.product.count({ where: { shipmentCode: code } }))
    .toBe(1);
  const product = await client.product.findFirstOrThrow({
    where: { shipmentCode: code },
  });
  close(Number(product.grandTotal), gross, `${stage}: saved gross purchase`);
  assert.equal(product.quantity, quantity);
  const receipts = await client.inventoryMovement.findMany({
    where: {
      productId: product.id,
      fromBucket: 'opening_inventory',
      toBucket: 'sellable',
      deletedAt: null,
    },
  });
  assert.equal(receipts.length, 1, 'I01: one product auto-receipt');
  close(Number(receipts[0].quantity), quantity, `${stage}: receipt quantity`);
  assert.equal(receipts[0].notes, `auto-receipt product ${product.id}`);
  const created = await reports(`${stage}-created`);
  for (const account of [
    'Cash',
    'Supplier Payable',
    'Inventory in Transit',
    'Stock on Hand',
  ]) {
    close(
      net(created.ledger.entries, account),
      net(opening.ledger.entries, account),
      `I01: creation alone does not post ${account}`
    );
  }
  await page.reload();
  await page
    .getByPlaceholder('Search products by code, name, shipment code...')
    .fill(code);
  await page.getByRole('gridcell', { name: code, exact: true }).first().click();
  await page
    .getByRole('button', { name: 'Transit Build-Up', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: /^Post Transit Build-Up/ })
    .getByRole('button', { name: 'Post Transit Build-Up', exact: true })
    .click();
  await expect
    .poll(() =>
      client.clothingInventoryTransitBuildEntry.count({
        where: { shipmentCode: code, deletedAt: null },
      })
    )
    .toBe(1);
  const built = await reports(`${stage}-built`);
  close(
    net(built.ledger.entries, 'Inventory in Transit') -
      net(opening.ledger.entries, 'Inventory in Transit'),
    gross,
    'I01: build asset'
  );
  close(
    net(built.ledger.entries, 'Cash') - net(opening.ledger.entries, 'Cash'),
    payment === 'Paid' ? -gross : 0,
    `${stage}: acquisition Cash funding`
  );
  close(
    net(built.ledger.entries, 'Supplier Payable') -
      net(opening.ledger.entries, 'Supplier Payable'),
    payment === 'Unpaid' ? -gross : 0,
    `${stage}: acquisition supplier debt`
  );
  if (purchase.stage === 'I02') {
    await runShortageFollowup({
      page,
      client,
      context,
      url,
      today,
      product,
      shipment,
      reports,
      net,
      close,
      checks,
      artifacts,
    });
    return;
  }
  if (purchase.stopAfterBuild) return { product, shipment, built, opening };
  const customer = await client.customer.create({
    data: {
      customerName: `Reconciliation ${stage}`,
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
  await client.price.create({
    data: {
      productId: product.id,
      productCode: product.productCode,
      lowerLimit: 100,
      upperLimit: 10000,
      currentPrice: 20000,
    },
  });
  const order = await reservePurchase({ page, client, url, customer, product });
  const reserved = await reports(`${stage}-reserved-in-transit`);
  assert.deepEqual(
    reserved,
    built,
    `${stage}: reservation does not dispose owned stock or move money`
  );
  await verifyPurchaseStock({
    page,
    url,
    product,
    expected: [0, 0, 0, 0, 20, 80],
    artifacts,
    stage: `${stage}-in-transit`,
  });
  await deliverPurchase({ page, client, url, shipment });
  const delivered = await reports(`${stage}-delivered`);
  for (const account of [
    'Cash',
    'Supplier Payable',
    'Inventory in Transit',
    'Stock on Hand',
  ]) {
    close(
      net(delivered.ledger.entries, account),
      net(built.ledger.entries, account),
      `I01: delivery status alone does not post ${account}`
    );
  }
  await verifyPurchaseStock({
    page,
    url,
    product,
    expected: [100, 20, 0, 80, 0, 0],
    artifacts,
    stage: `${stage}-received`,
  });
  await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
  await page
    .getByPlaceholder('Search products by code, name, shipment code...')
    .fill(code);
  await page.getByRole('gridcell', { name: code, exact: true }).first().click();
  await page
    .getByRole('button', { name: 'Reclass to Stock on Hand', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: /^reclass to stock on hand/i });
  await dialog
    .getByRole('button', { name: 'Create Reclass Entry', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: /^confirm reclass/i })
    .getByRole('button', { name: 'Create Reclass Entry', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() =>
      client.clothingInventoryReclassEntry.count({
        where: { productId: product.id, deletedAt: null },
      })
    )
    .toBe(1);
  const reclassed = await reports(`${stage}-reclassed`);
  close(
    net(reclassed.ledger.entries, 'Inventory in Transit') -
      net(opening.ledger.entries, 'Inventory in Transit'),
    0,
    'I01: transit cleared'
  );
  close(
    net(reclassed.ledger.entries, 'Stock on Hand') -
      net(opening.ledger.entries, 'Stock on Hand'),
    10000,
    'I01: stock capitalized'
  );
  close(
    net(reclassed.ledger.entries, 'Cash'),
    net(built.ledger.entries, 'Cash'),
    'I01: reclass does not pay twice'
  );
  await page.screenshot({
    path: path.join(artifacts, `${stage}-reclassed.png`),
    fullPage: true,
  });
  await page.goto(`${url}/clothing/operations/transactions`, {
    timeout: 120000,
  });
  await page
    .getByRole('textbox', { name: 'Search product code...', exact: true })
    .fill(product.productCode);
  await page
    .getByRole('row')
    .filter({
      has: page.getByRole('gridcell', {
        name: customer.customerName,
        exact: true,
      }),
    })
    .getByRole('gridcell', { name: product.productCode, exact: true })
    .click();
  for (let column = 2; column < 8; column += 1) {
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.press('F2');
  const editor = page.getByRole('combobox');
  await editor.press('Control+A');
  await editor.pressSequentially('Accounts Receivable');
  await page
    .getByRole('option', { name: 'Accounts Receivable', exact: true })
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
    .toBe('Accounts Receivable');
  const sales = await client.inventoryMovement.findMany({
    where: {
      sourceTransactionId: order.id,
      movementType: 'sale',
      deletedAt: null,
    },
  });
  assert.equal(sales.length, 1, `${stage}: one fulfillment movement`);
  close(Number(sales[0].quantity), 20, `${stage}: sold quantity`);
  assert.equal(sales[0].fromBucket, 'reserved');
  const orderMovements = await client.inventoryMovement.findMany({
    where: { sourceTransactionId: order.id, deletedAt: null },
  });
  close(
    orderMovements.reduce(
      (quantity, movement) =>
        quantity +
        (movement.toBucket === 'reserved' ? Number(movement.quantity) : 0) -
        (movement.fromBucket === 'reserved' ? Number(movement.quantity) : 0),
      0
    ),
    0,
    `${stage}: preserved reservation is fully consumed by the sale`
  );
  const fulfilled = await reports(`${stage}-fulfilled`);
  for (const [account, expected] of [
    ['Stock on Hand', 8000],
    ['Inventory in Transit', 0],
    ['COGS', 2000],
    ['Accounts Receivable', 4000],
  ]) {
    close(
      net(fulfilled.ledger.entries, account) -
        net(opening.ledger.entries, account),
      expected,
      `${stage}: fulfilled ${account}`
    );
  }
  close(
    fulfilled.profit.stats.revenueTotal - opening.profit.stats.revenueTotal,
    4000,
    `${stage}: revenue once`
  );
  close(
    fulfilled.profit.stats.cogsTotal - opening.profit.stats.cogsTotal,
    2000,
    `${stage}: cost once`
  );
  close(
    fulfilled.profit.stats.netProfit - opening.profit.stats.netProfit,
    2000,
    `${stage}: profit bridge`
  );
  await verifyPurchaseStock({
    page,
    url,
    product,
    expected: [100, 0, 20, 80, 0, 0],
    artifacts,
    stage: `${stage}-fulfilled`,
  });
  if (payment === 'Unpaid') {
    await settlePurchase({
      page,
      client,
      context,
      url,
      today,
      product,
      reports,
      net,
      close,
      checks,
      stage,
      opening,
      fulfilled,
    });
  }
  checks.push(
    `${stage}: actual shipment/product create, build, 20-unit in-transit reservation, delivery, reclass and fulfillment preserve 100 received/20 sold/80 available; cost 10000 becomes stock 8000 plus COGS 2000, revenue 4000; creation/reservation/delivery do not independently post`
  );
}

async function reservePurchase(
  { page, client, url, customer, product },
  purchase = {}
) {
  const quantity = purchase.quantity ?? 20;
  const unitPrice = purchase.unitPrice ?? 200;
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
  await page.reload();
  await page
    .getByRole('row')
    .filter({
      has: page.getByRole('gridcell', {
        name: customer.customerName,
        exact: true,
      }),
    })
    .getByRole('gridcell', { name: product.productCode, exact: true })
    .click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('F2');
  await page.keyboard.press('Control+A');
  await page.keyboard.type(String(quantity));
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
    .toBe(quantity * unitPrice);
  const order = await client.transaction.findFirstOrThrow({
    where: { customerId: customer.id },
  });
  assert.equal(order.quantity, quantity);
  assert.equal(order.orderStatus, purchase.status ?? 'In Transit');
  const reserves = await client.inventoryMovement.findMany({
    where: {
      sourceTransactionId: order.id,
      movementType: 'reserve',
      deletedAt: null,
    },
  });
  assert.equal(reserves.length, 1);
  assert.equal(Number(reserves[0].quantity), quantity);
  return order;
}

async function verifyPurchaseStock({
  page,
  url,
  product,
  expected,
  artifacts,
  stage,
}) {
  await page.goto(`${url}/clothing/operations/inventory`, { timeout: 120000 });
  await page
    .getByRole('textbox', { name: 'Sellable filter', exact: true })
    .click();
  await page
    .getByRole('option', { name: 'All Product Codes', exact: true })
    .click();
  const row = page.getByRole('row').filter({
    has: page
      .locator('td:first-child')
      .getByText(product.productCode, { exact: true }),
  });
  await expect(row).toHaveCount(1);
  for (const [offset, quantity] of expected.entries()) {
    await expect(row.getByRole('cell').nth(offset + 7)).toHaveText(
      new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(
        quantity
      )
    );
  }
  await page.screenshot({
    path: path.join(artifacts, `${stage}-stock.png`),
    fullPage: true,
  });
}

async function settlePurchase({
  page,
  client,
  context,
  url,
  today,
  product,
  reports,
  net,
  close,
  checks,
  stage,
  opening,
  fulfilled,
}) {
  const settlementWhere = {
    sourceType: 'PRODUCT',
    sourceId: String(product.id),
    sourceLineKey: { startsWith: 'SUPPLIER_SETTLEMENT:' },
  };
  assert.equal(
    await client.clothingAccountingJournalLine.count({
      where: settlementWhere,
    }),
    0
  );
  const builds = await client.clothingInventoryTransitBuildEntry.findMany({
    where: { shipmentCode: product.shipmentCode },
  });
  const reclasses = await client.clothingInventoryReclassEntry.findMany({
    where: { productId: product.id },
  });
  await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
  await page
    .getByPlaceholder('Search products by code, name, shipment code...')
    .fill(product.shipmentCode);
  await page
    .getByRole('gridcell', { name: product.shipmentCode, exact: true })
    .first()
    .click();
  for (let column = 0; column < 10; column += 1) {
    await page.keyboard.press('ArrowRight');
  }
  await page
    .getByRole('gridcell', { name: product.productCode, exact: true })
    .last()
    .dblclick();
  const dialog = page.getByRole('dialog', { name: /^edit product$/i });
  await dialog.getByRole('textbox', { name: 'Payment', exact: true }).click();
  await page.getByRole('option', { name: /\bPaid$/ }).click();
  const method = dialog.getByRole('textbox', {
    name: 'Payment Method',
    exact: true,
  });
  if ((await method.inputValue()) !== 'Cash') {
    await method.click();
    await page.getByRole('option', { name: 'Cash', exact: true }).click();
  }
  const savedResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.startsWith('/api/products') &&
      ['PUT', 'PATCH'].includes(response.request().method())
  );
  await dialog
    .getByRole('button', { name: 'Update Product', exact: true })
    .click();
  const saved = await savedResponse;
  assert.ok(
    saved.ok(),
    `${stage}: settlement returned ${saved.status()}: ${await saved.text()}`
  );
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() =>
      client.clothingAccountingJournalLine.count({ where: settlementWhere })
    )
    .toBe(2);
  assert.equal(
    (await client.product.findUniqueOrThrow({ where: { id: product.id } }))
      .payment,
    'Paid'
  );
  const lines = await client.clothingAccountingJournalLine.findMany({
    where: settlementWhere,
    orderBy: { id: 'asc' },
  });
  for (const line of lines) {
    assert.equal(line.date.toISOString().slice(0, 10), today);
    assert.equal(line.deletedAt, null);
  }
  const settled = await reports(`${stage}-settled`);
  close(
    net(settled.ledger.entries, 'Cash') - net(opening.ledger.entries, 'Cash'),
    -10000,
    `${stage}: actual supplier payment once`
  );
  close(
    net(settled.ledger.entries, 'Supplier Payable') -
      net(opening.ledger.entries, 'Supplier Payable'),
    0,
    `${stage}: supplier debt cleared`
  );
  for (const account of [
    'Inventory in Transit',
    'Stock on Hand',
    'COGS',
    'Accounts Receivable',
  ]) {
    close(
      net(settled.ledger.entries, account),
      net(fulfilled.ledger.entries, account),
      `${stage}: settlement does not reacquire ${account}`
    );
  }
  assert.deepEqual(settled.profit, fulfilled.profit);
  assert.deepEqual(settled.details, fulfilled.details);
  const replay = await context.request.fetch(saved.url(), {
    method: saved.request().method(),
    data: saved.request().postDataJSON(),
  });
  assert.ok(replay.ok(), `${stage}: same supplier Paid save replay succeeds`);
  assert.deepEqual(
    await client.clothingAccountingJournalLine.findMany({
      where: settlementWhere,
      orderBy: { id: 'asc' },
    }),
    lines
  );
  assert.deepEqual(
    await client.clothingInventoryTransitBuildEntry.findMany({
      where: { shipmentCode: product.shipmentCode },
    }),
    builds
  );
  assert.deepEqual(
    await client.clothingInventoryReclassEntry.findMany({
      where: { productId: product.id },
    }),
    reclasses
  );
  assert.deepEqual(await reports(`${stage}-settlement-replayed`), settled);
  checks.push(
    `${stage}: real Edit Product pays supplier 10000, clears debt without reacquisition or second expense; captured save replay preserves the same two dated settlement lines, build/reclass and five reports`
  );
}

async function runPurchaseLifecycle(args) {
  for (const payment of ['Paid', 'Unpaid']) {
    await runPurchaseCase(args, payment);
  }
}

async function deliverPurchase({ page, client, url, shipment, date }) {
  await page.goto(`${url}/clothing/operations/shipments`, { timeout: 120000 });
  await page
    .getByPlaceholder(
      'Search shipments by code, CV number, status, or notes...'
    )
    .fill(shipment.shipmentCode);
  await expect(page.getByText(/Showing 1 of \d+ shipments/)).toBeVisible();
  await page.locator('.dvn-scroller').dblclick({ position: { x: 110, y: 52 } });
  const dialog = page.getByRole('dialog', { name: /^edit shipment$/i });
  if (date) {
    await dialog
      .getByRole('textbox', { name: 'Date Delivered', exact: true })
      .fill(date);
    await dialog
      .getByRole('textbox', { name: 'Date Delivered', exact: true })
      .press('Tab');
  }
  await dialog
    .getByRole('textbox', { name: 'Shipment Status', exact: false })
    .click();
  await page.getByRole('option', { name: 'Delivered', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Update Shipment', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (
          await client.shipment.findUniqueOrThrow({
            where: { id: shipment.id },
          })
        ).shipmentStatus
    )
    .toBe('Delivered');
}

async function runShortageFollowup({
  page,
  client,
  context,
  url,
  today,
  product,
  shipment,
  reports,
  net,
  close,
  checks,
  artifacts,
}) {
  const creditCount = await client.clothingSupplierCredit.count();
  await deliverPurchase({ page, client, url, shipment });
  await page.goto(`${url}/clothing/operations/inventory`, { timeout: 120000 });
  await page.getByRole('button', { name: 'Adjustment', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: /^adjustments$/i });
  const productInput = dialog.getByRole('textbox', {
    name: 'Product Code',
    exact: false,
  });
  if ((await productInput.inputValue()) !== product.productCode) {
    await productInput.fill(product.productCode);
    await page
      .getByRole('option', { name: product.productCode, exact: false })
      .click();
  }
  await expect(productInput).toHaveValue(product.productCode);
  await dialog
    .getByRole('textbox', { name: 'Supplier Short', exact: false })
    .fill('120');
  const shortageResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/inventory/movements' &&
      response.request().method() === 'POST'
  );
  await dialog
    .getByRole('button', { name: 'Save Adjustment', exact: true })
    .click();
  const submittedShortage = await shortageResponse;
  assert.equal(
    submittedShortage.status(),
    201,
    `I02: shortage save: ${await submittedShortage.text()}`
  );
  await expect(dialog).toHaveCount(0);
  const shortage = await client.inventoryMovement.findFirstOrThrow({
    where: {
      productId: product.id,
      toBucket: 'supplier_short',
      deletedAt: null,
    },
  });
  assert.equal(shortage.quantity, 120);
  await verifyPurchaseStock({
    page,
    url,
    product,
    expected: [880, 0, 0, 880, 0, 0],
    artifacts,
    stage: 'I02-partial-receipt',
  });
  const before = await reports('I02-before-follow-up');
  await page.getByRole('tab', { name: 'Adjustments', exact: true }).click();
  const row = page
    .getByRole('row')
    .filter({
      has: page.getByRole('cell', { name: product.productCode, exact: true }),
    });
  await row
    .getByRole('button', {
      name: 'Edit supplier short resolution',
      exact: true,
    })
    .click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: 'Supplier short resolution', exact: true })
    .click();
  await page
    .getByRole('option', { name: 'Supplier credit received', exact: true })
    .click();
  await dialog
    .getByLabel('Supplier credit reference', { exact: true })
    .fill('I02-PARTIAL-CREDIT-5000');
  await dialog
    .getByLabel('Supplier credit amount', { exact: true })
    .fill('5000');
  await expect(
    dialog.getByText(
      'This records supplier follow-up only; it does not post an accounting entry.',
      { exact: true }
    )
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  const saved = await client.inventoryMovement.findUniqueOrThrow({
    where: { id: shortage.id },
  });
  assert.equal(saved.supplierShortResolution, 'CREDIT_RECEIVED');
  assert.equal(saved.supplierCreditReference, 'I02-PARTIAL-CREDIT-5000');
  close(Number(saved.supplierCreditAmount), 5000, 'I02: follow-up amount');
  assert.equal(await client.clothingSupplierCredit.count(), creditCount);
  const after = await reports('I02-follow-up-not-spendable');
  assert.deepEqual(
    after,
    before,
    'I02: follow-up note changes no financial report'
  );
  close(
    net(after.ledger.entries, 'Supplier Credits') -
      net(before.ledger.entries, 'Supplier Credits'),
    0,
    'I02: no invented credit asset'
  );
  const partialIssue = await context.request.post(
    `${url}/api/products/${product.id}/supplier-resolution`,
    {
      data: {
        action: 'ISSUE_CREDIT',
        requestId: randomUUID(),
        supplierReference: product.supplierReference,
        reference: 'I02-MUST-NOT-ISSUE-FULL-PURCHASE',
        postingDate: today,
      },
    }
  );
  assert.equal(partialIssue.status(), 409);
  assert.match(
    (await partialIssue.json()).error,
    /partial Supplier Short.*separate quantity\/accounting correction/i
  );
  assert.equal(await client.clothingSupplierCredit.count(), creditCount);
  assert.deepEqual(await reports('I02-full-credit-workaround-rejected'), after);
  await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
  await page.getByRole('button', { name: 'Add Product', exact: true }).click();
  dialog = page.getByRole('dialog', { name: /^add new product$/i });
  const supplierInput = dialog.getByRole('textbox', {
    name: 'Supplier',
    exact: true,
  });
  if ((await supplierInput.inputValue()) !== 'I02 Supplier') {
    await supplierInput.fill('I02 Supplier');
    await page.getByRole('option', { name: /^i02 supplier$/i }).click();
  }
  await dialog
    .getByRole('textbox', { name: 'Available supplier credit', exact: true })
    .click();
  await expect(
    page.getByText('No available credits', { exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: path.join(artifacts, 'I02-no-issued-credit.png'),
    fullPage: true,
  });
  checks.push(
    'I02: actual 1000-unit purchase/build, shortage120, delivered880, persisted PHP5000 follow-up and next-purchase selection prove no issued/spendable credit or financial change; unsupported partial issuance is explicit'
  );
}

async function runShortageLifecycle(args) {
  await runPurchaseCase(args, 'Paid', {
    stage: 'I02',
    quantity: 1000,
    unitPrice: 10,
  });
}

async function runCancellationReturn({
  page,
  client,
  context,
  databaseUrl,
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
  stage,
}) {
  const before = await reports(`${stage}-before-physical-return`);
  const cancellation = await client.clothingOrderCancellation.findUniqueOrThrow(
    { where: { transactionId: order.id } }
  );
  const payouts = await client.clothingRefundPayout.findMany({
    where: { cancellationId: cancellation.id },
    orderBy: { id: 'asc' },
  });
  const payments = await client.transactionPayment.findMany({
    where: { transactionId: order.id },
    orderBy: { id: 'asc' },
  });
  const sales = await client.inventoryMovement.findMany({
    where: {
      sourceTransactionId: order.id,
      movementType: 'sale',
      deletedAt: null,
    },
    orderBy: { id: 'asc' },
  });
  assert.equal(sales.length, 1);
  const {
    verifyFinancialRollback,
    verifyFinancialConcurrency,
  } = require('./clothing-reconciliation-atomicity.cjs');
  await verifyFinancialRollback({
    client,
    context,
    endpoint: `${url}/api/customers/${customer.id}/refunds`,
    data: {
      transactionId: order.id,
      refundDate: today,
      amount: 0,
      returnedQuantity: 0.5,
      restockBucket: 'sellable',
    },
    phase: `${stage}-physical-return`,
    reports,
    checks,
  });
  await page.goto(`${url}/clothing/operations/customers/${customer.id}`, {
    timeout: 120000,
  });
  await page.getByRole('tab', { name: /Return\/Refund/ }).click();
  await page
    .getByRole('button', { name: 'Record Physical Return', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: /^record physical return$/i,
  });
  await expect(
    dialog.getByRole('textbox', { name: 'Refund Amount', exact: true })
  ).toHaveCount(0);
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
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/customers/${customer.id}/refunds` &&
      response.request().method() === 'POST'
  );
  await dialog
    .getByRole('button', { name: 'Save Physical Return', exact: true })
    .click();
  const response = await responsePromise;
  assert.equal(
    response.status(),
    201,
    `${stage}: physical return: ${await response.text()}`
  );
  const refund = (await response.json()).data;
  assert.equal(refund.amount, 0);
  assert.equal(refund.returnedQuantity, 0.5);
  await expect(dialog).toHaveCount(0);
  const returns = await client.inventoryMovement.findMany({
    where: {
      sourceTransactionId: order.id,
      movementType: 'return',
      deletedAt: null,
    },
  });
  assert.equal(returns.length, 1);
  assert.equal(returns[0].fromBucket, 'sold');
  assert.equal(returns[0].toBucket, 'sellable');
  assert.equal(returns[0].quantity, 0.5);
  close(
    Number(returns[0].unitCost),
    Number(sales[0].unitCost),
    `${stage}: preserved sale cost`
  );
  const after = await reports(`${stage}-physical-return`);
  for (const account of ['Cash', 'Refunds Payable', 'Accounts Receivable']) {
    close(
      net(after.ledger.entries, account),
      net(before.ledger.entries, account),
      `${stage}: return changes no ${account}`
    );
  }
  close(
    net(after.ledger.entries, 'Stock on Hand') -
      net(before.ledger.entries, 'Stock on Hand'),
    5,
    `${stage}: partial physical stock carrying cost restored`
  );
  close(
    after.profit.stats.cogsTotal - before.profit.stats.cogsTotal,
    -5,
    `${stage}: sold cost reversed only on actual partial return`
  );
  close(
    after.profit.stats.revenueTotal,
    before.profit.stats.revenueTotal,
    `${stage}: no second monetary refund`
  );
  assert.deepEqual(
    await client.clothingOrderCancellation.findUniqueOrThrow({
      where: { transactionId: order.id },
    }),
    cancellation
  );
  assert.deepEqual(
    await client.clothingRefundPayout.findMany({
      where: { cancellationId: cancellation.id },
      orderBy: { id: 'asc' },
    }),
    payouts
  );
  assert.deepEqual(
    await client.transactionPayment.findMany({
      where: { transactionId: order.id },
      orderBy: { id: 'asc' },
    }),
    payments
  );
  assert.deepEqual(
    await client.inventoryMovement.findMany({
      where: {
        sourceTransactionId: order.id,
        movementType: 'sale',
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
    }),
    sales
  );
  const data = response.request().postDataJSON();
  const headers = {
    'Idempotency-Key': response.request().headers()['idempotency-key'],
  };
  assert.ok(headers['Idempotency-Key']);
  assert.equal(
    (await context.request.post(response.url(), { headers, data })).status(),
    201
  );
  assert.equal(
    (
      await context.request.post(response.url(), {
        headers,
        data: { ...data, returnedQuantity: 0.25 },
      })
    ).status(),
    409
  );
  assert.equal(
    (
      await context.request.post(response.url(), {
        headers: { 'Idempotency-Key': randomUUID() },
        data: { ...data, returnedQuantity: 1 },
      })
    ).status(),
    400
  );
  assert.equal(
    await client.inventoryMovement.count({
      where: {
        sourceTransactionId: order.id,
        movementType: 'return',
        deletedAt: null,
      },
    }),
    1
  );
  assert.deepEqual(await reports(`${stage}-return-replay-controls`), after);
  const winner = await verifyFinancialConcurrency({
    client,
    context,
    databaseUrl,
    endpoint: response.url(),
    data,
    successStatus: 201,
    rejectedStatus: 400,
    phase: `${stage}-physical-return`,
    checks,
  });
  assert.equal(
    (
      await context.request.post(winner.url, {
        headers: { 'Idempotency-Key': winner.key },
        data: winner.data,
      })
    ).status(),
    201
  );
  const allReturns = await client.inventoryMovement.findMany({
    where: {
      sourceTransactionId: order.id,
      movementType: 'return',
      deletedAt: null,
    },
  });
  assert.equal(allReturns.length, 2);
  close(
    sales.reduce((sum, movement) => sum + movement.quantity, 0) -
      allReturns.reduce((sum, movement) => sum + movement.quantity, 0),
    0,
    `${stage}: net sold stock after competing physical returns`
  );
  const final = await reports(`${stage}-bounded-returns-complete`);
  for (const account of ['Cash', 'Refunds Payable', 'Accounts Receivable'])
    close(
      net(final.ledger.entries, account),
      net(before.ledger.entries, account),
      `${stage}: racing returns change no ${account}`
    );
  close(
    net(final.ledger.entries, 'Stock on Hand') -
      net(before.ledger.entries, 'Stock on Hand'),
    10,
    `${stage}: complete actual return carrying cost`
  );
  close(
    final.profit.stats.cogsTotal - before.profit.stats.cogsTotal,
    -10,
    `${stage}: complete actual return cost reversal`
  );
  assert.deepEqual(
    await client.clothingOrderCancellation.findUniqueOrThrow({
      where: { transactionId: order.id },
    }),
    cancellation
  );
  assert.deepEqual(
    await client.clothingRefundPayout.findMany({
      where: { cancellationId: cancellation.id },
      orderBy: { id: 'asc' },
    }),
    payouts
  );
  await verifyPurchaseStock({
    page,
    url,
    product,
    expected: [100, 0, 1, 100, 0, 0],
    artifacts,
    stage,
  });
  checks.push(
    `${stage}: real cancelled-order physical return separately restores one unit at original PHP10 cost; Prepared/fully-paid or Shipped sale and complete payout history preserved; five-report money/cost bridge and replay/conflict/excess-return controls pass`
  );
}

async function runFreeGoodsLifecycle(args) {
  const {
    page,
    client,
    context,
    databaseUrl,
    url,
    reports,
    net,
    close,
    checks,
    artifacts,
    today,
  } = args;
  const { product, shipment } = await runPurchaseCase(args, 'Paid', {
    stage: 'I06',
    quantity: 1000,
    unitPrice: 20,
    stopAfterBuild: true,
  });
  await deliverPurchase({ page, client, url, shipment });
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
  await page
    .getByRole('dialog', { name: /^reclass to stock on hand/i })
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
  const capitalized = await reports('I06-paid-stock');
  await page.goto(`${url}/clothing/operations/inventory`, { timeout: 120000 });
  await page.getByRole('button', { name: 'Adjustment', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /^adjustments$/i });
  const productInput = dialog.getByRole('textbox', {
    name: 'Product Code',
    exact: false,
  });
  if ((await productInput.inputValue()) !== product.productCode) {
    await productInput.fill(product.productCode);
    await page
      .getByRole('option', { name: product.productCode, exact: false })
      .click();
  }
  await dialog.getByRole('textbox', { name: /Additionals/i }).fill('100');
  const receiptResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/inventory/movements' &&
      response.request().method() === 'POST'
  );
  await dialog
    .getByRole('button', { name: 'Save Adjustment', exact: true })
    .click();
  assert.equal((await receiptResponse).status(), 201);
  await expect(dialog).toHaveCount(0);
  const receipt = await client.inventoryMovement.findFirstOrThrow({
    where: {
      productId: product.id,
      costBasis: 'FREE_GOODS',
      movementType: 'free_goods_receipt',
      deletedAt: null,
    },
  });
  assert.equal(receipt.quantity, 100);
  assert.equal(receipt.unitCost, 0);
  assert.deepEqual(await reports('I06-free-receipt-no-money'), capitalized);
  await verifyPurchaseStock({
    page,
    url,
    product,
    expected: [1100, 0, 0, 1100, 0, 0],
    artifacts,
    stage: 'I06-1100-orderable-units',
  });
  const destination = await client.product.create({
    data: {
      product: 'Transfer destination catalog only',
      productCode: 'I06-TRANSFER-TARGET',
      quantity: 0,
      cogs: 0,
      landedUnitCost: 999,
      payment: 'Paid',
      shipmentStatus: 'Delivered',
    },
  });
  const {
    verifyFinancialRollback,
    verifyFinancialConcurrency,
  } = require('./clothing-reconciliation-atomicity.cjs');
  const endpoint = `${url}/api/inventory/movements`;
  const transferData = {
    productCode: product.productCode,
    transferToProductCode: destination.productCode,
    quantity: 1100,
    fromBucket: 'sellable',
    toBucket: 'supplier_short',
    postingDate: today,
  };
  await verifyFinancialRollback({
    client,
    context,
    endpoint,
    data: transferData,
    phase: 'I06-transfer',
    reports,
    checks,
  });
  const submitTransfer = async (targetQuantity) => {
    await page.goto(`${url}/clothing/operations/inventory`, {
      timeout: 120000,
    });
    await page.getByRole('button', { name: 'Adjustment', exact: true }).click();
    const transferDialog = page.getByRole('dialog', { name: /^adjustments$/i });
    const sourceInput = transferDialog.getByRole('textbox', {
      name: 'Product Code',
      exact: false,
    });
    if ((await sourceInput.inputValue()) !== product.productCode) {
      await sourceInput.fill(product.productCode);
      await page
        .getByRole('option', { name: product.productCode, exact: false })
        .click();
    }
    const destinationInput = transferDialog.getByRole('textbox', {
      name: 'Transfer To',
      exact: true,
    });
    if ((await destinationInput.inputValue()) !== destination.productCode) {
      await destinationInput.fill(destination.productCode);
      await page
        .getByRole('option', { name: destination.productCode, exact: false })
        .click();
    }
    await transferDialog
      .getByRole('textbox', { name: /Transfer Out/ })
      .fill(String(targetQuantity));
    const pending = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/inventory/movements' &&
        response.request().method() === 'POST'
    );
    await transferDialog
      .getByRole('button', { name: 'Save Adjustment', exact: true })
      .click();
    const response = await pending;
    assert.equal(response.status(), 201, await response.text());
    await expect(transferDialog).toHaveCount(0);
    const headers = {
      'Idempotency-Key': response.request().headers()['idempotency-key'],
    };
    const data = response.request().postDataJSON();
    const count = await client.inventoryMovement.count();
    assert.equal(
      (await context.request.post(endpoint, { headers, data })).status(),
      201
    );
    assert.equal(await client.inventoryMovement.count(), count);
    assert.equal(
      (
        await context.request.post(endpoint, {
          headers,
          data: { ...data, quantity: data.quantity + 1 },
        })
      ).status(),
      409
    );
    return (await response.json()).movements;
  };
  const transferred = await submitTransfer(1100);
  assert.equal(transferred.length, 4);
  assert.deepEqual(
    transferred
      .filter((movement) => movement.productCode === destination.productCode)
      .map((movement) => [
        movement.quantity,
        movement.unitCost,
        movement.costBasis,
      ]),
    [
      [1000, 20, 'PURCHASE'],
      [100, 0, 'FREE_GOODS'],
    ]
  );
  assert.deepEqual(
    await reports('I06-transferred-cost-and-money-unchanged'),
    capitalized
  );
  await verifyPurchaseStock({
    page,
    url,
    product: destination,
    expected: [0, 0, 0, 1100, 0, 0],
    artifacts,
    stage: 'I06-destination-transferred-stock',
  });
  await verifyPurchaseStock({
    page,
    url,
    product,
    expected: [1100, 0, 0, 0, 0, 0],
    artifacts,
    stage: 'I06-source-transferred-stock',
  });
  const destinationStock = await context.request.post(
    `${url}/api/inventory/check-stock`,
    { data: { productCode: destination.productCode, requestedQuantity: 1100 } }
  );
  assert.equal(destinationStock.status(), 200);
  assert.equal((await destinationStock.json()).availableStock, 1100);
  for (const method of ['patch', 'delete']) {
    const target =
      method === 'patch' ? endpoint : `${endpoint}?id=${transferred[0].id}`;
    assert.equal(
      (
        await context.request[method](target, {
          data: { id: transferred[0].id, quantity: 1 },
        })
      ).status(),
      409
    );
  }
  const reverseData = {
    ...transferData,
    productCode: destination.productCode,
    transferToProductCode: product.productCode,
    reverseTransfer: true,
  };
  assert.equal(
    (
      await context.request.post(endpoint, {
        headers: { 'Idempotency-Key': randomUUID() },
        data: { ...reverseData, quantity: 1101 },
      })
    ).status(),
    409
  );
  await verifyFinancialRollback({
    client,
    context,
    endpoint,
    data: reverseData,
    phase: 'I06-transfer-reversal',
    reports,
    checks,
  });
  await submitTransfer(1);
  const winner = await verifyFinancialConcurrency({
    client,
    context,
    databaseUrl,
    endpoint,
    data: { ...reverseData, quantity: 1 },
    successStatus: 201,
    rejectedStatus: 409,
    phase: 'I06-last-transferred-unit',
    checks,
  });
  assert.equal(
    (
      await context.request.post(winner.url, {
        headers: { 'Idempotency-Key': winner.key },
        data: winner.data,
      })
    ).status(),
    201
  );
  assert.deepEqual(
    await reports('I06-reversed-history-and-money-preserved'),
    capitalized
  );
  assert.equal(
    await client.inventoryMovement.count({
      where: {
        id: { in: transferred.map((movement) => movement.id) },
        deletedAt: null,
      },
    }),
    4
  );
  await verifyPurchaseStock({
    page,
    url,
    product,
    expected: [1100, 0, 0, 1100, 0, 0],
    artifacts,
    stage: 'I06-reversed-1100-orderable-units',
  });
  await client.price.create({
    data: {
      productId: product.id,
      productCode: product.productCode,
      lowerLimit: 0,
      upperLimit: 1000000,
      currentPrice: 5000,
    },
  });
  for (const [label, quantity] of [
    ['paid', 1000],
    ['free', 100],
  ]) {
    const customer = await client.customer.create({
      data: {
        customerName: `Reconciliation I06 ${label}`,
        date: today,
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
    const order = await reservePurchase(
      { page, client, url, customer, product },
      { quantity, unitPrice: 50, status: 'Warehouse' }
    );
    assert.equal(order.unitPrice, 50, `I06 ${label}: same PHP50 selling price`);
    await page.goto(`${url}/clothing/operations/transactions`, {
      timeout: 120000,
    });
    await page
      .getByRole('textbox', { name: /^Search transactions by customer/ })
      .fill(customer.customerName);
    await page
      .getByRole('gridcell', { name: product.productCode, exact: true })
      .click();
    for (let column = 2; column < 8; column += 1)
      await page.keyboard.press('ArrowRight');
    await page.keyboard.press('F2');
    const editor = page.getByRole('combobox');
    await editor.press('Control+A');
    await editor.pressSequentially('Accounts Receivable');
    await page
      .getByRole('option', { name: 'Accounts Receivable', exact: true })
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
      .toBe('Accounts Receivable');
    const sales = await client.inventoryMovement.findMany({
      where: {
        sourceTransactionId: order.id,
        movementType: 'sale',
        deletedAt: null,
      },
    });
    assert.equal(
      sales.reduce((sum, movement) => sum + movement.quantity, 0),
      quantity
    );
    for (const sale of sales) {
      close(
        Number(sale.unitCost),
        label === 'free' ? 0 : 20,
        `I06 ${label}: original lot cost`
      );
      if (label === 'free') {
        assert.equal(sale.costBasis, 'FREE_GOODS');
        let current = sale;
        const visited = new Set();
        while (current.id !== receipt.id) {
          assert.ok(
            current.sourceMovementId && !visited.has(current.id),
            'I06 free provenance remains linked to original receipt'
          );
          visited.add(current.id);
          current = await client.inventoryMovement.findUniqueOrThrow({
            where: { id: current.sourceMovementId },
          });
          assert.equal(current.unitCost, 0);
          assert.equal(current.costBasis, 'FREE_GOODS');
        }
      }
    }
    const current = await reports(`I06-${label}-sold`);
    close(
      current.profit.stats.cogsTotal - capitalized.profit.stats.cogsTotal,
      20000,
      `I06 ${label}: only paid goods contribute COGS`
    );
    close(
      current.profit.stats.revenueTotal - capitalized.profit.stats.revenueTotal,
      label === 'paid' ? 50000 : 55000,
      `I06 ${label}: normal PHP50 sales revenue`
    );
    close(
      net(current.ledger.entries, 'Stock on Hand') -
        net(capitalized.ledger.entries, 'Stock on Hand'),
      -20000,
      `I06 ${label}: no invented free asset value`
    );
    close(
      net(current.ledger.entries, 'Cash'),
      net(capitalized.ledger.entries, 'Cash'),
      `I06 ${label}: no additional supplier charge`
    );
  }
  await verifyPurchaseStock({
    page,
    url,
    product,
    expected: [1100, 0, 1100, 0, 0, 0],
    artifacts,
    stage: 'I06-paid-and-free-sold',
  });
  checks.push(
    'I06: actual1000 units at PHP20 plus100 supplier-free units; real atomic1100-unit transfer and eligible1099-unit UI reversal plus bounded final-unit race/replay/rollback preserve quantities, original history and source costs despite destination cost999; all1100 sell at the same PHP50, PHP55000 revenue/PHP20000 COGS, no added supplier charge'
  );
}

module.exports = {
  runPurchaseLifecycle,
  runShortageLifecycle,
  runFreeGoodsLifecycle,
  runCancellationReturn,
  runPurchaseCase,
  deliverPurchase,
};
