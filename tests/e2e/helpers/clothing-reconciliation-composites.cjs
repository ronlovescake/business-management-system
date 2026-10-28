const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { expect: playwrightExpect } = require('@playwright/test');
const {
  runPurchaseCase,
  deliverPurchase,
} = require('./clothing-reconciliation-scenarios.cjs');

const expect = playwrightExpect.configure({ timeout: 30000 });

async function runCompositeLifecycle(args) {
  const {
    page,
    client,
    context,
    databaseUrl,
    url,
    today,
    reports,
    net,
    close,
    checks,
    artifacts,
  } = args;
  const purchased = [];
  for (const [label, cost] of [
    ['A', 5],
    ['B', 10],
    ['SET', 20],
  ]) {
    const purchase = await runPurchaseCase(args, 'Paid', {
      stage: `I07-${label}`,
      quantity: 100,
      unitPrice: cost,
      stopAfterBuild: true,
    });
    await deliverPurchase({ page, client, url, shipment: purchase.shipment });
    await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
    await page
      .getByPlaceholder('Search products by code, name, shipment code...')
      .fill(purchase.shipment.shipmentCode);
    await page
      .getByRole('gridcell', {
        name: purchase.shipment.shipmentCode,
        exact: true,
      })
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
          where: { productId: purchase.product.id, deletedAt: null },
        })
      )
      .toBe(1);
    purchased.push(purchase.product);
  }
  const [first, second, parent] = purchased;
  const opening = await reports('I07-owned-purchases');
  const post = async (endpoint, data, key = randomUUID(), status = 201) => {
    const response = await context.request.post(`${url}${endpoint}`, {
      headers: { 'Idempotency-Key': key },
      data,
      timeout: 120000,
    });
    assert.equal(
      response.status(),
      status,
      `${endpoint}: ${await response.text()}`
    );
    return response;
  };
  const replays = async (response) => {
    const payload = response.request().postDataJSON();
    const key = response.request().headers()['idempotency-key'];
    const before = await client.inventoryMovement.count();
    assert.equal(
      (
        await context.request.post(response.url(), {
          headers: { 'Idempotency-Key': key },
          data: payload,
        })
      ).status(),
      201
    );
    assert.equal(await client.inventoryMovement.count(), before);
  };
  const customerFor = (label) =>
    client.customer.create({
      data: {
        customerName: `Reconciliation I07 ${label}`,
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
  const reserve = async (label, sku, quantity, unitPrice) => {
    const customer = await customerFor(label);
    const creationKey = randomUUID();
    await post('/api/transactions', [
      {
        creationKey,
        'Order Date': today,
        Customers: customer.customerName,
        'Product Code': sku,
        Quantity: quantity,
        'Unit Price': unitPrice,
        'Line Total': quantity * unitPrice,
        Discount: 0,
        Adjustment: 0,
        'Order Status': 'Warehouse',
        Notes: `I07 ${label}`,
      },
    ]);
    const order = await client.transaction.findUniqueOrThrow({
      where: { creationKey },
    });
    assert.equal(
      order.customerId,
      customer.id,
      'Actual import resolves customer ownership'
    );
    const movements = await client.inventoryMovement.findMany({
      where: {
        sourceTransactionId: order.id,
        movementType: 'reserve',
        deletedAt: null,
      },
    });
    close(
      movements.reduce((sum, movement) => sum + movement.quantity, 0),
      quantity,
      `${label}: actual reserved units`
    );
    return { order, customer };
  };
  const fulfill = async (order) => {
    const response = await context.request.patch(`${url}/api/transactions`, {
      data: {
        id: order.id,
        'Order Status': 'Accounts Receivable',
        'Packed Date': today,
      },
      timeout: 120000,
    });
    assert.equal(response.status(), 200, await response.text());
    assert.equal(
      (await client.transaction.findUniqueOrThrow({ where: { id: order.id } }))
        .orderStatus,
      'Accounts Receivable'
    );
    const sales = await client.inventoryMovement.findMany({
      where: {
        sourceTransactionId: order.id,
        movementType: 'sale',
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
    });
    close(
      sales.reduce((sum, sale) => sum + sale.quantity, 0),
      order.quantity,
      'Every fulfilled unit is recorded exactly once'
    );
    return sales;
  };
  const physicalReturn = async (record, quantity, component) => {
    await page.goto(
      `${url}/clothing/operations/customers/${record.customer.id}`,
      { timeout: 120000 }
    );
    await page.getByRole('tab', { name: /Return\/Refund/ }).click();
    await page
      .getByRole('button', { name: 'Record Physical Return', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: /^record physical return$/i,
    });
    await dialog
      .getByRole('textbox', { name: 'Transaction', exact: true })
      .click();
    await page
      .getByRole('option', { name: new RegExp(`#${record.order.id}\\b`) })
      .click();
    if (component) {
      await dialog
        .getByRole('textbox', { name: 'Returned Component', exact: true })
        .click();
      await page.getByRole('option', { name: component, exact: true }).click();
    }
    await dialog
      .getByRole('textbox', { name: 'Returned Quantity', exact: false })
      .fill(String(quantity));
    await dialog
      .getByRole('textbox', { name: 'Restock Bucket', exact: false })
      .click();
    await page.getByRole('option', { name: 'sellable', exact: true }).click();
    const pending = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/customers/${record.customer.id}/refunds` &&
        response.request().method() === 'POST'
    );
    await dialog
      .getByRole('button', { name: 'Save Physical Return', exact: true })
      .click();
    const response = await pending;
    assert.equal(response.status(), 201, await response.text());
    await expect(dialog).toHaveCount(0);
    await replays(response);
    return response;
  };
  const verifyReturn = async (record, sales, expectedQuantity) => {
    const returns = await client.inventoryMovement.findMany({
      where: {
        sourceTransactionId: record.order.id,
        movementType: 'return',
        deletedAt: null,
      },
    });
    close(
      returns.reduce((sum, movement) => sum + movement.quantity, 0),
      expectedQuantity,
      'Actual bounded physical return quantity'
    );
    for (const movement of returns) {
      const original = sales.find(
        (sale) => sale.id === movement.sourceMovementId
      );
      assert.ok(
        original,
        'Every returned portion links to its original fulfilled allocation'
      );
      assert.equal(movement.productCode, original.productCode);
      close(
        Number(movement.unitCost),
        Number(original.unitCost),
        'Original component cost preserved'
      );
    }
    assert.deepEqual(
      await client.inventoryMovement.findMany({
        where: { id: { in: sales.map((sale) => sale.id) } },
        orderBy: { id: 'asc' },
      }),
      sales,
      'No original sale was rewritten'
    );
  };
  await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
  await page.getByRole('tab', { name: 'Bundles', exact: true }).click();
  await page
    .getByRole('button', { name: /Bundle Batch/, exact: false })
    .click();
  let dialog = page.getByRole('dialog', { name: /^create bundle batch$/i });
  await dialog
    .getByRole('textbox', { name: 'Bundle Name', exact: true })
    .fill('I07 Recorded Kit');
  await dialog
    .getByRole('textbox', { name: 'Quantity', exact: true })
    .fill('30');
  await dialog.getByRole('textbox', { name: 'Price', exact: true }).fill('99');
  await dialog
    .getByPlaceholder('Select SKU', { exact: true })
    .first()
    .fill(first.productCode);
  await page
    .getByRole('option', { name: first.productCode, exact: true })
    .click();
  await dialog
    .getByRole('textbox', { name: 'Included Qty', exact: true })
    .fill('2');
  await dialog.getByRole('button', { name: 'Add SKU', exact: true }).click();
  await dialog
    .getByPlaceholder('Select SKU', { exact: true })
    .nth(1)
    .fill(second.productCode);
  await page
    .getByRole('option', { name: second.productCode, exact: true })
    .click();
  const bundleSaved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/bundles' &&
      response.request().method() === 'POST'
  );
  await dialog
    .getByRole('button', { name: 'Save Bundle', exact: true })
    .click();
  const bundleResponse = await bundleSaved;
  assert.equal(bundleResponse.status(), 201, await bundleResponse.text());
  await replays(bundleResponse);
  const bundle = await bundleResponse.json();
  close(
    (
      await client.inventoryMovement.findMany({
        where: {
          movementSource: 'inventory_bundle',
          movementType: 'bundle_receipt',
        },
      })
    ).reduce(
      (sum, movement) => sum + movement.quantity * Number(movement.unitCost),
      0
    ),
    600,
    'Assembly conserves actual component carrying cost'
  );
  assert.deepEqual(
    await reports('I07-bundle-assembled'),
    opening,
    'Assembly does not acquire value, pay suppliers or create expense'
  );
  const bundleOrder = await reserve('bundle', bundle.bundleSku, 1, 99);
  assert.deepEqual(await reports('I07-bundle-reserved'), opening);
  const bundleSales = await fulfill(bundleOrder.order);
  close(
    Number(bundleSales[0].unitCost),
    20,
    'Assembled bundle recorded cost, not selling price99'
  );
  await physicalReturn(bundleOrder, 1);
  await verifyReturn(bundleOrder, bundleSales, 1);
  const bundleReturned = await reports('I07-bundle-returned');
  close(
    bundleReturned.profit.stats.cogsTotal - opening.profit.stats.cogsTotal,
    0,
    'Bundle original carrying cost fully restored'
  );
  close(
    bundleReturned.profit.stats.revenueTotal -
      opening.profit.stats.revenueTotal,
    99,
    'Physical return is separate from monetary decision'
  );
  const bundlePayload = bundleResponse.request().postDataJSON();
  assert.equal(
    (
      await context.request.patch(`${url}/api/bundles`, {
        data: { ...bundlePayload, id: bundle.id, price: 999 },
      })
    ).status(),
    409
  );
  assert.equal(
    (
      await context.request.delete(`${url}/api/bundles?id=${bundle.id}`)
    ).status(),
    409
  );

  await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
  await page.getByRole('tab', { name: 'Mix & Match', exact: true }).click();
  await page.getByRole('button', { name: 'Mix & Match', exact: false }).click();
  dialog = page.getByRole('dialog', { name: /^create mix & match$/i });
  await dialog
    .getByRole('textbox', { name: 'Mix & Match Name', exact: true })
    .fill('I07 Original Mix');
  await dialog.getByRole('textbox', { name: 'Price', exact: true }).fill('50');
  await dialog
    .getByPlaceholder('Select SKU', { exact: true })
    .first()
    .fill(first.productCode);
  await page
    .getByRole('option', { name: first.productCode, exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Add SKU', exact: true }).click();
  await dialog
    .getByPlaceholder('Select SKU', { exact: true })
    .nth(1)
    .fill(second.productCode);
  await page
    .getByRole('option', { name: second.productCode, exact: true })
    .click();
  const mixSaved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/mix-and-match' &&
      response.request().method() === 'POST'
  );
  await dialog
    .getByRole('button', { name: 'Save Mix & Match', exact: true })
    .click();
  const mixResponse = await mixSaved;
  assert.equal(mixResponse.status(), 201, await mixResponse.text());
  const mix = await mixResponse.json();
  const mixOrder = await reserve('mix', mix.mixAndMatchSku, 6, 50);
  const mixReserved = await reports('I07-mix-reserved');
  assert.deepEqual(mixReserved, bundleReturned);
  const mixSales = await fulfill(mixOrder.order);
  assert.equal(new Set(mixSales.map((sale) => sale.productCode)).size, 2);
  const chosen = mixSales[0];
  await physicalReturn(mixOrder, 1, chosen.productCode);
  await verifyReturn(mixOrder, mixSales, 1);
  const mixReturned = await reports('I07-mix-returned');
  const mixCost =
    mixSales.reduce(
      (sum, sale) => sum + sale.quantity * Number(sale.unitCost),
      0
    ) - Number(chosen.unitCost);
  close(
    mixReturned.profit.stats.cogsTotal - bundleReturned.profit.stats.cogsTotal,
    mixCost,
    'Only the actual selected component cost reverses'
  );
  close(
    mixReturned.profit.stats.revenueTotal -
      bundleReturned.profit.stats.revenueTotal,
    300,
    'All six mix items generate positive customer revenue'
  );
  assert.equal(
    (
      await context.request.patch(`${url}/api/mix-and-match`, {
        data: {
          ...mixResponse.request().postDataJSON(),
          id: mix.id,
          price: 999,
        },
      })
    ).status(),
    409
  );
  assert.equal(
    (
      await context.request.delete(`${url}/api/mix-and-match?id=${mix.id}`)
    ).status(),
    409
  );
  const retryMix = await context.request.patch(`${url}/api/transactions`, {
    data: {
      id: mixOrder.order.id,
      Notes: 'I07 availability changed, original allocation retained',
    },
  });
  assert.equal(retryMix.status(), 200, await retryMix.text());
  await verifyReturn(mixOrder, mixSales, 1);

  await page.goto(`${url}/clothing/operations/products`, { timeout: 120000 });
  await page.getByRole('tab', { name: 'Split', exact: true }).click();
  await page.getByRole('button', { name: 'Split Batch', exact: false }).click();
  dialog = page.getByRole('dialog', { name: /^create split batch$/i });
  await dialog
    .getByRole('textbox', { name: 'Parent SKU (Set Product)', exact: true })
    .fill(parent.productCode);
  await page
    .getByRole('option', { name: parent.productCode, exact: true })
    .click();
  const labels = dialog.getByPlaceholder('e.g. Top, Bottom, Bonnet', {
    exact: true,
  });
  const skuInputs = dialog.getByPlaceholder('e.g. OCWW-TOP-030426', {
    exact: true,
  });
  const childCodes = ['I07-EXACT-TOP', 'I07-EXACT-BOTTOM'];
  for (let index = 0; index < 2; index += 1) {
    await labels.nth(index).fill(index === 0 ? 'Top' : 'Bottom');
    await skuInputs.nth(index).fill(childCodes[index]);
    await dialog
      .getByRole('textbox', {
        name: `Acquisition cost ${index + 1}`,
        exact: true,
      })
      .fill(index === 0 ? '5' : '10');
  }
  await dialog
    .getByRole('textbox', { name: 'Included Qty', exact: true })
    .fill('2');
  const splitSaved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/split-batches' &&
      response.request().method() === 'POST'
  );
  await dialog
    .getByRole('button', { name: 'Save Split Batch', exact: true })
    .click();
  const splitResponse = await splitSaved;
  assert.equal(splitResponse.status(), 201, await splitResponse.text());
  const split = await splitResponse.json();
  const topOrder = await reserve('split-top', childCodes[0], 2, 50);
  const bottomOrder = await reserve('split-bottom', childCodes[1], 1, 50);
  const opened = await client.inventoryMovement.findMany({
    where: {
      productCode: parent.productCode,
      movementType: 'split_open',
      deletedAt: null,
    },
  });
  close(
    opened.reduce((sum, movement) => sum + movement.quantity, 0),
    1,
    'Sibling orders open one original set, not one per child quantity'
  );
  assert.deepEqual(
    await reports('I07-split-opened-and-reserved'),
    mixReturned,
    'Break-pack conserves value and reservation creates no expense'
  );
  const topSales = await fulfill(topOrder.order);
  const bottomSales = await fulfill(bottomOrder.order);
  close(Number(topSales[0].unitCost), 5, 'Explicit top acquisition cost');
  close(
    Number(bottomSales[0].unitCost),
    10,
    'Explicit bottom acquisition cost'
  );
  await physicalReturn(topOrder, 1);
  assert.equal(
    await client.inventoryMovement.count({
      where: { movementType: 'split_rebuild_receipt', deletedAt: null },
    }),
    0,
    'A partial returned top must remain loose'
  );
  await physicalReturn(bottomOrder, 1);
  assert.equal(
    await client.inventoryMovement.count({
      where: { movementType: 'split_rebuild_receipt', deletedAt: null },
    }),
    0,
    'One missing top prevents parent reconstruction'
  );
  const {
    verifyFinancialRollback,
    verifyFinancialConcurrency,
  } = require('./clothing-reconciliation-atomicity.cjs');
  const endpoint = `${url}/api/customers/${topOrder.customer.id}/refunds`;
  const lastReturn = {
    transactionId: topOrder.order.id,
    refundDate: today,
    amount: 0,
    returnedQuantity: 1,
    restockBucket: 'sellable',
  };
  await verifyFinancialRollback({
    client,
    context,
    endpoint,
    data: lastReturn,
    phase: 'I07-complete-original-set',
    reports,
    checks,
  });
  const winner = await verifyFinancialConcurrency({
    client,
    context,
    databaseUrl,
    endpoint,
    data: lastReturn,
    successStatus: 201,
    rejectedStatus: 400,
    phase: 'I07-last-original-piece',
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
  const rebuilt = await client.inventoryMovement.findMany({
    where: { movementType: 'split_rebuild_receipt', deletedAt: null },
  });
  assert.equal(rebuilt.length, 1);
  assert.equal(rebuilt[0].quantity, 1);
  assert.equal(rebuilt[0].unitCost, 20);
  assert.equal(rebuilt[0].sourceMovementId, opened[0].id);
  await verifyReturn(topOrder, topSales, 2);
  await verifyReturn(bottomOrder, bottomSales, 1);
  const final = await reports('I07-complete-original-set-restored');
  close(
    final.profit.stats.cogsTotal,
    mixReturned.profit.stats.cogsTotal,
    'Every split child original cost is restored exactly once'
  );
  close(
    net(final.ledger.entries, 'Stock on Hand'),
    net(mixReturned.ledger.entries, 'Stock on Hand'),
    'Complete original split set conserves total carrying value'
  );
  for (const [code, available] of [
    [parent.productCode, 100],
    [childCodes[0], 200],
    [childCodes[1], 100],
  ]) {
    const response = await post(
      '/api/inventory/check-stock',
      { productCode: code, requestedQuantity: 1 },
      randomUUID(),
      200
    );
    close(
      (await response.json()).availableStock,
      available,
      `${code}: exact parent/child capacity after full physical return`
    );
  }
  assert.equal(
    (
      await context.request.patch(`${url}/api/split-batches`, {
        data: { ...splitResponse.request().postDataJSON(), id: split.id },
      })
    ).status(),
    409
  );
  assert.equal(
    (
      await context.request.delete(`${url}/api/split-batches?id=${split.id}`)
    ).status(),
    409
  );
  await page.goto(`${url}/clothing/operations/inventory`, { timeout: 120000 });
  await page.screenshot({
    path: path.join(artifacts, 'I07-final-original-components.png'),
    fullPage: true,
  });
  checks.push(
    'I07: actual purchased source lots -> UI bundle assembly / mix definition / explicit-cost split definition -> authenticated order reservation and full fulfillment -> real component-selecting physical returns; original sale/cost/source allocations immutable; split partial pieces remain loose, complete original set rebuilt once with rollback and competing last-piece return; five reports conserve value without duplicate acquisition, expense or payment'
  );
}

module.exports = { runCompositeLifecycle };
