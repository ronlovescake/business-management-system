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
if (target !== 'development' && target !== 'production') {
  throw new Error(
    'Specify development or production; omit --apply for read-only inspection.'
  );
}
const container =
  target === 'development'
    ? 'business-management-system-dev-db-1'
    : 'business-management-production-db-1';
const requestId = 'b0d0c026-1029-4000-8000-000000000740';
const payload = {
  productCode: 'Premium Shortsleeves Onesie (PSO-101226)',
  productId: 290,
  movementId: 5225,
  beforeQuantity: 700,
  confirmedQuantity: 740,
  owner: 'requesting-clothing-owner',
  reason:
    'Owner confirmed on 2026-10-29: all 740 ordered pieces received; 650 collected, 50 held for order 3471 and 40 held for order 3612. Quantity-only reconciliation; dates and financial records unchanged.',
};
const payloadHash = createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex');
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

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

const fingerprints = `jsonb_build_object(
  'products', (SELECT md5(COALESCE(string_agg(to_jsonb(row)::text, '' ORDER BY row.id), '')) FROM public.products row),
  'orders', (SELECT md5(COALESCE(string_agg(to_jsonb(row)::text, '' ORDER BY row.id), '')) FROM public.transactions row),
  'payments', (SELECT md5(COALESCE(string_agg(to_jsonb(row)::text, '' ORDER BY row.id), '')) FROM public.transaction_payments row),
  'journals', (SELECT md5(COALESCE(string_agg(to_jsonb(row)::text, '' ORDER BY row.id), '')) FROM public.clothing_accounting_journal_lines row),
  'otherMovements', (SELECT md5(COALESCE(string_agg(to_jsonb(row)::text, '' ORDER BY row.id), '')) FROM public.inventory_movements row WHERE row.id <> 5225)
)`;
const balances = `(SELECT jsonb_object_agg(bucket, units) FROM (
  SELECT bucket, sum(delta) AS units FROM (
    SELECT "toBucket"::text AS bucket, quantity AS delta FROM public.inventory_movements
      WHERE "deletedAt" IS NULL AND "productCode" = ${literal(payload.productCode)}
    UNION ALL
    SELECT "fromBucket"::text, -quantity FROM public.inventory_movements
      WHERE "deletedAt" IS NULL AND "productCode" = ${literal(payload.productCode)}
  ) changes GROUP BY bucket
) totals)`;

function main() {
  const before = sql(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
    SET LOCAL statement_timeout = '30s';
    SELECT jsonb_build_object('receipt', (SELECT to_jsonb(row) FROM public.inventory_movements row WHERE id=5225),
      'balances', ${balances}, 'fingerprints', ${fingerprints},
      'existingApproval', (SELECT result FROM public.clothing_financial_requests WHERE id=${literal(requestId)}));
    COMMIT;`);
  if (!apply) {
    console.log(
      JSON.stringify({ target, apply, snapshot: JSON.parse(before) })
    );
    return;
  }
  const directory = resolve(
    'backups',
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${target}-pso-receipt`
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
    throw new Error('Backup verification failed.');
  }
  writeFileSync(
    resolve(directory, 'before.json'),
    JSON.stringify(
      {
        target,
        payload,
        snapshot: JSON.parse(before),
        backupSha256: createHash('sha256').update(dump).digest('hex'),
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
  const outcome = sql(`BEGIN ISOLATION LEVEL SERIALIZABLE;
    SET LOCAL lock_timeout = '10s'; SET LOCAL statement_timeout = '30s';
    LOCK TABLE public.products, public.transactions, public.transaction_payments,
      public.clothing_accounting_journal_lines, public.inventory_movements,
      public.clothing_financial_requests IN SHARE ROW EXCLUSIVE MODE;
    DO $repair$
    DECLARE original jsonb; amended jsonb; existing public.clothing_financial_requests%ROWTYPE;
      before_hashes jsonb; after_hashes jsonb; stock jsonb; receipt_count integer;
    BEGIN
      SELECT * INTO existing FROM public.clothing_financial_requests WHERE id=${literal(requestId)};
      IF FOUND THEN
        IF existing.operation <> 'RECEIPT_QUANTITY_RECONCILIATION' OR existing."payloadHash" <> ${literal(payloadHash)}
          THEN RAISE EXCEPTION 'Conflicting repair request'; END IF;
        SELECT to_jsonb(row) INTO amended FROM public.inventory_movements row WHERE id=5225;
        IF amended IS DISTINCT FROM existing.result->'afterImage' THEN RAISE EXCEPTION 'Receipt changed after repair'; END IF;
        RETURN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=290 AND "deletedAt" IS NULL
        AND "productCode"=${literal(payload.productCode)} AND quantity=740 AND "landedUnitCost"=47.52)
        THEN RAISE EXCEPTION 'Product no longer matches approved scope'; END IF;
      SELECT to_jsonb(row) INTO original FROM public.inventory_movements row WHERE id=5225
        AND "productId"=290 AND "productCode"=${literal(payload.productCode)} AND quantity=700
        AND "fromBucket"='opening_inventory' AND "toBucket"='sellable' AND "deletedAt" IS NULL
        AND notes='auto-receipt product 290' AND "postingDate"='2026-10-12'
        AND "unitCost" IS NULL AND "costBasis" IS NULL;
      IF original IS NULL THEN RAISE EXCEPTION 'Receipt no longer matches approved scope'; END IF;
      SELECT count(*) INTO receipt_count FROM public.inventory_movements WHERE "deletedAt" IS NULL
        AND "productCode"=${literal(payload.productCode)} AND "fromBucket"='opening_inventory' AND "toBucket"='sellable';
      IF receipt_count <> 1 THEN RAISE EXCEPTION 'Unexpected additional receipt'; END IF;
      IF (SELECT count(*) FROM public.transactions WHERE "deletedAt" IS NULL AND "productCode"=${literal(payload.productCode)}
        AND ((id=3471 AND quantity=50 AND "orderStatus"='Prepared') OR (id=3612 AND quantity=40 AND "orderStatus"='Prepared'))) <> 2
        THEN RAISE EXCEPTION 'Held order scope changed'; END IF;
      IF ${literal(target)}='production' AND (
        (SELECT COALESCE(sum(amount),0) FROM public.transaction_payments WHERE "transactionId"=3471 AND "deletedAt" IS NULL) <> 3450 OR
        (SELECT COALESCE(sum(amount),0) FROM public.transaction_payments WHERE "transactionId"=3612 AND "deletedAt" IS NULL) <> 2760)
        THEN RAISE EXCEPTION 'Production paid evidence changed'; END IF;
      stock := ${balances};
      IF (stock->>'sellable')::numeric IS DISTINCT FROM -40 OR (stock->>'reserved')::numeric IS DISTINCT FROM 90
        OR (stock->>'sold')::numeric IS DISTINCT FROM 650 THEN RAISE EXCEPTION 'Unexpected pre-repair stock'; END IF;
      before_hashes := ${fingerprints};
      UPDATE public.inventory_movements SET quantity=740, "updatedAt"=CURRENT_TIMESTAMP WHERE id=5225;
      SELECT to_jsonb(row) INTO amended FROM public.inventory_movements row WHERE id=5225;
      after_hashes := ${fingerprints}; stock := ${balances};
      IF before_hashes IS DISTINCT FROM after_hashes OR
        (original - 'quantity' - 'updatedAt') IS DISTINCT FROM (amended - 'quantity' - 'updatedAt')
        OR (stock->>'sellable')::numeric IS DISTINCT FROM 0 OR (stock->>'reserved')::numeric IS DISTINCT FROM 90
        OR (stock->>'sold')::numeric IS DISTINCT FROM 650 THEN RAISE EXCEPTION 'Post-repair preservation check failed'; END IF;
      INSERT INTO public.clothing_financial_requests (id,operation,"payloadHash",result)
      VALUES (${literal(requestId)}, 'RECEIPT_QUANTITY_RECONCILIATION', ${literal(payloadHash)},
        jsonb_build_object('attestation',${literal(JSON.stringify(payload))}::jsonb,'approvedAt',CURRENT_TIMESTAMP,
          'beforeImage',original,'afterImage',amended,'beforeFingerprints',before_hashes,
          'afterFingerprints',after_hashes,'balances',stock,'backup',${literal(directory)}));
    END $repair$;
    SELECT result FROM public.clothing_financial_requests WHERE id=${literal(requestId)}; COMMIT;`);
  const saved = JSON.parse(outcome);
  writeFileSync(
    resolve(directory, 'after.json'),
    JSON.stringify(saved, null, 2),
    { mode: 0o600 }
  );
  console.log(
    JSON.stringify({
      target,
      backup: directory,
      receiptQuantity: saved.afterImage.quantity,
      balances: saved.balances,
      unchangedOtherRecords:
        JSON.stringify(saved.beforeFingerprints) ===
        JSON.stringify(saved.afterFingerprints),
    })
  );
}

try {
  main();
} catch {
  console.error(
    'PSO repair stopped. Inspect the guarded query and private backup evidence before retrying.'
  );
  process.exitCode = 1;
}
