import 'dotenv/config';

import fs from 'fs';
import path from 'path';

import { PrismaClient } from '@prisma/client';
import {
  type AccountType,
  detectAccountType,
} from '@/lib/accounting/account-classification';

type ModuleTarget = 'clothing' | 'gm' | 'both';

type InputJson = Record<string, unknown>;

type Args = {
  date: string;
  inputPath: string;
  ref: string;
  description?: string;
  module: ModuleTarget;
  apply: boolean;
  force: boolean;
};

const EPS = 0.005;

// Use a standalone Prisma client for scripts.
// This avoids Next.js dev/HMR behaviors and app-level middleware/logging
// that can contribute to connection exhaustion or unstable runs.
const prisma = new PrismaClient();

function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

function err(line: string): void {
  process.stderr.write(`${line}\n`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    date: '2026-02-01',
    inputPath: '',
    ref: 'OPENING-RESET',
    description: undefined,
    module: 'clothing',
    apply: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    const next = argv[i + 1];

    if (t === '--date' && next) {
      args.date = next.trim();
      i += 1;
      continue;
    }

    if ((t === '--input' || t === '--inputPath') && next) {
      args.inputPath = next.trim();
      i += 1;
      continue;
    }

    if (t === '--ref' && next) {
      args.ref = next.trim();
      i += 1;
      continue;
    }

    if (t === '--description' && next) {
      args.description = next.trim();
      i += 1;
      continue;
    }

    if (t === '--module' && next) {
      const v = next.trim().toLowerCase();
      if (v === 'clothing' || v === 'gm' || v === 'both') {
        args.module = v;
      }
      i += 1;
      continue;
    }

    if (t === '--apply') {
      args.apply = true;
      continue;
    }

    if (t === '--force') {
      args.force = true;
      continue;
    }
  }

  return args;
}

function parseIsoDateOnly(raw: string): Date {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    throw new Error(`Invalid --date. Expected YYYY-MM-DD, got: ${raw}`);
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`Invalid --date: ${raw}`);
  }

  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    throw new Error(`Invalid --date (rollover): ${raw}`);
  }

  return dt;
}

function formatIsoDateOnlyUTC(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

function parseIsoDateOnlyOrNull(raw: string | undefined): Date | null {
  if (!raw) {
    return null;
  }
  try {
    return parseIsoDateOnly(raw);
  } catch {
    return null;
  }
}

function validateCutoverEnvMatchesArgs(params: {
  module: ModuleTarget;
  date: Date;
  force: boolean;
}): void {
  if (params.force) {
    return;
  }

  const desired = formatIsoDateOnlyUTC(params.date);

  const shared = process.env.ACCOUNTING_CUTOVER_DATE;
  if (shared) {
    out(
      'NOTE: ACCOUNTING_CUTOVER_DATE is set. Prefer module-specific cutover vars to avoid changing both Clothing and GM unintentionally.'
    );
  }

  if (params.module === 'clothing' || params.module === 'both') {
    const envDt = parseIsoDateOnlyOrNull(
      process.env.ACCOUNTING_CUTOVER_DATE_CLOTHING
    );
    if (envDt) {
      const envStr = formatIsoDateOnlyUTC(envDt);
      if (envStr !== desired) {
        throw new Error(
          `Cutover mismatch for clothing: ACCOUNTING_CUTOVER_DATE_CLOTHING=${envStr} but --date=${desired}. Fix the env var or pass --force.`
        );
      }
    }
  }

  if (params.module === 'gm' || params.module === 'both') {
    const envDt = parseIsoDateOnlyOrNull(
      process.env.ACCOUNTING_CUTOVER_DATE_GM
    );
    if (envDt) {
      const envStr = formatIsoDateOnlyUTC(envDt);
      if (envStr !== desired) {
        throw new Error(
          `Cutover mismatch for GM: ACCOUNTING_CUTOVER_DATE_GM=${envStr} but --date=${desired}. Fix the env var or pass --force.`
        );
      }
    }
  }
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

type Line = {
  account: string;
  debit: number;
  credit: number;
  balance: number; // debit-credit
  type: AccountType;
};

function buildLine(accountRaw: string, balanceRaw: number): Line | null {
  const account = accountRaw.trim();
  if (!account) {
    return null;
  }

  const balance = Number(balanceRaw);
  if (!Number.isFinite(balance) || Math.abs(balance) < EPS) {
    return null;
  }

  const type = detectAccountType(account);
  if (!type) {
    throw new Error(
      `Unknown account type for "${account}". Add a better name (e.g. "Cash", "Stock on Hand", "Inventory in Transit", "Loan Payable – ...") or extend detectAccountType().`
    );
  }

  // Convention: input is the "normal" signed balance.
  // - Assets: positive => debit
  // - Liabilities/Equity: positive => credit
  // If user supplies a negative balance, we flip the side.
  let debit = 0;
  let credit = 0;

  if (type === 'Asset') {
    if (balance >= 0) {
      debit = balance;
    } else {
      credit = Math.abs(balance);
    }
  } else {
    // Liability or Equity
    if (balance >= 0) {
      credit = balance;
    } else {
      debit = Math.abs(balance);
    }
  }

  return {
    account,
    debit,
    credit,
    balance: debit - credit,
    type,
  };
}

function formatMoney(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v)) {
    return 'NaN';
  }
  return `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sum(lines: Array<{ debit: number; credit: number }>): {
  debit: number;
  credit: number;
} {
  return lines.reduce(
    (acc, l) => {
      acc.debit += Number(l.debit ?? 0) || 0;
      acc.credit += Number(l.credit ?? 0) || 0;
      return acc;
    },
    { debit: 0, credit: 0 }
  );
}

async function ensureNoDuplicates(params: {
  date: Date;
  ref: string;
  module: ModuleTarget;
  force: boolean;
}): Promise<void> {
  if (params.force) {
    return;
  }

  const checks: Array<Promise<number>> = [];

  if (params.module === 'clothing' || params.module === 'both') {
    checks.push(
      prisma.clothingAccountingOpeningBalance.count({
        where: { date: params.date, ref: params.ref },
      })
    );
  }

  if (params.module === 'gm' || params.module === 'both') {
    checks.push(
      prisma.generalMerchandiseAccountingOpeningBalance.count({
        where: { date: params.date, ref: params.ref },
      })
    );
  }

  const counts = await Promise.all(checks);
  const total = counts.reduce((a, b) => a + b, 0);

  if (total > 0) {
    throw new Error(
      `Ref/date already has ${total} opening balance rows. Use a new --ref or pass --force.`
    );
  }
}

async function writeOpeningBalances(params: {
  date: Date;
  ref: string;
  description?: string;
  module: ModuleTarget;
  apply: boolean;
  lines: Array<{ account: string; debit: number; credit: number }>;
}): Promise<void> {
  if (!params.apply) {
    out('Dry run only. Re-run with --apply to write to the database.');
    return;
  }

  const data = params.lines.map((l) => ({
    date: params.date,
    ref: params.ref,
    account: l.account,
    debit: l.debit,
    credit: l.credit,
    description: params.description ?? null,
  }));

  if (params.module === 'clothing' || params.module === 'both') {
    await prisma.clothingAccountingOpeningBalance.createMany({ data });
    out(`Applied: inserted ${data.length} clothing opening balance rows.`);
  }

  if (params.module === 'gm' || params.module === 'both') {
    await prisma.generalMerchandiseAccountingOpeningBalance.createMany({
      data,
    });
    out(`Applied: inserted ${data.length} GM opening balance rows.`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.inputPath) {
    throw new Error('Missing --input path to JSON file.');
  }

  const date = parseIsoDateOnly(args.date);

  validateCutoverEnvMatchesArgs({
    module: args.module,
    date,
    force: args.force,
  });

  const absPath = path.isAbsolute(args.inputPath)
    ? args.inputPath
    : path.join(process.cwd(), args.inputPath);

  const raw = fs.readFileSync(absPath, 'utf8');
  const json = JSON.parse(raw) as InputJson;

  const requested: Array<{ account: string; balance: number }> = [];
  for (const [account, value] of Object.entries(json)) {
    if ((account ?? '').trim().toLowerCase() === 'opening equity') {
      // Always compute Opening Equity automatically.
      continue;
    }

    const n = toFiniteNumber(value);
    if (n === null) {
      continue;
    }

    if (Math.abs(n) < EPS) {
      // This is how you exclude 0-balance liabilities (and any other 0 lines).
      continue;
    }

    requested.push({ account, balance: n });
  }

  if (requested.length === 0) {
    throw new Error('Input JSON produced no non-zero balances.');
  }

  const built = requested
    .map((r) => buildLine(r.account, r.balance))
    .filter(Boolean) as Line[];

  if (built.length === 0) {
    throw new Error('No valid lines after normalization.');
  }

  // Compute balancing Opening Equity so that total debits == total credits.
  const running = sum(built);
  const net = running.debit - running.credit;

  // Our input convention is a "normal" signed balance.
  // - Assets:   positive => debit
  // - L/E:      positive => credit
  // Therefore, when debits exceed credits (net > 0), Opening Equity should be
  // a positive equity balance (a credit) to offset the excess debit.
  const openingEquityBalance = net;
  const openingEquityLine = buildLine('Opening Equity', openingEquityBalance);
  const finalLines = openingEquityLine
    ? [...built, openingEquityLine]
    : [...built];

  const totals = sum(finalLines);

  out('=== Opening Balance Reset (read-only unless --apply) ===');
  out(`Target module: ${args.module}`);
  out(`Date:          ${date.toISOString().slice(0, 10)} (UTC midnight)`);
  out(`Ref:           ${args.ref}`);
  out(`Description:   ${args.description ?? '(none)'}`);
  out('');

  out('Planned lines (non-zero):');
  for (const line of finalLines) {
    out(
      `- ${line.account} [${line.type}] debit=${formatMoney(line.debit)} credit=${formatMoney(line.credit)} (net=${formatMoney(line.balance)})`
    );
  }

  out('');
  out(
    `Totals: debit=${formatMoney(totals.debit)} credit=${formatMoney(totals.credit)} diff=${formatMoney(
      totals.debit - totals.credit
    )}`
  );

  if (Math.abs(totals.debit - totals.credit) > 0.01) {
    throw new Error('Opening balances do not balance (debit != credit).');
  }

  await ensureNoDuplicates({
    date,
    ref: args.ref,
    module: args.module,
    force: args.force,
  });

  await writeOpeningBalances({
    date,
    ref: args.ref,
    description: args.description,
    module: args.module,
    apply: args.apply,
    lines: finalLines.map((l) => ({
      account: l.account,
      debit: l.debit,
      credit: l.credit,
    })),
  });
}

main()
  .catch((e) => {
    err(`ERROR: ${(e as Error)?.message ?? String(e)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });
