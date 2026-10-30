import { prisma } from '@/lib/db';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';
import { PAID_STATUSES } from '@/lib/accounting/constants';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import {
  fetchApprovedExpenses,
  fetchManualJournalLines,
  fetchRecognizedTransactions,
  fetchTransactionPayments,
  fetchTransactionRefunds,
  getPaidAtDate,
  isWithinDateRange,
} from '@/lib/accounting/data-fetchers';
import { parseDate } from '@/lib/accounting/date-utils';
import { getExpenseCreditAccount } from '@/lib/accounting/payment-accounts';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import {
  getAccountsReceivableRecognitionDate,
  getTransactionPaymentDebitAccount,
  hasAccountsReceivableShipment,
} from '@/lib/accounting/transaction-recognition';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';

const EPS = 0.01;

export async function reconcileClothingCash(actualCashAmount: number | null) {
  const cutover = await getRuntimeAccountingCutoverDate();
  const asOf = new Date();

  const openingModel = Reflect.get(
    prisma,
    'clothingAccountingOpeningBalance'
  ) as
    | {
        findMany?: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      }
    | undefined;
  const cancellationModel = Reflect.get(prisma, 'clothingOrderCancellation') as
    | {
        findMany?: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      }
    | undefined;

  const [
    transactions,
    payments,
    expenses,
    refunds,
    manualLines,
    openingBalanceRows,
    recurringTemplates,
    pendingCancellations,
    recentTransactions,
  ] = await Promise.all([
    fetchRecognizedTransactions(),
    fetchTransactionPayments(),
    fetchApprovedExpenses(),
    fetchTransactionRefunds(),
    fetchManualJournalLines({ from: cutover, to: asOf }),
    openingModel?.findMany
      ? openingModel.findMany({
          where: {
            deletedAt: null,
            date: { gte: cutover, lte: asOf },
          },
          orderBy: { date: 'asc' },
        })
      : Promise.resolve([]),
    prisma.clothingRecurringPaymentTemplate.findMany({
      where: { isActive: true },
      include: {
        drafts: {
          where: { status: 'DRAFT' },
          orderBy: { dueDate: 'asc' },
        },
      },
      orderBy: { nextDueDate: 'asc' },
    }),
    cancellationModel?.findMany
      ? cancellationModel.findMany({
          where: { pendingAmount: { gt: 0 } },
          include: {
            transaction: {
              select: {
                id: true,
                customers: true,
                productCode: true,
                orderStatus: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 25,
        })
      : Promise.resolve([]),
    prisma.transaction.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'desc' },
      take: 400,
    }),
  ]);

  // 1. Opening Balances mapped to Cash
  let openingCashEquivalents = 0;
  let openingPhysicalCashOnly = 0;
  const openingBreakdown: Array<{
    account: string;
    ref: string;
    description: string | null;
    amount: number;
  }> = [];

  for (const entry of openingBalanceRows) {
    const account = String(entry.account ?? '').trim();
    const amount = Number(entry.debit ?? 0) - Number(entry.credit ?? 0);
    if (!account || !Number.isFinite(amount) || Math.abs(amount) < EPS) {
      continue;
    }
    if (normalizeAccountForReporting(account) === 'Cash') {
      openingCashEquivalents += amount;
      if (account.toLowerCase() === 'cash') {
        openingPhysicalCashOnly += amount;
      }
      openingBreakdown.push({
        account,
        ref: String(entry.ref ?? ''),
        description: (entry.description as string | null) ?? null,
        amount: Number(amount.toFixed(2)),
      });
    }
  }

  // 2. Customer Payments (TransactionPayment rows)
  const paymentTotalsByTxId = new Map<number, number>();
  const paymentTotalsAllByTxId = new Map<number, number>();
  const earliestPaymentAtByTxId = new Map<number, Date>();
  const earliestIncludedPaymentAtByTxId = new Map<number, Date>();
  const cardTotalsByTxId = new Map<number, number>();
  const cardReservationTotalsByTxId = new Map<number, number>();
  const paymentEventTxIds = new Set<number>();
  const recordedPaymentTxIds = new Set<number>();
  const recordedNonReservationPaymentTxIds = new Set<number>();
  const paymentsByTxId = new Map<
    number,
    Array<{
      id: number;
      amount: number;
      paymentDate: string;
      method: string | null;
      isReservation: boolean;
      createdAt: string;
    }>
  >();

  let customerPaymentsCashEquivalents = 0;
  let customerPaymentsPhysicalCashOnly = 0;
  const paymentsByMethod: Record<string, number> = {};

  for (const payment of payments) {
    const isReservation = Boolean(payment.isReservation);
    const amt = Number(payment.amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      continue;
    }

    const list = paymentsByTxId.get(payment.transactionId) ?? [];
    list.push({
      id: payment.id,
      amount: amt,
      paymentDate: payment.paymentDate,
      method: payment.method,
      isReservation,
      createdAt:
        payment.createdAt instanceof Date
          ? payment.createdAt.toISOString()
          : String(payment.createdAt ?? ''),
    });
    paymentsByTxId.set(payment.transactionId, list);

    recordedPaymentTxIds.add(payment.transactionId);
    if (!isReservation) {
      recordedNonReservationPaymentTxIds.add(payment.transactionId);
    }

    const paymentAt = parseDate(payment.paymentDate);
    if (!isWithinDateRange(paymentAt, cutover, asOf)) {
      continue;
    }

    paymentEventTxIds.add(payment.transactionId);
    const debitAccount = getTransactionPaymentDebitAccount(payment);
    const methodKey = (payment.method ?? 'CASH').trim().toUpperCase() || 'CASH';
    paymentsByMethod[methodKey] = Number(
      ((paymentsByMethod[methodKey] ?? 0) + amt).toFixed(2)
    );

    if (normalizeAccountForReporting(debitAccount) === 'Cash') {
      customerPaymentsCashEquivalents += amt;
      if (debitAccount === 'Cash') {
        customerPaymentsPhysicalCashOnly += amt;
      }
    }

    if (debitAccount === 'Card Collections Clearing') {
      cardTotalsByTxId.set(
        payment.transactionId,
        (cardTotalsByTxId.get(payment.transactionId) ?? 0) + amt
      );
      if (isReservation) {
        cardReservationTotalsByTxId.set(
          payment.transactionId,
          (cardReservationTotalsByTxId.get(payment.transactionId) ?? 0) + amt
        );
      }
    }

    paymentTotalsAllByTxId.set(
      payment.transactionId,
      (paymentTotalsAllByTxId.get(payment.transactionId) ?? 0) + amt
    );
    const existingEarliestIncluded = earliestIncludedPaymentAtByTxId.get(
      payment.transactionId
    );
    if (
      paymentAt &&
      (!existingEarliestIncluded || paymentAt < existingEarliestIncluded)
    ) {
      earliestIncludedPaymentAtByTxId.set(payment.transactionId, paymentAt);
    }

    if (!isReservation) {
      paymentTotalsByTxId.set(
        payment.transactionId,
        (paymentTotalsByTxId.get(payment.transactionId) ?? 0) + amt
      );
      const existingEarliest = earliestPaymentAtByTxId.get(
        payment.transactionId
      );
      if (paymentAt && (!existingEarliest || paymentAt < existingEarliest)) {
        earliestPaymentAtByTxId.set(payment.transactionId, paymentAt);
      }
    }
  }

  // 3. Legacy unitemized adjustments on recognized transactions without TransactionPayment rows
  let legacyAdjustmentsCash = 0;
  const isPaidStatus = (status: string | null | undefined) =>
    (PAID_STATUSES as readonly string[]).includes((status ?? '').trim());

  for (const tx of transactions) {
    if (recordedPaymentTxIds.has(tx.id)) {
      continue;
    }
    const normalized = normalizeTransactionAmountsForAccounting(tx);
    const hasArLifecycle = hasAccountsReceivableShipment(tx);
    const receivableAt = hasArLifecycle
      ? getAccountsReceivableRecognitionDate(tx)
      : null;
    const recognizesReceivable = Boolean(
      receivableAt && isWithinDateRange(receivableAt, cutover, asOf)
    );
    const paidAt = isPaidStatus(tx.orderStatus) ? getPaidAtDate(tx) : null;
    const recognizesPaidStatus = Boolean(
      paidAt && isWithinDateRange(paidAt, cutover, asOf)
    );
    const usePaymentEvents =
      paymentEventTxIds.has(tx.id) ||
      recordedNonReservationPaymentTxIds.has(tx.id);
    const paymentReceived = usePaymentEvents
      ? Math.max(paymentTotalsByTxId.get(tx.id) ?? 0, 0)
      : Number(normalized.paymentReceived ?? 0);
    const paymentReceivedAll = usePaymentEvents
      ? Math.max(paymentTotalsAllByTxId.get(tx.id) ?? 0, 0)
      : paymentReceived;
    const includeRecognizedDeposits =
      recognizesPaidStatus || recognizesReceivable;
    const resolvedPaymentReceived = includeRecognizedDeposits
      ? paymentReceivedAll
      : paymentReceived;

    const recognizedAt = recognizesReceivable
      ? receivableAt
      : isPaidStatus(tx.orderStatus)
        ? getPaidAtDate(tx)
        : (earliestPaymentAtByTxId.get(tx.id) ??
          parseDate(tx.orderDate) ??
          null);

    if (!isWithinDateRange(recognizedAt, cutover, asOf)) {
      continue;
    }

    const receipts = Math.max(Number(resolvedPaymentReceived) || 0, 0);
    const cardCollections = Math.max(
      (cardTotalsByTxId.get(tx.id) ?? 0) -
        (includeRecognizedDeposits
          ? 0
          : (cardReservationTotalsByTxId.get(tx.id) ?? 0)),
      0
    );
    const cash = Math.max(receipts - cardCollections, 0);
    if (cash > 0) {
      legacyAdjustmentsCash += cash;
    }
  }

  // 4. Paid Expenses & Approved-but-Unpaid Expenses
  let paidExpensesCashEquivalents = 0;
  let paidExpensesPhysicalCashOnly = 0;
  const approvedUnpaidExpenses: Array<{
    id: number;
    date: string;
    category: string;
    description: string;
    amount: number;
    paymentMethod: string | null;
  }> = [];

  for (const exp of expenses) {
    const amount = Math.max(Number(exp.amount ?? 0), 0);
    const expDate = parseDate(exp.date);
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    if (exp.status.trim().toLowerCase() === 'approved') {
      approvedUnpaidExpenses.push({
        id: exp.id,
        date: exp.date,
        category: exp.category,
        description: exp.description,
        amount: Number(amount.toFixed(2)),
        paymentMethod: exp.paymentMethod ?? null,
      });
    }
    if (!isWithinDateRange(expDate, cutover, asOf)) {
      continue;
    }
    const creditAccount = getExpenseCreditAccount(exp);
    if (normalizeAccountForReporting(creditAccount) === 'Cash') {
      paidExpensesCashEquivalents += amount;
      if (creditAccount === 'Cash') {
        paidExpensesPhysicalCashOnly += amount;
      }
    }
  }

  // 5. Refunds Paid Out of Cash
  let refundsPaidCash = 0;
  for (const refund of refunds) {
    const refundAt = parseDate(refund.refundDate);
    if (!isWithinDateRange(refundAt, cutover, asOf)) {
      continue;
    }
    const amt = Number(refund.amount ?? 0);
    if (Number.isFinite(amt) && amt > 0) {
      refundsPaidCash += amt;
    }
  }

  // 6. Manual Journal Lines affecting Cash/Bank/GCash
  let manualJournalNetCashEquivalents = 0;
  let manualJournalNetPhysicalCashOnly = 0;
  const manualCashLines: Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    netCashImpact: number;
    description: string | null;
  }> = [];

  for (const line of manualLines) {
    const account = line.account.trim();
    const net = Number(line.debit ?? 0) - Number(line.credit ?? 0);
    if (!account || !Number.isFinite(net) || Math.abs(net) < EPS) {
      continue;
    }
    if (normalizeAccountForReporting(account) === 'Cash') {
      manualJournalNetCashEquivalents += net;
      if (account.toLowerCase() === 'cash') {
        manualJournalNetPhysicalCashOnly += net;
      }
      manualCashLines.push({
        id: line.id,
        date:
          line.date instanceof Date
            ? line.date.toISOString().slice(0, 10)
            : String(line.date),
        ref: line.ref,
        account,
        debit: Number(line.debit ?? 0),
        credit: Number(line.credit ?? 0),
        netCashImpact: Number(net.toFixed(2)),
        description: line.description,
      });
    }
  }

  const recordedBookCashEquivalents = Number(
    (
      openingCashEquivalents +
      customerPaymentsCashEquivalents +
      legacyAdjustmentsCash -
      paidExpensesCashEquivalents -
      refundsPaidCash +
      manualJournalNetCashEquivalents
    ).toFixed(2)
  );

  const recordedPhysicalCashOnly = Number(
    (
      openingPhysicalCashOnly +
      customerPaymentsPhysicalCashOnly +
      legacyAdjustmentsCash -
      paidExpensesPhysicalCashOnly -
      refundsPaidCash +
      manualJournalNetPhysicalCashOnly
    ).toFixed(2)
  );

  const varianceVsBookCashEquivalents =
    actualCashAmount !== null
      ? Number((actualCashAmount - recordedBookCashEquivalents).toFixed(2))
      : null;
  const varianceVsPhysicalCashOnly =
    actualCashAmount !== null
      ? Number((actualCashAmount - recordedPhysicalCashOnly).toFixed(2))
      : null;

  // 7. Scan for Duplicate Payments, Overpaid Orders & Formula Mismatches
  const duplicateOrOverpaidOrders: Array<Record<string, unknown>> = [];
  for (const tx of recentTransactions) {
    const qty = Number(tx.quantity ?? 0);
    const price = Number(tx.unitPrice ?? 0);
    const gross = Number((qty * price).toFixed(2));
    const adj = Number(tx.adjustment ?? 0);
    const lineTotal = Number(tx.lineTotal ?? 0);
    const expectedLineTotal = Number((gross - adj).toFixed(2));
    const status = (tx.orderStatus ?? '').trim();
    const closed = isCancelledOrderStatus(status);
    const txPayments = paymentsByTxId.get(tx.id) ?? [];
    const sumPayments = Number(
      txPayments.reduce((s, p) => s + p.amount, 0).toFixed(2)
    );

    // Check for duplicate payment rows on the same order (same amount recorded twice)
    const duplicatePayments: Array<Record<string, unknown>> = [];
    for (let i = 0; i < txPayments.length; i += 1) {
      for (let j = i + 1; j < txPayments.length; j += 1) {
        if (
          Math.abs(txPayments[i].amount - txPayments[j].amount) <= EPS &&
          txPayments[i].paymentDate === txPayments[j].paymentDate
        ) {
          duplicatePayments.push({
            firstPaymentId: txPayments[i].id,
            secondPaymentId: txPayments[j].id,
            amountEach: txPayments[i].amount,
            paymentDate: txPayments[i].paymentDate,
            method: txPayments[i].method,
          });
        }
      }
    }

    const isOverpaid = !closed && (lineTotal < -EPS || adj - gross > EPS);
    const hasClosedResidual = closed && Math.abs(lineTotal) > EPS;
    const hasFormulaMismatch =
      !closed && Math.abs(lineTotal - expectedLineTotal) > EPS;

    if (
      isOverpaid ||
      hasClosedResidual ||
      hasFormulaMismatch ||
      duplicatePayments.length > 0
    ) {
      duplicateOrOverpaidOrders.push({
        transactionId: tx.id,
        customer: tx.customers ?? 'Unknown',
        productCode: tx.productCode ?? '',
        orderDate: tx.orderDate ?? '',
        orderStatus: status,
        grossSale: gross,
        recordedAdjustment: adj,
        recordedPaymentsSum: sumPayments,
        lineTotal,
        overpaymentOrDiscrepancyAmount: isOverpaid
          ? Number((adj - gross).toFixed(2))
          : lineTotal,
        duplicatePayments,
        explanation: isOverpaid
          ? `Order #${tx.id} (${tx.customers ?? 'Unknown'}) has grossSale ₱${gross.toFixed(2)} but recorded payments/adjustment of ₱${adj.toFixed(2)} (lineTotal ₱${lineTotal.toFixed(2)}), inflating recorded book cash by ₱${(adj - gross).toFixed(2)}.`
          : hasClosedResidual
            ? `Closed order #${tx.id} (${status}) still carries a non-zero lineTotal of ₱${lineTotal.toFixed(2)}.`
            : `Order #${tx.id} has a formula mismatch or duplicate payment entry on the same date.`,
        sourceLink: '/clothing/operations/transactions',
      });
    }
  }

  // 8. Exact or Near-Exact Variance Matches (if actualCashAmount was provided)
  const exactOrNearVarianceMatches: Array<Record<string, unknown>> = [];
  if (varianceVsBookCashEquivalents !== null) {
    const targetAbs = Math.abs(varianceVsBookCashEquivalents);
    const halfTargetAbs = Number((targetAbs / 2).toFixed(2));
    const tolerance = Math.max(5, Number((targetAbs * 0.005).toFixed(2)));

    if (targetAbs > EPS) {
      for (const p of payments.slice(-150)) {
        const amt = Number(p.amount ?? 0);
        if (
          Math.abs(amt - targetAbs) <= tolerance ||
          Math.abs(amt - halfTargetAbs) <= tolerance
        ) {
          exactOrNearVarianceMatches.push({
            type: 'TRANSACTION_PAYMENT',
            paymentId: p.id,
            transactionId: p.transactionId,
            customer: p.transaction?.customers ?? 'Unknown',
            amount: amt,
            paymentDate: p.paymentDate,
            method: p.method,
            matchNote:
              Math.abs(amt - targetAbs) <= tolerance
                ? 'Matches the cash variance amount'
                : 'Matches half of the cash variance (possible double-counted or reversed entry)',
          });
        }
      }

      for (const line of manualCashLines) {
        const amt = Math.abs(line.netCashImpact);
        if (
          Math.abs(amt - targetAbs) <= tolerance ||
          Math.abs(amt - halfTargetAbs) <= tolerance
        ) {
          exactOrNearVarianceMatches.push({
            type: 'MANUAL_JOURNAL_LINE',
            lineId: line.id,
            ref: line.ref,
            account: line.account,
            netCashImpact: line.netCashImpact,
            date: line.date,
            description: line.description,
          });
        }
      }
    }
  }

  return {
    businessUnit: 'clothing',
    asOf: asOf.toISOString(),
    cutoverDate: cutover.toISOString().slice(0, 10),
    recordedBookCashEquivalents,
    recordedPhysicalCashOnly,
    actualCashAmount,
    varianceVsBookCashEquivalents,
    varianceVsPhysicalCashOnly,
    cashComponentsBreakdown: {
      openingCashEquivalents: Number(openingCashEquivalents.toFixed(2)),
      openingBreakdown,
      customerPaymentsCashEquivalents: Number(
        customerPaymentsCashEquivalents.toFixed(2)
      ),
      paymentsByMethod,
      legacyAdjustmentsCash: Number(legacyAdjustmentsCash.toFixed(2)),
      paidExpensesOutflow: Number(paidExpensesCashEquivalents.toFixed(2)),
      refundsPaidOutflow: Number(refundsPaidCash.toFixed(2)),
      manualJournalNetCash: Number(manualJournalNetCashEquivalents.toFixed(2)),
      recentManualCashLines: manualCashLines.slice(-5),
    },
    potentialCulprits: {
      duplicateOrOverpaidOrders: duplicateOrOverpaidOrders.slice(0, 5),
      unpostedRecurringObligations: recurringTemplates.slice(0, 5).map((t) => ({
        templateId: t.id,
        name: t.name,
        kind: t.kind,
        amount: t.amount,
        frequency: t.frequency,
        nextDueDate: t.nextDueDate.toISOString().slice(0, 10),
        pendingDraftsCount: t.drafts.length,
        pendingDrafts: t.drafts.slice(0, 3).map((d) => ({
          draftId: d.id,
          dueDate: d.dueDate.toISOString().slice(0, 10),
          amount: d.amount,
          status: d.status,
        })),
      })),
      pendingCancellationRefunds: pendingCancellations.slice(0, 5).map((c) => {
        const tx = c.transaction as
          | {
              id?: number;
              customers?: string | null;
              productCode?: string | null;
            }
          | undefined;
        return {
          cancellationId: String(c.id ?? ''),
          transactionId: Number(c.transactionId ?? tx?.id ?? 0),
          customer: tx?.customers ?? 'Unknown',
          productCode: tx?.productCode ?? '',
          decisionDate: String(c.decisionDate ?? ''),
          approvedRefundAmount: Number(c.approvedRefundAmount ?? 0),
          pendingAmount: Number(c.pendingAmount ?? 0),
        };
      }),
      approvedButUnpaidExpenses: approvedUnpaidExpenses.slice(0, 5),
      exactOrNearVarianceMatches: exactOrNearVarianceMatches.slice(0, 5),
    },
    sourceLink: '/clothing/accounting',
  };
}
