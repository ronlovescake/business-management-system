import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDate } from '@/lib/accounting/date-utils';
import {
  ACCOUNTS_RECEIVABLE_STATUSES,
  PAID_STATUSES,
} from '@/lib/accounting/constants';
import {
  fetchApprovedExpenses,
  fetchRecognizedTransactions,
  fetchManualJournalLines,
  fetchTransactionRefunds,
  getPaidAtDate,
  isWithinDateRange,
} from '@/lib/accounting/data-fetchers';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import {
  computeCogsTotal,
  computeInventorySeedAndShrinkageTotals,
} from '@/lib/accounting/inventory-cogs';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CUTOVER = new Date(Date.UTC(2026, 0, 1));

function clampAsOf(raw: Date | null): Date {
  if (!raw || Number.isNaN(raw.getTime())) {
    return CUTOVER;
  }
  return raw < CUTOVER ? CUTOVER : raw;
}

type AccountType = 'Asset' | 'Liability' | 'Equity';

type BalanceRow = {
  account: string;
  amount: number;
};
const ACCOUNT_MAP: Record<AccountType, Set<string>> = {
  Asset: new Set([
    'cash',
    'cash on hand',
    'inventory',
    'stock on hand',
    'inventory in transit',
    'accounts receivable',
    'a/r',
    'prepaid',
    'prepaid expense',
    'deposit',
    'deposits',
  ]),
  Liability: new Set([
    'accounts payable',
    'a/p',
    'taxes payable',
    'withholding payable',
    'accrued freight',
    'accrued expense',
    'accrued expenses',
    'loan',
    'liability',
  ]),
  Equity: new Set([
    'opening equity',
    'owner’s equity',
    "owner's equity",
    'owner draw',
    'owner’s draw',
    "owner's draw",
    'owners draw',
    'retained earnings',
    'capital',
    'equity',
  ]),
};

function detectAccountType(account: string): AccountType | null {
  const rawName = account.trim();
  const name = rawName.toLowerCase();
  if (!name) {
    return null;
  }

  for (const type of Object.keys(ACCOUNT_MAP) as AccountType[]) {
    if (ACCOUNT_MAP[type].has(name)) {
      return type;
    }
  }

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

  const normalizedName = normalize(rawName);
  if (!normalizedName) {
    return null;
  }

  for (const type of Object.keys(ACCOUNT_MAP) as AccountType[]) {
    for (const keyword of Array.from(ACCOUNT_MAP[type])) {
      const normalizedKeyword = normalize(keyword);
      if (!normalizedKeyword) {
        continue;
      }

      if (normalizedName === normalizedKeyword) {
        return type;
      }

      if (normalizedName.includes(normalizedKeyword)) {
        return type;
      }
    }
  }

  return null;
}

function aggregateBalancesFromRows(
  rows: Array<BalanceRow & { type: AccountType }>
) {
  return rows.reduce<Record<AccountType, number>>(
    (acc, row) => {
      acc[row.type] += row.amount;
      return acc;
    },
    { Asset: 0, Liability: 0, Equity: 0 }
  );
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const asOfParam = req.nextUrl.searchParams.get('asOf');
  const asOf = clampAsOf(parseDate(asOfParam));

  const transactions = await fetchRecognizedTransactions();
  const expenses = await fetchApprovedExpenses();
  const refunds = await fetchTransactionRefunds();
  const manualLines = await fetchManualJournalLines({
    from: CUTOVER,
    to: asOf,
  });

  const openingBalanceRows =
    await prisma.clothingAccountingOpeningBalance.findMany({
      where: {
        date: {
          gte: CUTOVER,
          lte: asOf,
        },
      },
      orderBy: { date: 'asc' },
    });

  const openingEntries = openingBalanceRows.map((entry) => ({
    account: entry.account,
    amount: entry.debit - entry.credit,
  }));

  const reclassRows = await prisma.clothingInventoryReclassEntry.findMany({
    where: {
      deletedAt: null,
      postingDate: {
        gte: CUTOVER,
        lte: asOf,
      },
    },
    orderBy: { postingDate: 'asc' },
  });

  const reclassEntries: BalanceRow[] = reclassRows
    .map((row) => {
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const value = Math.max(amount, 0);
      return [
        { account: row.toAccount, amount: value },
        { account: row.fromAccount, amount: -value },
      ];
    })
    .flat()
    .filter(Boolean) as BalanceRow[];

  const transitBuildRows =
    await prisma.clothingInventoryTransitBuildEntry.findMany({
      where: {
        deletedAt: null,
        postingDate: {
          gte: CUTOVER,
          lte: asOf,
        },
      },
      orderBy: { postingDate: 'asc' },
    });

  const transitBuildEntries: BalanceRow[] = transitBuildRows
    .map((row) => {
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const value = Math.max(amount, 0);
      return [
        { account: row.debitAccount, amount: value },
        { account: row.creditAccount, amount: -value },
      ];
    })
    .flat()
    .filter(Boolean) as BalanceRow[];

  const isReceivableStatus = (status: string | null | undefined): boolean => {
    const normalized = (status ?? '').trim();
    return (ACCOUNTS_RECEIVABLE_STATUSES as readonly string[]).includes(
      normalized
    );
  };

  const isPaidStatus = (status: string | null | undefined): boolean => {
    const normalized = (status ?? '').trim();
    return (PAID_STATUSES as readonly string[]).includes(normalized);
  };

  const getRecognizedAt = (
    tx: { orderStatus?: string | null; orderDate?: string | null } & Parameters<
      typeof getPaidAtDate
    >[0]
  ) => {
    if (isPaidStatus(tx.orderStatus)) {
      return getPaidAtDate(tx);
    }
    return parseDate(tx.orderDate) ?? null;
  };

  const txEntries = transactions
    .map((tx) => {
      const { paymentReceived, balanceDue } =
        normalizeTransactionAmountsForAccounting(tx);

      const recognizedAt = getRecognizedAt(tx);
      if (!isWithinDateRange(recognizedAt, CUTOVER, asOf)) {
        return null;
      }

      const cash = Math.max(Number(paymentReceived) || 0, 0);
      const ar = isReceivableStatus(tx.orderStatus)
        ? Math.max(Number(balanceDue) || 0, 0)
        : 0;
      const saleAmount = cash + ar;

      if (!Number.isFinite(saleAmount) || saleAmount <= 0) {
        return null;
      }

      return [
        ...(cash > 0 ? [{ account: 'Cash', amount: cash }] : []),
        ...(ar > 0 ? [{ account: 'Accounts Receivable', amount: ar }] : []),
        // Revenue flows into Equity on the balance sheet.
        { account: 'Retained Earnings', amount: -saleAmount },
      ];
    })
    .flat()
    .filter(Boolean) as BalanceRow[];

  const expenseEntries = expenses
    .map((exp) => {
      const amount = Number(exp.amount ?? 0);
      if (!Number.isFinite(amount)) {
        return null;
      }

      const expDate = parseDate(exp.date);
      if (!isWithinDateRange(expDate, CUTOVER, asOf)) {
        return null;
      }

      const amt = Math.max(amount, 0);
      return [
        // Expenses reduce Equity on the balance sheet.
        { account: 'Retained Earnings', amount: amt },
        { account: 'Cash', amount: -amt },
      ];
    })
    .flat()
    .filter(Boolean) as BalanceRow[];

  // COGS reduces equity and reduces the inventory asset.
  // This makes old stock depletion visible on the balance sheet even in cash-basis mode.
  const cogsTotal = await computeCogsTotal({ from: CUTOVER, to: asOf });
  const cogsEntries: BalanceRow[] =
    Number.isFinite(cogsTotal) && cogsTotal > 0
      ? [
          { account: 'Retained Earnings', amount: cogsTotal },
          { account: 'Stock on Hand', amount: -cogsTotal },
        ]
      : [];

  // Inventory seed/shrinkage proxy valuation.
  // Seed: scrap -> asset bucket (treat as opening equity contribution).
  // Shrinkage: asset bucket -> scrap (treat as reduction to retained earnings).
  const { seedTotal, shrinkageTotal } =
    await computeInventorySeedAndShrinkageTotals({
      from: CUTOVER,
      to: asOf,
    });
  const inventorySeedEntries: BalanceRow[] =
    Number.isFinite(seedTotal) && seedTotal > 0
      ? [
          { account: 'Stock on Hand', amount: seedTotal },
          { account: 'Opening Equity', amount: -seedTotal },
        ]
      : [];
  const inventoryShrinkageEntries: BalanceRow[] =
    Number.isFinite(shrinkageTotal) && shrinkageTotal > 0
      ? [
          { account: 'Retained Earnings', amount: shrinkageTotal },
          { account: 'Stock on Hand', amount: -shrinkageTotal },
        ]
      : [];

  const refundEntries = refunds
    .map((refund) => {
      const refundAt = parseDate(refund.refundDate);
      if (!isWithinDateRange(refundAt, CUTOVER, asOf)) {
        return null;
      }

      const amt = Number(refund.amount ?? 0);
      if (!Number.isFinite(amt) || amt <= 0) {
        return null;
      }

      const value = Math.max(amt, 0);

      // Refunds reduce Equity and reduce the Cash asset.
      return [
        { account: 'Retained Earnings', amount: value },
        { account: 'Cash', amount: -value },
      ];
    })
    .flat()
    .filter(Boolean) as BalanceRow[];

  // Manual journal entries affect the balance sheet directly (e.g. Owner Draw).
  // Each line is already one side of a balanced entry, so include as-is.
  const manualEntries: BalanceRow[] = manualLines
    .map((line) => ({
      account: line.account,
      amount: Number(line.debit ?? 0) - Number(line.credit ?? 0),
    }))
    .filter((row) => Number.isFinite(row.amount) && row.amount !== 0);

  const combined = [
    ...openingEntries,
    ...reclassEntries,
    ...transitBuildEntries,
    ...txEntries,
    ...expenseEntries,
    ...manualEntries,
    ...cogsEntries,
    ...inventorySeedEntries,
    ...inventoryShrinkageEntries,
    ...refundEntries,
  ];

  const byAccount = combined.reduce<
    Record<string, { amount: number; type: AccountType }>
  >((acc, row) => {
    const key = row.account.trim();
    const type = detectAccountType(key);
    if (!key || !type) {
      return acc;
    }
    const existing = acc[key];
    acc[key] = {
      type,
      amount: (existing?.amount ?? 0) + row.amount,
    };
    return acc;
  }, {});

  const rows = Object.entries(byAccount).map(([account, data]) => ({
    id: account,
    account,
    type: data.type,
    amount: data.amount,
  }));

  const totals = aggregateBalancesFromRows(rows);

  return ApiResponse.success({
    rows,
    stats: {
      assets: totals.Asset,
      liabilities: totals.Liability,
      equity: totals.Equity,
      // Accounting equation (with signed balances): Assets + Liabilities + Equity = 0.
      // This endpoint uses signed balances where debits are positive and credits are negative.
      balance: totals.Asset + totals.Liability + totals.Equity,
      asOf: asOf.toISOString(),
    },
  });
});
