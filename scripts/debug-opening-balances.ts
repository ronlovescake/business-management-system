import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { parseDate } from '@/lib/accounting/date-utils';

function parseArgs(argv: string[]): { date: Date } {
  const idx = argv.findIndex((t) => t === '--date');
  const raw = idx >= 0 ? argv[idx + 1] : undefined;
  const parsed = parseDate(raw ?? '2026-01-01');
  if (!parsed || Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --date value: ${String(raw)}`);
  }
  return { date: parsed };
}

function money(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  return `${sign}₱${abs.toFixed(2)}`;
}

async function main() {
  const { date } = parseArgs(process.argv.slice(2));
  const from = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);

  const rows = await prisma.clothingAccountingOpeningBalance.findMany({
    where: {
      date: { gte: from, lt: to },
    },
    select: {
      id: true,
      date: true,
      account: true,
      debit: true,
      credit: true,
      ref: true,
      description: true,
      createdAt: true,
    },
    orderBy: [{ account: 'asc' }, { createdAt: 'asc' }],
  });

  const byAccount = new Map<
    string,
    { debit: number; credit: number; net: number }
  >();
  for (const r of rows) {
    const debit = Number(r.debit ?? 0);
    const credit = Number(r.credit ?? 0);
    const net = debit - credit;
    const key = r.account;
    const existing = byAccount.get(key) ?? { debit: 0, credit: 0, net: 0 };
    existing.debit += debit;
    existing.credit += credit;
    existing.net += net;
    byAccount.set(key, existing);
  }

  // eslint-disable-next-line no-console
  console.log(
    `Opening balances on ${from.toISOString().slice(0, 10)} (rows=${rows.length})`
  );
  // eslint-disable-next-line no-console
  console.log('====================================================');

  const entries = Array.from(byAccount.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [account, totals] of entries) {
    // eslint-disable-next-line no-console
    console.log(
      `- ${account}: debit=${money(totals.debit)} credit=${money(totals.credit)} net(debit-credit)=${money(totals.net)}`
    );
  }

  const totalDebit = rows.reduce((sum, r) => sum + Number(r.debit ?? 0), 0);
  const totalCredit = rows.reduce((sum, r) => sum + Number(r.credit ?? 0), 0);

  // eslint-disable-next-line no-console
  console.log('\nTotals:');
  // eslint-disable-next-line no-console
  console.log({
    totalDebit: money(totalDebit),
    totalCredit: money(totalCredit),
    diff: money(totalDebit - totalCredit),
  });

  // eslint-disable-next-line no-console
  console.log('\nRaw rows (id, account, dr, cr, notes):');
  for (const r of rows) {
    // eslint-disable-next-line no-console
    console.log(
      `- ${r.id} | ${r.account} | dr=${money(Number(r.debit ?? 0))} cr=${money(Number(r.credit ?? 0))} | ref=${String(r.ref ?? '')} | ${String(r.description ?? '').slice(0, 120)}`
    );
  }
}

main()
  .catch((error) => {
    logger.error('debug-opening-balances failed', { error });
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
