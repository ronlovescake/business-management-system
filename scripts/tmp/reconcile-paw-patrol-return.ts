import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2];
const apply = process.argv.includes('--apply');
const check = process.argv.includes('--check');
if ((target !== 'development' && target !== 'production') || (apply && check)) {
  throw new Error(
    'Specify development or production and at most one of --check (rollback) or --apply.'
  );
}
if (check && target !== 'development') {
  throw new Error('Rollback validation is development-only.');
}
const container =
  target === 'development'
    ? 'business-management-system-dev-db-1'
    : 'business-management-production-db-1';
const requestId = 'b0d0c026-1029-4000-8000-000000000280';
const code = 'Paw Patrol 2-PC Onesie (PP2PCO-082026)';
const operation = 'UNSUPPORTED_SCRAP_RETURN_REPAIR';
const payload = {
  productId: 280,
  productCode: code,
  movementId: 5468,
  precedingReturnId: 5467,
  scrapId: 5466,
  units: 7,
  owner: 'requesting-clothing-owner',
  reason:
    'Owner requested reconciliation to confirmed zero physical stock on 2026-10-29. Movement 5467 already exhausted the only seven recorded scrap units; 5468 is an unsupported second return. Preserve the prior chain and eight shipped units; no new write-off, sale, return or cost is authorized.',
};
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const payloadHash = createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex');

function sql(query: string) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-u',
      'postgres',
      container,
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-d',
      'business_management',
      '-c',
      query,
    ],
    { encoding: 'utf8' }
  ).trim();
}

const scope = `("productId"=280 OR "productCode"=${literal(code)})`;
const balances = `(SELECT jsonb_object_agg(bucket, units) FROM (
  SELECT bucket, sum(delta) AS units FROM (
    SELECT "toBucket"::text AS bucket, quantity AS delta FROM public.inventory_movements WHERE ${scope} AND "deletedAt" IS NULL
    UNION ALL SELECT "fromBucket"::text, -quantity FROM public.inventory_movements WHERE ${scope} AND "deletedAt" IS NULL
  ) changes GROUP BY bucket
) totals)`;
const fingerprints = `jsonb_build_object(
  'products',(SELECT md5(COALESCE(string_agg(to_jsonb(row)::text,'' ORDER BY id),'')) FROM public.products row),
  'orders',(SELECT md5(COALESCE(string_agg(to_jsonb(row)::text,'' ORDER BY id),'')) FROM public.transactions row),
  'payments',(SELECT md5(COALESCE(string_agg(to_jsonb(row)::text,'' ORDER BY id),'')) FROM public.transaction_payments row),
  'refunds',(SELECT md5(COALESCE(string_agg(to_jsonb(row)::text,'' ORDER BY id),'')) FROM public.transaction_refunds row),
  'journals',(SELECT md5(COALESCE(string_agg(to_jsonb(row)::text,'' ORDER BY id),'')) FROM public.clothing_accounting_journal_lines row),
  'openings',(SELECT md5(COALESCE(string_agg(to_jsonb(row)::text,'' ORDER BY id),'')) FROM public."ClothingAccountingOpeningBalance" row),
  'otherMovements',(SELECT md5(COALESCE(string_agg(to_jsonb(row)::text,'' ORDER BY id),'')) FROM public.inventory_movements row WHERE id<>5468)
)`;
const expectedHistory = [
  [4890, 10, 'opening_inventory', 'sellable'],
  [4891, 15, 'supplier_short', 'sellable'],
  [4893, 4, 'sellable', 'reserved'],
  [5004, 4, 'sellable', 'reserved'],
  [5008, 4, 'reserved', 'sold'],
  [5023, 4, 'reserved', 'sold'],
  [5463, 17, 'sellable', 'supplier_short'],
  [5464, 7, 'sellable', 'supplier_short'],
  [5465, 7, 'supplier_short', 'sellable'],
  [5466, 7, 'sellable', 'scrap'],
  [5467, 7, 'scrap', 'sellable'],
  [5468, 7, 'scrap', 'sellable'],
];

function main() {
  const before = JSON.parse(
    sql(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
    SET LOCAL statement_timeout='30s';
    SELECT jsonb_build_object('movements',(SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM public.inventory_movements row WHERE ${scope}),
      'balances',${balances},'fingerprints',${fingerprints},
      'existingApproval',(SELECT result FROM public.clothing_financial_requests WHERE id=${literal(requestId)})); COMMIT;`)
  );
  if (!apply && !check) {
    console.log(
      JSON.stringify({ target, mode: 'read-only', snapshot: before })
    );
    return;
  }
  let directory: string | null = null;
  if (apply) {
    directory = resolve(
      'backups',
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${target}-paw-patrol-return`
    );
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const descriptor = openSync(resolve(directory, 'before.dump'), 'wx', 0o600);
    try {
      execFileSync(
        'docker',
        [
          'exec',
          '-u',
          'postgres',
          container,
          'pg_dump',
          '-Fc',
          '-d',
          'business_management',
        ],
        { stdio: ['ignore', descriptor, 'pipe'] }
      );
    } finally {
      closeSync(descriptor);
    }
    const dump = readFileSync(resolve(directory, 'before.dump'));
    const verification = spawnSync(
      'docker',
      [
        'exec',
        '-i',
        '-u',
        'postgres',
        container,
        'pg_restore',
        '--file=/dev/null',
      ],
      { input: dump }
    );
    if (verification.status !== 0 || verification.error) {
      throw new Error('Backup archive verification failed.');
    }
    writeFileSync(
      resolve(directory, 'before.json'),
      JSON.stringify(
        {
          target,
          payload,
          before,
          backupSha256: createHash('sha256').update(dump).digest('hex'),
        },
        null,
        2
      ),
      { mode: 0o600 }
    );
  }
  const saved = JSON.parse(
    sql(`BEGIN ISOLATION LEVEL SERIALIZABLE;
    SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='30s';
    LOCK TABLE public.products,public.transactions,public.transaction_payments,public.transaction_refunds,
      public.clothing_accounting_journal_lines,public."ClothingAccountingOpeningBalance",
      public.inventory_movements,public.clothing_financial_requests IN SHARE ROW EXCLUSIVE MODE;
    DO $repair$
    DECLARE original jsonb; amended jsonb; history jsonb; stock jsonb; before_hashes jsonb; after_hashes jsonb;
      existing public.clothing_financial_requests%ROWTYPE; original_chain jsonb;
    BEGIN
      SELECT * INTO existing FROM public.clothing_financial_requests WHERE id=${literal(requestId)};
      IF FOUND THEN
        IF existing.operation<>${literal(operation)} OR existing."payloadHash"<>${literal(payloadHash)} THEN RAISE EXCEPTION 'Conflicting repair request'; END IF;
        SELECT to_jsonb(row) INTO amended FROM public.inventory_movements row WHERE id=5468;
        IF amended IS DISTINCT FROM existing.result->'afterImage' THEN RAISE EXCEPTION 'Repaired row has changed'; END IF;
        RETURN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=280 AND "productCode"=${literal(code)} AND "deletedAt" IS NULL)
        THEN RAISE EXCEPTION 'Product scope changed'; END IF;
      SELECT jsonb_agg(jsonb_build_array(id,quantity,"fromBucket","toBucket") ORDER BY id),jsonb_agg(to_jsonb(row) ORDER BY id)
        INTO history,original_chain FROM public.inventory_movements row WHERE ${scope} AND "deletedAt" IS NULL;
      IF history IS DISTINCT FROM ${literal(JSON.stringify(expectedHistory))}::jsonb THEN RAISE EXCEPTION 'Movement chain changed'; END IF;
      SELECT to_jsonb(row) INTO original FROM public.inventory_movements row WHERE id=5468
        AND "productId"=280 AND "productCode"=${literal(code)} AND "deletedAt" IS NULL AND quantity=7
        AND "fromBucket"='scrap' AND "toBucket"='sellable' AND "postingDate"='2026-10-23'
        AND "createdAt"='2026-10-23T13:52:55.328'::timestamp AND notes IS NULL
        AND "sourceTransactionId" IS NULL AND "sourceMovementId" IS NULL AND "movementSource" IS NULL
        AND "movementType" IS NULL AND "costBasis" IS NULL AND "unitCost" IS NULL;
      IF original IS NULL THEN RAISE EXCEPTION 'Unsupported return provenance changed'; END IF;
      IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE "sourceMovementId"=5468)
        OR EXISTS (SELECT 1 FROM public.clothing_financial_requests WHERE result->'resolvedMovementIds' @> '[5468]'::jsonb)
        THEN RAISE EXCEPTION 'Return has dependent cost/allocation evidence'; END IF;
      IF (SELECT count(*) FROM public.transactions WHERE id IN (3331,3378) AND "deletedAt" IS NULL AND quantity=4
        AND "orderStatus"='Shipped' AND "productId"=280 AND "productCode"=${literal(code)})<>2 THEN RAISE EXCEPTION 'Shipped order scope changed'; END IF;
      IF EXISTS (SELECT 1 FROM public.transactions WHERE ${scope} AND "deletedAt" IS NULL AND id NOT IN (3331,3378)) THEN RAISE EXCEPTION 'Additional order found'; END IF;
      IF (SELECT COALESCE(sum(CASE WHEN "toBucket"='scrap' THEN quantity WHEN "fromBucket"='scrap' THEN -quantity ELSE 0 END),0)
        FROM public.inventory_movements WHERE ${scope} AND "deletedAt" IS NULL AND id<5468)<>0 THEN RAISE EXCEPTION 'Scrap before unsupported return is not empty'; END IF;
      stock := ${balances};
      IF stock IS DISTINCT FROM '{"sellable":7,"scrap":-7,"sold":8,"reserved":0,"supplier_short":2,"opening_inventory":-10}'::jsonb
        THEN RAISE EXCEPTION 'Unexpected starting balances'; END IF;
      before_hashes := ${fingerprints};
      UPDATE public.inventory_movements SET "deletedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=5468;
      SELECT to_jsonb(row) INTO amended FROM public.inventory_movements row WHERE id=5468;
      after_hashes := ${fingerprints}; stock := ${balances};
      IF before_hashes IS DISTINCT FROM after_hashes
        OR (original-'deletedAt'-'updatedAt') IS DISTINCT FROM (amended-'deletedAt'-'updatedAt')
        OR stock IS DISTINCT FROM '{"sellable":0,"scrap":0,"sold":8,"reserved":0,"supplier_short":2,"opening_inventory":-10}'::jsonb
        THEN RAISE EXCEPTION 'Post-repair preservation failed'; END IF;
      INSERT INTO public.clothing_financial_requests(id,operation,"payloadHash",result)
        VALUES (${literal(requestId)},${literal(operation)},${literal(payloadHash)},jsonb_build_object(
          'attestation',${literal(JSON.stringify(payload))}::jsonb,'approvedAt',CURRENT_TIMESTAMP,
          'beforeImage',original,'afterImage',amended,'originalChain',original_chain,
          'beforeFingerprints',before_hashes,'afterFingerprints',after_hashes,'balances',stock,
          'backup',${directory ? literal(directory) : 'NULL'}));
    END $repair$;
    SELECT result FROM public.clothing_financial_requests WHERE id=${literal(requestId)};
    ${check ? 'ROLLBACK' : 'COMMIT'};`)
  );
  if (directory) {
    writeFileSync(
      resolve(directory, 'after.json'),
      JSON.stringify(saved, null, 2),
      { mode: 0o600 }
    );
  }
  console.log(
    JSON.stringify({
      target,
      mode: check ? 'validated-and-rolled-back' : 'applied',
      replay: Boolean(before.existingApproval),
      backup: directory,
      correctedMovement: saved.afterImage.id,
      balances: saved.balances,
      protectedRecordsUnchanged:
        JSON.stringify(saved.beforeFingerprints) ===
        JSON.stringify(saved.afterFingerprints),
    })
  );
}

try {
  main();
} catch {
  console.error(
    'Paw Patrol repair stopped. Review guarded scope and private backup evidence before retrying.'
  );
  process.exitCode = 1;
}
