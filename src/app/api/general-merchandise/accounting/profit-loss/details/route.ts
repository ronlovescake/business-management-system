import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import {
  buildPeriodLabel,
  parseDate,
  parseDateRangeFromParams,
} from '@/lib/accounting/date-utils';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import {
  fetchGeneralMerchandiseApprovedExpenses,
  fetchGeneralMerchandisePaidTransactions,
  fetchGeneralMerchandiseTransactionPayments,
  fetchGeneralMerchandiseTransactionRefunds,
  getPaidAtDate,
  getCancelledAtDate,
  isWithinDateRange,
} from '@/lib/accounting/general-merchandise/data-fetchers';
import {
  buildCogsAndInventoryEntries,
  buildInventorySeedAndShrinkageEntries,
} from '@/lib/accounting/general-merchandise/inventory-cogs';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CUTOVER = getAccountingCutoverDate();

function clampFrom(from: Date | null): Date {
  if (!from) {
    return CUTOVER;
  }
  return from < CUTOVER ? CUTOVER : from;
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
  const { from, to } = parseDateRangeFromParams(req.nextUrl.searchParams);
  const effectiveFrom = clampFrom(from);
  const effectiveTo = to ?? null;

  const [transactions, expenses, refunds, payments] = await Promise.all([
    fetchGeneralMerchandisePaidTransactions(),
    fetchGeneralMerchandiseApprovedExpenses(),
    fetchGeneralMerchandiseTransactionRefunds(),
    fetchGeneralMerchandiseTransactionPayments(),
  ]);

  const rows: ProfitLossDetailRow[] = [];

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
        .filter((p) => isCancelledOrderStatus(p.transaction?.orderStatus))
        .map((p) => p.transactionId)
    )
  );

  const cancelledAtByTxId = new Map<number, Date | null>();
  if (cancelledReservationTxIds.length > 0) {
    const cancelledTxRows = await prisma.generalMerchandiseTransaction.findMany(
      {
        where: {
          id: { in: cancelledReservationTxIds },
          deletedAt: null,
        },
        select: {
          id: true,
          updatedAt: true,
          statusChanges: {
            where: { newStatus: { equals: 'Cancelled' } },
            orderBy: { changedAt: 'asc' },
            select: { newStatus: true, changedAt: true },
          },
        },
      }
    );

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
  const paymentTransactionIds = new Set(
    payments.map((p: (typeof payments)[number]) => p.transactionId)
  );

  for (const payment of payments) {
    const isReservation =
      (payment as unknown as { isReservation?: boolean }).isReservation ===
      true;

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
        ? 'Reservation fee forfeited (Cancelled)'
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

  // Inventory/COGS derived entries
  const [{ entries: cogsEntries }, { entries: seedEntries }] =
    await Promise.all([
      buildCogsAndInventoryEntries({ from: effectiveFrom, to: effectiveTo }),
      buildInventorySeedAndShrinkageEntries({
        from: effectiveFrom,
        to: effectiveTo,
      }),
    ]);

  for (const entry of cogsEntries) {
    rows.push({
      id: entry.id,
      date: entry.date,
      category: entry.account,
      type: 'Expense',
      sourceType: 'InventoryCOGS',
      sourceId: entry.ref,
      ref: entry.ref,
      description: entry.description,
      amount: entry.debit - entry.credit,
      customer: null,
      productCode: null,
      method: null,
    });
  }

  for (const entry of seedEntries) {
    rows.push({
      id: entry.id,
      date: entry.date,
      category: entry.account,
      type: 'Expense',
      sourceType: 'InventorySeed',
      sourceId: entry.ref,
      ref: entry.ref,
      description: entry.description,
      amount: entry.debit - entry.credit,
      customer: null,
      productCode: null,
      method: null,
    });
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return ApiResponse.success({
    rows,
    period: buildPeriodLabel(effectiveFrom, effectiveTo),
    from: effectiveFrom.toISOString(),
    to: effectiveTo ? effectiveTo.toISOString() : null,
  });
});
