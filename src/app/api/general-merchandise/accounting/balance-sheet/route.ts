import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { endOfDay, parseDate } from '@/lib/accounting/date-utils';
import {
  ACCOUNTS_RECEIVABLE_STATUSES,
  PAID_STATUSES,
} from '@/lib/accounting/constants';
import {
  fetchGeneralMerchandiseApprovedExpenses,
  fetchGeneralMerchandiseRecognizedTransactions,
  fetchGeneralMerchandiseManualJournalLines,
  fetchGeneralMerchandiseTransactionPayments,
  fetchGeneralMerchandiseTransactionRefunds,
  getPaidAtDate,
  getCancelledAtDate,
  isWithinDateRange,
} from '@/lib/accounting/general-merchandise/data-fetchers';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import { computeCogsTotal } from '@/lib/accounting/general-merchandise/inventory-cogs';
import { prisma } from '@/lib/db';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';
import {
  detectAccountType,
  type AccountType,
} from '@/lib/accounting/account-classification';
import {
  isCancelledOrderStatus,
  isDepositForfeitureOrderStatus,
} from '@/lib/transactions/order-status';

export const dynamic = 'force-dynamic';

const CUTOVER = getAccountingCutoverDate('generalMerchandise');

function clampAsOf(raw: Date | null): Date {
  if (!raw || Number.isNaN(raw.getTime())) {
    return CUTOVER;
  }
  return raw < CUTOVER ? CUTOVER : raw;
}

type BalanceRow = {
  account: string;
  amount: number;
};

type BalanceRowDetail = {
  label: string;
  amount: number;
};

type OpeningBalanceRow = {
  id: string;
  date: Date;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string | null;
};

type OptionalFindManyModel = {
  findMany: (args: unknown) => Promise<unknown[]>;
};

type ReclassDataRow = {
  amount: number;
  toAccount: string;
  fromAccount: string;
};

type TransitBuildDataRow = {
  amount: number;
  debitAccount: string;
  creditAccount: string;
};

const CASH_ACCOUNT = 'Cash';
const STOCK_ON_HAND_ACCOUNT = 'Stock on Hand';

function getOptionalFindManyModel(
  modelName: string
): OptionalFindManyModel | null {
  const candidate = Reflect.get(prisma, modelName);
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const maybeFindMany = Reflect.get(candidate, 'findMany');
  if (typeof maybeFindMany !== 'function') {
    return null;
  }

  return {
    findMany: (args: unknown) =>
      (maybeFindMany as (args: unknown) => Promise<unknown[]>).call(
        candidate,
        args
      ),
  };
}

function toOpeningBalanceRow(row: unknown): OpeningBalanceRow | null {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const id = Reflect.get(row, 'id');
  const date = Reflect.get(row, 'date');
  const ref = Reflect.get(row, 'ref');
  const account = Reflect.get(row, 'account');
  const debit = Number(Reflect.get(row, 'debit') ?? 0);
  const credit = Number(Reflect.get(row, 'credit') ?? 0);
  const descriptionValue = Reflect.get(row, 'description');

  if (
    typeof id !== 'string' ||
    !(date instanceof Date) ||
    typeof ref !== 'string' ||
    typeof account !== 'string' ||
    !Number.isFinite(debit) ||
    !Number.isFinite(credit)
  ) {
    return null;
  }

  return {
    id,
    date,
    ref,
    account,
    debit,
    credit,
    description: typeof descriptionValue === 'string' ? descriptionValue : null,
  };
}

function toReclassDataRow(row: unknown): ReclassDataRow | null {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const amount = Number(Reflect.get(row, 'amount') ?? 0);
  const toAccount = Reflect.get(row, 'toAccount');
  const fromAccount = Reflect.get(row, 'fromAccount');

  if (
    !Number.isFinite(amount) ||
    typeof toAccount !== 'string' ||
    typeof fromAccount !== 'string'
  ) {
    return null;
  }

  return { amount, toAccount, fromAccount };
}

function toTransitBuildDataRow(row: unknown): TransitBuildDataRow | null {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const amount = Number(Reflect.get(row, 'amount') ?? 0);
  const debitAccount = Reflect.get(row, 'debitAccount');
  const creditAccount = Reflect.get(row, 'creditAccount');

  if (
    !Number.isFinite(amount) ||
    typeof debitAccount !== 'string' ||
    typeof creditAccount !== 'string'
  ) {
    return null;
  }

  return { amount, debitAccount, creditAccount };
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
  const asOfRaw = parseDate(asOfParam);
  const asOfDateOnly = !!asOfParam && /^\d{4}-\d{2}-\d{2}$/.test(asOfParam);
  const asOf = clampAsOf(asOfDateOnly && asOfRaw ? endOfDay(asOfRaw) : asOfRaw);

  const transactions = await fetchGeneralMerchandiseRecognizedTransactions();
  const payments = await fetchGeneralMerchandiseTransactionPayments();
  const expenses = await fetchGeneralMerchandiseApprovedExpenses();
  const refunds = await fetchGeneralMerchandiseTransactionRefunds();
  const manualLines = await fetchGeneralMerchandiseManualJournalLines({
    from: CUTOVER,
    to: asOf,
  });

  // Non-reservation payments contribute to revenue/cash recognition for in-progress orders.
  const paymentTotalsByTxId = new Map<number, number>();
  const earliestPaymentAtByTxId = new Map<number, Date>();

  // All payments (including reservation deposits) so paid orders can reflect full cash received.
  const paymentTotalsAllByTxId = new Map<number, number>();
  const earliestIncludedPaymentAtByTxId = new Map<number, Date>();

  // Reservation payments are tracked separately as Customer Deposits.
  const reservationTotalsByTxId = new Map<number, number>();

  // Track any payment activity so we can prefer payment events over legacy adjustment fields.
  const paymentEventTxIds = new Set<number>();

  for (const payment of payments) {
    const isReservation =
      Reflect.get(payment as object, 'isReservation') === true;

    const paymentAt = parseDate(payment.paymentDate);
    if (!isWithinDateRange(paymentAt, CUTOVER, asOf)) {
      continue;
    }

    const amt = Number(payment.amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      continue;
    }

    paymentEventTxIds.add(payment.transactionId);

    // Mirror ledger behavior: for cancelled orders, only reservation/deposit payments count.
    if (
      isCancelledOrderStatus(payment.transaction?.orderStatus) &&
      !isReservation
    ) {
      continue;
    }

    paymentTotalsAllByTxId.set(
      payment.transactionId,
      (paymentTotalsAllByTxId.get(payment.transactionId) ?? 0) + amt
    );

    const existingEarliestIncluded = earliestIncludedPaymentAtByTxId.get(
      payment.transactionId
    );
    if (
      !existingEarliestIncluded ||
      (paymentAt && paymentAt < existingEarliestIncluded)
    ) {
      if (paymentAt) {
        earliestIncludedPaymentAtByTxId.set(payment.transactionId, paymentAt);
      }
    }

    if (isReservation) {
      reservationTotalsByTxId.set(
        payment.transactionId,
        (reservationTotalsByTxId.get(payment.transactionId) ?? 0) + amt
      );
      continue;
    }

    paymentTotalsByTxId.set(
      payment.transactionId,
      (paymentTotalsByTxId.get(payment.transactionId) ?? 0) + amt
    );

    const existingEarliest = earliestPaymentAtByTxId.get(payment.transactionId);
    if (!existingEarliest || (paymentAt && paymentAt < existingEarliest)) {
      if (paymentAt) {
        earliestPaymentAtByTxId.set(payment.transactionId, paymentAt);
      }
    }
  }

  const openingBalanceModel = getOptionalFindManyModel(
    'generalMerchandiseAccountingOpeningBalance'
  );

  const openingBalanceRowsRaw = openingBalanceModel
    ? await openingBalanceModel.findMany({
        where: {
          date: {
            gte: CUTOVER,
            lte: asOf,
          },
        },
        orderBy: { date: 'asc' },
      })
    : [];
  const openingBalanceRows = openingBalanceRowsRaw
    .map(toOpeningBalanceRow)
    .filter((row): row is OpeningBalanceRow => row !== null);

  const loanDetailsByLabel = new Map<string, number>();
  const addLoanDetail = (label: string, amount: number) => {
    const key = label.trim();
    if (!key || !Number.isFinite(amount) || amount === 0) {
      return;
    }
    loanDetailsByLabel.set(key, (loanDetailsByLabel.get(key) ?? 0) + amount);
  };

  const cashDetailsByLabel = new Map<string, number>();
  const addCashDetail = (label: string, account: string, amount: number) => {
    const key = label.trim();
    if (!key || !Number.isFinite(amount) || amount === 0) {
      return;
    }

    const normalizedAccount = normalizeAccountForReporting(account).trim();
    if (normalizedAccount !== CASH_ACCOUNT) {
      return;
    }

    cashDetailsByLabel.set(key, (cashDetailsByLabel.get(key) ?? 0) + amount);
  };

  const stockDetailsByLabel = new Map<string, number>();
  const addStockDetail = (label: string, account: string, amount: number) => {
    const key = label.trim();
    if (!key || !Number.isFinite(amount) || amount === 0) {
      return;
    }

    const normalizedAccount = normalizeAccountForReporting(account).trim();
    if (normalizedAccount !== STOCK_ON_HAND_ACCOUNT) {
      return;
    }

    stockDetailsByLabel.set(key, (stockDetailsByLabel.get(key) ?? 0) + amount);
  };

  const detailLabelFromRefDescription = (input: {
    ref?: string | null;
    description?: string | null;
  }): string | null => {
    const ref = (input.ref ?? '').trim();
    if (ref) {
      return ref;
    }
    const desc = (input.description ?? '').trim();
    if (desc) {
      return desc;
    }
    return null;
  };

  const parseLoanSuffix = (account: string): string | null => {
    const trimmed = account.trim();
    const prefix = 'Loan Payable';
    if (!trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
      return null;
    }
    const rest = trimmed.slice(prefix.length).trim();
    if (!rest) {
      return null;
    }

    // Supports both hyphen and en-dash separators.
    const normalized = rest.replace(/^[-–—]+\s*/, '').trim();
    return normalized || null;
  };

  const loanLabelForLine = (line: {
    account: string;
    description?: string | null;
    ref?: string | null;
  }): string => {
    const suffix = parseLoanSuffix(line.account);
    if (suffix) {
      return suffix;
    }

    const desc = (line.description ?? '').trim();
    if (desc) {
      return desc;
    }

    const ref = (line.ref ?? '').trim();
    if (ref) {
      return ref;
    }

    return 'Unspecified';
  };

  const openingEntries = openingBalanceRows.map((entry) => ({
    account: entry.account,
    amount: entry.debit - entry.credit,
  }));

  for (const entry of openingBalanceRows) {
    const account = entry.account.trim();
    if (!account) {
      continue;
    }

    const amount = Number(entry.debit ?? 0) - Number(entry.credit ?? 0);
    if (!Number.isFinite(amount) || amount === 0) {
      continue;
    }

    const tag = detailLabelFromRefDescription({
      ref: entry.ref,
      description: entry.description,
    });

    addCashDetail(
      tag ? `Opening Balance – ${tag}` : 'Opening Balance',
      account,
      amount
    );

    addStockDetail(
      tag ? `Opening Balance – ${tag}` : 'Opening Balance',
      account,
      amount
    );
  }

  // Capture per-loan breakdown only when the account is the generic Loan Payable
  // (or when using suffixed loan payable accounts), using description/ref as the tag.
  for (const entry of openingBalanceRows) {
    const account = entry.account.trim();
    if (!account) {
      continue;
    }
    if (!account.toLowerCase().startsWith('loan payable')) {
      continue;
    }

    const amount = Number(entry.debit ?? 0) - Number(entry.credit ?? 0);
    if (!Number.isFinite(amount) || amount === 0) {
      continue;
    }

    addLoanDetail(
      loanLabelForLine({
        account,
        description: entry.description,
        ref: entry.ref,
      }),
      amount
    );
  }

  const reclassModel = getOptionalFindManyModel(
    'generalMerchandiseInventoryReclassEntry'
  );

  const reclassRows = reclassModel
    ? await reclassModel.findMany({
        where: {
          deletedAt: null,
          postingDate: {
            gte: CUTOVER,
            lte: asOf,
          },
        },
        orderBy: { postingDate: 'asc' },
      })
    : [];
  const normalizedReclassRows = reclassRows
    .map(toReclassDataRow)
    .filter((row): row is ReclassDataRow => row !== null);

  const reclassEntries: BalanceRow[] = normalizedReclassRows
    .map((row) => {
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const value = Math.max(amount, 0);

      addCashDetail('Inventory Reclass', row.toAccount, value);
      addCashDetail('Inventory Reclass', row.fromAccount, -value);

      addStockDetail(`Reclass In – ${row.fromAccount}`, row.toAccount, value);
      addStockDetail(`Reclass Out – ${row.toAccount}`, row.fromAccount, -value);

      return [
        { account: row.toAccount, amount: value },
        { account: row.fromAccount, amount: -value },
      ];
    })
    .flat()
    .filter(Boolean) as BalanceRow[];

  const transitBuildModel = getOptionalFindManyModel(
    'generalMerchandiseInventoryTransitBuildEntry'
  );

  const transitBuildRows = transitBuildModel
    ? await transitBuildModel.findMany({
        where: {
          deletedAt: null,
          postingDate: {
            gte: CUTOVER,
            lte: asOf,
          },
        },
        orderBy: { postingDate: 'asc' },
      })
    : [];
  const normalizedTransitBuildRows = transitBuildRows
    .map(toTransitBuildDataRow)
    .filter((row): row is TransitBuildDataRow => row !== null);

  const transitBuildEntries: BalanceRow[] = normalizedTransitBuildRows
    .map((row) => {
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const value = Math.max(amount, 0);

      addCashDetail('Inventory Transit Build', row.debitAccount, value);
      addCashDetail('Inventory Transit Build', row.creditAccount, -value);

      addStockDetail(
        `Transit Build In – ${row.creditAccount}`,
        row.debitAccount,
        value
      );
      addStockDetail(
        `Transit Build Out – ${row.debitAccount}`,
        row.creditAccount,
        -value
      );

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
    tx: {
      id: number;
      orderStatus?: string | null;
      orderDate?: string | null;
    } & Parameters<typeof getPaidAtDate>[0]
  ) => {
    if (isPaidStatus(tx.orderStatus)) {
      return getPaidAtDate(tx);
    }

    const paymentAt = earliestPaymentAtByTxId.get(tx.id);
    if (paymentAt) {
      return paymentAt;
    }

    return parseDate(tx.orderDate) ?? null;
  };

  const txEntries = transactions
    .map((tx) => {
      const normalized = normalizeTransactionAmountsForAccounting(tx);
      const grossSale = Number(normalized.grossSale ?? 0);

      // If we have explicit payment events, prefer them for cash received for
      // non-paid statuses to avoid missing cash on the balance sheet.
      const hasPaymentEvents = paymentEventTxIds.has(tx.id);
      const usePaymentEvents = hasPaymentEvents;

      const paymentReceived = usePaymentEvents
        ? Math.max(paymentTotalsByTxId.get(tx.id) ?? 0, 0)
        : Number(normalized.paymentReceived ?? 0);

      const paymentReceivedAll = usePaymentEvents
        ? Math.max(paymentTotalsAllByTxId.get(tx.id) ?? 0, 0)
        : paymentReceived;

      const resolvedPaymentReceived = isPaidStatus(tx.orderStatus)
        ? paymentReceivedAll
        : paymentReceived;

      const derivedBalanceDue = Math.max(
        Math.max(grossSale, 0) - Math.max(resolvedPaymentReceived, 0),
        0
      );
      const balanceDue = usePaymentEvents
        ? derivedBalanceDue
        : Number(normalized.balanceDue ?? 0);

      const paymentAnchor =
        (isPaidStatus(tx.orderStatus)
          ? earliestIncludedPaymentAtByTxId.get(tx.id)
          : earliestPaymentAtByTxId.get(tx.id)) ?? null;
      const recognizedAt =
        usePaymentEvents && paymentAnchor ? paymentAnchor : getRecognizedAt(tx);
      if (!isWithinDateRange(recognizedAt, CUTOVER, asOf)) {
        return null;
      }

      const cash = Math.max(Number(resolvedPaymentReceived) || 0, 0);
      const ar = isReceivableStatus(tx.orderStatus)
        ? Math.max(Number(balanceDue) || 0, 0)
        : 0;
      const saleAmount = cash + ar;

      if (!Number.isFinite(saleAmount) || saleAmount <= 0) {
        return null;
      }

      if (cash > 0) {
        addCashDetail('Sales (cash received)', CASH_ACCOUNT, cash);
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

  // Reservation payments (deposits) appear as Cash + Customer Deposits (liability)
  // until the order is either completed (then they are part of the sale recognition)
  // or cancelled (then they become Forfeited Deposits -> Retained Earnings).
  const reservationTxIds = Array.from(reservationTotalsByTxId.keys());
  const reservationEntries: BalanceRow[] = [];

  if (reservationTxIds.length > 0) {
    const txRows = await prisma.generalMerchandiseTransaction.findMany({
      where: {
        id: { in: reservationTxIds },
        deletedAt: null,
      },
      select: {
        id: true,
        orderStatus: true,
        updatedAt: true,
        statusChanges: {
          where: {
            newStatus: { in: [...PAID_STATUSES, 'Cancelled', 'Forfeited'] },
          },
          orderBy: { changedAt: 'asc' },
          select: { newStatus: true, changedAt: true },
        },
      },
    });

    const txById = new Map(txRows.map((t) => [t.id, t]));

    for (const txId of reservationTxIds) {
      const depositTotal = reservationTotalsByTxId.get(txId) ?? 0;
      if (!Number.isFinite(depositTotal) || depositTotal <= 0) {
        continue;
      }

      const tx = txById.get(txId);
      if (!tx) {
        continue;
      }

      // If the order is already completed/paid, the cash is already reflected
      // via the sale recognition entry and no deposit liability remains.
      if (isPaidStatus(tx.orderStatus)) {
        continue;
      }

      const cancelledAt = isDepositForfeitureOrderStatus(tx.orderStatus)
        ? getCancelledAtDate(tx)
        : null;

      if (cancelledAt && isWithinDateRange(cancelledAt, CUTOVER, asOf)) {
        addCashDetail(
          'Reservation Deposits (forfeited)',
          CASH_ACCOUNT,
          depositTotal
        );
        reservationEntries.push(
          { account: 'Cash', amount: depositTotal },
          { account: 'Retained Earnings', amount: -depositTotal }
        );
        continue;
      }

      addCashDetail('Reservation Deposits (open)', CASH_ACCOUNT, depositTotal);

      reservationEntries.push(
        { account: 'Cash', amount: depositTotal },
        { account: 'Customer Deposits', amount: -depositTotal }
      );
    }
  }

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

  if (Number.isFinite(cogsTotal) && cogsTotal > 0) {
    addStockDetail(
      'COGS (inventory movements)',
      STOCK_ON_HAND_ACCOUNT,
      -cogsTotal
    );
  }

  // Inventory seed/shrinkage proxy valuation.
  // NOTE: This is intentionally excluded from the balance sheet so that
  // inventory assets (Stock on Hand / Inventory in Transit) reflect only
  // explicit, user-entered accounting postings.
  const inventorySeedEntries: BalanceRow[] = [];
  const inventoryShrinkageEntries: BalanceRow[] = [];

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

      addCashDetail('Refunds', CASH_ACCOUNT, -value);

      // Refunds reduce Equity and reduce the Cash asset.
      return [
        { account: 'Retained Earnings', amount: value },
        { account: 'Cash', amount: -value },
      ];
    })
    .flat()
    .filter(Boolean) as BalanceRow[];

  const expenseEntries = expenses
    .map((exp: (typeof expenses)[number]) => {
      const amount = Number(exp.amount ?? 0);
      if (!Number.isFinite(amount)) {
        return null;
      }

      const expDate = parseDate(exp.date);
      if (!isWithinDateRange(expDate, CUTOVER, asOf)) {
        return null;
      }

      const value = Math.max(amount, 0);

      const category = (exp.category ?? '').trim();
      const method = (exp.paymentMethod ?? '').trim() || 'Cash';
      const label = category
        ? `Expense – ${category} (${method})`
        : `Expense (${method})`;

      addCashDetail(label, exp.paymentMethod ?? 'Cash', -value);

      return [
        { account: exp.paymentMethod ?? 'Cash', amount: -value },
        { account: 'Retained Earnings', amount: value },
      ];
    })
    .flat()
    .filter(Boolean) as BalanceRow[];

  // Manual journal entries affect the balance sheet directly (e.g. Owner Draw).
  // Each line is already one side of a balanced entry.
  // If a line uses a P&L account (e.g. "Utilities Expense"), it should roll into
  // Retained Earnings on the balance sheet to keep the accounting equation balanced.
  const manualEntries: BalanceRow[] = manualLines
    .map((line) => {
      const account = line.account.trim();
      const amount = Number(line.debit ?? 0) - Number(line.credit ?? 0);
      if (!account || !Number.isFinite(amount) || amount === 0) {
        return null;
      }

      const type = detectAccountType(account);
      if (!type) {
        return {
          account: 'Retained Earnings',
          amount,
        };
      }

      if (type === 'Asset' || type === 'Liability' || type === 'Equity') {
        return { account, amount };
      }

      return {
        account: 'Retained Earnings',
        amount,
      };
    })
    .filter(Boolean) as BalanceRow[];

  for (const line of manualLines) {
    const account = line.account.trim();
    if (!account) {
      continue;
    }

    const amount = Number(line.debit ?? 0) - Number(line.credit ?? 0);
    if (Number.isFinite(amount) && amount !== 0) {
      const tag = detailLabelFromRefDescription({
        ref: line.ref,
        description: line.description,
      });

      addCashDetail(
        tag ? `Manual Journal – ${tag}` : 'Manual Journal',
        account,
        amount
      );
    }

    if (!account.toLowerCase().startsWith('loan payable')) {
      continue;
    }

    if (!Number.isFinite(amount) || amount === 0) {
      continue;
    }

    addLoanDetail(
      loanLabelForLine({
        account,
        description: line.description,
        ref: line.ref,
      }),
      amount
    );
  }

  const combined = [
    ...openingEntries,
    ...reclassEntries,
    ...transitBuildEntries,
    ...txEntries,
    ...reservationEntries,
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
    const key = normalizeAccountForReporting(row.account).trim();
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

  const loanDetails: BalanceRowDetail[] = Array.from(loanDetailsByLabel)
    .map(([label, amount]) => ({ label, amount }))
    .filter((item) => Number.isFinite(item.amount) && item.amount !== 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  const maxCashDetails = 30;
  const cashDetailsAll: BalanceRowDetail[] = Array.from(cashDetailsByLabel)
    .map(([label, amount]) => ({ label, amount }))
    .filter((item) => Number.isFinite(item.amount) && item.amount !== 0)
    .sort((a, b) => {
      const diff = Math.abs(b.amount) - Math.abs(a.amount);
      if (diff !== 0) {
        return diff;
      }
      return a.label.localeCompare(b.label);
    });

  const maxStockDetails = 30;
  const stockDetailsAll: BalanceRowDetail[] = Array.from(stockDetailsByLabel)
    .map(([label, amount]) => ({ label, amount }))
    .filter((item) => Number.isFinite(item.amount) && item.amount !== 0)
    .sort((a, b) => {
      const diff = Math.abs(b.amount) - Math.abs(a.amount);
      if (diff !== 0) {
        return diff;
      }
      return a.label.localeCompare(b.label);
    });

  const cashDetails: BalanceRowDetail[] =
    cashDetailsAll.length > maxCashDetails
      ? (() => {
          const head = cashDetailsAll.slice(0, maxCashDetails);
          const tail = cashDetailsAll.slice(maxCashDetails);
          const otherSum = tail.reduce((sum, item) => sum + item.amount, 0);
          const otherLabel = `Other (${tail.length})`;
          return Number.isFinite(otherSum) && otherSum !== 0
            ? [...head, { label: otherLabel, amount: otherSum }]
            : head;
        })()
      : cashDetailsAll;

  const stockDetails: BalanceRowDetail[] =
    stockDetailsAll.length > maxStockDetails
      ? (() => {
          const head = stockDetailsAll.slice(0, maxStockDetails);
          const tail = stockDetailsAll.slice(maxStockDetails);
          const otherSum = tail.reduce((sum, item) => sum + item.amount, 0);
          const otherLabel = `Other (${tail.length})`;
          return Number.isFinite(otherSum) && otherSum !== 0
            ? [...head, { label: otherLabel, amount: otherSum }]
            : head;
        })()
      : stockDetailsAll;

  const rowsWithDetails = rows.map((row) => {
    if (row.account === 'Loan Payable' && loanDetails.length > 0) {
      return {
        ...row,
        details: loanDetails,
      };
    }

    if (row.account === CASH_ACCOUNT && cashDetails.length > 0) {
      return {
        ...row,
        details: cashDetails,
      };
    }

    if (row.account === STOCK_ON_HAND_ACCOUNT && stockDetails.length > 0) {
      return {
        ...row,
        details: stockDetails,
      };
    }

    return row;
  });

  const totals = aggregateBalancesFromRows(rows);

  return ApiResponse.success({
    rows: rowsWithDetails,
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
