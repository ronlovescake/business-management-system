const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const operation = 'CLOTHING-FALSE-RECEIPT-1694-20261029';
const production = 'business-management-production-db-1';
const rehearsal = 'bms-clothing-false-receipt-rehearsal-20261029';
const database = 'business_management';
const directory = '/home/ron/business-management-system-data/production/backup/clothing-accounting-corrections-20261029';
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const same = (left, right) => assert.deepEqual(left, right);

function command(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
  assert.equal(result.status, 0, (result.stderr || result.error?.message || 'Docker command failed').slice(0, 3000));
  return result.stdout;
}

function verify(container) {
  assert.ok([production, rehearsal].includes(container));
  const details = JSON.parse(command(['inspect', '--format', '{{json .}}', container]));
  if (container === production) {
    assert.equal(details.Config.Labels['com.docker.compose.project.working_dir'], '/home/ron/Websites Production/business-management-production');
    assert.ok(details.HostConfig.PortBindings['5432/tcp'].some((binding) => binding.HostPort === '5432'));
  } else {
    assert.equal(details.HostConfig.NetworkMode, 'none');
    assert.deepEqual(details.HostConfig.PortBindings || {}, {});
    assert.equal(details.Config.Labels['bms.correction'], operation);
  }
  return details;
}

function sql(container, input, allowFailure = false) {
  verify(container);
  const result = spawnSync('docker', ['exec', '-i', '-u', 'postgres', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', database], { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (allowFailure) return result;
  assert.equal(result.status, 0, (result.stderr || result.error?.message || '').slice(0, 3000));
  return result.stdout.trim();
}

function save(file, value) {
  assert.equal(path.dirname(path.resolve(file)), directory);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}

function tables(container) {
  return JSON.parse(sql(container, `BEGIN READ ONLY; SELECT json_agg(json_build_object('schema',schemaname,'table',tablename) ORDER BY schemaname,tablename) FROM pg_tables WHERE schemaname IN ('public','general_merchandise'); COMMIT;`));
}

function snapshotSelect(plan) {
  const protectedQueries = plan.tables.map(({ schema, table }) => {
    const filter = schema === 'public' && table === 'transaction_payments' ? 'WHERE record.id <> 1694' : schema === 'public' && table === 'transactions' ? 'WHERE record.id <> 3494' : schema === 'public' && table === 'audit_logs' ? `WHERE record.timestamp <= ${literal(plan.auditCutoff)}::timestamp` : '';
    return `SELECT ${literal(`${schema}.${table}`)} AS name, md5(COALESCE(string_agg(md5(to_jsonb(record)::text),'' ORDER BY md5(to_jsonb(record)::text)),'')) AS checksum FROM ${identifier(schema)}.${identifier(table)} record ${filter}`;
  });
  return `SELECT jsonb_build_object(
    'payment',(SELECT to_jsonb(record) FROM public.transaction_payments record WHERE id=1694),
    'order',(SELECT to_jsonb(record) FROM public.transactions record WHERE id=3494),
    'protected',(SELECT jsonb_object_agg(name,checksum) FROM (${protectedQueries.join(' UNION ALL ')}) checks))`;
}

function snapshot(container, plan) {
  return JSON.parse(sql(container, `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='60s'; ${snapshotSelect(plan)}; COMMIT;`));
}

function expectedAfter(plan) {
  return {
    ...plan.before,
    payment: { ...plan.before.payment, deletedAt: plan.timestamp, updatedAt: plan.timestamp },
    order: { ...plan.before.order, adjustment: 0, lineTotal: 2070, updatedAt: plan.timestamp },
  };
}

function validateBefore(before) {
  assert.equal(before.payment.id, 1694);
  assert.equal(before.payment.transactionId, 3494);
  assert.equal(Number(before.payment.amount), 255.3);
  assert.equal(before.payment.paymentDate, '2026-10-17');
  assert.equal(before.payment.method, 'Cash');
  assert.equal(before.payment.isReservation, true);
  assert.equal(before.payment.deletedAt, null);
  assert.equal(before.payment.financialRequestId, null);
  assert.ok('updatedAt' in before.payment);
  assert.equal(before.order.id, 3494);
  assert.equal(before.order.orderStatus, 'Voided');
  assert.equal(before.order.productId, 290);
  assert.equal(before.order.quantity, 30);
  assert.equal(before.order.unitPrice, 69);
  assert.equal(Number(before.order.adjustment), 255.3);
  assert.equal(Number(before.order.lineTotal), 1814.7);
  assert.equal(before.order.deletedAt, null);
  assert.ok(before.order.initialDepositAmount == null);
}

function execute(container, plan, mode = 'commit', undo = false) {
  const before = undo ? expectedAfter(plan) : plan.before;
  const after = undo ? plan.before : expectedAfter(plan);
  const current = snapshot(container, plan);
  if (!undo && mode === 'commit' && JSON.stringify(current) === JSON.stringify(after)) return { idempotentNoop: true, snapshot: current };
  same(current, before);
  const lockedTables = plan.tables.map(({ schema, table }) => `${identifier(schema)}.${identifier(table)}`).join(',');
  const paymentUpdate = undo ? `"deletedAt"=NULL,"updatedAt"=${literal(before.payment.updatedAt === plan.timestamp ? plan.before.payment.updatedAt : before.payment.updatedAt)}::timestamp` : `"deletedAt"=${literal(plan.timestamp)}::timestamp,"updatedAt"=${literal(plan.timestamp)}::timestamp`;
  const orderUpdate = undo ? `adjustment=255.3,"lineTotal"=1814.7,"updatedAt"=${literal(plan.before.order.updatedAt)}::timestamp` : `adjustment=0,"lineTotal"=2070,"updatedAt"=${literal(plan.timestamp)}::timestamp`;
  const input = `BEGIN ISOLATION LEVEL SERIALIZABLE;
    SET LOCAL statement_timeout='90s'; SET LOCAL lock_timeout='3s'; SET LOCAL timezone='UTC';
    SELECT pg_advisory_xact_lock(hashtext(${literal(operation)}));
    LOCK TABLE ${lockedTables} IN SHARE ROW EXCLUSIVE MODE;
    DO $correction$ DECLARE actual jsonb; BEGIN
      actual := (${snapshotSelect(plan)});
      IF actual <> ${literal(JSON.stringify(before))}::jsonb THEN RAISE EXCEPTION 'Before-image or protected data changed'; END IF;
      UPDATE public.transaction_payments SET ${paymentUpdate} WHERE id=1694;
      UPDATE public.transactions SET ${orderUpdate} WHERE id=3494;
      ${mode === 'fail' ? "RAISE EXCEPTION 'INJECTED_FINAL_ROW_FAILURE';" : ''}
      actual := (${snapshotSelect(plan)});
      IF actual <> ${literal(JSON.stringify(after))}::jsonb THEN RAISE EXCEPTION 'Postcondition or protected data mismatch'; END IF;
    END $correction$;
    ${snapshotSelect(plan)};
    ${mode === 'rollback' ? 'ROLLBACK' : 'COMMIT'};`;
  if (mode === 'fail') {
    const result = sql(container, input, true);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes('INJECTED_FINAL_ROW_FAILURE'), result.stderr.slice(0, 1000));
    same(snapshot(container, plan), before);
    return { injectedFailureRolledBack: true };
  }
  const output = sql(container, input).split('\n').filter((line) => line.startsWith('{'));
  same(JSON.parse(output.at(-1)), after);
  same(snapshot(container, plan), mode === 'rollback' ? before : after);
  return { idempotentNoop: false, snapshot: after };
}

function load(file) {
  assert.equal(path.dirname(path.resolve(file)), directory);
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(plan.operation, operation);
  assert.equal(plan.scriptHash, digest(__filename));
  assert.equal(path.dirname(plan.backup), directory);
  assert.equal(plan.backupHash, digest(plan.backup));
  validateBefore(plan.before);
  return plan;
}

function main() {
  const [mode = '--preview', file] = process.argv.slice(2);
  assert.ok(['--preview', '--prepare', '--rehearse', '--apply', '--verify'].includes(mode));
  if (mode === '--preview' || mode === '--prepare') {
    const plan = { operation, tables: tables(production), auditCutoff: sql(production, "BEGIN READ ONLY; SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::text; COMMIT;"), scriptHash: digest(__filename) };
    plan.before = snapshot(production, plan);
    validateBefore(plan.before);
    assert.equal(Number(sql(production, 'BEGIN READ ONLY; SELECT count(*) FROM public.transaction_payments WHERE "transactionId"=3494 AND "deletedAt" IS NULL; COMMIT;')), 1);
    assert.equal(Number(sql(production, 'BEGIN READ ONLY; SELECT count(*) FROM public.clothing_order_cancellations WHERE "transactionId"=3494; COMMIT;')), 0);
    if (mode === '--preview') {
      console.log(JSON.stringify({ operation, mode, paymentId: 1694, transactionId: 3494, falseReceipt: '255.30', intendedPaid: 0, intendedBalance: 2070, protectedTableCount: plan.tables.length, databaseWrites: false }));
      return;
    }
    const stamp = new Date().toISOString().replaceAll(/[-:.]/g, '');
    plan.timestamp = new Date().toISOString().replace(/Z$/, '').replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
    plan.backup = path.join(directory, `business_management_production_pre-false-receipt_${stamp}.dump`);
    const descriptor = fs.openSync(plan.backup, 'wx', 0o600);
    try { command(['exec', '-u', 'postgres', production, 'pg_dump', '-Fc', '-d', database], { stdio: ['ignore', descriptor, 'pipe'] }); } finally { fs.closeSync(descriptor); }
    plan.backupHash = digest(plan.backup);
    const descriptorRead = fs.openSync(plan.backup, 'r');
    try { command(['exec', '-i', '-u', 'postgres', production, 'pg_restore', '-l'], { stdio: [descriptorRead, 'pipe', 'pipe'] }); } finally { fs.closeSync(descriptorRead); }
    same(snapshot(production, plan), plan.before);
    plan.preparedAt = new Date().toISOString();
    const planFile = path.join(directory, `production-false-receipt-plan_${stamp}.json`);
    save(planFile, plan);
    console.log(JSON.stringify({ planFile, backup: plan.backup, backupBytes: fs.statSync(plan.backup).size, backupHash: plan.backupHash, protectedTableCount: plan.tables.length, databaseWrites: false }));
    return;
  }
  const plan = load(file);
  if (mode === '--rehearse') {
    const image = verify(production).Config.Image;
    command(['run', '--pull', 'never', '--detach', '--name', rehearsal, '--network', 'none', '--label', `bms.correction=${operation}`, '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', `POSTGRES_DB=${database}`, image]);
    try {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const probe = spawnSync('docker', ['exec', '-u', 'postgres', rehearsal, 'pg_isready', '-h', '127.0.0.1', '-d', database], { encoding: 'utf8' });
        if (probe.status === 0) { ready = true; break; }
      }
      assert.ok(ready, 'Isolated PostgreSQL did not become ready');
      verify(rehearsal);
      const descriptor = fs.openSync(plan.backup, 'r');
      try { command(['exec', '-i', '-u', 'postgres', rehearsal, 'pg_restore', '--exit-on-error', '--no-owner', '--no-acl', '-d', database], { stdio: [descriptor, 'pipe', 'pipe'] }); } finally { fs.closeSync(descriptor); }
      same(snapshot(rehearsal, plan), plan.before);
      execute(rehearsal, plan, 'rollback');
      execute(rehearsal, plan, 'fail');
      execute(rehearsal, plan);
      assert.equal(execute(rehearsal, plan).idempotentNoop, true);
      execute(rehearsal, plan, 'commit', true);
      same(snapshot(rehearsal, plan), plan.before);
      save(`${file}.rehearsal.json`, { operation, planHash: digest(file), scriptHash: digest(__filename), backupHash: plan.backupHash, restored: true, rollback: true, finalRowFailure: true, commit: true, retry: true, exactUndo: true, certifiedAt: new Date().toISOString() });
      console.log(JSON.stringify({ certificate: `${file}.rehearsal.json`, restored: true, rollback: true, finalRowFailure: true, commit: true, retry: true, exactUndo: true }));
    } finally { command(['rm', '-f', rehearsal]); }
    return;
  }
  if (mode === '--verify') {
    same(snapshot(production, plan), expectedAfter(plan));
    console.log(JSON.stringify({ operation, verified: true, amountRemoved: '255.30', allProtectedTablesUnchanged: true }));
    return;
  }
  const certificate = JSON.parse(fs.readFileSync(`${file}.rehearsal.json`, 'utf8'));
  assert.equal(certificate.planHash, digest(file));
  assert.equal(certificate.scriptHash, digest(__filename));
  assert.equal(certificate.backupHash, plan.backupHash);
  for (const check of ['restored', 'rollback', 'finalRowFailure', 'commit', 'retry', 'exactUndo']) assert.equal(certificate[check], true);
  assert.ok(Date.now() - new Date(plan.preparedAt).getTime() < 60 * 60 * 1000, 'Fresh backup required');
  const result = execute(production, plan);
  const evidence = `${file}.${new Date().toISOString().replaceAll(/[-:.]/g, '')}.applied.json`;
  save(evidence, { operation, planHash: digest(file), appliedAt: new Date().toISOString(), ...result });
  console.log(JSON.stringify({ operation, evidence, idempotentNoop: result.idempotentNoop, amountRemoved: '255.30', allProtectedTablesUnchanged: true }));
}

main();