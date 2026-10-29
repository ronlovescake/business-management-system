import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import dotenv from 'dotenv';

const target = process.argv[2];
const apply = process.argv.includes('--apply');
let stage = 'preflight';
if (!['development', 'production'].includes(target)) {
  throw new Error(
    'Specify development or production; omit --apply for read-only preflight.'
  );
}
const container =
  target === 'development'
    ? 'business-management-system-dev-db-1'
    : 'business-management-production-db-1';
const groups = [
  {
    productCode: 'Onesie (O-091426)',
    unitCost: 40.07,
    rows: [
      [5224, 18, 3450],
      [5268, 35, 3453],
      [5271, 2000, 3427],
    ],
  },
  {
    productCode: 'Premium Shortsleeves Onesie (PSO-101226)',
    unitCost: 47.52,
    rows: [
      [5270, 50, 3467],
      [5273, 150, 3472],
      [5276, 50, 3468],
      [5297, 100, 3475],
      [5301, 150, 3469],
      [5333, 50, 3473],
    ],
  },
  {
    productCode: 'Mixed Onesie (MO-062626)',
    unitCost: 39.01,
    rows: [[5179, 20, 3386]],
  },
  {
    productCode: 'Baby Shoes (BS-062926)',
    unitCost: 77.65,
    rows: [[4614, 1, 3201]],
  },
  {
    productCode: 'MK Shoes (MS-062226)',
    unitCost: 401.96,
    rows: [[5335, 1, 3258]],
  },
  {
    productCode: 'Organic Undies (OU-042226)',
    unitCost: 16.47,
    rows: [
      [5178, 50, 3387],
      [5222, 50, 3373],
      [5226, 15, 3212],
    ],
  },
];

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
      `BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; ${query}; COMMIT;`,
    ],
    { encoding: 'utf8' }
  ).trim();
}

function fingerprints() {
  return Object.fromEntries(
    [
      'products',
      'inventory_movements',
      'transactions',
      'clothing_accounting_journal_lines',
    ].map((table) => [
      table,
      sql(
        `SELECT md5(COALESCE(string_agg(row_to_json(record)::text, '' ORDER BY record.id), '')) FROM public.${table} record`
      ),
    ])
  );
}

async function main() {
  dotenv.config({ path: '.env.local', quiet: true });
  const inspected = JSON.parse(
    execFileSync('docker', ['inspect', container], { encoding: 'utf8' })
  )[0];
  const env = Object.fromEntries(
    (inspected.Config.Env as string[]).map((value) => {
      const split = value.indexOf('=');
      return [value.slice(0, split), value.slice(split + 1)];
    })
  );
  const port = inspected.NetworkSettings.Ports['5432/tcp'][0].HostPort;
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:${port}/business_management`;
  const { prisma } = await import('../../src/lib/db');
  const { confirmLegacyMovementCosts } = await import(
    '../../src/lib/accounting/inventory-valuation'
  );
  const { buildCogsAndInventoryEntries } = await import(
    '../../src/lib/accounting/inventory-cogs'
  );
  try {
    const ids = groups.flatMap((group) => group.rows.map(([id]) => id));
    const movements = await prisma.inventoryMovement.findMany({
      where: { id: { in: ids } },
    });
    if (movements.length !== 15) {
      throw new Error('Expected exactly 15 movements.');
    }
    for (const group of groups) {
      const products = await prisma.product.findMany({
        where: { productCode: group.productCode, deletedAt: null },
      });
      if (
        products.length !== 1 ||
        products[0].landedUnitCost !== group.unitCost
      ) {
        throw new Error(`Catalog changed: ${group.productCode}`);
      }
      for (const [id, quantity, transactionId] of group.rows) {
        const movement = movements.find((row) => row.id === id);
        if (
          !movement ||
          movement.deletedAt ||
          movement.productCode !== group.productCode ||
          movement.quantity !== quantity ||
          movement.sourceTransactionId !== transactionId ||
          movement.unitCost !== null ||
          movement.costBasis !== null ||
          movement.toBucket !== 'sold' ||
          movement.fromBucket !== 'reserved' ||
          movement.movementSource !== 'transaction' ||
          movement.movementType !== 'sale'
        ) {
          throw new Error(
            `Movement evidence changed for ${group.productCode}.`
          );
        }
      }
    }
    const before = fingerprints();
    const period = { from: new Date('2026-10-11T16:00:00Z'), to: null };
    const beforeReport = await buildCogsAndInventoryEntries(period);
    const historicalBefore = await buildCogsAndInventoryEntries({
      ...period,
      to: new Date('2026-10-28T15:59:59Z'),
    });
    console.log(
      JSON.stringify({
        target,
        apply,
        movements: ids.length,
        units: movements.reduce((sum, movement) => sum + movement.quantity, 0),
        issuesBefore: beforeReport.valuationIssues.length,
      })
    );
    if (!apply) {
      return;
    }
    const directory = resolve(
      'backups',
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${target}-legacy-cost-approval`
    );
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const dump = resolve(directory, 'before.dump');
    stage = 'backup-create';
    const descriptor = openSync(dump, 'wx', 0o600);
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
    const dumpContents = readFileSync(dump);
    stage = 'backup-verify';
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
      { input: dumpContents }
    );
    if (verification.status !== 0 || verification.error) {
      throw new Error('Backup archive verification failed.');
    }
    writeFileSync(
      resolve(directory, 'before.json'),
      JSON.stringify(
        {
          before,
          movements,
          backupSha256: createHash('sha256').update(dumpContents).digest('hex'),
        },
        null,
        2
      ),
      { mode: 0o600 }
    );
    for (const [index, group] of groups.entries()) {
      stage = `confirm-product-${index + 1}`;
      const input = {
        productCode: group.productCode,
        unitCost: group.unitCost,
        reason:
          'Clothing owner confirmed original all-in batch costs on 2026-10-29; reconciliation log section 30; exact 15-movement scope only.',
        movements: group.rows.map(([id, quantity, transactionId]) => ({
          id,
          quantity,
          transactionId,
        })),
      };
      const actor = {
        id: 'clothing-owner-attestation-2026-10-29',
        role: 'ADMIN',
      };
      const key = `b0d0c026-1029-4000-8000-${String(index + 1).padStart(12, '0')}`;
      const first = await confirmLegacyMovementCosts(key, input, actor);
      const replay = await confirmLegacyMovementCosts(key, input, actor);
      if (!isDeepStrictEqual(JSON.parse(JSON.stringify(first)), replay)) {
        throw new Error('Replay mismatch.');
      }
    }
    const after = fingerprints();
    stage = 'post-verification';
    const afterReport = await buildCogsAndInventoryEntries(period);
    const historicalAfter = await buildCogsAndInventoryEntries({
      ...period,
      to: new Date('2026-10-28T15:59:59Z'),
    });
    const outcome = {
      target,
      backup: directory,
      before,
      after,
      issuesAfter: afterReport.valuationIssues.length,
      cogsBefore: beforeReport.totalCogs,
      cogsAfter: afterReport.totalCogs,
      historicalUnchanged:
        JSON.stringify(historicalBefore) === JSON.stringify(historicalAfter),
      originalTablesUnchanged: JSON.stringify(before) === JSON.stringify(after),
    };
    writeFileSync(
      resolve(directory, 'after.json'),
      JSON.stringify(outcome, null, 2),
      { mode: 0o600 }
    );
    if (
      !outcome.originalTablesUnchanged ||
      !outcome.historicalUnchanged ||
      outcome.issuesAfter !== 0 ||
      outcome.cogsBefore !== outcome.cogsAfter
    ) {
      throw new Error(
        `Post-approval verification failed. Review ${directory}; do not repeat with new keys.`
      );
    }
    console.log(JSON.stringify(outcome));
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(
      JSON.stringify({
        stage,
        errorType: error?.name,
        code: error?.code,
        detail:
          stage.startsWith('confirm-') || stage === 'post-verification'
            ? error?.message
            : undefined,
      })
    );
    process.exit(1);
  });
