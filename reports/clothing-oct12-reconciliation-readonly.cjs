const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '..');
const settings = dotenv.parse(fs.readFileSync(path.join(root, '.env.local')));
const target = new URL(settings.DATABASE_URL);
assert.equal(target.hostname, 'localhost');
assert.equal(target.port, '5435');
assert.equal(target.pathname, '/business_management');

const client = new PrismaClient({ datasources: { db: { url: settings.DATABASE_URL } } });
const snapshotSuffix = process.argv.includes('--post-esquire3') ? '-post-esquire3' : process.argv.includes('--post-conversion') ? '-post-conversion' : process.argv.includes('--followup') ? '-followup' : '';
const queries = {
  settings: 'SELECT * FROM public.accounting_settings',
  products: `SELECT id, "createdAt", "updatedAt", "deletedAt", "postingDate", "orderDate",
    product, "productCode", "shipmentCode", "shipmentStatus", payment, quantity,
    "unitPrice", php, "subTotalPHP", "alibabaShippingCost", "transactionFee", "grandTotal",
    "forwardersFee", lalamove, "packagingCost", cogs, "landedUnitCost", "actualPrice",
    "paymentMethod", "paymentCardId", "supplierFulfillmentStatus", "supplierCreditAppliedAmount"
    FROM public.products ORDER BY id`,
  aliases: 'SELECT "productId", code FROM public.product_code_aliases ORDER BY "productId", code',
  shipments: 'SELECT * FROM public.shipments ORDER BY id',
  shippingCalculators: 'SELECT * FROM public.shipping_fee_calculator_states ORDER BY id',
  movements: 'SELECT * FROM public.inventory_movements ORDER BY id',
  transactions: `SELECT id, "createdAt", "updatedAt", "deletedAt", "customerId", "orderDate",
    "productId", "productCode", quantity, "unitPrice", discount, adjustment, "lineTotal",
    "refundQty", "refundAmount", "refundDate", "orderStatus", "invoiceDate", "packedDate",
    "shippedAt", "shipmentCode", "initialDepositAmount", notes
    FROM public.transactions ORDER BY id`,
  payments: `SELECT id, "createdAt", "updatedAt", "deletedAt", "transactionId", "paymentDate",
    amount, method, "isReservation", notes FROM public.transaction_payments ORDER BY id`,
  refunds: 'SELECT * FROM public.transaction_refunds ORDER BY id',
  cancellations: `SELECT id, "transactionId", kind, "decisionDate", "previousStatus",
    "grossAmount", "collectedAmount", "priorRefundAmount", "retainedAmount", "approvedRefundAmount",
    "pendingAmount", "receivableCreditAmount", "initialDepositAmount", "createdAt"
    FROM public.clothing_order_cancellations ORDER BY "createdAt", id`,
  payouts: `SELECT id, "cancellationId", "refundId", amount, "paymentDate", method, "createdAt"
    FROM public.clothing_refund_payouts ORDER BY "paymentDate", id`,
  statusChanges: 'SELECT * FROM public.transaction_status_changes ORDER BY id',
  expenses: `SELECT id, "createdAt", "updatedAt", "deletedAt", date, amount, description,
    category, status, "sourceType", "sourceId", "sourceLineKey", "systemGenerated",
    "paymentMethod", "paymentCardId", notes FROM public.expenses ORDER BY id`,
  journalLines: 'SELECT * FROM public.clothing_accounting_journal_lines ORDER BY date, id',
  openings: 'SELECT * FROM public."ClothingAccountingOpeningBalance" ORDER BY date, id',
  transitBuilds: 'SELECT * FROM public.clothing_inventory_transit_build_entries ORDER BY "postingDate", id',
  reclassifications: 'SELECT * FROM public.clothing_inventory_reclass_entries ORDER BY "postingDate", id',
  recurringTemplates: 'SELECT * FROM public.clothing_recurring_payment_templates ORDER BY id',
  recurringDrafts: 'SELECT * FROM public.clothing_recurring_payment_drafts ORDER BY "dueDate", id',
  agreements: `SELECT id, "investorId", reference, "effectiveDate", principal, "monthlyRateBps",
    notes, "createdAt", "updatedAt" FROM public."ClothingInvestmentAgreement" ORDER BY reference`,
  investorPayments: 'SELECT * FROM public."ClothingInvestmentPayment" ORDER BY "paidDate", id',
  bundles: 'SELECT * FROM public.bundle_batches ORDER BY id',
  bundleComponents: 'SELECT * FROM public.bundle_batch_components ORDER BY id',
  splits: 'SELECT * FROM public.split_batches ORDER BY id',
  splitComponents: 'SELECT * FROM public.split_batch_components ORDER BY id',
  paymentCards: 'SELECT id, bank, label FROM public.payment_cards ORDER BY id',
  inventoryCostEvidence: `SELECT id, operation, result, "createdAt" FROM public.clothing_financial_requests
    WHERE operation IN ('INVENTORY_COST_CORRECTION', 'ZERO_COST_CONFIRMATION') ORDER BY "createdAt", id`,
};

async function main() {
  try {
    const snapshot = await client.$transaction(async transaction => {
      await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const [database] = await transaction.$queryRawUnsafe(`SELECT current_database() AS database,
        current_setting('transaction_read_only') AS "readOnly",
        current_setting('transaction_isolation') AS isolation, now() AS "snapshotAt"`);
      assert.equal(database.database, 'business_management');
      assert.equal(database.readOnly, 'on');
      assert.equal(database.isolation, 'repeatable read');
      const tables = {};
      for (const [name, query] of Object.entries(queries)) {
        assert.match(query.trim(), /^SELECT\b/i);
        tables[name] = await transaction.$queryRawUnsafe(query);
      }
      return {
        target: 'localhost:5435/business_management (development only)',
        database,
        period: { start: '2026-10-12', through: '2026-10-29', timezone: 'Asia/Manila' },
        ownerEvidence: {
          shipmentCode: 'KPC 23930A-236',
          lalamoveAmount: '950.00',
          lalamovePaymentDate: null,
          openingCash: null,
          verifiedClosingCash: null,
        },
        tables,
      };
    }, { isolationLevel: 'RepeatableRead', timeout: 120000, maxWait: 10000 });
    if (process.argv.includes('--verify-current')) {
      const { createHash } = require('node:crypto');
      const sourcePath = path.join(__dirname, `clothing-oct12-reconciliation-data-2026-10-29${snapshotSuffix}.json`);
      const previous = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      const serialize = value => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item);
      const hash = value => createHash('sha256').update(serialize(value)).digest('hex');
      const changedTables = Object.keys(queries).filter(name => hash(snapshot.tables[name]) !== hash(previous.tables[name]));
      console.log(JSON.stringify({
        database: snapshot.database,
        comparedWithSnapshotAt: previous.database.snapshotAt,
        rawSnapshotPreserved: true,
        queriedTables: Object.keys(queries).length,
        changedTables,
        databaseWrites: false,
      }, null, 2));
      assert.equal(changedTables.length, 0, 'Captured evidence differs from current development data; refresh explicitly without overwriting the original snapshot.');
      return;
    }
    const outputPath = path.join(__dirname, `clothing-oct12-reconciliation-data-2026-10-29${snapshotSuffix}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(snapshot, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2) + '\n');
    console.log(JSON.stringify({
      database: snapshot.database,
      period: snapshot.period,
      rows: Object.fromEntries(Object.entries(snapshot.tables).map(([name, rows]) => [name, rows.length])),
      output: path.relative(root, outputPath),
    }, null, 2));
  } finally {
    await client.$disconnect();
  }
}

function analyzeSnapshot() {
  require('tsx/cjs');
  const { Decimal } = require('@prisma/client/runtime/library');
  const { parseDate, endOfDay } = require('../src/lib/accounting/date-utils.ts');
  const { toISODate } = require('../src/utils/date.ts');
  const { buildInventoryItems } = require('../src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts');
  const { normalizeProductCode } = require('../src/lib/inventory/movements.ts');
  const { resolveAutoSaleTransactionId, pickUnitCostFromProductRow, buildCogsEntriesFromMovements, projectDatedMovementCosts, INVENTORY_ASSET_BUCKETS, isKnownZeroAcquisitionCost } = require('../src/lib/accounting/inventoryCogsShared.ts');
  const { isInTransitShipmentStatus } = require('../src/lib/inventory/shipment-status.ts');
  const { getFinancialSourceTransaction, getAccountsReceivableRecognitionDate, hasAccountsReceivableShipment, getTransactionPaymentDebitAccount } = require('../src/lib/accounting/transaction-recognition.ts');
  const { normalizeTransactionAmountsForAccounting } = require('../src/lib/accounting/transaction-normalization.ts');
  const { normalizeAccountForReporting } = require('../src/lib/accounting/account-normalization.ts');
  const { getExpenseCreditAccount } = require('../src/lib/accounting/payment-accounts.ts');
  const { PAID_STATUSES, CLOTHING_ACCOUNTS_RECEIVABLE_STATUSES } = require('../src/lib/accounting/constants.ts');
  const sourcePath = path.join(__dirname, `clothing-oct12-reconciliation-data-2026-10-29${snapshotSuffix}.json`);
  const snapshot = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  assert.equal(snapshot.database.readOnly, 'on');
  const { tables, period } = snapshot;
  const active = rows => rows.filter(row => !row.deletedAt);
  const day = value => {
    const parsed = parseDate(value);
    return parsed ? toISODate(parsed) : null;
  };
  const within = value => day(value) >= period.start && day(value) <= period.through;
  const sum = (rows, selector = value => value) => rows.reduce((total, row) => {
    const value = Number(selector(row) ?? 0);
    assert.ok(Number.isFinite(value));
    return total.plus(value);
  }, new Decimal(0));
  const money = (rows, selector) => sum(rows, selector).toFixed(2);
  const groups = (rows, selector) => {
    const result = new Map();
    for (const row of rows) {
      const key = selector(row);
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(row);
    }
    return result;
  };
  const products = active(tables.products);
  const productsById = new Map(products.map(row => [row.id, row]));
  const productsByCode = groups(products, row => normalizeProductCode(row.productCode));
  const ownerConfirmedAfterOct12ProductIds = new Set([
    291, 292, 293, 294, 295, 296, 297, 298, 299, 300,
    301, 302, 303, 304, 305, 306, 307, 308, 309, 310,
  ]);
  const ownerConfirmedNeverShippedProductIds = new Set([173, 276]);
  const statusByTransaction = groups(tables.statusChanges, row => row.transactionId);
  const cancellationByTransaction = new Map(tables.cancellations.map(row => [row.transactionId, row]));
  const transactions = active(tables.transactions).map(row => ({
    ...row,
    statusChanges: (statusByTransaction.get(row.id) ?? []).sort((left, right) => left.changedAt.localeCompare(right.changedAt)),
    cancellation: cancellationByTransaction.get(row.id) ?? null,
  }));
  const transactionsById = new Map(transactions.map(row => [row.id, row]));
  const payments = active(tables.payments).filter(row => transactionsById.has(row.transactionId) && row.amount > 0);
  const paymentsByTransaction = groups(payments, row => row.transactionId);
  const periodPayments = payments.filter(row => within(row.paymentDate));
  const periodPaymentsByTransaction = groups(periodPayments, row => row.transactionId);
  const isPaid = row => PAID_STATUSES.includes(row.orderStatus?.trim());
  const paidAt = row => row.packedDate || row.statusChanges.find(change => PAID_STATUSES.includes(change.newStatus?.trim()))?.changedAt || row.orderDate;
  const movementDate = row => row.postingDate || row.createdAt;
  const movements = active(tables.movements).filter(row => day(movementDate(row)) <= period.through);
  const periodMovements = movements.filter(row => within(movementDate(row)));
  const saleMovements = movements.filter(row => row.toBucket === 'sold');
  const salesByTransaction = groups(saleMovements, resolveAutoSaleTransactionId);
  const periodSales = periodMovements.filter(row => row.toBucket === 'sold');
  const periodSaleTransactionIds = new Set(periodSales.map(resolveAutoSaleTransactionId).filter(Boolean));
  const virtualCodes = new Set([
    ...tables.bundles.map(row => normalizeProductCode(row.bundleSku)),
    ...tables.splitComponents.map(row => normalizeProductCode(row.componentSku)),
  ]);
  const splitBatches = tables.splits.map(row => ({
    ...row,
    components: tables.splitComponents.filter(component => component.splitBatchId === row.id),
  }));
  const mixBatches = tables.bundles.filter(row => row.bundleName.startsWith('[MIXMATCH] ')).map(row => ({
    ...row,
    mixAndMatchSku: row.bundleSku,
    mixAndMatchName: row.bundleName.slice('[MIXMATCH] '.length),
    components: tables.bundleComponents.filter(component => component.bundleBatchId === row.id).map(component => ({
      productCode: component.componentProductCode,
      includedQuantity: component.includedQuantity,
    })),
  }));
  const shipmentsByCode = new Map(active(tables.shipments).map(row => [normalizeProductCode(row.shipmentCode), row]));
  const inventory = buildInventoryItems(products.map(row => ({
    id: String(row.id),
    'Product Code': row.productCode,
    Quantity: row.quantity,
    COGS: row.cogs,
    'Actual Price': row.actualPrice,
    'Shipment Code': row.shipmentCode,
    'Shipment Status': shipmentsByCode.get(normalizeProductCode(row.shipmentCode))?.shipmentStatus?.trim() || row.shipmentStatus,
    'Supplier Fulfillment Status': row.supplierFulfillmentStatus,
  })), transactions.map(row => ({
    id: String(row.id),
    'Product Code': row.productCode,
    Quantity: row.quantity,
    'Unit Price': row.unitPrice,
    'Order Status': row.orderStatus,
  })), [], movements, mixBatches, splitBatches);
  const resolveProduct = row => {
    if (row.productId && productsById.has(row.productId)) return productsById.get(row.productId);
    const matches = productsByCode.get(normalizeProductCode(row.productCode)) ?? [];
    return matches.length === 1 ? matches[0] : null;
  };
  const movementKey = row => resolveProduct(row)?.id ?? `unresolved:${normalizeProductCode(row.productCode)}`;
  const movementsByProduct = groups(movements, movementKey);
  const bucketBalances = rows => {
    const balances = {};
    for (const row of rows) {
      balances[row.fromBucket] = new Decimal(balances[row.fromBucket] ?? 0).minus(row.quantity).toNumber();
      balances[row.toBucket] = new Decimal(balances[row.toBucket] ?? 0).plus(row.quantity).toNumber();
    }
    return balances;
  };
  const productRows = inventory.map(row => {
    const product = productsById.get(Number(row.id));
    const productMovements = movementsByProduct.get(product.id) ?? [];
    const opening = bucketBalances(productMovements.filter(movement => day(movementDate(movement)) < period.start));
    const activity = bucketBalances(productMovements.filter(movement => within(movementDate(movement))));
    const closing = bucketBalances(productMovements);
    for (const bucket of new Set([...Object.keys(opening), ...Object.keys(activity), ...Object.keys(closing)])) {
      assert.equal(new Decimal(opening[bucket] ?? 0).plus(activity[bucket] ?? 0).toNumber(), closing[bucket] ?? 0);
    }
    const receipts = productMovements.filter(movement =>
      movement.toBucket === 'sellable' &&
      (movement.fromBucket === 'opening_inventory' || (movement.fromBucket === 'scrap' && movement.movementSource !== 'inventory_adjustment')));
    const ledgerStockRemaining = ['sellable', 'reserved', 'damaged_hold', 'assembly_wip'].reduce((total, bucket) => total + (closing[bucket] ?? 0), 0);
    const uiStockRemaining = row.onHandSellable + row.onHandReserved + row.inTransitReserved + row.inTransitUnreserved + row.damagedOnHand;
    return {
      productId: product.id,
      name: product.product,
      code: product.productCode,
      purchaseDate: day(product.orderDate),
      rawPurchaseDate: product.orderDate,
      duplicateCode: (productsByCode.get(normalizeProductCode(product.productCode))?.length ?? 0) > 1,
      ...row,
      productQuantity: product.quantity,
      ledgerReceipts: sum(receipts, movement => movement.quantity).toNumber(),
      ledgerOpening: opening,
      ledgerActivity: activity,
      ledgerClosing: closing,
      ledgerVsUiSellable: (closing.sellable ?? 0) - row.onHandSellable - row.inTransitUnreserved,
      ledgerStockRemaining,
      uiStockRemaining,
      stockRemainingDifference: ledgerStockRemaining - uiStockRemaining,
      knownSupplierFailed: ownerConfirmedNeverShippedProductIds.has(product.id),
      periodSold: sum(productMovements.filter(movement => within(movementDate(movement)) && movement.toBucket === 'sold'), movement => movement.quantity).toNumber(),
      availableAtCatalogCost: money([row.onHandSellable * pickUnitCostFromProductRow(product)]),
      reservedAtCatalogCost: money([row.onHandReserved * pickUnitCostFromProductRow(product)]),
    };
  });
  const saleMatches = [...periodSaleTransactionIds].map(transactionId => {
    const transaction = transactionsById.get(transactionId);
    const sales = salesByTransaction.get(transactionId) ?? [];
    const periodRows = sales.filter(row => within(movementDate(row)));
    const composite = virtualCodes.has(normalizeProductCode(transaction?.productCode));
    const allQuantity = sum(sales, row => row.quantity).toNumber();
    return {
      transactionId,
      productId: transaction?.productId ?? null,
      code: transaction?.productCode ?? null,
      orderDate: transaction?.orderDate ?? null,
      packedDate: transaction?.packedDate ?? null,
      currentStatus: transaction?.orderStatus ?? null,
      orderQuantity: transaction?.quantity ?? null,
      grossOrderValue: transaction ? money([Number(transaction.quantity ?? 0) * Number(transaction.unitPrice ?? 0)]) : null,
      periodMovementQuantity: sum(periodRows, row => row.quantity).toNumber(),
      allSaleMovementQuantity: allQuantity,
      movementIds: sales.map(row => row.id),
      composite,
      quantityMatches: !composite && transaction ? Math.abs(allQuantity - Number(transaction.quantity)) < 0.000001 : null,
    };
  });
  const unitCosts = new Map(products.map(row => [row.productCode?.trim(), pickUnitCostFromProductRow(row)]));
  const cogs = buildCogsEntriesFromMovements({
    movements: periodMovements.map(row => ({ ...row, createdAt: new Date(row.createdAt), when: parseDate(movementDate(row)) })),
    unitCostByProductCode: unitCosts,
    customerNameByTransactionId: new Map(),
    cogsAccount: 'COGS',
    inventoryAccount: 'Stock on Hand',
    cogsDescriptionStyle: 'short',
  });
  const asOf = endOfDay(parseDate(period.through));
  const corrections = tables.inventoryCostEvidence.filter(row => row.operation === 'INVENTORY_COST_CORRECTION').map(row => row.result).filter(result => result && Array.isArray(result.movementCosts));
  const confirmedZeroCostMovementIds = new Set(tables.inventoryCostEvidence.filter(row => row.operation === 'ZERO_COST_CONFIRMATION' && new Date(row.createdAt) <= asOf).map(row => row.result?.movementId).filter(Number.isFinite));
  const reportDatedMovements = projectDatedMovementCosts(movements.filter(row => row.toBucket === 'sold' || row.fromBucket === 'sold').map(row => {
    const transactionId = resolveAutoSaleTransactionId(row);
    const transaction = transactionsById.get(transactionId);
    return {
      ...row,
      createdAt: new Date(row.createdAt),
      when: transactionId ? parseDate(transaction?.packedDate) || new Date(row.createdAt) : parseDate(movementDate(row)),
    };
  }), corrections, asOf).filter(row => row.when >= parseDate(period.start) && row.when <= asOf);
  const reportCogs = buildCogsEntriesFromMovements({
    movements: reportDatedMovements,
    unitCostByProductCode: unitCosts,
    customerNameByTransactionId: new Map(),
    cogsAccount: 'COGS',
    inventoryAccount: 'Stock on Hand',
    cogsDescriptionStyle: 'short',
    confirmedZeroCostMovementIds,
  });
  const reportSaleTransactionIds = new Set(reportDatedMovements.filter(row => row.toBucket === 'sold').map(resolveAutoSaleTransactionId).filter(Boolean));
  const reportSaleMatches = [...reportSaleTransactionIds].map(transactionId => {
    const transaction = transactionsById.get(transactionId);
    const sales = salesByTransaction.get(transactionId) ?? [];
    const quantity = sum(sales, row => row.quantity).toNumber();
    const composite = virtualCodes.has(normalizeProductCode(transaction?.productCode));
    return {
      transactionId,
      productId: transaction?.productId ?? resolveProduct(transaction ?? {})?.id ?? null,
      code: transaction?.productCode ?? null,
      orderQuantity: transaction?.quantity ?? null,
      saleMovementQuantity: quantity,
      grossOrderValue: transaction ? new Decimal(transaction.quantity ?? 0).times(transaction.unitPrice ?? 0).toFixed(2) : null,
      reportDate: day(reportDatedMovements.find(row => resolveAutoSaleTransactionId(row) === transactionId)?.when),
      movementIds: sales.map(row => row.id),
      quantityMatches: !composite && transaction ? Math.abs(quantity - Number(transaction.quantity)) < 0.000001 : null,
    };
  });
  const includedJournal = active(tables.journalLines).filter(row => within(row.date));
  const includedTransit = active(tables.transitBuilds).filter(row => within(row.postingDate));
  const includedOpenings = active(tables.openings).filter(row => within(row.date));
  const cash = account => normalizeAccountForReporting(account) === 'Cash';
  const cashJournal = includedJournal.filter(row => cash(row.account));
  const cashTransit = includedTransit.filter(row => cash(row.creditAccount) || cash(row.debitAccount));
  const cashExpenses = active(tables.expenses).filter(row => within(row.date) && ['approved', 'paid'].includes(row.status) && cash(getExpenseCreditAccount(row)));
  const refunds = active(tables.refunds).filter(row => within(row.refundDate) && transactionsById.has(row.transactionId));
  const draws = cashJournal.filter(row => row.ref === 'SIM-HOUSEHOLD');
  const datedCashPayments = periodPayments.filter(row => getTransactionPaymentDebitAccount({ ...row, transaction: getFinancialSourceTransaction(transactionsById.get(row.transactionId)) }) !== 'Card Collections Clearing');
  const legacyReceipts = [];
  const balanceSheetReceipts = [];
  for (const current of transactions) {
    const transaction = getFinancialSourceTransaction(current);
    const transactionPayments = paymentsByTransaction.get(transaction.id) ?? [];
    const includedPayments = periodPaymentsByTransaction.get(transaction.id) ?? [];
    if (isPaid(transaction) && transactionPayments.length === 0 && within(paidAt(transaction))) {
      legacyReceipts.push({ transactionId: transaction.id, code: transaction.productCode, date: day(paidAt(transaction)), amount: normalizeTransactionAmountsForAccounting(transaction).paymentReceived });
    }
    const recognized = [...PAID_STATUSES, ...CLOTHING_ACCOUNTS_RECEIVABLE_STATUSES].includes(transaction.orderStatus) || Number(transaction.adjustment) > 0 || transactionPayments.length > 0;
    if (!recognized) continue;
    const normalized = normalizeTransactionAmountsForAccounting(transaction);
    const receivableAt = hasAccountsReceivableShipment(transaction) ? getAccountsReceivableRecognitionDate(transaction) : null;
    const recognizesReceivable = within(receivableAt);
    const recognizesPaid = isPaid(transaction) && within(paidAt(transaction));
    const includedDeposits = recognizesReceivable || recognizesPaid;
    const includedReceipts = includedPayments.filter(row => includedDeposits || !row.isReservation);
    const amount = includedPayments.length > 0 ? sum(includedReceipts, row => row.amount).toNumber() : normalized.paymentReceived;
    const sortedPayments = [...includedReceipts].sort((left, right) => String(day(left.paymentDate)).localeCompare(String(day(right.paymentDate))));
    const recognizedAt = recognizesReceivable ? receivableAt : includedPayments.length > 0 && sortedPayments[0] ? sortedPayments[0].paymentDate : isPaid(transaction) ? paidAt(transaction) : includedPayments.find(row => !row.isReservation)?.paymentDate || transaction.orderDate;
    if (within(recognizedAt) && amount > 0) balanceSheetReceipts.push({
      transactionId: transaction.id,
      code: transaction.productCode,
      date: day(recognizedAt),
      amount,
      source: includedPayments.length > 0 ? 'PERIOD_PAYMENT_EVENTS' : 'LEGACY_ORDER_FIELDS',
      hasEarlierPaymentEvents: transactionPayments.length > 0 && includedPayments.length === 0,
    });
    const depositAmount = sum(includedPayments.filter(row => row.isReservation), row => row.amount).toNumber();
    if (depositAmount > 0 && !includedDeposits) balanceSheetReceipts.push({ transactionId: transaction.id, code: transaction.productCode, date: null, amount: depositAmount, source: 'OPEN_OR_FORFEITED_DEPOSIT' });
  }
  const cashJournalNet = sum(cashJournal, row => row.debit - row.credit);
  const cashTransitNet = sum(cashTransit, row => (cash(row.debitAccount) ? row.amount : 0) - (cash(row.creditAccount) ? row.amount : 0));
  const cashOpening = sum(includedOpenings.filter(row => cash(row.account)), row => row.debit - row.credit);
  const directClosing = sum(datedCashPayments, row => row.amount).plus(cashJournalNet).plus(cashTransitNet).plus(cashOpening).minus(sum(cashExpenses, row => row.amount)).minus(sum(refunds, row => row.amount));
  const reportClosing = sum(balanceSheetReceipts, row => row.amount).plus(cashJournalNet).plus(cashTransitNet).plus(cashOpening).minus(sum(cashExpenses, row => row.amount)).minus(sum(refunds, row => row.amount));
  const purchases = products.filter(row => within(row.orderDate));
  const ownerConfirmedPurchases = purchases.filter(row => ownerConfirmedAfterOct12ProductIds.has(row.id));
  assert.equal(ownerConfirmedPurchases.length, 20);
  assert.deepEqual(new Set(products.filter(row => within(row.orderDate) && day(row.orderDate) > period.start).map(row => row.id)), ownerConfirmedAfterOct12ProductIds);
  const dues = includedJournal.filter(row => cash(row.account) && row.credit > 0 && (row.ref.startsWith('SIM-DUES-') || row.ref.startsWith('RECURRING:SIM-DUES-RECURRING-20261029:') || row.ref === 'RECURRING:SIM-DUES-ESQUIRE3-FINAL-20261029'));
  const Papa = require('papaparse');
  const schedule = Papa.parse(fs.readFileSync(path.join(root, 'Czarlie & Ron Mastersheets 2025 - loan_schedule_with_balance.csv'), 'utf8'), { header: true, skipEmptyLines: true });
  assert.equal(schedule.errors.length, 0);
  const scheduleRows = schedule.data.filter(row => Number(row['Due Date']) > 0 && !/DO NOT INCLUDE|Will Start Paying On November/i.test(row.Notes ?? ''));
  const scheduleTotal = predicate => money(scheduleRows.filter(predicate), row => row.Amount);
  const shipment236 = active(tables.shipments).find(row => row.shipmentCode === snapshot.ownerEvidence.shipmentCode);
  const product236 = purchases.filter(row => row.shipmentCode === snapshot.ownerEvidence.shipmentCode);
  const missing236 = sum(product236, row => row.grandTotal).plus(shipment236.fee).plus(snapshot.ownerEvidence.lalamoveAmount);
  const reportBeforeDraw = reportClosing.plus(sum(draws, row => row.credit - row.debit));
  const directBeforeDraw = directClosing.plus(sum(draws, row => row.credit - row.debit));
  const shipment236Fees = new Decimal(shipment236.fee).plus(snapshot.ownerEvidence.lalamoveAmount);
  const ownerConfirmedCashBeforeDraw = directBeforeDraw.minus(shipment236Fees);
  const olderStock = productRows.filter(row => row.purchaseDate && row.purchaseDate < period.start && !row.knownSupplierFailed);
  const purchaseIds = new Set(purchases.map(row => row.id));
  const legacyStock = productRows.filter(row => !purchaseIds.has(row.productId) && !row.knownSupplierFailed);
  const physicalUnits = row => row.onHandSellable + row.onHandReserved + row.damagedOnHand;
  const totals = fields => Object.fromEntries(fields.map(field => [field, sum(productRows, row => row[field]).toNumber()]));
  const summarizeStock = rows => ({
    availableUnits: sum(rows, row => row.onHandSellable).toNumber(),
    reservedUnits: sum(rows, row => row.onHandReserved).toNumber(),
    damagedUnits: sum(rows, row => row.damagedOnHand).toNumber(),
    availableAtCatalogCost: money(rows, row => row.availableAtCatalogCost),
    reservedAtCatalogCost: money(rows, row => row.reservedAtCatalogCost),
    damagedAtCatalogCost: money(rows, row => row.damagedOnHand * pickUnitCostFromProductRow(productsById.get(row.productId))),
    availableAtSavedSellingPrice: money(rows, row => row.endingInventoryValue),
  });
  const preparedOrders = transactions.filter(row => row.orderStatus === 'Prepared' && !salesByTransaction.has(row.id)).map(row => {
    const recordedPayments = paymentsByTransaction.get(row.id) ?? [];
    const normalized = normalizeTransactionAmountsForAccounting(row);
    const collected = recordedPayments.length ? sum(recordedPayments, payment => payment.amount) : new Decimal(normalized.paymentReceived ?? 0);
    return { transactionId: row.id, productId: resolveProduct(row)?.id ?? null, code: row.productCode, requestedUnits: row.quantity, collected: collected.toFixed(2), outstanding: Decimal.max(new Decimal(normalized.grossSale ?? 0).minus(collected), 0).toFixed(2), saleMovementPosted: false };
  });
  const stockAccount = account => normalizeAccountForReporting(account) === 'Stock on Hand';
  const stockAdjustments = periodMovements.filter(row => day(row.createdAt) >= period.start && (row.fromBucket === 'scrap' || row.toBucket === 'scrap')).map(row => {
    const product = resolveProduct(row);
    const unitCost = isKnownZeroAcquisitionCost(row) ? 0 : Number(row.unitCost) > 0 ? row.unitCost : pickUnitCostFromProductRow(product ?? {});
    const status = product?.shipmentStatus?.trim() || shipmentsByCode.get(normalizeProductCode(product?.shipmentCode))?.shipmentStatus || '';
    return { movementId: row.id, from: row.fromBucket, to: row.toBucket, amount: new Decimal(row.quantity).times(unitCost).toFixed(2), seedToStockOnHand: row.fromBucket === 'scrap' && INVENTORY_ASSET_BUCKETS.has(row.toBucket) && !isInTransitShipmentStatus(status), shrinkageFromStockOnHand: row.toBucket === 'scrap' && INVENTORY_ASSET_BUCKETS.has(row.fromBucket) };
  });
  const stockOpening = sum(includedOpenings.filter(row => stockAccount(row.account)), row => row.debit - row.credit);
  const stockManual = sum(includedJournal.filter(row => stockAccount(row.account)), row => row.debit - row.credit);
  const stockTransit = sum(includedTransit, row => (stockAccount(row.debitAccount) ? row.amount : 0) - (stockAccount(row.creditAccount) ? row.amount : 0));
  const stockReclass = sum(active(tables.reclassifications).filter(row => within(row.postingDate)), row => (stockAccount(row.toAccount) ? row.amount : 0) - (stockAccount(row.fromAccount) ? row.amount : 0));
  const stockSeeds = sum(stockAdjustments.filter(row => row.seedToStockOnHand), row => row.amount);
  const stockShrinkage = sum(stockAdjustments.filter(row => row.shrinkageFromStockOnHand), row => row.amount);
  const stockClosing = stockOpening.plus(stockManual).plus(stockTransit).plus(stockReclass).minus(reportCogs.totalCogs).plus(stockSeeds).minus(stockShrinkage);
  const analysis = {
    snapshotAt: snapshot.database.snapshotAt,
    period,
    ownerClarification: {
      recordedOn: '2026-10-29',
      confirmedPurchasesAfterOctober12: Array.from(ownerConfirmedAfterOct12ProductIds),
      neverShippedBySupplier: Array.from(ownerConfirmedNeverShippedProductIds).map(productId => ({ productId, code: productsById.get(productId).productCode })),
      boundaryPurchase: {
        productId: 290,
        code: productsById.get(290).productCode,
        savedOrderDate: productsById.get(290).orderDate,
        ownerConfirmedOrderMonth: '2026-09',
        ownerConfirmedPaidMonth: '2026-09',
        actualPaymentDate: null,
        paymentTimingRelativeToFunding: 'beforeFunding',
        ownerConfirmedLoggingDate: '2026-10-12',
        shippedBeforeOctoberLogging: true,
        ownerConfirmedArrivalDate: '2026-10-13',
        physicalArrivalDateConfirmed: true,
        arrivalShipment: 'KPC 23930A-236',
        ownerConfirmedArrivalKpcAmount: '1530.00',
        ownerConfirmedArrivalCourierAmount: '950.00',
        ownerConfirmedArrivalDeliveryCharges: '2480.00',
        octoberSalesAndMovementsIncluded: true,
        includeAsConfirmedNewCashOutflow: false,
      },
      ownerReportedClosingCash: { amount: '95945.14', approximate: true, independentlyVerified: false },
      rawSnapshotUnchanged: true,
    },
    balanceSheetReview: {
      cash: {
        reproducedReportedCash: reportClosing.toFixed(2),
        datedEventCash: directClosing.toFixed(2),
        earlierReceiptFallback: reportClosing.minus(directClosing).toFixed(2),
        ownerApproximateCash: '95945.14',
        cosmeticAdditionalDraw: reportClosing.minus('95945.14').toFixed(2),
        cosmeticDrawTotal: sum(draws, row => row.credit - row.debit).plus(reportClosing).minus('95945.14').toFixed(2),
        gapAfterRemovingFallbackBeforeUnpostedFees: new Decimal('95945.14').minus(directClosing).toFixed(2),
        datedCashIfFeesWerePaid: directClosing.minus(shipment236Fees).toFixed(2),
        drawAdjustmentAuthorized: false,
      },
      stock: {
        opening: stockOpening.toFixed(2), manualNet: stockManual.toFixed(2), transitNet: stockTransit.toFixed(2), reclassificationNet: stockReclass.toFixed(2),
        cogs: new Decimal(reportCogs.totalCogs).toFixed(2), seeds: stockSeeds.toFixed(2), shrinkage: stockShrinkage.toFixed(2), closing: stockClosing.toFixed(2), adjustmentRows: stockAdjustments,
        legacyBasisExcludingProduct290: summarizeStock(legacyStock),
        preFundingIncludingProduct290: summarizeStock(productRows.filter(row => !ownerConfirmedAfterOct12ProductIds.has(row.productId) && !row.knownSupplierFailed)),
        ownerReportedSellableAtSellingPrice: '54177.00',
        reproducedLegacySellableAtSellingPrice: money(legacyStock, row => row.endingInventoryValue),
        unreconciledSellingValueDifference: new Decimal('54177.00').minus(sum(legacyStock, row => row.endingInventoryValue)).toFixed(2),
        preparedOrdersRetainStockUntilFulfilled: true,
        preparedDemandCanExceedCappedReservedStock: true,
        product290PreparedOrders: preparedOrders.filter(row => row.productId === 290),
        physicalCountVerified: false,
      },
    },
    assertions: { databaseReadOnly: true, snapshotIsolation: snapshot.database.isolation, productBucketRollforwards: productRows.length, applicationInventoryProjectionReused: true },
    inventory: {
      movementCount: periodMovements.length,
      movementQuantity: money(periodMovements, row => row.quantity),
      movementGroups: [...groups(periodMovements, row => `${row.fromBucket}->${row.toBucket}`).entries()].map(([transition, rows]) => ({ transition, rows: rows.length, quantity: sum(rows, row => row.quantity).toNumber() })),
      saleMovementCount: periodSales.length,
      saleUnits: sum(periodSales, row => row.quantity).toNumber(),
      saleOrderCount: saleMatches.length,
      saleOrderValue: money(saleMatches, row => row.grossOrderValue),
      cogs: new Decimal(cogs.totalCogs).toFixed(2),
      valuationIssues: cogs.valuationIssues,
      accountingReportCogs: new Decimal(reportCogs.totalCogs).toFixed(2),
      accountingReportSaleCount: reportDatedMovements.filter(row => row.toBucket === 'sold').length,
      accountingReportSaleUnits: sum(reportDatedMovements.filter(row => row.toBucket === 'sold'), row => row.quantity).toNumber(),
      accountingReportGrossOrderValue: money(reportSaleMatches, row => row.grossOrderValue),
      accountingCogsByProduct: [...groups(reportCogs.entries.filter(row => row.account === 'COGS'), row => row.ref).entries()].map(([ref, rows]) => ({ ref, amount: money(rows, row => row.debit - row.credit) })),
      accountingReportSaleMatches: reportSaleMatches,
      accountingReportSaleMismatches: reportSaleMatches.filter(row => row.quantityMatches === false || !row.code),
      accountingSalesByProduct: [...groups(reportSaleMatches, row => row.code).entries()].map(([code, rows]) => ({ code, orders: rows.length, units: sum(rows, row => row.orderQuantity).toNumber(), gross: money(rows, row => row.grossOrderValue) })),
      accountingReportValuationIssues: reportCogs.valuationIssues,
      accountingReportDatingDifferences: reportDatedMovements.filter(row => !within(movementDate(row))).map(row => ({ id: row.id, transactionId: resolveAutoSaleTransactionId(row), code: row.productCode, quantity: row.quantity, postingDate: row.postingDate, recordedDate: day(row.createdAt), reportDate: day(row.when) })),
      saleMatches,
      totals: totals(['quantity', 'soldQty', 'scrapQty', 'supplierShortQty', 'damagedOnHand', 'onHandSellable', 'onHandReserved', 'inTransitReserved', 'inTransitUnreserved', 'endingInventoryValue']),
      onHandAvailableAtCatalogCost: money(productRows, row => row.availableAtCatalogCost),
      onHandReservedAtCatalogCost: money(productRows, row => row.reservedAtCatalogCost),
      supplierFailedAvailableUnits: sum(productRows.filter(row => row.knownSupplierFailed), row => row.onHandSellable).toNumber(),
      supplierFailedAvailableAtCatalogCost: money(productRows.filter(row => row.knownSupplierFailed), row => row.availableAtCatalogCost),
      availableExcludingSupplierFailedUnits: sum(productRows.filter(row => !row.knownSupplierFailed), row => row.onHandSellable).toNumber(),
      availableExcludingSupplierFailedAtCatalogCost: money(productRows.filter(row => !row.knownSupplierFailed), row => row.availableAtCatalogCost),
      physicalQuantityDrift: productRows.filter(row => Math.abs(row.stockRemainingDifference) > 0.000001).length,
      negativeSellableBucketCount: productRows.filter(row => (row.ledgerClosing.sellable ?? 0) < 0).length,
      olderStockExcludingSupplierFailed: {
        products: olderStock.filter(row => physicalUnits(row) > 0).length,
        available: sum(olderStock, row => row.onHandSellable).toNumber(),
        reserved: sum(olderStock, row => row.onHandReserved).toNumber(),
        damaged: sum(olderStock, row => row.damagedOnHand).toNumber(),
        totalUnits: sum(olderStock, physicalUnits).toNumber(),
        catalogCost: money(olderStock, row => physicalUnits(row) * pickUnitCostFromProductRow(productsById.get(row.productId))),
      },
      legacyStockIncludingUndated: {
        products: legacyStock.filter(row => physicalUnits(row) > 0).length,
        available: sum(legacyStock, row => row.onHandSellable).toNumber(),
        reserved: sum(legacyStock, row => row.onHandReserved).toNumber(),
        damaged: sum(legacyStock, row => row.damagedOnHand).toNumber(),
        totalUnits: sum(legacyStock, physicalUnits).toNumber(),
        catalogCost: money(legacyStock, row => physicalUnits(row) * pickUnitCostFromProductRow(productsById.get(row.productId))),
        undatedProducts: legacyStock.filter(row => !row.purchaseDate && physicalUnits(row) > 0).map(row => ({ productId: row.productId, code: row.code, units: physicalUnits(row) })),
      },
      duplicateCodes: [...productsByCode.entries()].filter(([, rows]) => rows.length > 1).map(([code, rows]) => ({ code, ids: rows.map(row => row.id) })),
      saleMismatches: saleMatches.filter(row => row.quantityMatches === false || !row.code),
      fulfilledWithoutSaleMovement: transactions.filter(row => isPaid(row) && within(paidAt(row)) && !salesByTransaction.has(row.id)).map(row => ({ id: row.id, code: row.productCode, quantity: row.quantity, date: day(paidAt(row)) })),
      unresolvedLedger: [...movementsByProduct.entries()].filter(([key]) => typeof key === 'string').map(([key, rows]) => ({ key, virtual: virtualCodes.has(normalizeProductCode(rows[0].productCode)), movementCount: rows.length, balances: bucketBalances(rows) })),
      backdatedRecordedInPeriod: movements.filter(row => within(row.createdAt) && !within(movementDate(row))).map(row => ({ id: row.id, date: day(movementDate(row)), recordedDate: day(row.createdAt), code: row.productCode, quantity: row.quantity, from: row.fromBucket, to: row.toBucket, notes: row.notes })),
      products: productRows,
      periodMovements,
    },
    cash: {
      ownerConfirmedScope: {
        products: ownerConfirmedPurchases.length,
        productIds: ownerConfirmedPurchases.map(row => row.id),
        purchaseUnits: sum(ownerConfirmedPurchases, row => row.quantity).toNumber(),
        purchaseGrandTotal: money(ownerConfirmedPurchases, row => row.grandTotal),
        supplierFailedProductsIncluded: ownerConfirmedPurchases.some(row => ownerConfirmedNeverShippedProductIds.has(row.id)),
        supplierCashPaymentsAssumed: true,
        shipment236FeesCashPaidInWindowAssumed: true,
        shipment236Fees: shipment236Fees.toFixed(2),
        excludedBoundaryPurchaseIds: [290],
        cashBeforeDrawAssumingZeroOpening: ownerConfirmedCashBeforeDraw.toFixed(2),
        unverifiedClosingTarget: '95945.14',
        unexplainedAtClosingTarget: ownerConfirmedCashBeforeDraw.minus('95945.14').toFixed(2),
        ownerDrawVerified: false,
        actualOpeningCash: null,
        actualClosingCash: null,
      },
      allDatabaseDatedAcquisitionsScenarioStatus: 'Superseded: the owner confirms Product 290 was paid in September before funding. Its saved October 12 order date is logging evidence, not a new period cash payment.',
      periodReceiptEvents: datedCashPayments.length,
      datedDeposits: money(datedCashPayments.filter(row => row.isReservation), row => row.amount),
      datedOtherCollections: money(datedCashPayments.filter(row => !row.isReservation), row => row.amount),
      datedTotalCollections: money(datedCashPayments, row => row.amount),
      legacyPaidOrderFallback: money(legacyReceipts, row => row.amount),
      legacyPaidOrderRows: legacyReceipts,
      balanceSheetCollectionTotal: money(balanceSheetReceipts, row => row.amount),
      balanceSheetFallback: balanceSheetReceipts.filter(row => row.source === 'LEGACY_ORDER_FIELDS'),
      openingCashRepresented: cashOpening.toFixed(2),
      journalCashNet: cashJournalNet.toFixed(2),
      transitCashNet: cashTransitNet.toFixed(2),
      paidOperatingExpenses: money(cashExpenses, row => row.amount),
      operatingExpenseRows: cashExpenses,
      refunds: money(refunds, row => row.amount),
      directEventClosingIncludingSimulation: directClosing.toFixed(2),
      balanceSheetClosingIncludingSimulation: reportClosing.toFixed(2),
      simulatedOwnerDraw: money(draws, row => row.credit - row.debit),
      directCashBeforeDraw: directBeforeDraw.toFixed(2),
      reportCashBeforeDraw: reportBeforeDraw.toFixed(2),
      supersededProduct290CashPaymentScenario: {
        status: 'Contradicted by owner-confirmed September payment; historical calculation only.',
        assumedPurchaseAndFees: missing236.toFixed(2),
        directCashAfter236BeforeDraw: directBeforeDraw.minus(missing236).toFixed(2),
        reportCashAfter236BeforeDraw: reportBeforeDraw.minus(missing236).toFixed(2),
        residualAt95945UsingDatedCollections: directBeforeDraw.minus(missing236).minus('95945.14').toFixed(2),
        residualAt95945UsingReportCollections: reportBeforeDraw.minus(missing236).minus('95945.14').toFixed(2),
      },
      residualAt95945UsingSavedCashMethods: new Decimal(500000).plus(sum(datedCashPayments, row => row.amount)).minus(sum(purchases.filter(row => row.paymentMethod === 'CASH'), row => row.grandTotal)).minus(sum(dues, row => row.credit)).minus(sum(cashExpenses, row => row.amount)).minus(shipment236.fee).minus(snapshot.ownerEvidence.lalamoveAmount).minus('95945.14').toFixed(2),
      duesTotal: money(dues, row => row.credit),
      referenceSchedule: {
        fullOctober: scheduleTotal(() => true),
        beforeOctober12: scheduleTotal(row => Number(row['Due Date']) < 12),
        october12Through28: scheduleTotal(row => Number(row['Due Date']) >= 12 && Number(row['Due Date']) <= 28),
        october29: scheduleTotal(row => Number(row['Due Date']) === 29),
        october30: scheduleTotal(row => Number(row['Due Date']) === 30),
        rows: scheduleRows.map(row => ({ dueDay: Number(row['Due Date']), lender: row['Loan / Creditor'], amount: new Decimal(row.Amount).toFixed(2), notes: row.Notes })),
      },
      duesRows: dues,
      cashJournalRows: cashJournal,
      cashTransitRows: cashTransit,
      purchasesTotal: money(purchases, row => row.grandTotal),
      purchaseUnits: sum(purchases, row => row.quantity).toNumber(),
      purchaseReceiptDifferences: purchases.map(row => {
        const stock = productRows.find(stock => stock.productId === row.id);
        return { productId: row.id, code: row.productCode, productQuantity: row.quantity, ledgerReceipts: stock.ledgerReceipts, difference: row.quantity - stock.ledgerReceipts };
      }).filter(row => row.difference !== 0),
      purchasesBySavedMethod: [...groups(purchases, row => row.paymentMethod).entries()].map(([method, rows]) => ({ method, products: rows.length, amount: money(rows, row => row.grandTotal) })),
      productLogisticsEstimates: money(purchases, row => row.forwardersFee + row.lalamove + row.packagingCost),
      purchases: purchases.map(row => ({ productId: row.id, name: row.product, code: row.productCode, date: row.orderDate, quantity: row.quantity, grandTotal: row.grandTotal, forwarderEstimate: row.forwardersFee, courierEstimate: row.lalamove, packagingEstimate: row.packagingCost, shipmentCode: row.shipmentCode, payment: row.payment, method: row.paymentMethod, card: tables.paymentCards.find(card => card.id === row.paymentCardId)?.label ?? null })),
      shipment236,
      logisticsJournalRows: includedJournal.filter(row => row.sourceType === 'SHIPMENT_LOGISTICS'),
    },
  };
  const outputPath = path.join(__dirname, `clothing-oct12-reconciliation-analysis-2026-10-29${snapshotSuffix}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2) + '\n');
  console.log(JSON.stringify({
    assertions: analysis.assertions,
    inventory: { movementCount: periodMovements.length, movementDatedSaleOrders: saleMatches.length, accountingSaleOrders: reportSaleMatches.length, accountingSaleUnits: analysis.inventory.accountingReportSaleUnits, accountingSaleValue: analysis.inventory.accountingReportGrossOrderValue, accountingSaleMismatches: analysis.inventory.accountingReportSaleMismatches.length, movementDatedCogs: analysis.inventory.cogs, accountingReportCogs: analysis.inventory.accountingReportCogs, olderStock: analysis.inventory.olderStockExcludingSupplierFailed, physicalQuantityDrift: analysis.inventory.physicalQuantityDrift, negativeSellableBuckets: analysis.inventory.negativeSellableBucketCount },
    cash: { ownerConfirmedScope: analysis.cash.ownerConfirmedScope, datedCustomerCollections: analysis.cash.datedTotalCollections, reportedDues: analysis.cash.duesTotal, payroll: analysis.cash.paidOperatingExpenses, allDatabaseDatedAcquisitionsScenarioStatus: analysis.cash.allDatabaseDatedAcquisitionsScenarioStatus },
    output: path.relative(root, outputPath),
  }, null, 2));
}

if (process.argv.includes('--analyze')) {
  try {
    analyzeSnapshot();
  } catch (error) {
    console.error(error.code || error.name, error.message);
    process.exitCode = 1;
  }
} else {
  main().catch(error => {
    console.error(error.code || error.name, error.meta?.message || error.message);
    process.exitCode = 1;
  });
}
