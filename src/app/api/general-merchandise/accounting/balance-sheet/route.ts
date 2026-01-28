import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDate } from '@/lib/accounting/date-utils';
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
import {
  buildInventorySeedAndShrinkageEntries,
  computeCogsTotal,
} from '@/lib/accounting/general-merchandise/inventory-cogs';
import { prisma } from '@/lib/db';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';
import {
  detectAccountType,
  type AccountType,
} from '@/lib/accounting/account-classification';
import { isInTransitShipmentStatus } from '@/lib/inventory/shipment-status';
import {
  isCancelledOrderStatus,
  isDepositForfeitureOrderStatus,
} from '@/lib/transactions/order-status';

export const dynamic = 'force-dynamic';

const CUTOVER = getAccountingCutoverDate();
const IN_TRANSIT_ACCOUNT = 'Inventory in Transit';

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

const CASH_ACCOUNT = 'Cash';

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

  // Reservation payments are tracked separately as Customer Deposits.
  const reservationTotalsByTxId = new Map<number, number>();

  for (const payment of payments) {
    const isReservation =
      (payment as unknown as { isReservation?: boolean }).isReservation ===
      true;

    const paymentAt = parseDate(payment.paymentDate);
    if (!isWithinDateRange(paymentAt, CUTOVER, asOf)) {
      continue;
    }

    const amt = Number(payment.amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      continue;
    }

    if (isReservation) {
      reservationTotalsByTxId.set(
        payment.transactionId,
        (reservationTotalsByTxId.get(payment.transactionId) ?? 0) + amt
      );
      continue;
    }

    if (isCancelledOrderStatus(payment.transaction?.orderStatus)) {
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

  const openingBalanceModel = (
    prisma as unknown as {
      generalMerchandiseAccountingOpeningBalance?: {
        findMany?: (args: unknown) => Promise<unknown>;
      };
    }
  ).generalMerchandiseAccountingOpeningBalance;

  const openingBalanceRows = openingBalanceModel?.findMany
    ? ((await openingBalanceModel.findMany({
        where: {
          date: {
            gte: CUTOVER,
            lte: asOf,
          },
        },
        orderBy: { date: 'asc' },
      })) as OpeningBalanceRow[])
    : [];

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

  const reclassModel = (
    prisma as unknown as {
      generalMerchandiseInventoryReclassEntry?: {
        findMany?: (args: unknown) => Promise<unknown>;
      };
    }
  ).generalMerchandiseInventoryReclassEntry;

  const reclassRows = reclassModel?.findMany
    ? ((await reclassModel.findMany({
        where: {
          deletedAt: null,
          postingDate: {
            gte: CUTOVER,
            lte: asOf,
          },
        },
        orderBy: { postingDate: 'asc' },
      })) as Array<{
        id: string;
        amount: unknown;
        toAccount: string;
        fromAccount: string;
      }>)
    : [];

  const reclassEntries: BalanceRow[] = reclassRows
    .map((row) => {
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const value = Math.max(amount, 0);

      addCashDetail('Inventory Reclass', row.toAccount, value);
      addCashDetail('Inventory Reclass', row.fromAccount, -value);

      return [
        { account: row.toAccount, amount: value },
        { account: row.fromAccount, amount: -value },
      ];
    })
    .flat()
    .filter(Boolean) as BalanceRow[];

  const transitBuildModel = (
    prisma as unknown as {
      generalMerchandiseInventoryTransitBuildEntry?: {
        findMany?: (args: unknown) => Promise<unknown>;
      };
    }
  ).generalMerchandiseInventoryTransitBuildEntry;

  const transitBuildRows = transitBuildModel?.findMany
    ? ((await transitBuildModel.findMany({
        where: {
          deletedAt: null,
          postingDate: {
            gte: CUTOVER,
            lte: asOf,
          },
        },
        orderBy: { postingDate: 'asc' },
      })) as Array<{
        id: string;
        amount: unknown;
        debitAccount: string;
        creditAccount: string;
      }>)
    : [];

  const transitBuildEntries: BalanceRow[] = transitBuildRows
    .map((row) => {
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const value = Math.max(amount, 0);

      addCashDetail('Inventory Transit Build', row.debitAccount, value);
      addCashDetail('Inventory Transit Build', row.creditAccount, -value);

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
      const hasPaymentEvents = paymentTotalsByTxId.has(tx.id);
      const usePaymentEvents =
        hasPaymentEvents && !isPaidStatus(tx.orderStatus);
      const paymentReceived = usePaymentEvents
        ? Math.min(
            Math.max(paymentTotalsByTxId.get(tx.id) ?? 0, 0),
            Math.max(grossSale, 0)
          )
        : Number(normalized.paymentReceived ?? 0);

      const derivedBalanceDue = Math.max(
        Math.max(grossSale, 0) - Math.max(paymentReceived, 0),
        0
      );
      const balanceDue = usePaymentEvents
        ? derivedBalanceDue
        : Number(normalized.balanceDue ?? 0);

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

  // Inventory seed/shrinkage proxy valuation.
  // Seed: scrap -> asset bucket (treat as opening equity contribution).
  // Shrinkage: asset bucket -> scrap (treat as reduction to retained earnings).
  const { entries: seedShrinkEntries } =
    await buildInventorySeedAndShrinkageEntries({
      from: CUTOVER,
      to: asOf,
    });
  const inventorySeedEntries: BalanceRow[] = seedShrinkEntries
    .filter(
      (entry) =>
        entry.description.startsWith('Inventory seeded') ||
        entry.description.startsWith('Inventory in Transit seeded')
    )
    .map((entry) => ({
      account: entry.account,
      amount: Number(entry.debit ?? 0) - Number(entry.credit ?? 0),
    }));
  const inventoryShrinkageEntries: BalanceRow[] = seedShrinkEntries
    .filter((entry) => entry.description.startsWith('Inventory shrinkage'))
    .map((entry) => ({
      account: entry.account,
      amount: Number(entry.debit ?? 0) - Number(entry.credit ?? 0),
    }));

  const products = await prisma.generalMerchandiseProduct.findMany({
    where: { deletedAt: null },
    select: {
      productCode: true,
      shipmentCode: true,
      shipmentStatus: true,
      cogs: true,
    },
  });

  const shipmentCodes = Array.from(
    new Set(
      products.map((row) => (row.shipmentCode ?? '').trim()).filter(Boolean)
    )
  );

  const shipmentRows =
    shipmentCodes.length > 0
      ? await prisma.generalMerchandiseShipment.findMany({
          where: { shipmentCode: { in: shipmentCodes } },
          select: { shipmentCode: true, shipmentStatus: true },
        })
      : [];

  const shipmentStatusByCode = new Map<string, string>();
  for (const row of shipmentRows) {
    const code = (row.shipmentCode ?? '').trim();
    if (code && !shipmentStatusByCode.has(code)) {
      shipmentStatusByCode.set(code, row.shipmentStatus ?? '');
    }
  }

  // ==========================================================================
  // ⚠️ INVENTORY IN TRANSIT (SHIPMENT STATUS)
  // ==========================================================================
  // Uses shared helper to keep "blank = in transit" behavior consistent
  // with transactions workflow and accounting.
  // ==========================================================================
  const inTransitProductTotal = products.reduce((sum, row) => {
    const productCode = (row.productCode ?? '').trim();
    if (!productCode) {
      return sum;
    }

    const directStatus = row.shipmentStatus ?? '';
    const shipmentCode = (row.shipmentCode ?? '').trim();
    const fallbackStatus = shipmentCode
      ? (shipmentStatusByCode.get(shipmentCode) ?? '')
      : '';
    const status = directStatus.trim() ? directStatus : fallbackStatus;
    if (!shipmentCode || !isInTransitShipmentStatus(status)) {
      return sum;
    }

    const cogs = Number(row.cogs ?? 0);
    if (!Number.isFinite(cogs) || cogs <= 0) {
      return sum;
    }

    return sum + cogs;
  }, 0);

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

  const currentInTransit = combined
    .filter((row) => row.account.trim() === IN_TRANSIT_ACCOUNT)
    .reduce((sum, row) => sum + row.amount, 0);

  const inTransitDelta = inTransitProductTotal - currentInTransit;
  if (Number.isFinite(inTransitDelta) && Math.abs(inTransitDelta) > 0.01) {
    combined.push(
      { account: IN_TRANSIT_ACCOUNT, amount: inTransitDelta },
      { account: 'Opening Equity', amount: -inTransitDelta }
    );
  }

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
