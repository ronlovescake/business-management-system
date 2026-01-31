import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import {
  parseDateRangeFromParams,
  buildPeriodLabel,
  parseDate,
} from '@/lib/accounting/date-utils';
import {
  isCancelledOrderStatus,
  isDepositForfeitureOrderStatus,
} from '@/lib/transactions/order-status';
import {
  fetchPaidTransactions,
  fetchApprovedExpenses,
  fetchTransactionRefunds,
  fetchTransactionPayments,
  getPaidAtDate,
  getCancelledAtDate,
  isWithinDateRange,
} from '@/lib/accounting/data-fetchers';
import { computeCogsTotal } from '@/lib/accounting/inventory-cogs';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CUTOVER = getAccountingCutoverDate();

function clampFrom(from: Date | null): Date {
  if (!from) {
    return CUTOVER;
  }
  return from < CUTOVER ? CUTOVER : from;
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { from, to } = parseDateRangeFromParams(req.nextUrl.searchParams);
  const effectiveFrom = clampFrom(from);
  const effectiveTo = to ?? null;

  // Revenue recognition policy (ops workflow): we treat certain transaction statuses as
  // "shipped today" signals. In particular, when an order is tagged "Ready For Dispatch"
  // or "Checked Out", it is expected to be shipped within the same day (not left sitting
  // in the warehouse for days). Accounting revenue for the P&L is therefore anchored to
  // paid/shipped statuses and payment events.
  const transactions = await fetchPaidTransactions();
  const expenses = await fetchApprovedExpenses();
  const refunds = await fetchTransactionRefunds();
  const payments = await fetchTransactionPayments();

  const paymentTransactionIds = new Set(payments.map((p) => p.transactionId));

  const paidAtByTxId = new Map<number, Date | null>();
  for (const tx of transactions) {
    paidAtByTxId.set(tx.id, getPaidAtDate(tx));
  }

  const reservationPayments = payments.filter(
    (p) => (p as unknown as { isReservation?: boolean }).isReservation === true
  );

  const cancelledReservationTxIds = Array.from(
    new Set(
      reservationPayments
        .filter((p) =>
          isDepositForfeitureOrderStatus(p.transaction?.orderStatus)
        )
        .map((p) => p.transactionId)
    )
  );

  const cancelledAtByTxId = new Map<number, Date | null>();
  if (cancelledReservationTxIds.length > 0) {
    const cancelledTxRows = await prisma.transaction.findMany({
      where: {
        id: { in: cancelledReservationTxIds },
        deletedAt: null,
      },
      select: {
        id: true,
        updatedAt: true,
        statusChanges: {
          where: { newStatus: { in: ['Cancelled', 'Forfeited'] } },
          orderBy: { changedAt: 'asc' },
          select: { newStatus: true, changedAt: true },
        },
      },
    });

    for (const tx of cancelledTxRows) {
      cancelledAtByTxId.set(tx.id, getCancelledAtDate(tx));
    }
  }

  // ============================================================================
  // ⚠️ CANCELLED STATUS FILTER (PAYMENT REVENUE)
  // ============================================================================
  // Only the explicit "Cancelled" order status is excluded from revenue totals.
  // ============================================================================
  const paymentRevenueTotal = payments.reduce((sum, payment) => {
    const isReservation =
      (payment as unknown as { isReservation?: boolean }).isReservation ===
      true;

    if (isCancelledOrderStatus(payment.transaction?.orderStatus)) {
      return sum;
    }

    // Reservation/deposit payments are not Sales Revenue when paid.
    if (isReservation) {
      return sum;
    }

    const paymentAt = parseDate(payment.paymentDate);
    if (!isWithinDateRange(paymentAt, effectiveFrom, effectiveTo)) {
      return sum;
    }

    const amt = Number(payment.amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      return sum;
    }

    return sum + amt;
  }, 0);

  const recognizedDepositRevenueTotal = Array.from(
    new Set(reservationPayments.map((p) => p.transactionId))
  ).reduce((sum, txId) => {
    const paidAt = paidAtByTxId.get(txId) ?? null;
    if (!isWithinDateRange(paidAt, effectiveFrom, effectiveTo)) {
      return sum;
    }

    const depositTotal = reservationPayments
      .filter((p) => p.transactionId === txId)
      .reduce((sub, p) => {
        const paidAtPayment = parseDate(p.paymentDate);
        if (!paidAtPayment) {
          return sub;
        }
        if (paidAt && paidAtPayment > paidAt) {
          return sub;
        }
        const amt = Number(p.amount ?? 0);
        return Number.isFinite(amt) && amt > 0 ? sub + amt : sub;
      }, 0);

    return Number.isFinite(depositTotal) && depositTotal > 0
      ? sum + depositTotal
      : sum;
  }, 0);

  const forfeitedDepositsTotal = Array.from(
    new Set(reservationPayments.map((p) => p.transactionId))
  ).reduce((sum, txId) => {
    const cancelledAt = cancelledAtByTxId.get(txId) ?? null;
    if (!isWithinDateRange(cancelledAt, effectiveFrom, effectiveTo)) {
      return sum;
    }

    const depositTotal = reservationPayments
      .filter((p) => p.transactionId === txId)
      .reduce((sub, p) => {
        const paidAtPayment = parseDate(p.paymentDate);
        if (!paidAtPayment) {
          return sub;
        }
        if (cancelledAt && paidAtPayment > cancelledAt) {
          return sub;
        }
        const amt = Number(p.amount ?? 0);
        return Number.isFinite(amt) && amt > 0 ? sub + amt : sub;
      }, 0);

    return Number.isFinite(depositTotal) && depositTotal > 0
      ? sum + depositTotal
      : sum;
  }, 0);

  // ============================================================================
  // ⚠️ CANCELLED STATUS FILTER (LEGACY REVENUE)
  // ============================================================================
  // Legacy paid transactions are excluded only when Order Status is "Cancelled".
  // ============================================================================
  const transactionsWithPaidAt = transactions
    .filter((tx) => !paymentTransactionIds.has(tx.id))
    .filter((tx) => !isCancelledOrderStatus(tx.orderStatus))
    .map((tx) => {
      const paidAt = getPaidAtDate(tx);
      return { ...tx, paidAt };
    });

  const filteredTransactions = transactionsWithPaidAt.filter((tx) =>
    isWithinDateRange(tx.paidAt, effectiveFrom, effectiveTo)
  );

  const legacyRevenueTotal = filteredTransactions.reduce((sum, tx) => {
    const { paymentReceived } = normalizeTransactionAmountsForAccounting(tx);
    return sum + paymentReceived;
  }, 0);

  const salesRevenueTotal =
    paymentRevenueTotal + legacyRevenueTotal + recognizedDepositRevenueTotal;
  const revenueTotal = salesRevenueTotal + forfeitedDepositsTotal;

  const refundTotal = refunds.reduce((sum, refund) => {
    const refundAt = parseDate(refund.refundDate);
    if (!isWithinDateRange(refundAt, effectiveFrom, effectiveTo)) {
      return sum;
    }

    const amt = Number(refund.amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      return sum;
    }

    return sum + amt;
  }, 0);

  const netRevenueTotal = revenueTotal - refundTotal;

  const expenseTotalsByCategory = new Map<string, number>();
  expenses.forEach((exp) => {
    const expenseDate = parseDate(exp.date);
    if (!isWithinDateRange(expenseDate, effectiveFrom, effectiveTo)) {
      return;
    }

    const amount = Number.isFinite(exp.amount) ? exp.amount : 0;
    const current = expenseTotalsByCategory.get(exp.category) ?? 0;
    expenseTotalsByCategory.set(exp.category, current + amount);
  });

  const rows = [] as Array<{
    id: string;
    category: string;
    type: 'Revenue' | 'Expense';
    amount: number;
  }>;

  if (salesRevenueTotal !== 0) {
    rows.push({
      id: 'revenue-sales',
      category: 'Sales Revenue',
      type: 'Revenue',
      amount: salesRevenueTotal,
    });
  }

  if (forfeitedDepositsTotal !== 0) {
    rows.push({
      id: 'revenue-forfeited-deposits',
      category: 'Forfeited Deposits',
      type: 'Revenue',
      amount: forfeitedDepositsTotal,
    });
  }

  if (refundTotal !== 0) {
    rows.push({
      id: 'revenue-sales-returns',
      category: 'Sales Returns',
      type: 'Revenue',
      amount: -refundTotal,
    });
  }

  expenseTotalsByCategory.forEach((amount, category) => {
    rows.push({
      id: `expense-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      category,
      type: 'Expense',
      amount,
    });
  });

  const expenseTotal = Array.from(expenseTotalsByCategory.values()).reduce(
    (sum, amt) => sum + amt,
    0
  );

  const cogsTotal = await computeCogsTotal({
    from: effectiveFrom,
    to: effectiveTo,
  });

  if (cogsTotal !== 0) {
    rows.push({
      id: 'expense-cogs',
      category: 'COGS',
      type: 'Expense',
      amount: cogsTotal,
    });
  }

  const totalExpenses = expenseTotal + cogsTotal;
  const grossProfit = netRevenueTotal - cogsTotal;

  const stats = {
    revenueTotal: netRevenueTotal,
    cogsTotal,
    grossProfit,
    expenseTotal: totalExpenses,
    netProfit: netRevenueTotal - totalExpenses,
    period: buildPeriodLabel(from, to),
  };

  return ApiResponse.success({ rows, stats });
});
