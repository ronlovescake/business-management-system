import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  ACCOUNTS_RECEIVABLE_STATUSES,
  PAID_STATUSES,
} from '@/lib/accounting/constants';
import { parseDate } from '@/lib/accounting/date-utils';
import {
  fetchApprovedExpenses,
  fetchManualJournalLines,
  fetchRecognizedTransactions,
  fetchTransactionRefunds,
  getPaidAtDate,
  isWithinDateRange,
} from '@/lib/accounting/data-fetchers';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import {
  computeCogsTotal,
  computeInventorySeedAndShrinkageTotals,
} from '@/lib/accounting/inventory-cogs';
import { detectAccountType } from '@/lib/accounting/account-classification';

const CUTOVER = new Date(Date.UTC(2026, 0, 1));

function clampAsOf(raw: Date | null): Date {
  if (!raw || Number.isNaN(raw.getTime())) {
    return CUTOVER;
  }
  return raw < CUTOVER ? CUTOVER : raw;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (!token.startsWith('--')) {
      continue;
    }
    if (!next || next.startsWith('--')) {
      args[token.slice(2)] = 'true';
      continue;
    }
    args[token.slice(2)] = next;
    i += 1;
  }
  return args;
}

function asMoney(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  return `${sign}₱${abs.toFixed(2)}`;
}

function isReceivableStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').trim();
  return (ACCOUNTS_RECEIVABLE_STATUSES as readonly string[]).includes(
    normalized
  );
}

function isPaidStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').trim();
  return (PAID_STATUSES as readonly string[]).includes(normalized);
}

function getRecognizedAt(
  tx: {
    orderStatus?: string | null;
    orderDate?: string | null;
  } & Parameters<typeof getPaidAtDate>[0]
): Date | null {
  if (isPaidStatus(tx.orderStatus)) {
    return getPaidAtDate(tx);
  }
  return parseDate(tx.orderDate) ?? null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const asOfInput = String(args.asOf ?? args.asof ?? '2026-01-31');
  const asOf = clampAsOf(parseDate(asOfInput));

  const [transactions, expenses, refunds, manualLines] = await Promise.all([
    fetchRecognizedTransactions(),
    fetchApprovedExpenses(),
    fetchTransactionRefunds(),
    fetchManualJournalLines({ from: CUTOVER, to: asOf }),
  ]);

  const txContrib: Array<{
    transactionId: number;
    recognizedAt: string;
    status: string;
    cash: number;
    ar: number;
    saleAmount: number;
    retainedEarnings: number;
  }> = [];

  let retainedFromSales = 0;

  for (const tx of transactions) {
    const { paymentReceived, balanceDue } =
      normalizeTransactionAmountsForAccounting(tx);
    const recognizedAt = getRecognizedAt(tx);
    if (!isWithinDateRange(recognizedAt, CUTOVER, asOf)) {
      continue;
    }

    const cash = Math.max(Number(paymentReceived) || 0, 0);
    const ar = isReceivableStatus(tx.orderStatus)
      ? Math.max(Number(balanceDue) || 0, 0)
      : 0;

    const saleAmount = cash + ar;
    if (!Number.isFinite(saleAmount) || saleAmount <= 0) {
      continue;
    }

    const retainedEarnings = -saleAmount;
    retainedFromSales += retainedEarnings;

    txContrib.push({
      transactionId: tx.id,
      recognizedAt: (recognizedAt ?? new Date(0)).toISOString().slice(0, 10),
      status: String(tx.orderStatus ?? ''),
      cash,
      ar,
      saleAmount,
      retainedEarnings,
    });
  }

  let retainedFromExpenses = 0;
  const expenseContrib: Array<{
    id: string;
    date: string;
    amount: number;
    retainedEarnings: number;
  }> = [];
  for (const exp of expenses) {
    const amount = Number((exp as { amount?: unknown }).amount ?? 0);
    if (!Number.isFinite(amount)) {
      continue;
    }
    const expDate = parseDate((exp as { date?: string | null }).date ?? null);
    if (!isWithinDateRange(expDate, CUTOVER, asOf)) {
      continue;
    }
    const amt = Math.max(amount, 0);
    if (amt === 0) {
      continue;
    }
    retainedFromExpenses += amt;
    expenseContrib.push({
      id: String((exp as { id?: unknown }).id ?? ''),
      date: String((exp as { date?: unknown }).date ?? ''),
      amount: amt,
      retainedEarnings: amt,
    });
  }

  let retainedFromRefunds = 0;
  const refundContrib: Array<{
    id: number;
    date: string;
    amount: number;
    retainedEarnings: number;
    transactionId: number;
  }> = [];
  for (const refund of refunds) {
    const refundAt = parseDate(refund.refundDate);
    if (!isWithinDateRange(refundAt, CUTOVER, asOf)) {
      continue;
    }
    const amt = Number(refund.amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      continue;
    }
    const value = Math.max(amt, 0);
    retainedFromRefunds += value;
    refundContrib.push({
      id: refund.id,
      date: refund.refundDate,
      amount: value,
      retainedEarnings: value,
      transactionId: refund.transactionId,
    });
  }

  // Manual lines: if P&L, the balance sheet route rolls unknown/non-balance accounts into retained earnings.
  let retainedFromManual = 0;
  const manualContrib: Array<{
    id: string;
    date: string;
    account: string;
    amount: number;
    rolledToRetained: boolean;
  }> = [];
  for (const line of manualLines) {
    const account = line.account.trim();
    const amount = Number(line.debit ?? 0) - Number(line.credit ?? 0);
    if (!account || !Number.isFinite(amount) || amount === 0) {
      continue;
    }

    const type = detectAccountType(account);
    const rolledToRetained = !type;
    if (rolledToRetained) {
      retainedFromManual += amount;
    } else if (account === 'Retained Earnings') {
      retainedFromManual += amount;
    }

    manualContrib.push({
      id: line.id,
      date: line.date.toISOString().slice(0, 10),
      account,
      amount,
      rolledToRetained,
    });
  }

  let retainedFromCogs = 0;
  try {
    const cogsTotal = await computeCogsTotal({ from: CUTOVER, to: asOf });
    retainedFromCogs =
      Number.isFinite(cogsTotal) && cogsTotal > 0 ? cogsTotal : 0;
  } catch {
    retainedFromCogs = 0;
  }

  let retainedFromShrinkage = 0;
  try {
    const { shrinkageTotal } = await computeInventorySeedAndShrinkageTotals({
      from: CUTOVER,
      to: asOf,
    });
    retainedFromShrinkage =
      Number.isFinite(shrinkageTotal) && shrinkageTotal > 0
        ? shrinkageTotal
        : 0;
  } catch {
    retainedFromShrinkage = 0;
  }

  // Opening balances don't touch retained earnings directly.
  let openingEquity: { _sum: { debit: number | null; credit: number | null } } =
    {
      _sum: { debit: null, credit: null },
    };
  try {
    openingEquity = await prisma.clothingAccountingOpeningBalance.aggregate({
      where: {
        date: { gte: CUTOVER, lte: asOf },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });
  } catch {
    openingEquity = { _sum: { debit: null, credit: null } };
  }

  const retainedNet =
    retainedFromSales +
    retainedFromExpenses +
    retainedFromRefunds +
    retainedFromManual +
    retainedFromCogs +
    retainedFromShrinkage;

  const header = `Retained Earnings debug (asOf=${asOf.toISOString().slice(0, 10)}, from=${CUTOVER.toISOString().slice(0, 10)})`;
  // eslint-disable-next-line no-console
  console.log(header);
  // eslint-disable-next-line no-console
  console.log('='.repeat(header.length));
  // eslint-disable-next-line no-console
  console.log(
    `Sales contribution:        ${asMoney(retainedFromSales)} (credits from revenue)`
  );
  // eslint-disable-next-line no-console
  console.log(`Expenses contribution:     ${asMoney(retainedFromExpenses)}`);
  // eslint-disable-next-line no-console
  console.log(`Refunds contribution:      ${asMoney(retainedFromRefunds)}`);
  // eslint-disable-next-line no-console
  console.log(`Manual lines contribution: ${asMoney(retainedFromManual)}`);
  // eslint-disable-next-line no-console
  console.log(`COGS contribution:         ${asMoney(retainedFromCogs)}`);
  // eslint-disable-next-line no-console
  console.log(`Shrinkage contribution:    ${asMoney(retainedFromShrinkage)}`);
  // eslint-disable-next-line no-console
  console.log(`Net retained earnings:     ${asMoney(retainedNet)}`);
  // eslint-disable-next-line no-console
  console.log('');

  const topTx = [...txContrib]
    .sort((a, b) => Math.abs(b.retainedEarnings) - Math.abs(a.retainedEarnings))
    .slice(0, 20);

  if (topTx.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      'Top sales rows (transactionId, recognizedAt, status, saleAmount, retainedEarnings):'
    );
    for (const row of topTx) {
      // eslint-disable-next-line no-console
      console.log(
        `- tx ${row.transactionId} | ${row.recognizedAt} | ${row.status} | sale=${asMoney(row.saleAmount)} | RE=${asMoney(row.retainedEarnings)}`
      );
    }
    // eslint-disable-next-line no-console
    console.log('');
  }

  const topExpenses = [...expenseContrib]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

  if (topExpenses.length > 0) {
    // eslint-disable-next-line no-console
    console.log('Top expense rows (id, date, amount, retainedEarnings):');
    for (const row of topExpenses) {
      // eslint-disable-next-line no-console
      console.log(
        `- exp ${row.id} | ${row.date} | amt=${asMoney(row.amount)} | RE=${asMoney(row.retainedEarnings)}`
      );
    }
    // eslint-disable-next-line no-console
    console.log('');
  }

  const topRefunds = [...refundContrib]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

  if (topRefunds.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      'Refund rows (id, date, transactionId, amount, retainedEarnings):'
    );
    for (const row of topRefunds) {
      // eslint-disable-next-line no-console
      console.log(
        `- refund ${row.id} | ${row.date} | tx ${row.transactionId} | amt=${asMoney(row.amount)} | RE=${asMoney(row.retainedEarnings)}`
      );
    }
    // eslint-disable-next-line no-console
    console.log('');
  }

  const rolledManual = manualContrib.filter((m) => m.rolledToRetained);
  if (rolledManual.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      'Manual journal lines rolled into retained earnings (id, date, account, amount):'
    );
    for (const row of rolledManual.slice(0, 30)) {
      // eslint-disable-next-line no-console
      console.log(
        `- line ${row.id} | ${row.date} | ${row.account} | amt=${asMoney(row.amount)}`
      );
    }
    // eslint-disable-next-line no-console
    console.log('');
  }

  // eslint-disable-next-line no-console
  console.log(
    'Sanity (opening balance debit-credit sum; should not affect RE directly):',
    {
      openingDebitSum: Number(openingEquity._sum.debit ?? 0),
      openingCreditSum: Number(openingEquity._sum.credit ?? 0),
    }
  );
}

main()
  .catch((error) => {
    logger.error('debug-retained-earnings failed', { error });
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
