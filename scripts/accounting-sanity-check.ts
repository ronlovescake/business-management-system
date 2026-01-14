import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PAID_STATUSES } from '@/lib/accounting/constants';

const CUTOVER = new Date(Date.UTC(2026, 0, 1));
const EPS = 0.01;

type Args = {
  from?: string;
  to?: string;
  limit?: number;
  take?: number;
  csv?: string;
  includePaidAdjustmentMismatch?: boolean;
  failOnIssues?: boolean;
  scanAll?: boolean;
  help?: boolean;
};

type IssueType =
  | 'paid_missing_amounts'
  | 'paid_line_total_nonzero'
  | 'paid_adjustment_mismatch'
  | 'pending_payment_adjustment_gt_gross'
  | 'pending_payment_negative_adjustment'
  | 'line_total_inconsistent'
  | 'missing_status_with_money';

type IssueRow = {
  type: IssueType;
  transactionId: number;
  orderDate: string;
  orderStatus: string;
  customers: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  adjustment: number;
  lineTotal: number;
  grossSale: number;
  expectedLineTotal: number;
  detail: string;
};

function usage(): string {
  return `Accounting sanity check (read-only)

Usage:
  npx tsx scripts/accounting-sanity-check.ts [options]

Options:
  --from YYYY-MM-DD      Filter by orderDate >= from (best-effort)
  --to YYYY-MM-DD        Filter by orderDate <= to (best-effort)
  --limit N              Max issue rows to print (default: 200)
  --take N               Only scan the most-recent N transactions (default: all matched)
  --csv PATH              Write issues to CSV file
  --includePaidAdjustmentMismatch  Include a warning when Adjustment != grossSale for paid statuses
  --failOnIssues          Exit with code 1 if any issues are found
  --scanAll               Scan all transactions (default: only createdAt >= 2026-01-01)
  --help                  Show this help

Notes:
  - Paid statuses are: ${PAID_STATUSES.join(', ')}
  - Pending payment status is: Pending Payment
  - This script does not modify data.
`;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token === '--includePaidAdjustmentMismatch') {
      args.includePaidAdjustmentMismatch = true;
      continue;
    }

    if (token === '--scanAll') {
      args.scanAll = true;
      continue;
    }

    if (token === '--failOnIssues') {
      args.failOnIssues = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) {
      continue;
    }

    if (token === '--from') {
      args.from = next;
      index += 1;
      continue;
    }

    if (token === '--to') {
      args.to = next;
      index += 1;
      continue;
    }

    if (token === '--limit') {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed >= 0) {
        args.limit = parsed;
      }
      index += 1;
      continue;
    }

    if (token === '--take') {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed >= 0) {
        args.take = parsed;
      }
      index += 1;
      continue;
    }

    if (token === '--csv') {
      args.csv = next;
      index += 1;
      continue;
    }
  }

  return args;
}

function toFinite(value: unknown): number {
  if (typeof value !== 'number') {
    return 0;
  }
  return Number.isFinite(value) ? value : 0;
}

function normText(value: unknown): string {
  return String(value ?? '').trim();
}

function isPaidStatus(status: string): boolean {
  return (PAID_STATUSES as readonly string[]).includes(status);
}

function parseDateKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  // Keep only the date portion if the string is ISO-like.
  const datePart = trimmed.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : '';
}

function inDateRange(orderDate: string, from?: string, to?: string): boolean {
  const key = parseDateKey(orderDate);
  if (!key) {
    return true;
  }
  if (from && key < from) {
    return false;
  }
  if (to && key > to) {
    return false;
  }
  return true;
}

function toCsv(rows: IssueRow[]): string {
  const header = [
    'type',
    'transactionId',
    'orderDate',
    'orderStatus',
    'customers',
    'productCode',
    'quantity',
    'unitPrice',
    'adjustment',
    'lineTotal',
    'grossSale',
    'expectedLineTotal',
    'detail',
  ];

  const lines = [header.join(',')];
  for (const row of rows) {
    const values = [
      row.type,
      String(row.transactionId),
      row.orderDate,
      row.orderStatus,
      row.customers,
      row.productCode,
      String(row.quantity),
      String(row.unitPrice),
      String(row.adjustment),
      String(row.lineTotal),
      String(row.grossSale),
      String(row.expectedLineTotal),
      row.detail,
    ].map((v) => JSON.stringify(String(v ?? '')));

    lines.push(values.join(','));
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const limit = args.limit ?? 200;

  const fromKey = args.from ?? undefined;
  const toKey = args.to ?? undefined;

  const txRows = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      ...(args.scanAll ? {} : { createdAt: { gte: CUTOVER } }),
    },
    select: {
      id: true,
      orderDate: true,
      customers: true,
      productCode: true,
      quantity: true,
      unitPrice: true,
      adjustment: true,
      lineTotal: true,
      orderStatus: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'desc' }],
    ...(typeof args.take === 'number' ? { take: args.take } : {}),
  });

  const issues: IssueRow[] = [];

  for (const tx of txRows) {
    const orderStatus = normText(tx.orderStatus);
    const orderDate = normText(tx.orderDate);

    if (!inDateRange(orderDate, fromKey, toKey)) {
      continue;
    }

    const quantity = toFinite(tx.quantity);
    const unitPrice = toFinite(tx.unitPrice);
    const adjustment = toFinite(tx.adjustment);
    const lineTotal = toFinite(tx.lineTotal);

    const grossSale = Number.isFinite(quantity * unitPrice)
      ? quantity * unitPrice
      : 0;

    const expectedLineTotal = quantity * unitPrice - adjustment;

    const customers = normText(tx.customers);
    const productCode = normText(tx.productCode);

    const hasAnyMoney =
      Math.abs(grossSale) > EPS ||
      Math.abs(adjustment) > EPS ||
      Math.abs(lineTotal) > EPS;

    // 1) Paid statuses should have a meaningful gross sale.
    if (isPaidStatus(orderStatus)) {
      if (!(grossSale > EPS)) {
        issues.push({
          type: 'paid_missing_amounts',
          transactionId: tx.id,
          orderDate,
          orderStatus,
          customers,
          productCode,
          quantity,
          unitPrice,
          adjustment,
          lineTotal,
          grossSale,
          expectedLineTotal,
          detail:
            'Paid status but quantity/unitPrice results in grossSale <= 0.',
        });
      }

      if (Math.abs(lineTotal) > EPS) {
        issues.push({
          type: 'paid_line_total_nonzero',
          transactionId: tx.id,
          orderDate,
          orderStatus,
          customers,
          productCode,
          quantity,
          unitPrice,
          adjustment,
          lineTotal,
          grossSale,
          expectedLineTotal,
          detail:
            'Paid status but stored lineTotal is not ~0 (suggests an unpaid balance remains).',
        });
      }

      if (
        args.includePaidAdjustmentMismatch &&
        grossSale > EPS &&
        Math.abs(adjustment - grossSale) > EPS
      ) {
        issues.push({
          type: 'paid_adjustment_mismatch',
          transactionId: tx.id,
          orderDate,
          orderStatus,
          customers,
          productCode,
          quantity,
          unitPrice,
          adjustment,
          lineTotal,
          grossSale,
          expectedLineTotal,
          detail:
            'Paid status but Adjustment differs from grossSale (warning only; accounting ignores Adjustment for paid statuses).',
        });
      }
    }

    // 2) Pending Payment rules: Adjustment is a deposit and must not exceed gross sale.
    if (orderStatus === 'Pending Payment') {
      if (adjustment < -EPS) {
        issues.push({
          type: 'pending_payment_negative_adjustment',
          transactionId: tx.id,
          orderDate,
          orderStatus,
          customers,
          productCode,
          quantity,
          unitPrice,
          adjustment,
          lineTotal,
          grossSale,
          expectedLineTotal,
          detail: 'Pending Payment has a negative Adjustment.',
        });
      }

      if (grossSale > EPS && adjustment - grossSale > EPS) {
        issues.push({
          type: 'pending_payment_adjustment_gt_gross',
          transactionId: tx.id,
          orderDate,
          orderStatus,
          customers,
          productCode,
          quantity,
          unitPrice,
          adjustment,
          lineTotal,
          grossSale,
          expectedLineTotal,
          detail:
            'Pending Payment Adjustment exceeds grossSale (deposit > order value).',
        });
      }
    }

    // 3) Generic consistency check: stored lineTotal should match formula.
    if (
      Number.isFinite(expectedLineTotal) &&
      Math.abs(lineTotal - expectedLineTotal) > EPS &&
      (Math.abs(quantity) > EPS ||
        Math.abs(unitPrice) > EPS ||
        Math.abs(adjustment) > EPS)
    ) {
      issues.push({
        type: 'line_total_inconsistent',
        transactionId: tx.id,
        orderDate,
        orderStatus,
        customers,
        productCode,
        quantity,
        unitPrice,
        adjustment,
        lineTotal,
        grossSale,
        expectedLineTotal,
        detail:
          'Stored lineTotal differs from (quantity * unitPrice) - adjustment.',
      });
    }

    // 4) Money exists but no status (often indicates incomplete workflow)
    if (!orderStatus && hasAnyMoney) {
      issues.push({
        type: 'missing_status_with_money',
        transactionId: tx.id,
        orderDate,
        orderStatus,
        customers,
        productCode,
        quantity,
        unitPrice,
        adjustment,
        lineTotal,
        grossSale,
        expectedLineTotal,
        detail:
          'Transaction has money fields filled but Order Status is blank.',
      });
    }
  }

  const counts = new Map<IssueType, number>();
  for (const issue of issues) {
    counts.set(issue.type, (counts.get(issue.type) ?? 0) + 1);
  }

  const sortedCounts = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

  console.log('Accounting sanity check summary');
  console.log(`Scanned transactions: ${txRows.length}`);
  if (fromKey || toKey) {
    console.log(
      `Filter (orderDate): ${fromKey ?? '(none)'} -> ${toKey ?? '(none)'}`
    );
  }
  console.log(`Issues found: ${issues.length}`);

  if (sortedCounts.length) {
    console.log('\nBy type:');
    for (const [type, count] of sortedCounts) {
      console.log(`- ${type}: ${count}`);
    }
  }

  const preview = limit === 0 ? [] : issues.slice(0, limit);
  if (preview.length) {
    console.log(`\nFirst ${preview.length} issue rows:`);
    for (const row of preview) {
      console.log(
        `- [${row.type}] TX-${row.transactionId} ${row.orderStatus || '(no status)'} ` +
          `${row.productCode || '(no product)'} qty=${row.quantity} unit=${row.unitPrice} ` +
          `adj=${row.adjustment} line=${row.lineTotal} gross=${row.grossSale} :: ${row.detail}`
      );
    }
  }

  if (args.csv) {
    const csvPath = path.resolve(process.cwd(), args.csv);
    fs.writeFileSync(csvPath, toCsv(issues), 'utf8');
    console.log(`\nWrote CSV: ${csvPath}`);
  }

  if (issues.length && args.failOnIssues) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  logger.error('Accounting sanity check failed', { error });
  process.exitCode = 1;
});
