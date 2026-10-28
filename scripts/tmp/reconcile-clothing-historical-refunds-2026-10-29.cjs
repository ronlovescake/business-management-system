const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Decimal } = require('@prisma/client/runtime/library');

const operation = 'CLOTHING-HISTORICAL-REFUNDS-20261029';
const production = 'business-management-production-db-1';
const rehearsal = 'bms-clothing-refund-rehearsal-20261029';
const database = 'business_management';
const effectiveDate = '2026-03-01';
const method = 'GCash';
const productCode = 'Onesie Dress (OD-020726)';
const actor = 'data-correction:clothing-historical-refunds-20261029';
const evidenceDirectory =
  '/home/ron/business-management-system-data/production/backup/clothing-accounting-corrections-20261029';
const originalBackup = path.join(
  evidenceDirectory,
  'business_management_production_pre-clothing-corrections_20261028T195438Z.dump'
);
const originalBackupHash =
  '0bf1e720a7d2b7361f2c8ea5960da353612836b1e7e8b71f038fc997e45560ef';
const historicalTimestamp = `${effectiveDate}T00:00:00.000Z`;
const targets = [
  [2245, 'c70d5bb7-d292-41ec-bca0-4b712e1b6984', '163.50'],
  [2246, '75803d06-af53-4e8a-8c23-37c7547d0e7e', '163.50'],
  [2248, 'a1b54be7-40d3-4840-8286-ba063f3f71af', '163.50'],
  [2249, '2f3941a7-0a2e-4350-810c-030e11ed20eb', '218.00'],
  [2251, 'd4bc7f32-1a26-421d-acc1-b62d27e14323', '218.00'],
  [2252, '0f374c6f-06d4-4175-8231-b84e002e4896', '163.50'],
  [2254, '8f8dc402-f15e-4d26-8140-9e3769c26d48', '163.50'],
  [2255, 'bafea31c-d975-4673-9f5f-221ead104187', '654.00'],
  [2256, '1bc24cc9-75eb-48d3-816d-749f25b26be8', '170.00'],
  [2257, '1bda03ac-e4a0-40db-a4a2-fc06544bca00', '327.00'],
  [2258, 'afb08522-c378-4085-81db-a3ad4640bcee', '164.00'],
].map(([transactionId, cancellationId, amount]) => ({
  transactionId,
  cancellationId,
  amount,
}));
const protectedTables = [
  'accounting_settings',
  'products',
  'shipments',
  'inventory_movements',
  'transactions',
  'transaction_payments',
  'transaction_status_changes',
  'expenses',
  'ClothingAccountingOpeningBalance',
  'clothing_inventory_transit_build_entries',
  'clothing_inventory_reclass_entries',
  'ClothingInvestmentAgreement',
  'ClothingInvestmentPayment',
  'clothing_recurring_payment_templates',
  'clothing_recurring_payment_drafts',
];
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const transactionIds = targets.map((target) => target.transactionId).join(',');
const cancellationIds = targets
  .map((target) => `${literal(target.cancellationId)}::uuid`)
  .join(',');
const sourceIds = targets
  .map((target) => literal(target.cancellationId))
  .join(',');
const sum = (values) =>
  values.reduce((total, value) => total.plus(value), new Decimal(0)).toFixed(2);
const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fileHash = (file) =>
  createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function saveEvidence(file, value) {
  assert.equal(path.dirname(path.resolve(file)), evidenceDirectory);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
}

function verifyContainer(container) {
  assert.ok([production, rehearsal].includes(container));
  const result = spawnSync(
    'docker',
    [
      'inspect',
      '--format',
      '{"ports":{{json .HostConfig.PortBindings}},"network":{{json .HostConfig.NetworkMode}},"label":{{json (index .Config.Labels "bms.correction")}},"directory":{{json (index .Config.Labels "com.docker.compose.project.working_dir")}}}',
      container,
    ],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, 'Cannot verify database container.');
  const details = JSON.parse(result.stdout);
  if (container === production) {
    assert.equal(
      details.directory,
      '/home/ron/Websites Production/business-management-production'
    );
    assert.ok(
      details.ports['5432/tcp'].some((binding) => binding.HostPort === '5432')
    );
  } else {
    assert.equal(details.network, 'none');
    assert.equal(details.label, operation);
    assert.deepEqual(details.ports ?? {}, {});
  }
}

function sql(container, input) {
  assert.ok(
    [production, rehearsal].includes(container),
    'Unreviewed database container.'
  );
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
    { input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  assert.equal(
    result.status,
    0,
    `Database check failed: ${result.stderr.split('\nQUERY:')[0]}`
  );
  return result.stdout.trim();
}

function rows(table, where = 'TRUE') {
  return `(SELECT COALESCE(jsonb_agg(to_jsonb(record) ORDER BY record.id), '[]'::jsonb)
    FROM public."${table}" record WHERE ${where})`;
}

function snapshotSql(payoutIds = []) {
  const requestIds = [
    ...targets.map((target) => target.cancellationId),
    ...payoutIds,
  ]
    .map((value) => `${literal(value)}::uuid`)
    .join(',');
  const protectedQueries = protectedTables.map(
    (table) => `${literal(table)}, md5(${rows(table)}::text)`
  );
  protectedQueries.push(
    `'unrelatedJournals', md5(${rows('clothing_accounting_journal_lines', `NOT (record."sourceType" = 'CUSTOMER_CANCELLATION' AND record."sourceId" IN (${sourceIds}))`)}::text)`,
    `'unrelatedCancellations', md5(${rows('clothing_order_cancellations', `record.id NOT IN (${cancellationIds})`)}::text)`,
    `'unrelatedRequests', md5(${rows('clothing_financial_requests', `record.id NOT IN (${requestIds})`)}::text)`,
    `'unrelatedRefunds', md5(${rows('transaction_refunds', `record."transactionId" NOT IN (${transactionIds})`)}::text)`,
    `'unrelatedPayouts', md5(${rows('clothing_refund_payouts', `record."cancellationId" NOT IN (${cancellationIds})`)}::text)`
  );
  return `SELECT jsonb_build_object(
    'cancellations', ${rows('clothing_order_cancellations', `record."transactionId" IN (${transactionIds})`)},
    'journals', ${rows('clothing_accounting_journal_lines', `record."sourceType" = 'CUSTOMER_CANCELLATION' AND record."sourceId" IN (${sourceIds})`)},
    'requests', ${rows('clothing_financial_requests', `record.id IN (${requestIds})`)},
    'refunds', ${rows('transaction_refunds', `record."transactionId" IN (${transactionIds})`)},
    'payouts', ${rows('clothing_refund_payouts', `record."cancellationId" IN (${cancellationIds})`)},
    'orders', ${rows('transactions', `record.id IN (${transactionIds})`)},
    'payments', ${rows('transaction_payments', `record."transactionId" IN (${transactionIds})`)},
    'protected', jsonb_build_object(${protectedQueries.join(',\n')})
  )`;
}

function snapshot(container, payoutIds = []) {
  verifyContainer(container);
  return JSON.parse(
    sql(
      container,
      `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
    SET LOCAL statement_timeout = '30s';
    ${snapshotSql(payoutIds)};
    COMMIT;`
    )
  );
}

function validateBefore(before) {
  assert.equal(before.cancellations.length, targets.length);
  assert.equal(before.journals.length, targets.length * 2);
  assert.equal(before.requests.length, targets.length);
  assert.equal(
    before.refunds.length,
    0,
    'Existing target refunds need review; never duplicate them.'
  );
  assert.equal(
    before.payouts.length,
    0,
    'Existing target payouts need review; never duplicate them.'
  );
  assert.equal(before.orders.length, targets.length);
  for (const target of targets) {
    const cancellation = before.cancellations.find(
      (row) => row.transactionId === target.transactionId
    );
    assert.ok(cancellation);
    assert.equal(cancellation.id, target.cancellationId);
    assert.equal(cancellation.kind, 'VOIDED');
    assert.equal(cancellation.decisionDate, '2026-10-27');
    for (const field of [
      'approvedRefundAmount',
      'pendingAmount',
      'collectedAmount',
    ]) {
      assert.equal(
        new Decimal(cancellation[field]).toFixed(2),
        target.amount,
        `${target.transactionId}: ${field}`
      );
    }
    assert.equal(
      new Decimal(cancellation.priorRefundAmount).toFixed(2),
      '0.00'
    );
    assert.equal(new Decimal(cancellation.retainedAmount).toFixed(2), '0.00');
    const order = before.orders.find((row) => row.id === target.transactionId);
    assert.equal(order.productCode, productCode);
    assert.equal(order.orderStatus, 'Voided');
    assert.equal(order.deletedAt, null);
    assert.ok(Number.isInteger(order.customerId));
    const payments = before.payments.filter(
      (row) => row.transactionId === target.transactionId && !row.deletedAt
    );
    assert.equal(sum(payments.map((row) => row.amount)), target.amount);
    assert.ok(
      payments.every((row) => row.paymentDate.slice(0, 10) <= effectiveDate),
      'Payment after historical refund date.'
    );
    const request = before.requests.find(
      (row) => row.id === target.cancellationId
    );
    assert.equal(request.operation, 'ORDER_CANCELLATION');
    assert.equal(request.result.decisionDate, '2026-10-27');
    const pair = before.journals.filter(
      (row) => row.sourceId === target.cancellationId
    );
    assert.equal(pair.length, 2);
    assert.ok(
      pair.every(
        (row) =>
          row.deletedAt === null &&
          row.date.startsWith('2026-10-27') &&
          row.ref === `TX-${target.transactionId}` &&
          row.systemGenerated
      )
    );
    assert.equal(
      sum(pair.map((row) => new Decimal(row.debit).minus(row.credit))),
      '0.00'
    );
    assert.ok(
      pair.some(
        (row) =>
          row.account === 'Refunds Payable' &&
          row.sourceLineKey === 'refund-approval' &&
          new Decimal(row.credit).toFixed(2) === target.amount &&
          row.debit === 0
      )
    );
    const debitAccount =
      target.transactionId === 2256 ? 'Sales Returns' : 'Customer Deposits';
    assert.ok(
      pair.some(
        (row) =>
          row.account === debitAccount &&
          new Decimal(row.debit).toFixed(2) === target.amount &&
          row.credit === 0
      )
    );
  }
  assert.equal(sum(targets.map((target) => target.amount)), '2568.50');
  assert.equal(
    sum(
      before.journals
        .filter((row) => row.account === 'Customer Deposits')
        .map((row) => row.debit)
    ),
    '2398.50'
  );
}

function verifyAfter(after, plan) {
  assert.deepEqual(
    after.protected,
    plan.before.protected,
    'Unrelated source data changed.'
  );
  assert.deepEqual(after.orders, plan.before.orders);
  assert.deepEqual(after.payments, plan.before.payments);
  assert.equal(after.payouts.length, targets.length);
  assert.equal(after.refunds.length, targets.length);
  assert.equal(after.requests.length, targets.length * 2);
  assert.equal(after.journals.length, targets.length * 2);
  assert.equal(sum(after.payouts.map((row) => row.amount)), '2568.50');
  for (const target of targets) {
    const original = plan.before.cancellations.find(
      (row) => row.id === target.cancellationId
    );
    const cancellation = after.cancellations.find(
      (row) => row.id === target.cancellationId
    );
    assert.deepEqual(cancellation, {
      ...original,
      decisionDate: effectiveDate,
      pendingAmount: 0,
    });
    const entry = plan.entries.find(
      (row) => row.transactionId === target.transactionId
    );
    const payout = after.payouts.find((row) => row.id === entry.payoutId);
    assert.ok(payout);
    assert.equal(payout.cancellationId, target.cancellationId);
    assert.equal(new Decimal(payout.amount).toFixed(2), target.amount);
    assert.equal(payout.paymentDate, effectiveDate);
    assert.equal(payout.method, method);
    assert.equal(payout.createdBy, actor);
    const refund = after.refunds.find((row) => row.id === payout.refundId);
    assert.ok(refund);
    assert.equal(refund.transactionId, target.transactionId);
    assert.equal(new Decimal(refund.amount).toFixed(2), target.amount);
    assert.equal(refund.refundDate, effectiveDate);
    assert.equal(refund.notes, entry.payload.payout.notes);
    assert.equal(refund.reason, original.reason);
    assert.equal(refund.deletedAt, null);
    assert.equal(refund.returnedQuantity, null);
    assert.equal(refund.restockBucket, null);
    const originalRequest = plan.before.requests.find(
      (row) => row.id === target.cancellationId
    );
    const request = after.requests.find(
      (row) => row.id === target.cancellationId
    );
    assert.deepEqual(request, {
      ...originalRequest,
      result: { ...originalRequest.result, decisionDate: effectiveDate },
    });
    const payoutRequest = after.requests.find(
      (row) => row.id === entry.payoutId
    );
    assert.equal(payoutRequest.operation, 'CANCELLATION_PAYOUT');
    assert.equal(payoutRequest.payloadHash, entry.payloadHash);
    assert.deepEqual(payoutRequest.result, {
      id: entry.payoutId,
      refundId: refund.id,
      cancellationId: target.cancellationId,
      transactionId: target.transactionId,
      amount: Number(target.amount),
      paymentDate: effectiveDate,
      method,
      pendingAmount: 0,
    });
  }
  for (const original of plan.before.journals) {
    const current = after.journals.find((row) => row.id === original.id);
    assert.equal(new Date(current.date).toISOString(), historicalTimestamp);
    assert.deepEqual(
      { ...current, date: original.date, updatedAt: original.updatedAt },
      original
    );
  }
}

function prepare(container) {
  const before = snapshot(container);
  validateBefore(before);
  const stamp = new Date().toISOString().replaceAll(/[-:.]/g, '');
  const prefix = container === production ? 'production' : 'rehearsal';
  let backup = {
    file: originalBackup,
    sha256: originalBackupHash,
    restorationRehearsed: true,
  };
  assert.equal(fileHash(originalBackup), originalBackupHash);
  if (container === production) {
    const file = path.join(
      evidenceDirectory,
      `business_management_production_pre-historical-refunds_${stamp}.dump`
    );
    const descriptor = fs.openSync(file, 'wx', 0o600);
    let result;
    try {
      result = spawnSync(
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
        { stdio: ['ignore', descriptor, 'pipe'], encoding: 'utf8' }
      );
    } finally {
      fs.closeSync(descriptor);
    }
    assert.equal(result.status, 0, 'Fresh production backup failed.');
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
    assert.equal(listing.status, 0, 'Fresh backup archive listing failed.');
    for (const table of [
      'clothing_order_cancellations',
      'clothing_refund_payouts',
      'transaction_refunds',
      'clothing_financial_requests',
      'clothing_accounting_journal_lines',
      'inventory_movements',
    ]) {
      assert.ok(listing.stdout.includes(table), `Backup missing ${table}.`);
    }
    assert.deepEqual(
      snapshot(container),
      before,
      'Production changed during backup; prepare a new plan.'
    );
    backup = {
      operation,
      container,
      file,
      sha256: fileHash(file),
      bytes: fs.statSync(file).size,
      createdAt: new Date().toISOString(),
      archiveVerified: true,
      restorationRehearsed: false,
    };
    saveEvidence(`${file}.json`, backup);
  }
  const entries = targets.map((target) => {
    const order = before.orders.find((row) => row.id === target.transactionId);
    const payout = {
      cancellationId: target.cancellationId,
      amount: Number(target.amount),
      paymentDate: effectiveDate,
      method,
      notes: `${operation}: historical GCash refund already completed March 1, 2026; owner confirmed. October 27 cancellation was entered late. No new transfer or goods return.`,
    };
    const payload = { customerId: order.customerId, payout, actorId: actor };
    return {
      ...target,
      payoutId: randomUUID(),
      payload,
      payloadHash: hash({ operation: 'CANCELLATION_PAYOUT', payload }),
    };
  });
  const plan = {
    operation,
    container,
    preparedAt: new Date().toISOString(),
    effectiveDate,
    method,
    backup,
    before,
    entries,
  };
  const file = path.join(
    evidenceDirectory,
    `${prefix}-historical-refund-plan_${stamp}.json`
  );
  saveEvidence(file, plan);
  console.log(
    JSON.stringify(
      {
        plan: file,
        mode: 'PREPARED ONLY',
        container,
        historicalRefunds: '2568.50',
        backup: backup.file,
      },
      null,
      2
    )
  );
}

function loadPlan(file, container) {
  assert.ok(file, 'An exact reviewed plan is required.');
  assert.equal(path.dirname(path.resolve(file)), evidenceDirectory);
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(plan.operation, operation);
  assert.equal(plan.container, container);
  assert.equal(plan.effectiveDate, effectiveDate);
  assert.equal(plan.method, method);
  assert.equal(fileHash(plan.backup.file), plan.backup.sha256);
  assert.deepEqual(
    plan.entries.map(({ transactionId, cancellationId, amount }) => ({
      transactionId,
      cancellationId,
      amount,
    })),
    targets
  );
  for (const entry of plan.entries) {
    assert.equal(
      entry.payloadHash,
      hash({ operation: 'CANCELLATION_PAYOUT', payload: entry.payload })
    );
    assert.match(entry.payoutId, /^[0-9a-f-]{36}$/);
  }
  validateBefore(plan.before);
  return plan;
}

function requireCondition(condition, message) {
  return `DO $guard$ BEGIN IF (${condition}) IS DISTINCT FROM TRUE THEN RAISE EXCEPTION ${literal(message)}; END IF; END $guard$;`;
}

function transactionStart() {
  const tables = [
    ...protectedTables,
    'clothing_order_cancellations',
    'clothing_accounting_journal_lines',
    'clothing_financial_requests',
    'transaction_refunds',
    'clothing_refund_payouts',
  ];
  return `BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    SET LOCAL statement_timeout = '30s';
    SET LOCAL lock_timeout = '2s';
    SELECT pg_advisory_xact_lock(hashtext(${literal(operation)}));
    LOCK TABLE ${tables.map((table) => `public."${table}"`).join(',')} IN SHARE ROW EXCLUSIVE MODE NOWAIT;`;
}

function verifySql(plan) {
  const checks = [];
  const equalJson = (expression, value) =>
    checks.push(`${expression} = ${literal(JSON.stringify(value))}::jsonb`);
  equalJson("actual->'protected'", plan.before.protected);
  equalJson("actual->'orders'", plan.before.orders);
  equalJson("actual->'payments'", plan.before.payments);
  equalJson(
    "actual->'cancellations'",
    plan.before.cancellations.map((row) => ({
      ...row,
      decisionDate: effectiveDate,
      pendingAmount: 0,
    }))
  );
  checks.push(
    `jsonb_array_length(actual->'payouts') = 11`,
    `jsonb_array_length(actual->'refunds') = 11`,
    `jsonb_array_length(actual->'requests') = 22`,
    `jsonb_array_length(actual->'journals') = 22`
  );
  for (const original of plan.before.journals) {
    const { date, updatedAt, ...unchanged } = original;
    const current = `(SELECT row FROM jsonb_array_elements(actual->'journals') row WHERE row->>'id' = ${literal(original.id)})`;
    equalJson(`(${current} - 'date' - 'updatedAt')`, unchanged);
    checks.push(
      `(${current}->>'date')::timestamptz = ${literal(historicalTimestamp)}::timestamptz`
    );
  }
  for (const entry of plan.entries) {
    const cancellation = plan.before.cancellations.find(
      (row) => row.id === entry.cancellationId
    );
    const originalRequest = plan.before.requests.find(
      (row) => row.id === entry.cancellationId
    );
    equalJson(
      `(SELECT row FROM jsonb_array_elements(actual->'requests') row WHERE row->>'id' = ${literal(entry.cancellationId)})`,
      {
        ...originalRequest,
        result: { ...originalRequest.result, decisionDate: effectiveDate },
      }
    );
    const payout = `(SELECT row FROM jsonb_array_elements(actual->'payouts') row WHERE row->>'id' = ${literal(entry.payoutId)})`;
    equalJson(`(${payout} - 'createdAt' - 'refundId')`, {
      id: entry.payoutId,
      cancellationId: entry.cancellationId,
      amount: Number(entry.amount),
      paymentDate: effectiveDate,
      method,
      createdBy: actor,
    });
    const refund = `(SELECT row FROM jsonb_array_elements(actual->'refunds') row WHERE row->>'id' = ${payout}->>'refundId')`;
    equalJson(`(${refund} - 'id' - 'createdAt' - 'updatedAt')`, {
      transactionId: entry.transactionId,
      refundDate: effectiveDate,
      amount: Number(entry.amount),
      reason: cancellation.reason,
      returnedQuantity: null,
      restockBucket: null,
      notes: entry.payload.payout.notes,
      deletedAt: null,
    });
    const request = `(SELECT row FROM jsonb_array_elements(actual->'requests') row WHERE row->>'id' = ${literal(entry.payoutId)})`;
    equalJson(`(${request} - 'createdAt' - 'result')`, {
      id: entry.payoutId,
      operation: 'CANCELLATION_PAYOUT',
      payloadHash: entry.payloadHash,
    });
    equalJson(`((${request}->'result') - 'refundId')`, {
      id: entry.payoutId,
      cancellationId: entry.cancellationId,
      transactionId: entry.transactionId,
      amount: Number(entry.amount),
      paymentDate: effectiveDate,
      method,
      pendingAmount: 0,
    });
    checks.push(`${request}->'result'->'refundId' = ${payout}->'refundId'`);
  }
  return `DO $verify$ DECLARE actual jsonb := (${snapshotSql(plan.entries.map((entry) => entry.payoutId))});
    BEGIN IF (${checks.map((check) => `(${check})`).join(' AND\n')}) IS DISTINCT FROM TRUE
    THEN RAISE EXCEPTION 'Corrected rows or protected sources failed validation; transaction rolled back.';
    END IF; END $verify$;`;
}

function buildCorrection(plan) {
  const identifiers = plan.entries.map((entry) => entry.payoutId);
  let statement = transactionStart();
  statement += requireCondition(
    `(${snapshotSql(identifiers)}) = ${literal(JSON.stringify(plan.before))}::jsonb`,
    'Source data changed since the approved plan.'
  );
  for (const entry of plan.entries) {
    const original = plan.before.cancellations.find(
      (row) => row.id === entry.cancellationId
    );
    statement += `
      UPDATE public.clothing_order_cancellations SET "decisionDate" = ${literal(effectiveDate)}, "pendingAmount" = 0
        WHERE id = ${literal(entry.cancellationId)}::uuid AND "pendingAmount" = ${entry.amount};
      UPDATE public.clothing_financial_requests
        SET result = jsonb_set(result, '{decisionDate}', to_jsonb(${literal(effectiveDate)}::text), false)
        WHERE id = ${literal(entry.cancellationId)}::uuid;
      UPDATE public.clothing_accounting_journal_lines
        SET date = ${literal(historicalTimestamp)}::timestamptz, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "sourceType" = 'CUSTOMER_CANCELLATION' AND "sourceId" = ${literal(entry.cancellationId)};
      INSERT INTO public.clothing_financial_requests (id, operation, "payloadHash")
        VALUES (${literal(entry.payoutId)}::uuid, 'CANCELLATION_PAYOUT', ${literal(entry.payloadHash)});
      WITH refund AS (
        INSERT INTO public.transaction_refunds ("transactionId", "refundDate", amount, reason, notes, "updatedAt")
        VALUES (${entry.transactionId}, ${literal(effectiveDate)}, ${entry.amount}, ${literal(original.reason)},
          ${literal(entry.payload.payout.notes)}, CURRENT_TIMESTAMP) RETURNING id
      ), payout AS (
        INSERT INTO public.clothing_refund_payouts (id, "cancellationId", "refundId", amount, "paymentDate", method, "createdBy")
        SELECT ${literal(entry.payoutId)}::uuid, ${literal(entry.cancellationId)}::uuid, id, ${entry.amount},
          ${literal(effectiveDate)}, ${literal(method)}, ${literal(actor)} FROM refund RETURNING "refundId"
      )
      UPDATE public.clothing_financial_requests SET result = jsonb_build_object(
        'id', ${literal(entry.payoutId)}, 'refundId', payout."refundId", 'cancellationId', ${literal(entry.cancellationId)},
        'transactionId', ${entry.transactionId}, 'amount', ${entry.amount}, 'paymentDate', ${literal(effectiveDate)},
        'method', ${literal(method)}, 'pendingAmount', 0)
        FROM payout WHERE public.clothing_financial_requests.id = ${literal(entry.payoutId)}::uuid;
    `;
  }
  statement += `${verifySql(plan)}\n${snapshotSql(identifiers)};`;
  return statement;
}

function execute(planFile, container, rollback) {
  const plan = loadPlan(planFile, container);
  const identifiers = plan.entries.map((entry) => entry.payoutId);
  const before = snapshot(container, identifiers);
  if (before.payouts.length) {
    verifyAfter(before, plan);
    console.log(
      JSON.stringify({
        operation,
        idempotentNoop: true,
        historicalRefunds: '2568.50',
        pending: '0.00',
      })
    );
    return;
  }
  assert.deepEqual(before, plan.before);
  if (container === production) {
    assert.equal(rollback, false);
    assert.ok(
      Date.now() - new Date(plan.backup.createdAt).getTime() < 60 * 60 * 1000,
      'Take a fresh production backup.'
    );
    const rehearsalRecord = JSON.parse(
      fs.readFileSync(`${planFile}.rehearsal.json`, 'utf8')
    );
    assert.equal(rehearsalRecord.planSha256, fileHash(planFile));
    assert.equal(rehearsalRecord.rollbackPassed, true);
    assert.equal(rehearsalRecord.commitPassed, true);
    assert.equal(rehearsalRecord.undoPassed, true);
    assert.equal(rehearsalRecord.retryPassed, true);
    assert.equal(rehearsalRecord.lateFailurePassed, true);
    assert.equal(rehearsalRecord.scriptSha256, fileHash(__filename));
  }
  const statements = buildCorrection(plan);
  const output = sql(
    container,
    `${statements}\n${rollback ? 'ROLLBACK' : 'COMMIT'};`
  );
  const after = JSON.parse(
    output
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .at(-1)
  );
  verifyAfter(after, plan);
  const persisted = snapshot(container, identifiers);
  if (rollback)
    assert.deepEqual(
      persisted,
      before,
      'Rollback did not restore all before-images.'
    );
  else verifyAfter(persisted, plan);
  const record = {
    operation,
    container,
    planSha256: fileHash(planFile),
    checkedAt: new Date().toISOString(),
    rollback,
    historicalRefunds: '2568.50',
    pending: '0.00',
    before,
    after,
    protectedSourcesUnchanged: true,
  };
  const stamp = new Date().toISOString().replaceAll(/[-:.]/g, '');
  const recordFile = `${planFile}.${stamp}.${rollback ? 'rollback' : 'applied'}.json`;
  saveEvidence(recordFile, record);
  console.log(
    JSON.stringify(
      {
        record: recordFile,
        operation,
        container,
        rollback,
        historicalRefunds: '2568.50',
        pending: '0.00',
        protectedSourcesUnchanged: true,
      },
      null,
      2
    )
  );
}

function undoRehearsal(planFile) {
  const plan = loadPlan(planFile, rehearsal);
  const identifiers = plan.entries.map((entry) => entry.payoutId);
  const before = snapshot(rehearsal, identifiers);
  verifyAfter(before, plan);
  let statement = transactionStart();
  statement += requireCondition(
    `(${snapshotSql(identifiers)}) = ${literal(JSON.stringify(before))}::jsonb`,
    'Rehearsal data changed before undo.'
  );
  const payoutIds = identifiers
    .map((identifier) => `${literal(identifier)}::uuid`)
    .join(',');
  const refundIds = before.payouts.map((payout) => payout.refundId).join(',');
  statement += `DELETE FROM public.clothing_refund_payouts WHERE id IN (${payoutIds});
    DELETE FROM public.transaction_refunds WHERE id IN (${refundIds});
    DELETE FROM public.clothing_financial_requests WHERE id IN (${payoutIds});`;
  for (const original of plan.before.cancellations) {
    statement += `UPDATE public.clothing_order_cancellations SET "decisionDate" = ${literal(original.decisionDate)},
      "pendingAmount" = ${original.pendingAmount} WHERE id = ${literal(original.id)}::uuid;`;
  }
  for (const original of plan.before.requests) {
    statement += `UPDATE public.clothing_financial_requests SET result = ${literal(JSON.stringify(original.result))}::jsonb WHERE id = ${literal(original.id)}::uuid;`;
  }
  for (const original of plan.before.journals) {
    statement += `UPDATE public.clothing_accounting_journal_lines SET date = ${literal(original.date)}::timestamptz,
      "updatedAt" = ${literal(original.updatedAt)}::timestamptz WHERE id = ${literal(original.id)};`;
  }
  statement += requireCondition(
    `(${snapshotSql(identifiers)}) = ${literal(JSON.stringify(plan.before))}::jsonb`,
    'Undo did not reproduce exact original source rows.'
  );
  sql(rehearsal, `${statement}\nCOMMIT;`);
  assert.deepEqual(snapshot(rehearsal, identifiers), plan.before);
  console.log(
    JSON.stringify({
      operation,
      container: rehearsal,
      exactBeforeImagesRestored: true,
    })
  );
}

function certifyProduction(planFile) {
  const plan = loadPlan(planFile, production);
  verifyContainer(rehearsal);
  const descriptor = fs.openSync(plan.backup.file, 'r');
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
        stdio: [descriptor, 'pipe', 'pipe'],
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      }
    );
  } finally {
    fs.closeSync(descriptor);
  }
  assert.equal(
    restored.status,
    0,
    `Isolated backup restoration failed: ${restored.stderr}`
  );
  assert.deepEqual(
    snapshot(
      rehearsal,
      plan.entries.map((entry) => entry.payoutId)
    ),
    plan.before
  );
  const clone = {
    ...plan,
    container: rehearsal,
    backup: { ...plan.backup, restorationRehearsed: true },
  };
  const cloneFile = `${planFile}.isolated.json`;
  saveEvidence(cloneFile, clone);
  execute(cloneFile, rehearsal, true);
  sql(
    rehearsal,
    `CREATE FUNCTION public.bms_refund_forced_failure() RETURNS trigger LANGUAGE plpgsql AS $failure$
    BEGIN IF NEW."cancellationId" = ${literal(targets.at(-1).cancellationId)}::uuid
    THEN RAISE EXCEPTION 'forced late refund correction failure'; END IF; RETURN NEW; END $failure$;
    CREATE TRIGGER bms_refund_forced_failure BEFORE INSERT ON public.clothing_refund_payouts
    FOR EACH ROW EXECUTE FUNCTION public.bms_refund_forced_failure();`
  );
  let rejected = false;
  try {
    execute(cloneFile, rehearsal, false);
  } catch (error) {
    assert.ok(error.message.includes('forced late refund correction failure'));
    rejected = true;
  } finally {
    sql(
      rehearsal,
      `DROP TRIGGER bms_refund_forced_failure ON public.clothing_refund_payouts;
      DROP FUNCTION public.bms_refund_forced_failure();`
    );
  }
  assert.equal(rejected, true);
  assert.deepEqual(
    snapshot(
      rehearsal,
      plan.entries.map((entry) => entry.payoutId)
    ),
    plan.before
  );
  execute(cloneFile, rehearsal, false);
  const after = snapshot(
    rehearsal,
    plan.entries.map((entry) => entry.payoutId)
  );
  execute(cloneFile, rehearsal, false);
  assert.deepEqual(
    snapshot(
      rehearsal,
      plan.entries.map((entry) => entry.payoutId)
    ),
    after
  );
  undoRehearsal(cloneFile);
  const certificate = {
    operation,
    planSha256: fileHash(planFile),
    scriptSha256: fileHash(__filename),
    backupSha256: plan.backup.sha256,
    checkedAt: new Date().toISOString(),
    restorationRehearsed: true,
    rollbackPassed: true,
    commitPassed: true,
    lateFailurePassed: true,
    retryPassed: true,
    undoPassed: true,
  };
  saveEvidence(`${planFile}.rehearsal.json`, certificate);
  console.log(JSON.stringify(certificate, null, 2));
}

function main() {
  const argumentsList = process.argv.slice(2);
  const command = argumentsList[0] ?? '--preview';
  assert.ok(argumentsList.length <= 2);
  if (command === '--prepare-rehearsal') return prepare(rehearsal);
  if (command === '--prepare-production') return prepare(production);
  if (command === '--rollback-rehearsal')
    return execute(argumentsList[1], rehearsal, true);
  if (command === '--apply-rehearsal')
    return execute(argumentsList[1], rehearsal, false);
  if (command === '--undo-rehearsal') return undoRehearsal(argumentsList[1]);
  if (command === '--certify-production')
    return certifyProduction(argumentsList[1]);
  if (command === '--apply-production')
    return execute(argumentsList[1], production, false);
  assert.equal(command, '--preview', 'Unknown mode; refusing execution.');
  const before = snapshot(production);
  validateBefore(before);
  console.log(
    JSON.stringify(
      {
        operation,
        mode: 'READ ONLY',
        cancellations: targets.length,
        journalLines: before.journals.length,
        historicalRefunds: sum(targets.map((target) => target.amount)),
        effectiveDate,
        method,
        existingRefunds: before.refunds.length,
        existingPayouts: before.payouts.length,
        protectedSources: Object.keys(before.protected).length,
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
