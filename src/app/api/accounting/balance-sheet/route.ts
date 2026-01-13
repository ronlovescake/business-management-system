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
  getPaidAtDate,
  isWithinDateRange,
} from '@/lib/accounting/data-fetchers';
import { normalizeTransactionAmounts } from '@/lib/accounting/transaction-normalization';
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
    'retained earnings',
    'capital',
    'equity',
  ]),
};

function detectAccountType(account: string): AccountType | null {
  const name = account.trim().toLowerCase();
  if (!name) {
    return null;
  }

  for (const type of Object.keys(ACCOUNT_MAP) as AccountType[]) {
    if (ACCOUNT_MAP[type].has(name)) {
      return type;
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
      const { paymentReceived, balanceDue } = normalizeTransactionAmounts(tx);

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

  const combined = [...openingEntries, ...txEntries, ...expenseEntries];

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
      // Accounting equation: Assets = Liabilities + Equity.
      // Equity is stored as a signed balance (credits negative), so use assets + equity - liabilities.
      balance: totals.Asset + totals.Equity - totals.Liability,
      asOf: asOf.toISOString(),
    },
  });
});
