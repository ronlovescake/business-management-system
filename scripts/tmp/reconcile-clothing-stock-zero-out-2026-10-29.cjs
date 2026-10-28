const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
require('tsx/cjs');
const {
  buildInventoryItems,
} = require('../../src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts');
const {
  normalizeProductCode,
} = require('../../src/lib/inventory/movements.ts');
const { toISODate } = require('../../src/utils/date.ts');

const operation = 'CLOTHING-OLD-STOCK-ZERO-20261029';
const production = 'business-management-production-db-1';
const rehearsal = 'bms-clothing-stock-rehearsal-20261029';
const database = 'business_management';
const effectiveDate = '2026-10-11';
const evidenceDirectory =
  '/home/ron/business-management-system-data/production/backup/clothing-accounting-corrections-20261029';
const targets = [
  {
    id: 284,
    code: 'Girls Onesie (GO-091526)',
    sold: 360,
    reserved: 50,
    reverse: [
      [5455, 591],
      [5458, 1],
      [5459, 590],
    ],
  },
  {
    id: 184,
    code: 'Baby Pants (BP-022326)',
    sold: 110,
    reserved: 0,
    reverse: [],
  },
  {
    id: 174,
    code: 'Sleeveless Onesie (SO-020726)',
    sold: 177,
    reserved: 0,
    reverse: [],
  },
  {
    id: 160,
    code: 'H&M Shorts (HMS-012826)',
    sold: 27,
    reserved: 0,
    reverse: [],
  },
  {
    id: 133,
    code: 'Premium Short (PS-012426)',
    sold: 700,
    reserved: 0,
    reverse: [],
  },
  {
    id: 130,
    code: 'Romper (R-012426)',
    sold: 285,
    reserved: 0,
    reverse: [[5502, 1]],
  },
  {
    id: 274,
    code: 'Chickpea Onesie (CO-081026)',
    sold: 516,
    reserved: 0,
    reverse: [[5470, 65]],
  },
];
const readTables = {
  products: 'products',
  transactions: 'transactions',
  movements: 'inventory_movements',
  shipments: 'shipments',
  bundles: 'bundle_batches',
  bundleComponents: 'bundle_batch_components',
  splits: 'split_batches',
  splitComponents: 'split_batch_components',
};
const protectedTables = [
  ...Object.values(readTables).filter(
    (table) => table !== 'inventory_movements'
  ),
  'accounting_settings',
  'transaction_payments',
  'transaction_refunds',
  'transaction_status_changes',
  'clothing_order_cancellations',
  'clothing_refund_payouts',
  'clothing_financial_requests',
  'clothing_accounting_journal_lines',
  'expenses',
  'ClothingAccountingOpeningBalance',
  'clothing_inventory_transit_build_entries',
  'clothing_inventory_reclass_entries',
  'ClothingInvestmentAgreement',
  'ClothingInvestmentPayment',
  'clothing_recurring_payment_templates',
  'clothing_recurring_payment_drafts',
];
const active = (rows) => rows.filter((row) => !row.deletedAt);
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const fileHash = (file) =>
  createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const isCorrection = (row) => (row.notes ?? '').startsWith(`${operation}:`);

function verifyContainer(containerName) {
  assert.ok([production, rehearsal].includes(containerName));
  const inspected = spawnSync('docker', ['inspect', containerName], {
    encoding: 'utf8',
  });
  assert.equal(inspected.status, 0);
  const container = JSON.parse(inspected.stdout)[0];
  if (containerName === production) {
    assert.equal(
      container.Config.Labels['com.docker.compose.project.working_dir'],
      '/home/ron/Websites Production/business-management-production'
    );
    assert.ok(
      container.HostConfig.PortBindings['5432/tcp'].some(
        (binding) => binding.HostPort === '5432'
      )
    );
  } else {
    assert.equal(container.HostConfig.NetworkMode, 'none');
    assert.equal(container.Config.Labels['bms.correction'], operation);
    assert.deepEqual(container.HostConfig.PortBindings ?? {}, {});
  }
  const relative =
    'src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts';
  assert.equal(
    fileHash(path.resolve(relative)),
    fileHash(
      path.join(
        '/home/ron/Websites Production/business-management-production',
        relative
      )
    ),
    'Production projection differs from development.'
  );
}

function query(container, input, descriptor) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      '-u',
      'postgres',
      container,
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-d',
      database,
    ],
    {
      input,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      ...(descriptor ? { stdio: ['pipe', descriptor, 'pipe'] } : {}),
    }
  );
  assert.equal(result.status, 0, (result.stderr ?? '').split('\nQUERY:')[0]);
  return result.stdout?.trim();
}

function rows(
  table,
  where = 'TRUE',
  expression = 'to_jsonb(record)',
  order = 'record.id'
) {
  return `(SELECT COALESCE(jsonb_agg(${expression} ORDER BY ${order}), '[]'::jsonb) FROM public."${table}" record WHERE ${where})`;
}

function protectedSql() {
  const values = protectedTables.map(
    (table) => `${literal(table)}, md5(${rows(table)}::text)`
  );
  values.push(
    `'originalMovements', md5(${rows('inventory_movements', `COALESCE(record.notes, '') NOT LIKE ${literal(`${operation}:%`)}`)}::text)`
  );
  return `SELECT jsonb_build_object(${values.join(',')})`;
}

function capture(container = production) {
  verifyContainer(container);
  const values = Object.entries(readTables).map(
    ([name, table]) => `${literal(name)}, ${rows(table)}`
  );
  const input = `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
    SET LOCAL statement_timeout = '30s';
    SELECT jsonb_build_object('database', current_database(), 'readOnly', current_setting('transaction_read_only'),
      'snapshotAt', now(), 'protected', (${protectedSql()}), 'tables', jsonb_build_object(${values.join(',')}));
    COMMIT;`;
  const snapshot = JSON.parse(query(container, input));
  assert.equal(snapshot.database, database);
  assert.equal(snapshot.readOnly, 'on');
  return snapshot;
}

function project(tables, movements) {
  const shipments = new Map(
    active(tables.shipments).map((row) => [
      normalizeProductCode(row.shipmentCode),
      row,
    ])
  );
  const products = active(tables.products).map((row) => ({
    id: String(row.id),
    'Product Code': row.productCode,
    Quantity: row.quantity,
    COGS: row.cogs,
    'Actual Price': row.actualPrice,
    'Shipment Code': row.shipmentCode,
    'Shipment Status':
      shipments
        .get(normalizeProductCode(row.shipmentCode))
        ?.shipmentStatus?.trim() || row.shipmentStatus,
    'Supplier Fulfillment Status': row.supplierFulfillmentStatus,
  }));
  const transactions = active(tables.transactions).map((row) => ({
    id: String(row.id),
    'Product Code': row.productCode,
    Quantity: row.quantity,
    'Unit Price': row.unitPrice,
    'Order Status': row.orderStatus,
  }));
  const mixes = active(tables.bundles)
    .filter((row) => row.bundleName.startsWith('[MIXMATCH] '))
    .map((row) => ({
      ...row,
      mixAndMatchSku: row.bundleSku,
      mixAndMatchName: row.bundleName.slice('[MIXMATCH] '.length),
      components: tables.bundleComponents
        .filter((component) => component.bundleBatchId === row.id)
        .map((component) => ({
          productCode: component.componentProductCode,
          includedQuantity: component.includedQuantity,
        })),
    }));
  const splits = active(tables.splits).map((row) => ({
    ...row,
    components: tables.splitComponents.filter(
      (component) => component.splitBatchId === row.id
    ),
  }));
  return buildInventoryItems(
    products,
    transactions,
    [],
    movements,
    mixes,
    splits
  );
}

function preview(snapshot) {
  const tables = snapshot.tables;
  const movements = active(tables.movements).filter(
    (row) => !isCorrection(row)
  );
  const before = project(tables, movements);
  const reversals = [];
  for (const target of targets) {
    const product = active(tables.products).find((row) => row.id === target.id);
    assert.equal(product.productCode, target.code);
    for (const [id, quantity] of target.reverse) {
      const original = movements.find((row) => row.id === id);
      assert.ok(original, `Missing reviewed zeroing movement ${id}.`);
      assert.equal(original.productCode, target.code);
      assert.equal(original.quantity, quantity);
      assert.ok(
        [original.fromBucket, original.toBucket].every((bucket) =>
          ['sellable', 'supplier_short'].includes(bucket)
        )
      );
      assert.ok(
        !/^(additionals|transfer)/i.test(original.notes ?? ''),
        `Source-owned receipt/transfer ${id} cannot be reversed as a zeroing mistake.`
      );
      reversals.push({
        productCode: target.code,
        quantity,
        fromBucket: original.toBucket,
        toBucket: original.fromBucket,
        movementSource: 'inventory_adjustment',
        movementType: 'adjustment',
        postingDate: original.postingDate || toISODate(original.createdAt),
        notes: `${operation}: reverse mistaken zero-out movement ${id}; not a new receipt or supplier credit.`,
      });
    }
  }
  const recovered = project(tables, [...movements, ...reversals]);
  const scraps = targets
    .map((target) => {
      const item = recovered.find((row) => Number(row.id) === target.id);
      assert.equal(item.soldQty, target.sold);
      assert.equal(item.onHandReserved, target.reserved);
      assert.equal(item.inTransitReserved, 0);
      assert.equal(item.inTransitUnreserved, 0);
      return {
        productCode: target.code,
        quantity: item.onHandSellable,
        fromBucket: 'sellable',
        toBucket: 'scrap',
        movementSource: 'inventory_adjustment',
        movementType: 'adjustment',
        postingDate: effectiveDate,
        notes: `${operation}: ${target.code} old-stock sellable write-off; preserve sold and reserved quantities.`,
      };
    })
    .filter((row) => row.quantity > 0);
  const damaged = recovered.find((row) => Number(row.id) === 133);
  assert.equal(damaged.damagedOnHand, 6);
  scraps.push({
    productCode: 'Premium Short (PS-012426)',
    quantity: 6,
    fromBucket: 'damaged_hold',
    toBucket: 'scrap',
    movementSource: 'inventory_adjustment',
    movementType: 'adjustment',
    postingDate: effectiveDate,
    notes: `${operation}: owner-approved disposal of 6 damaged old-stock units; no sale or reservation change.`,
  });
  const after = project(tables, [...movements, ...reversals, ...scraps]);
  const selected = targets.map((target) => {
    const original = before.find((row) => Number(row.id) === target.id);
    const restored = recovered.find((row) => Number(row.id) === target.id);
    const final = after.find((row) => Number(row.id) === target.id);
    assert.equal(final.onHandSellable, 0);
    assert.equal(final.soldQty, restored.soldQty);
    assert.equal(final.onHandReserved, restored.onHandReserved);
    assert.equal(final.damagedOnHand, 0);
    assert.equal(final.supplierShortQty, 0);
    const raw = [...movements, ...reversals, ...scraps].filter(
      (row) => row.productCode === target.code
    );
    const rawSellable = raw.reduce(
      (total, row) =>
        total +
        (row.toBucket === 'sellable' ? row.quantity : 0) -
        (row.fromBucket === 'sellable' ? row.quantity : 0),
      0
    );
    assert.equal(
      rawSellable,
      0,
      `${target.code}: raw sellable ledger must also end at zero.`
    );
    return {
      product: target.code,
      currentlyAvailable: original.onHandSellable,
      afterReversingZeroingMistakes: restored.onHandSellable,
      proposedSellableScrap:
        scraps.find((row) => row.productCode === target.code)?.quantity ?? 0,
      soldPreserved: final.soldQty,
      reservedPreserved: final.onHandReserved,
      damagedScrap: target.id === 133 ? 6 : 0,
      damagedRemaining: final.damagedOnHand,
      supplierShortAfter: final.supplierShortQty,
      finalAvailable: final.onHandSellable,
      rawSellableAfter: rawSellable,
    };
  });
  const untouched = (rows) =>
    rows.filter(
      (row) => !targets.some((target) => Number(row.id) === target.id)
    );
  assert.deepEqual(
    untouched(after),
    untouched(before),
    'Another product projection changed.'
  );
  const reserve = active(tables.transactions).find((row) => row.id === 3545);
  assert.equal(reserve.productCode, targets[0].code);
  assert.equal(reserve.quantity, 50);
  assert.equal(
    scraps.reduce((total, row) => total + row.quantity, 0),
    782
  );
  return {
    operation,
    mode: 'READ ONLY PREVIEW',
    snapshotAt: snapshot.snapshotAt,
    effectiveDate,
    proposedReversals: reversals.length,
    proposedScrapMovements: scraps.length,
    totalScrap: scraps.reduce((total, row) => total + row.quantity, 0),
    products: selected,
    proposedMovements: [...reversals, ...scraps].map((row) => ({
      ...row,
      productId: targets.find((target) => target.code === row.productCode).id,
      unitCost: null,
      costBasis: null,
      sourceMovementId: null,
      sourceTransactionId: null,
      supplierShortResolution: null,
      supplierShortExpectedShipmentCode: null,
      supplierCreditReference: null,
      supplierCreditAmount: null,
      deletedAt: null,
    })),
    reviewedSupplierShortMovements: movements
      .filter(
        (row) =>
          targets.some((target) => target.code === row.productCode) &&
          (row.fromBucket === 'supplier_short' ||
            row.toBucket === 'supplier_short')
      )
      .map(
        ({
          id,
          productCode,
          quantity,
          fromBucket,
          toBucket,
          notes,
          supplierShortResolution,
        }) => ({
          id,
          productCode,
          quantity,
          fromBucket,
          toBucket,
          notes,
          supplierShortResolution,
        })
      ),
  };
}

function save(file, value) {
  assert.equal(path.dirname(path.resolve(file)), evidenceDirectory);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
}

function prepare() {
  const before = capture();
  assert.equal(before.tables.movements.filter(isCorrection).length, 0);
  const proposal = preview(before);
  const stamp = new Date().toISOString().replaceAll(/[-:.]/g, '');
  const file = path.join(
    evidenceDirectory,
    `business_management_production_pre-stock-zero_${stamp}.dump`
  );
  const output = fs.openSync(file, 'wx', 0o600);
  let dump;
  try {
    dump = spawnSync(
      'docker',
      [
        'exec',
        '-u',
        'postgres',
        production,
        'pg_dump',
        '--no-password',
        '--format=custom',
        '--no-owner',
        '--no-acl',
        '--dbname=business_management',
      ],
      { stdio: ['ignore', output, 'pipe'], encoding: 'utf8' }
    );
  } finally {
    fs.closeSync(output);
  }
  assert.equal(dump.status, 0, dump.stderr);
  const input = fs.openSync(file, 'r');
  let listing;
  try {
    listing = spawnSync(
      'docker',
      ['exec', '-i', '-u', 'postgres', production, 'pg_restore', '--list'],
      {
        stdio: [input, 'pipe', 'pipe'],
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      }
    );
  } finally {
    fs.closeSync(input);
  }
  assert.equal(listing.status, 0);
  for (const table of [
    'inventory_movements',
    'products',
    'transactions',
    'clothing_refund_payouts',
  ])
    assert.ok(listing.stdout.includes(table));
  const after = capture();
  assert.deepEqual(
    after.tables,
    before.tables,
    'Source tables changed during backup.'
  );
  assert.deepEqual(
    after.protected,
    before.protected,
    'Protected sources changed during backup.'
  );
  const backup = {
    file,
    sha256: fileHash(file),
    bytes: fs.statSync(file).size,
    createdAt: new Date().toISOString(),
    archiveVerified: true,
  };
  save(`${file}.json`, { operation, container: production, ...backup });
  const planFile = path.join(
    evidenceDirectory,
    `production-stock-zero-plan_${stamp}.json`
  );
  save(planFile, {
    operation,
    effectiveDate,
    before,
    proposal,
    backup,
    scriptSha256: fileHash(__filename),
  });
  console.log(
    JSON.stringify(
      { plan: planFile, mode: 'PREPARED ONLY', backup, totalScrap: 782 },
      null,
      2
    )
  );
}

function loadPlan(file) {
  assert.ok(file);
  assert.equal(path.dirname(path.resolve(file)), evidenceDirectory);
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(plan.operation, operation);
  assert.equal(plan.effectiveDate, effectiveDate);
  assert.equal(plan.scriptSha256, fileHash(__filename));
  assert.equal(fileHash(plan.backup.file), plan.backup.sha256);
  assert.deepEqual(preview(plan.before), plan.proposal);
  return plan;
}

function verifyAfter(after, plan) {
  assert.deepEqual(
    after.protected,
    plan.before.protected,
    'Unrelated source data changed.'
  );
  assert.deepEqual(
    after.tables.movements.filter((row) => !isCorrection(row)),
    plan.before.tables.movements
  );
  const inserted = after.tables.movements.filter(isCorrection);
  assert.equal(inserted.length, 13);
  for (const expected of plan.proposal.proposedMovements) {
    const row = inserted.find((movement) => movement.notes === expected.notes);
    assert.ok(row);
    const { id, createdAt, updatedAt, ...content } = row;
    assert.ok(Number.isInteger(id) && createdAt && updatedAt);
    assert.deepEqual(content, expected);
  }
  const actual = project(after.tables, active(after.tables.movements));
  const expected = project(plan.before.tables, [
    ...active(plan.before.tables.movements),
    ...plan.proposal.proposedMovements,
  ]);
  assert.deepEqual(actual, expected);
  return {
    totalScrap: 782,
    insertedMovements: 13,
    protectedSources: Object.keys(after.protected).length,
    products: plan.proposal.products.map((row) => ({
      product: row.product,
      sellable: 0,
      damaged: 0,
      supplierShort: 0,
      sold: row.soldPreserved,
      reserved: row.reservedPreserved,
    })),
  };
}

function guard(condition, message) {
  return `DO $guard$ BEGIN IF (${condition}) IS DISTINCT FROM TRUE THEN RAISE EXCEPTION ${literal(message)}; END IF; END $guard$;`;
}

function transactionStart() {
  return `BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    SET LOCAL statement_timeout = '30s'; SET LOCAL lock_timeout = '2s';
    SELECT pg_advisory_xact_lock(hashtext(${literal(operation)}));
    LOCK TABLE ${[...protectedTables, 'inventory_movements'].map((table) => `public."${table}"`).join(',')}
      IN SHARE ROW EXCLUSIVE MODE NOWAIT;`;
}

function execute(planFile, container, rollback = false) {
  const plan = loadPlan(planFile);
  const before = capture(container);
  if (before.tables.movements.some(isCorrection)) {
    const verified = verifyAfter(before, plan);
    console.log(JSON.stringify({ idempotentNoop: true, ...verified }));
    return;
  }
  assert.deepEqual(before.tables, plan.before.tables);
  assert.deepEqual(before.protected, plan.before.protected);
  if (container === production) {
    assert.equal(rollback, false);
    const certificate = JSON.parse(
      fs.readFileSync(`${planFile}.rehearsal.json`, 'utf8')
    );
    assert.equal(certificate.planSha256, fileHash(planFile));
    assert.equal(certificate.scriptSha256, fileHash(__filename));
    assert.ok(
      certificate.restore &&
        certificate.rollback &&
        certificate.lateFailure &&
        certificate.commit &&
        certificate.retry &&
        certificate.undo
    );
    assert.ok(
      Date.now() - new Date(plan.backup.createdAt).getTime() < 60 * 60 * 1000,
      'Production backup is stale.'
    );
  }
  let statement = transactionStart();
  statement += guard(
    `(${protectedSql()}) = ${literal(JSON.stringify(plan.before.protected))}::jsonb`,
    'Source data changed since backup.'
  );
  statement += guard(
    `(SELECT COUNT(*) FROM public.inventory_movements WHERE notes LIKE ${literal(`${operation}:%`)}) = 0`,
    'Correction already exists.'
  );
  for (const movement of plan.proposal.proposedMovements) {
    const columns = Object.keys(movement);
    const values = columns.map((column) =>
      movement[column] === null
        ? 'NULL'
        : typeof movement[column] === 'number'
          ? String(movement[column])
          : literal(movement[column])
    );
    statement += `INSERT INTO public.inventory_movements (${columns.map((column) => `"${column}"`).join(',')}) VALUES (${values.join(',')});`;
  }
  statement += guard(
    `(${protectedSql()}) = ${literal(JSON.stringify(plan.before.protected))}::jsonb`,
    'Protected sources changed during correction.'
  );
  const content = `to_jsonb(record) - 'id' - 'createdAt' - 'updatedAt'`;
  const expected = [...plan.proposal.proposedMovements].sort((left, right) =>
    left.notes.localeCompare(right.notes)
  );
  statement += guard(
    `${rows('inventory_movements', `record.notes LIKE ${literal(`${operation}:%`)}`, content, 'record.notes COLLATE "C"')} = ${literal(JSON.stringify(expected.sort((left, right) => (left.notes < right.notes ? -1 : 1))))}::jsonb`,
    'Inserted movement content differs from plan.'
  );
  for (const target of targets) {
    statement += guard(
      `(SELECT COALESCE(SUM((CASE WHEN "toBucket" = 'sellable' THEN quantity ELSE 0 END) -
      (CASE WHEN "fromBucket" = 'sellable' THEN quantity ELSE 0 END)),0)
      FROM public.inventory_movements WHERE "deletedAt" IS NULL AND "productCode" = ${literal(target.code)}) = 0`,
      'Ending sellable ledger is not zero.'
    );
  }
  query(container, `${statement}\n${rollback ? 'ROLLBACK' : 'COMMIT'};`);
  const after = capture(container);
  let verification;
  if (rollback) {
    assert.deepEqual(after.tables, plan.before.tables);
    assert.deepEqual(after.protected, plan.before.protected);
    verification = { exactRollback: true };
  } else verification = verifyAfter(after, plan);
  const stamp = new Date().toISOString().replaceAll(/[-:.]/g, '');
  const recordFile = `${planFile}.${container === production ? 'production' : 'isolated'}.${stamp}.${rollback ? 'rollback' : 'applied'}.json`;
  save(recordFile, {
    operation,
    container,
    checkedAt: new Date().toISOString(),
    planSha256: fileHash(planFile),
    backupSha256: plan.backup.sha256,
    rollback,
    protected: after.protected,
    insertedMovements: after.tables.movements.filter(isCorrection),
    verification,
  });
  console.log(
    JSON.stringify(
      { record: recordFile, container, rollback, ...verification },
      null,
      2
    )
  );
}

function undoRehearsal(planFile) {
  const plan = loadPlan(planFile);
  const before = capture(rehearsal);
  verifyAfter(before, plan);
  let statement = transactionStart();
  statement += guard(
    `(${protectedSql()}) = ${literal(JSON.stringify(plan.before.protected))}::jsonb`,
    'Source data changed before isolated undo.'
  );
  statement += `DELETE FROM public.inventory_movements WHERE id IN (${before.tables.movements
    .filter(isCorrection)
    .map((row) => row.id)
    .join(',')});`;
  statement += guard(
    `(${protectedSql()}) = ${literal(JSON.stringify(plan.before.protected))}::jsonb`,
    'Isolated undo changed original data.'
  );
  query(rehearsal, `${statement}\nCOMMIT;`);
  assert.deepEqual(capture(rehearsal).tables, plan.before.tables);
}

function certify(planFile) {
  const plan = loadPlan(planFile);
  verifyContainer(rehearsal);
  const input = fs.openSync(plan.backup.file, 'r');
  let restored;
  try {
    restored = spawnSync(
      'docker',
      [
        'exec',
        '-i',
        '-u',
        'postgres',
        rehearsal,
        'pg_restore',
        '--clean',
        '--if-exists',
        '--exit-on-error',
        '--no-owner',
        '--no-acl',
        '--dbname=business_management',
      ],
      {
        stdio: [input, 'pipe', 'pipe'],
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      }
    );
  } finally {
    fs.closeSync(input);
  }
  assert.equal(restored.status, 0, restored.stderr);
  assert.deepEqual(capture(rehearsal).tables, plan.before.tables);
  execute(planFile, rehearsal, true);
  query(
    rehearsal,
    `CREATE FUNCTION public.bms_stock_forced_failure() RETURNS trigger LANGUAGE plpgsql AS $fail$
    BEGIN IF NEW.notes = ${literal(plan.proposal.proposedMovements.at(-1).notes)} THEN RAISE EXCEPTION 'forced late stock failure'; END IF;
    RETURN NEW; END $fail$;
    CREATE TRIGGER bms_stock_forced_failure BEFORE INSERT ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.bms_stock_forced_failure();`
  );
  let rejected = false;
  try {
    execute(planFile, rehearsal);
  } catch (error) {
    assert.ok(error.message.includes('forced late stock failure'));
    rejected = true;
  } finally {
    query(
      rehearsal,
      'DROP TRIGGER bms_stock_forced_failure ON public.inventory_movements; DROP FUNCTION public.bms_stock_forced_failure();'
    );
  }
  assert.equal(rejected, true);
  assert.deepEqual(capture(rehearsal).tables, plan.before.tables);
  execute(planFile, rehearsal);
  const after = capture(rehearsal);
  execute(planFile, rehearsal);
  assert.deepEqual(capture(rehearsal).tables, after.tables);
  undoRehearsal(planFile);
  const certificate = {
    operation,
    planSha256: fileHash(planFile),
    scriptSha256: fileHash(__filename),
    backupSha256: plan.backup.sha256,
    checkedAt: new Date().toISOString(),
    restore: true,
    rollback: true,
    lateFailure: true,
    commit: true,
    retry: true,
    undo: true,
  };
  save(`${planFile}.rehearsal.json`, certificate);
  console.log(JSON.stringify(certificate, null, 2));
}

function main() {
  const [command = '--preview', file] = process.argv.slice(2);
  assert.ok(process.argv.length <= 4);
  if (command === '--prepare') return prepare();
  if (command === '--certify') return certify(file);
  if (command === '--apply-production') return execute(file, production);
  if (command === '--verify') {
    const result = verifyAfter(capture(), loadPlan(file));
    return console.log(JSON.stringify(result, null, 2));
  }
  assert.equal(command, '--preview');
  const { proposedMovements, reviewedSupplierShortMovements, ...summary } =
    preview(capture());
  console.log(JSON.stringify(summary, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
