const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { expect: playwrightExpect } = require('@playwright/test');

const expect = playwrightExpect.configure({ timeout: 30000 });

async function snapshot(client) {
  const result = {};
  for (const model of [
    'transaction',
    'transactionPayment',
    'transactionRefund',
    'inventoryMovement',
    'clothingFinancialRequest',
    'clothingOrderCancellation',
    'clothingRefundPayout',
    'clothingAccountingJournalLine',
    'clothingSupplierCredit',
    'clothingSupplierCreditApplication',
    'clothingInventoryTransitBuildEntry',
  ]) {
    result[model] = await client[model].findMany({ orderBy: { id: 'asc' } });
  }
  return result;
}

async function withFailure(client, table, event, work) {
  assert.ok(
    [
      'clothing_financial_requests',
      'clothing_supplier_credit_applications',
    ].includes(table)
  );
  assert.ok(['UPDATE', 'INSERT'].includes(event));
  const name = `recon_fail_${randomUUID().replaceAll('-', '')}`;
  await client.$executeRawUnsafe(
    `CREATE FUNCTION public."${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED_RECON_FINALIZE_FAILURE'; END $$`
  );
  try {
    await client.$executeRawUnsafe(
      `CREATE TRIGGER "${name}" AFTER ${event} ON public."${table}" FOR EACH ROW EXECUTE FUNCTION public."${name}"()`
    );
    try {
      await work();
    } finally {
      await client.$executeRawUnsafe(
        `DROP TRIGGER "${name}" ON public."${table}"`
      );
    }
  } finally {
    await client.$executeRawUnsafe(`DROP FUNCTION public."${name}"()`);
  }
}

async function verifyFinancialRollback({
  client,
  context,
  endpoint,
  data,
  phase,
  reports,
  checks,
}) {
  const before = await snapshot(client);
  const financialBefore = await reports(`X03-${phase}-before`);
  const key = randomUUID();
  await withFailure(
    client,
    'clothing_financial_requests',
    'UPDATE',
    async () => {
      const response = await context.request.post(endpoint, {
        headers: { 'Idempotency-Key': key },
        data,
      });
      assert.equal(
        response.status(),
        500,
        `X03: ${phase} injected finalization failure`
      );
    }
  );
  assert.equal(
    await client.clothingFinancialRequest.count({ where: { id: key } }),
    0
  );
  assert.deepEqual(
    await snapshot(client),
    before,
    `X03: ${phase} leaves no partial writes`
  );
  assert.deepEqual(await reports(`X03-${phase}-rolled-back`), financialBefore);
  checks.push(
    `X03 ${phase}: real authenticated operation failed at final request persistence; request/events, parent balance, refunds/obligation, journal and inventory rolled back completely; all report payloads unchanged`
  );
}

async function verifyCreditRollback({
  client,
  context,
  endpoint,
  data,
  reports,
  checks,
}) {
  const before = await snapshot(client);
  const financialBefore = await reports('X03-credit-before');
  await withFailure(
    client,
    'clothing_supplier_credit_applications',
    'INSERT',
    async () => {
      const response = await context.request.post(endpoint, { data });
      assert.equal(
        response.status(),
        500,
        'X03: credit application injected persistence failure'
      );
    }
  );
  assert.deepEqual(
    await snapshot(client),
    before,
    'X03: credit reservation/build/application rolled back'
  );
  assert.deepEqual(await reports('X03-credit-rolled-back'), financialBefore);
  checks.push(
    'X03 supplier application: failure after application insertion rolls back reserved credit, acquisition funding and application together; no partial writes or report changes'
  );
}

async function verifyFinancialConcurrency({
  client,
  context,
  databaseUrl,
  endpoint,
  data,
  requests,
  supplier = false,
  successStatus,
  rejectedStatus,
  phase,
  checks,
}) {
  const controller = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  const name = `recon_race_${randomUUID().replaceAll('-', '')}`;
  const lock = parseInt(randomUUID().slice(0, 8), 16) % 2147483647;
  const keys = requests
    ? requests.map((request) => request.data.requestId)
    : [randomUUID(), randomUUID()];
  const table = supplier
    ? 'clothing_supplier_credits'
    : 'clothing_financial_requests';
  const event = supplier ? 'UPDATE' : 'INSERT';
  let release;
  let ready;
  const released = new Promise((resolve) => {
    release = resolve;
  });
  const locked = new Promise((resolve) => {
    ready = resolve;
  });
  let held;
  let posts;
  let controllerPid;
  let connections = 0;
  await client.$executeRawUnsafe(
    `CREATE FUNCTION public."${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock_shared(${lock}); RETURN NEW; END $$`
  );
  try {
    await client.$executeRawUnsafe(
      `CREATE TRIGGER "${name}" BEFORE ${event} ON public."${table}" FOR EACH ROW EXECUTE FUNCTION public."${name}"()`
    );
    try {
      held = controller.$transaction(
        async (transaction) => {
          controllerPid = Number(
            (await transaction.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid
          );
          await transaction.$executeRawUnsafe(
            `SELECT pg_advisory_xact_lock(${lock})`
          );
          ready();
          await released;
        },
        { timeout: 60000 }
      );
      await Promise.race([
        locked,
        held.then(() => {
          throw new Error('Barrier released before requests');
        }),
      ]);
      posts = keys.map((key, index) =>
        context.request.post(requests?.[index].endpoint ?? endpoint, {
          headers: { 'Idempotency-Key': key },
          data: requests?.[index].data ?? data,
        })
      );
      await expect
        .poll(async () => {
          const rows =
            await client.$queryRaw`SELECT COUNT(DISTINCT pid) AS connections FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid() AND pid <> ${controllerPid}
          AND xact_start IS NOT NULL AND backend_type = 'client backend' AND wait_event_type = 'Lock'`;
          connections = Number(rows[0].connections);
          return connections;
        })
        .toBeGreaterThanOrEqual(2);
      release();
      await held;
      const responses = await Promise.all(posts);
      assert.deepEqual(
        responses.map((response) => response.status()).sort(),
        [successStatus, rejectedStatus].sort(),
        `X02 ${phase}: one bounded winner and one rejection`
      );
      const winner = responses.findIndex(
        (response) => response.status() === successStatus
      );
      const loser = 1 - winner;
      if (supplier) {
        assert.equal(
          await client.clothingSupplierCreditApplication.count({
            where: { requestId: keys[winner] },
          }),
          1
        );
        assert.equal(
          await client.clothingSupplierCreditApplication.count({
            where: { requestId: keys[loser] },
          }),
          0
        );
      } else {
        assert.equal(
          await client.clothingFinancialRequest.count({
            where: { id: keys[winner] },
          }),
          1
        );
        assert.equal(
          await client.clothingFinancialRequest.count({
            where: { id: keys[loser] },
          }),
          0
        );
      }
      checks.push(
        `X02 ${phase}: ${connections} independent blocked application transactions released together; exactly one succeeds, the other rejects without a partial request; normal replay/report/count checks follow`
      );
      return {
        url: requests?.[winner].endpoint ?? endpoint,
        key: keys[winner],
        data: requests?.[winner].data ?? data,
        loser: requests?.[loser],
      };
    } finally {
      release();
      if (held) await held;
      if (posts) await Promise.allSettled(posts);
      await client.$executeRawUnsafe(
        `DROP TRIGGER "${name}" ON public."${table}"`
      );
    }
  } finally {
    await client.$executeRawUnsafe(`DROP FUNCTION public."${name}"()`);
    await controller.$disconnect();
  }
}

module.exports = {
  snapshot,
  verifyFinancialRollback,
  verifyCreditRollback,
  verifyFinancialConcurrency,
};
