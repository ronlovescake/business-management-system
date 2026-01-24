import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '@/lib/db';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';

const CUTOVER = getAccountingCutoverDate();
const EPS = 0.01;

type Args = {
  from?: string;
  to?: string;
  take?: number;
  limit?: number;
  csv?: string;
  help?: boolean;
};

type IssueType =
  | 'journal_line_invalid_amount'
  | 'journal_entry_unbalanced_by_ref_date'
  | 'journal_entry_unbalanced_by_source'
  | 'manual_journal_missing_pair'
  | 'recurring_payment_missing_pair'
  | 'opening_balance_invalid_amount'
  | 'opening_balance_unbalanced_by_ref_date'
  | 'expense_invalid_amount'
  | 'expense_status_unexpected';

type IssueRow = {
  type: IssueType;
  severity: 'error' | 'warn';
  key: string;
  detail: string;
};

function usage(): string {
  return `Accounting DB integrity check (read-only)

Usage:
  npx tsx scripts/accounting-db-integrity-check.ts [options]

Options:
  --from YYYY-MM-DD    Only consider rows with date >= from (best-effort)
  --to YYYY-MM-DD      Only consider rows with date <= to (best-effort)
  --take N             Limit scanned journal lines (default: all)
  --limit N            Max issue rows to print (default: 200)
  --csv PATH           Write issues to CSV file
  --help               Show this help

Notes:
  - Cutover is ${CUTOVER.toISOString().slice(0, 10)}
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

    if (token === '--take') {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed >= 0) {
        args.take = parsed;
      }
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

    if (token === '--csv') {
      args.csv = next;
      index += 1;
      continue;
    }
  }

  return args;
}

function parseDateKey(raw: unknown): string {
  const val = raw instanceof Date ? raw : null;
  if (!val) {
    return '';
  }
  return val.toISOString().slice(0, 10);
}

function inDateRange(key: string, from?: string, to?: string): boolean {
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toCsv(rows: IssueRow[]): string {
  const header = ['type', 'severity', 'key', 'detail'];
  const lines = [header.join(',')];

  for (const row of rows) {
    const values = [row.type, row.severity, row.key, row.detail].map((v) =>
      JSON.stringify(String(v ?? ''))
    );
    lines.push(values.join(','));
  }

  return `${lines.join('\n')}\n`;
}

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? '';
  return code === 'P2021' || message.includes('does not exist');
}

async function fetchJournalLines(params: {
  take?: number;
  fromKey?: string;
  toKey?: string;
}) {
  const journalModel = (
    prisma as unknown as {
      clothingAccountingJournalLine?: {
        findMany?: (args: unknown) => Promise<unknown>;
      };
    }
  ).clothingAccountingJournalLine;

  if (!journalModel?.findMany) {
    return { ok: false as const, reason: 'Prisma Client missing model' };
  }

  try {
    const rows = (await journalModel.findMany({
      where: {
        date: { gte: CUTOVER },
      },
      select: {
        id: true,
        date: true,
        ref: true,
        account: true,
        debit: true,
        credit: true,
        description: true,
        sourceType: true,
        sourceId: true,
        sourceLineKey: true,
        systemGenerated: true,
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      ...(typeof params.take === 'number' ? { take: params.take } : {}),
    })) as Array<{
      id: string;
      date: Date;
      ref: string;
      account: string;
      debit: number;
      credit: number;
      description: string | null;
      sourceType: string;
      sourceId: string | null;
      sourceLineKey: string;
      systemGenerated: boolean;
    }>;

    const filtered = rows.filter((row) => {
      const key = parseDateKey(row.date);
      return inDateRange(key, params.fromKey, params.toKey);
    });

    return { ok: true as const, rows: filtered };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { ok: false as const, reason: 'Missing table' };
    }
    throw error;
  }
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

  const issues: IssueRow[] = [];

  // ---------------------------------------------------------------------------
  // Journal lines
  // ---------------------------------------------------------------------------
  const journal = await fetchJournalLines({
    take: args.take,
    fromKey,
    toKey,
  });

  if (!journal.ok) {
    issues.push({
      type: 'journal_entry_unbalanced_by_ref_date',
      severity: 'warn',
      key: 'journal',
      detail: `Skipped journal line checks (${journal.reason}).`,
    });
  } else {
    const byRefDate = new Map<
      string,
      { net: number; count: number; exampleIds: string[] }
    >();

    const bySource = new Map<
      string,
      { net: number; count: number; exampleIds: string[] }
    >();

    const manualBySource = new Map<string, Set<string>>();
    const recurringBySource = new Map<string, Set<string>>();

    for (const line of journal.rows) {
      const debit = Number(line.debit ?? 0);
      const credit = Number(line.credit ?? 0);

      const invalidAmount =
        !Number.isFinite(debit) ||
        !Number.isFinite(credit) ||
        debit < 0 ||
        credit < 0 ||
        (debit > 0 && credit > 0);

      if (invalidAmount) {
        issues.push({
          type: 'journal_line_invalid_amount',
          severity: 'error',
          key: `journalLine:${line.id}`,
          detail: `ref=${line.ref} account=${line.account} dr=${debit} cr=${credit} source=${line.sourceType}:${line.sourceId ?? ''}:${line.sourceLineKey}`,
        });
      }

      const dayKey = parseDateKey(line.date);
      const refKey = `${dayKey}|${(line.ref ?? '').trim()}`;
      const refGroup = byRefDate.get(refKey) ?? {
        net: 0,
        count: 0,
        exampleIds: [],
      };
      refGroup.net += debit - credit;
      refGroup.count += 1;
      if (refGroup.exampleIds.length < 3) {
        refGroup.exampleIds.push(line.id);
      }
      byRefDate.set(refKey, refGroup);

      const sourceKey = `${line.sourceType}:${line.sourceId ?? ''}`;
      const sourceGroup = bySource.get(sourceKey) ?? {
        net: 0,
        count: 0,
        exampleIds: [],
      };
      sourceGroup.net += debit - credit;
      sourceGroup.count += 1;
      if (sourceGroup.exampleIds.length < 3) {
        sourceGroup.exampleIds.push(line.id);
      }
      bySource.set(sourceKey, sourceGroup);

      if (line.sourceType === 'MANUAL' && line.systemGenerated === false) {
        if (!line.sourceId) {
          continue;
        }
        const set = manualBySource.get(line.sourceId) ?? new Set<string>();
        set.add(line.sourceLineKey);
        manualBySource.set(line.sourceId, set);
      }

      if (line.sourceType === 'RECURRING_PAYMENT') {
        if (!line.sourceId) {
          continue;
        }
        const set = recurringBySource.get(line.sourceId) ?? new Set<string>();
        set.add(line.sourceLineKey);
        recurringBySource.set(line.sourceId, set);
      }
    }

    const unbalancedRefDate = Array.from(byRefDate.entries())
      .map(([key, value]) => ({ key, ...value, net: round2(value.net) }))
      .filter((row) => Math.abs(row.net) > EPS)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    for (const row of unbalancedRefDate.slice(0, limit)) {
      issues.push({
        type: 'journal_entry_unbalanced_by_ref_date',
        severity: 'error',
        key: row.key,
        detail: `net=${row.net} count=${row.count} exampleLineIds=${row.exampleIds.join('|')}`,
      });
    }

    const unbalancedSource = Array.from(bySource.entries())
      .map(([key, value]) => ({ key, ...value, net: round2(value.net) }))
      .filter((row) => Math.abs(row.net) > EPS)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    for (const row of unbalancedSource.slice(0, limit)) {
      issues.push({
        type: 'journal_entry_unbalanced_by_source',
        severity: 'warn',
        key: row.key,
        detail: `net=${row.net} count=${row.count} exampleLineIds=${row.exampleIds.join('|')}`,
      });
    }

    for (const [sourceId, keys] of Array.from(manualBySource.entries())) {
      const hasDebit = keys.has('debit');
      const hasCredit = keys.has('credit');
      if (!hasDebit || !hasCredit) {
        issues.push({
          type: 'manual_journal_missing_pair',
          severity: 'error',
          key: `MANUAL:${sourceId}`,
          detail: `missing=${[!hasDebit ? 'debit' : null, !hasCredit ? 'credit' : null].filter(Boolean).join(',')}`,
        });
      }
    }

    for (const [sourceId, keys] of Array.from(recurringBySource.entries())) {
      const hasDebit = keys.has('debit');
      const hasCredit = keys.has('credit');
      if (!hasDebit || !hasCredit) {
        issues.push({
          type: 'recurring_payment_missing_pair',
          severity: 'error',
          key: `RECURRING_PAYMENT:${sourceId}`,
          detail: `missing=${[!hasDebit ? 'debit' : null, !hasCredit ? 'credit' : null].filter(Boolean).join(',')}`,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Opening balances
  // ---------------------------------------------------------------------------
  const openingRows = await prisma.clothingAccountingOpeningBalance.findMany({
    where: {
      date: {
        gte: CUTOVER,
      },
    },
    select: {
      id: true,
      date: true,
      ref: true,
      account: true,
      debit: true,
      credit: true,
      description: true,
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });

  const openingByRefDate = new Map<string, { net: number; count: number }>();

  for (const row of openingRows) {
    const dayKey = parseDateKey(row.date);
    if (!inDateRange(dayKey, fromKey, toKey)) {
      continue;
    }

    const debit = Number(row.debit ?? 0);
    const credit = Number(row.credit ?? 0);

    const invalidAmount =
      !Number.isFinite(debit) ||
      !Number.isFinite(credit) ||
      debit < 0 ||
      credit < 0 ||
      (debit > 0 && credit > 0);

    if (invalidAmount) {
      issues.push({
        type: 'opening_balance_invalid_amount',
        severity: 'error',
        key: `openingBalance:${row.id}`,
        detail: `ref=${row.ref} account=${row.account} dr=${debit} cr=${credit}`,
      });
    }

    const key = `${dayKey}|${(row.ref ?? '').trim()}`;
    const group = openingByRefDate.get(key) ?? { net: 0, count: 0 };
    group.net += debit - credit;
    group.count += 1;
    openingByRefDate.set(key, group);
  }

  const openingUnbalanced = Array.from(openingByRefDate.entries())
    .map(([key, value]) => ({
      key,
      net: round2(value.net),
      count: value.count,
    }))
    .filter((row) => Math.abs(row.net) > EPS)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  for (const row of openingUnbalanced.slice(0, limit)) {
    issues.push({
      type: 'opening_balance_unbalanced_by_ref_date',
      severity: 'warn',
      key: row.key,
      detail: `net=${row.net} count=${row.count}`,
    });
  }

  // ---------------------------------------------------------------------------
  // Expenses
  // ---------------------------------------------------------------------------
  const expenseRows = await prisma.expense.findMany({
    where: {
      createdAt: { gte: CUTOVER },
    },
    select: {
      id: true,
      date: true,
      amount: true,
      status: true,
      category: true,
      description: true,
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  const allowedStatuses = new Set(['pending', 'approved', 'rejected', 'paid']);

  for (const exp of expenseRows) {
    const status = String(exp.status ?? '').trim();
    if (status && !allowedStatuses.has(status)) {
      issues.push({
        type: 'expense_status_unexpected',
        severity: 'warn',
        key: `expense:${exp.id}`,
        detail: `status=${status} category=${exp.category} amount=${exp.amount}`,
      });
    }

    const amount = Number(exp.amount ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      issues.push({
        type: 'expense_invalid_amount',
        severity: 'error',
        key: `expense:${exp.id}`,
        detail: `amount=${amount} status=${status} category=${exp.category}`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------
  console.log(usage());
  console.log(`Issues found: ${issues.length}`);

  const toPrint = issues.slice(0, limit);
  for (const issue of toPrint) {
    console.log(
      `- ${issue.severity.toUpperCase()} ${issue.type} | ${issue.key} | ${issue.detail}`
    );
  }

  if (issues.length > limit) {
    console.log(`... (${issues.length - limit} more not shown)`);
  }

  if (args.csv) {
    const csvText = toCsv(issues);
    const resolved = path.resolve(args.csv);
    fs.writeFileSync(resolved, csvText, 'utf8');
    console.log(`\nWrote CSV: ${resolved}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
