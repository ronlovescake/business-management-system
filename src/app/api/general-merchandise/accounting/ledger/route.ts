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
  fetchGeneralMerchandisePaidTransactions,
  fetchGeneralMerchandiseApprovedExpenses,
  fetchGeneralMerchandiseTransactionRefunds,
  fetchGeneralMerchandiseTransactionPayments,
  fetchGeneralMerchandiseManualJournalLines,
  getPaidAtDate,
  getCancelledAtDate,
  isWithinDateRange,
} from '@/lib/accounting/general-merchandise/data-fetchers';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import { buildCogsAndInventoryEntries } from '@/lib/accounting/general-merchandise/inventory-cogs';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Only show ledger activity from the accounting cutover date forward.
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

  const transactions = await fetchGeneralMerchandisePaidTransactions();
  const expenses = await fetchGeneralMerchandiseApprovedExpenses();
  const refunds = await fetchGeneralMerchandiseTransactionRefunds();
  const payments = await fetchGeneralMerchandiseTransactionPayments();
  const manualLines = await fetchGeneralMerchandiseManualJournalLines({
    from: effectiveFrom,
    to: effectiveTo,
  });

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
            where: { newStatus: { in: ['Cancelled', 'Forfeited'] } },
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

  const paymentTransactionIds = new Set(payments.map((p) => p.transactionId));

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
            gte: effectiveFrom,
            ...(effectiveTo ? { lte: effectiveTo } : {}),
          },
        },
        orderBy: { date: 'asc' },
      })) as Array<{
        id: string;
        date: Date;
        ref: string;
        account: string;
        debit: number;
        credit: number;
        description: string | null;
      }>)
    : [];

  const openingEntries = openingBalanceRows.map((entry) => ({
    id: entry.id,
    date: entry.date.toISOString(),
    ref: entry.ref,
    account: entry.account,
    debit: entry.debit,
    credit: entry.credit,
    description: entry.description ?? 'Opening balance',
  }));

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
            gte: effectiveFrom,
            ...(effectiveTo ? { lte: effectiveTo } : {}),
          },
        },
        orderBy: { postingDate: 'asc' },
      })) as Array<{
        id: string;
        amount: unknown;
        postingDate: Date;
        shipmentCode: string | null;
        productCode: string;
        toAccount: string;
        fromAccount: string;
      }>)
    : [];

  const reclassEntries = reclassRows
    .map((row) => {
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const dateStr = row.postingDate.toISOString();
      const ref = (row.shipmentCode ?? '').trim() || row.productCode;
      const description = `Inventory reclass • ${row.productCode}`;
      const idBase = `RC-${row.id}`;

      return [
        {
          id: `${idBase}-to`,
          date: dateStr,
          ref,
          account: row.toAccount,
          debit: Math.max(amount, 0),
          credit: 0,
          description,
        },
        {
          id: `${idBase}-from`,
          date: dateStr,
          ref,
          account: row.fromAccount,
          debit: 0,
          credit: Math.max(amount, 0),
          description,
        },
      ];
    })
    .flat()
    .filter(Boolean) as Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
  }>;

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
            gte: effectiveFrom,
            ...(effectiveTo ? { lte: effectiveTo } : {}),
          },
        },
        orderBy: { postingDate: 'asc' },
      })) as Array<{
        id: string;
        amount: unknown;
        postingDate: Date;
        shipmentCode: string | null;
        shipmentId: number | null;
        debitAccount: string;
        creditAccount: string;
      }>)
    : [];

  const transitBuildEntries = transitBuildRows
    .map((row) => {
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const dateStr = row.postingDate.toISOString();
      const ref = (row.shipmentCode ?? '').trim() || `SHIP-${row.shipmentId}`;
      const description = `Transit build-up • ${row.shipmentCode}`;
      const idBase = `TB-${row.id}`;

      return [
        {
          id: `${idBase}-debit`,
          date: dateStr,
          ref,
          account: row.debitAccount,
          debit: Math.max(amount, 0),
          credit: 0,
          description,
        },
        {
          id: `${idBase}-credit`,
          date: dateStr,
          ref,
          account: row.creditAccount,
          debit: 0,
          credit: Math.max(amount, 0),
          description,
        },
      ];
    })
    .flat()
    .filter(Boolean) as Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
  }>;

  // ============================================================================
  // ⚠️ CANCELLED STATUS FILTER (ACCOUNTING REVENUE)
  // ============================================================================
  // Only the explicit "Cancelled" order status is excluded from revenue entries.
  // This keeps accounting aligned with the transactions dropdown.
  // ============================================================================
  const paymentEntries = payments
    .map((payment) => {
      const isReservation =
        (payment as unknown as { isReservation?: boolean }).isReservation ===
        true;

      // For cancelled orders, only reservation/deposit payments are included.
      if (
        isCancelledOrderStatus(payment.transaction?.orderStatus) &&
        !isReservation
      ) {
        return null;
      }

      const paymentAt = parseDate(payment.paymentDate);
      if (!isWithinDateRange(paymentAt, effectiveFrom, effectiveTo)) {
        return null;
      }

      const amt = Number(payment.amount ?? 0);
      if (!Number.isFinite(amt) || amt <= 0) {
        return null;
      }

      const dateStr = (paymentAt ?? new Date()).toISOString();
      const idBase = `PM-${payment.id}`;
      const productRef = (payment.transaction?.productCode ?? '').trim();
      const ref = productRef || `TX-${payment.transactionId}`;
      const customer = (payment.transaction?.customers ?? '').trim();

      const method = (payment.method ?? '').trim();
      const notes = (payment.notes ?? '').trim();
      const suffix = [method, notes].filter(Boolean).join(' • ');
      const descriptionBase =
        customer || `Payment for TX-${payment.transactionId}`;
      const description = suffix
        ? `${descriptionBase} • ${suffix}`
        : descriptionBase;

      const creditAccount = isReservation
        ? 'Customer Deposits'
        : 'Sales Revenue';

      return [
        {
          id: `${idBase}-cash`,
          date: dateStr,
          ref,
          account: 'Cash',
          debit: Math.max(amt, 0),
          credit: 0,
          description,
        },
        {
          id: `${idBase}-credit`,
          date: dateStr,
          ref,
          account: creditAccount,
          debit: 0,
          credit: Math.max(amt, 0),
          description,
        },
      ];
    })
    .flat()
    .filter(Boolean) as Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
  }>;

  const legacyTxEntries = transactions
    .filter((tx) => !paymentTransactionIds.has(tx.id))
    .filter((tx) => !isCancelledOrderStatus(tx.orderStatus))
    .map((tx) => {
      const { paymentReceived } = normalizeTransactionAmountsForAccounting(tx);
      const amount = paymentReceived;

      const paidAt = getPaidAtDate(tx);
      if (!isWithinDateRange(paidAt, effectiveFrom, effectiveTo)) {
        return null;
      }

      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return null;
      }

      const dateStr = (paidAt ?? new Date()).toISOString();
      const productRef = (tx.productCode ?? '').trim();
      const ref = productRef || `TX-${tx.id}`;
      const idBase = `TX-${tx.id}`;
      const customer = (tx.customers ?? '').trim();

      return [
        {
          id: `${idBase}-cash`,
          date: dateStr,
          ref,
          account: 'Cash',
          debit: Math.max(amt, 0),
          credit: 0,
          description: customer || 'Unknown customer',
        },
        {
          id: `${idBase}-sales`,
          date: dateStr,
          ref,
          account: 'Sales Revenue',
          debit: 0,
          credit: Math.max(amt, 0),
          description: customer || 'Unknown customer',
        },
      ];
    })
    .flat()
    .filter(Boolean) as Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
  }>;

  const reservationReclassEntries = Array.from(
    new Set(reservationPayments.map((p) => p.transactionId))
  )
    .map((txId) => {
      const paidAt = paidAtByTxId.get(txId) ?? null;
      const cancelledAt = cancelledAtByTxId.get(txId) ?? null;
      const recognizeAt = cancelledAt ?? paidAt;
      if (!isWithinDateRange(recognizeAt, effectiveFrom, effectiveTo)) {
        return null;
      }

      const refPayment = reservationPayments.find(
        (p) => p.transactionId === txId
      );
      const customer = (refPayment?.transaction?.customers ?? '').trim();
      const productRef = (refPayment?.transaction?.productCode ?? '').trim();
      const ref = productRef || `TX-${txId}`;
      const dateStr = (recognizeAt ?? new Date()).toISOString();

      const depositTotal = reservationPayments
        .filter((p) => p.transactionId === txId)
        .reduce((sum, p) => {
          const paidAtPayment = parseDate(p.paymentDate);
          if (!paidAtPayment) {
            return sum;
          }
          if (recognizeAt && paidAtPayment > recognizeAt) {
            return sum;
          }
          const amt = Number(p.amount ?? 0);
          return Number.isFinite(amt) && amt > 0 ? sum + amt : sum;
        }, 0);

      if (!Number.isFinite(depositTotal) || depositTotal <= 0) {
        return null;
      }

      const targetCredit = cancelledAt ? 'Forfeited Deposits' : 'Sales Revenue';
      const description = cancelledAt
        ? `${customer || 'Unknown customer'} • Reservation fee forfeited`
        : `${customer || 'Unknown customer'} • Reservation fee recognized`;

      const idBase = cancelledAt
        ? `DEP-FORFEIT-TX-${txId}`
        : `DEP-REVENUE-TX-${txId}`;

      return [
        {
          id: `${idBase}-debit`,
          date: dateStr,
          ref,
          account: 'Customer Deposits',
          debit: Math.max(depositTotal, 0),
          credit: 0,
          description,
        },
        {
          id: `${idBase}-credit`,
          date: dateStr,
          ref,
          account: targetCredit,
          debit: 0,
          credit: Math.max(depositTotal, 0),
          description,
        },
      ];
    })
    .flat()
    .filter(Boolean) as Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
  }>;

  const expenseEntries = expenses
    .map((exp: (typeof expenses)[number]) => {
      const amount = Number(exp.amount ?? 0);
      if (!Number.isFinite(amount)) {
        return null;
      }

      const expDate = parseDate(exp.date);
      if (!isWithinDateRange(expDate, effectiveFrom, effectiveTo)) {
        return null;
      }

      const dateStr = (expDate ?? new Date()).toISOString();
      const ref = `EXP-${exp.id}`;

      return [
        {
          id: `${ref}-${exp.category}-debit`,
          date: dateStr,
          ref,
          account: exp.category,
          debit: Math.max(amount, 0),
          credit: 0,
          description: exp.description,
        },
        {
          id: `${ref}-${exp.category}-credit`,
          date: dateStr,
          ref,
          account: exp.paymentMethod ?? 'Cash',
          debit: 0,
          credit: Math.max(amount, 0),
          description: exp.description,
        },
      ];
    })
    .flat()
    .filter(Boolean) as Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
  }>;

  const refundEntries = refunds
    .map((refund) => {
      const amount = Number(refund.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const refundAt = parseDate(refund.refundDate);
      if (!isWithinDateRange(refundAt, effectiveFrom, effectiveTo)) {
        return null;
      }

      const dateStr = (refundAt ?? new Date()).toISOString();
      const ref = `RF-${refund.id}`;
      const description = refund.reason?.trim() || 'Refund issued';

      return [
        {
          id: `${ref}-refund`,
          date: dateStr,
          ref,
          account: 'Sales Returns',
          debit: Math.max(amount, 0),
          credit: 0,
          description,
        },
        {
          id: `${ref}-cash`,
          date: dateStr,
          ref,
          account: 'Cash',
          debit: 0,
          credit: Math.max(amount, 0),
          description,
        },
      ];
    })
    .flat()
    .filter(Boolean) as Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
  }>;

  const manualEntries = manualLines
    .map((line) => {
      const debit = Number(line.debit ?? 0);
      const credit = Number(line.credit ?? 0);

      if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
        return null;
      }

      if (debit === 0 && credit === 0) {
        return null;
      }

      return {
        id: line.id,
        date: line.date.toISOString(),
        ref: line.ref,
        account: line.account,
        debit,
        credit,
        description: line.description ?? '',
        sourceType: line.sourceType,
        sourceId: line.sourceId,
        sourceLineKey: line.sourceLineKey,
        systemGenerated: line.systemGenerated,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
    sourceType: string;
    sourceId: string | null;
    sourceLineKey: string;
    systemGenerated: boolean;
  }>;

  const { entries: cogsEntries } = await buildCogsAndInventoryEntries({
    from: effectiveFrom,
    to: effectiveTo,
    cogsDescriptionStyle: 'short',
  });

  // Derived inventory seed/shrink entries are intentionally excluded.
  // Inventory accounts should reflect explicit postings only.
  const seedEntries: Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
  }> = [];

  const allEntries = [
    ...openingEntries,
    ...paymentEntries,
    ...reservationReclassEntries,
    ...legacyTxEntries,
    ...expenseEntries,
    ...refundEntries,
    ...reclassEntries,
    ...transitBuildEntries,
    ...manualEntries,
    ...cogsEntries,
    ...seedEntries,
  ]
    .map((entry) => ({
      ...entry,
      account: normalizeAccountForReporting(entry.account),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return ApiResponse.success({
    entries: allEntries,
    period: buildPeriodLabel(effectiveFrom, effectiveTo),
    from: effectiveFrom.toISOString(),
    to: effectiveTo ? effectiveTo.toISOString() : null,
  });
});
