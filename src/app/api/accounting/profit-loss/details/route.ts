import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import {
  buildPeriodLabel,
  parseDate,
  parseDateRangeFromParams,
} from '@/lib/accounting/date-utils';
import {
  isCancelledOrderStatus,
  isDepositForfeitureOrderStatus,
} from '@/lib/transactions/order-status';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import {
  fetchApprovedExpenses,
  fetchPaidTransactions,
  fetchTransactionPayments,
  fetchTransactionRefunds,
  getPaidAtDate,
  getCancelledAtDate,
  isWithinDateRange,
} from '@/lib/accounting/data-fetchers';
import { buildCogsAndInventoryEntries } from '@/lib/accounting/inventory-cogs';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function clampFrom(from: Date | null, cutover: Date): Date {
  if (!from) {
    return cutover;
  }
  return from < cutover ? cutover : from;
}

export type ProfitLossDetailRow = {
  id: string;
  date: string;
  category: string;
  type: 'Revenue' | 'Expense';
  sourceType: string;
  sourceId: string | null;
  ref: string | null;
  description: string;
  amount: number;
  customer: string | null;
  productCode: string | null;
  method: string | null;
};

export const GET = withErrorHandler(async (req: NextRequest) => {
  const cutover = await getRuntimeAccountingCutoverDate();
  const { from, to } = parseDateRangeFromParams(req.nextUrl.searchParams);
  const effectiveFrom = clampFrom(from, cutover);
  const effectiveTo = to ?? null;

  const [transactions, expenses, refunds, payments] = await Promise.all([
    fetchPaidTransactions(),
    fetchApprovedExpenses(),
    fetchTransactionRefunds(),
    fetchTransactionPayments(),
  ]);

  const rows: ProfitLossDetailRow[] = [];

  const paidAtByTxId = new Map<number, Date | null>();
  for (const tx of transactions) {
    paidAtByTxId.set(tx.id, getPaidAtDate(tx));
  }

  const reservationPayments = payments.filter(
    (payment) => Reflect.get(payment as object, 'isReservation') === true
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

  // ==========================================================================
  // ⚠️ CANCELLED STATUS FILTER (PAYMENT DETAILS)
  // ==========================================================================
  // Only explicit "Cancelled" order status is excluded from revenue details.
  // ==========================================================================
  // Revenue: payment events
  const paymentTransactionIds = new Set(payments.map((p) => p.transactionId));

  for (const payment of payments) {
    const isReservation =
      Reflect.get(payment as object, 'isReservation') === true;

    if (isCancelledOrderStatus(payment.transaction?.orderStatus)) {
      continue;
    }

    // Reservation/deposit payments are not revenue when received.
    if (isReservation) {
      continue;
    }

    const paymentAt = parseDate(payment.paymentDate);
    if (!isWithinDateRange(paymentAt, effectiveFrom, effectiveTo)) {
      continue;
    }

    const amt = Number(payment.amount ?? 0);
    if (!Number.isFinite(amt) || amt === 0) {
      continue;
    }

    rows.push({
      id: `payment-${payment.id}`,
      date: (paymentAt ?? new Date()).toISOString(),
      category: 'Sales Revenue',
      type: 'Revenue',
      sourceType: 'TransactionPayment',
      sourceId: String(payment.id),
      ref: `TX-${payment.transactionId}`,
      description: payment.notes?.trim() || 'Payment received',
      amount: amt,
      customer: payment.transaction.customers ?? null,
      productCode: payment.transaction.productCode ?? null,
      method: payment.method ?? null,
    });
  }

  // Revenue: reservation payments recognized on completion / forfeiture on cancellation.
  for (const txId of Array.from(
    new Set(reservationPayments.map((p) => p.transactionId))
  )) {
    const paidAt = paidAtByTxId.get(txId) ?? null;
    const cancelledAt = cancelledAtByTxId.get(txId) ?? null;
    const recognizeAt = cancelledAt ?? paidAt;
    if (!isWithinDateRange(recognizeAt, effectiveFrom, effectiveTo)) {
      continue;
    }

    const refPayment = reservationPayments.find(
      (p) => p.transactionId === txId
    );
    const customer = refPayment?.transaction?.customers ?? null;
    const productCode = refPayment?.transaction?.productCode ?? null;

    const depositTotal = reservationPayments
      .filter((p) => p.transactionId === txId)
      .reduce((sum, p) => {
        const paymentAt = parseDate(p.paymentDate);
        if (!paymentAt) {
          return sum;
        }
        if (recognizeAt && paymentAt > recognizeAt) {
          return sum;
        }
        const amt = Number(p.amount ?? 0);
        return Number.isFinite(amt) && amt > 0 ? sum + amt : sum;
      }, 0);

    if (!Number.isFinite(depositTotal) || depositTotal === 0) {
      continue;
    }

    const isForfeit = Boolean(cancelledAt);
    rows.push({
      id: isForfeit ? `forfeit-${txId}` : `deposit-recognized-${txId}`,
      date: (recognizeAt ?? new Date()).toISOString(),
      category: isForfeit ? 'Forfeited Deposits' : 'Sales Revenue',
      type: 'Revenue',
      sourceType: isForfeit
        ? 'ReservationDepositForfeit'
        : 'ReservationDepositRecognition',
      sourceId: String(txId),
      ref: `TX-${txId}`,
      description: isForfeit
        ? 'Reservation fee forfeited'
        : 'Reservation fee recognized (Completed)',
      amount: depositTotal,
      customer,
      productCode,
      method: null,
    });
  }

  // ==========================================================================
  // ⚠️ CANCELLED STATUS FILTER (LEGACY DETAILS)
  // ==========================================================================
  // Legacy paid transactions are excluded only when Order Status is "Cancelled".
  // ==========================================================================
  // Revenue: legacy paid transactions (only if there are no payment events to avoid double counting)
  for (const tx of transactions) {
    if (paymentTransactionIds.has(tx.id)) {
      continue;
    }

    if (isCancelledOrderStatus(tx.orderStatus)) {
      continue;
    }

    const paidAt = getPaidAtDate(tx);
    if (!isWithinDateRange(paidAt, effectiveFrom, effectiveTo)) {
      continue;
    }

    const { paymentReceived } = normalizeTransactionAmountsForAccounting(tx);
    if (!Number.isFinite(paymentReceived) || paymentReceived === 0) {
      continue;
    }

    rows.push({
      id: `tx-${tx.id}`,
      date: (paidAt ?? new Date()).toISOString(),
      category: 'Sales Revenue',
      type: 'Revenue',
      sourceType: 'Transaction',
      sourceId: String(tx.id),
      ref: `TX-${tx.id}`,
      description: `Order status: ${(tx.orderStatus ?? '').trim() || 'Unknown'}`,
      amount: paymentReceived,
      customer: (tx.customers ?? '').trim() || null,
      productCode: (tx.productCode ?? '').trim() || null,
      method: null,
    });
  }

  // Revenue: refunds (negative revenue)
  for (const refund of refunds) {
    const refundAt = parseDate(refund.refundDate);
    if (!isWithinDateRange(refundAt, effectiveFrom, effectiveTo)) {
      continue;
    }

    const amt = Number(refund.amount ?? 0);
    if (!Number.isFinite(amt) || amt === 0) {
      continue;
    }

    rows.push({
      id: `refund-${refund.id}`,
      date: (refundAt ?? new Date()).toISOString(),
      category: 'Sales Returns',
      type: 'Revenue',
      sourceType: 'TransactionRefund',
      sourceId: String(refund.id),
      ref: `TX-${refund.transactionId}`,
      description: refund.reason?.trim() || 'Refund issued',
      amount: -Math.abs(amt),
      customer: refund.transaction.customers ?? null,
      productCode: refund.transaction.productCode ?? null,
      method: null,
    });
  }

  // Expenses: manual/approved expenses
  for (const exp of expenses) {
    const expenseAt = parseDate(exp.date);
    if (!isWithinDateRange(expenseAt, effectiveFrom, effectiveTo)) {
      continue;
    }

    const amt = Number.isFinite(exp.amount) ? exp.amount : 0;
    if (!Number.isFinite(amt) || amt === 0) {
      continue;
    }

    rows.push({
      id: `expense-${exp.id}`,
      date: (expenseAt ?? new Date()).toISOString(),
      category: exp.category,
      type: 'Expense',
      sourceType: 'Expense',
      sourceId: String(exp.id),
      ref: exp.sourceId ?? `EXP-${exp.id}`,
      description: exp.description,
      amount: Math.abs(amt),
      customer: exp.employeeName ?? null,
      productCode: null,
      method: exp.paymentMethod ?? null,
    });
  }

  // Expenses: COGS (from inventory movements)
  const { entries: cogsEntries } = await buildCogsAndInventoryEntries({
    from: effectiveFrom,
    to: effectiveTo,
    cogsDescriptionStyle: 'short',
  });

  for (const entry of cogsEntries) {
    if (entry.account !== 'COGS') {
      continue;
    }

    const amt = Number(entry.debit ?? 0) - Number(entry.credit ?? 0);
    if (!Number.isFinite(amt) || amt === 0) {
      continue;
    }

    rows.push({
      id: `cogs-${entry.id}`,
      date: entry.date,
      category: 'COGS',
      type: 'Expense',
      sourceType: 'InventoryMovement',
      sourceId: entry.id,
      ref: entry.ref,
      description: entry.description ?? 'COGS (inventory movements)',
      amount: amt,
      customer: null,
      productCode: null,
      method: null,
    });
  }

  rows.sort((a, b) => {
    // Newest-first (ISO timestamps compare correctly lexicographically).
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) {
      return byDate;
    }
    const byType = a.type.localeCompare(b.type);
    if (byType !== 0) {
      return byType;
    }
    const byCategory = a.category.localeCompare(b.category);
    if (byCategory !== 0) {
      return byCategory;
    }
    return a.id.localeCompare(b.id);
  });

  return ApiResponse.success({
    rows,
    period: buildPeriodLabel(from, to),
  });
});
