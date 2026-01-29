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
  fetchManualJournalLines,
  getPaidAtDate,
  getCancelledAtDate,
  isWithinDateRange,
} from '@/lib/accounting/data-fetchers';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import {
  buildCogsAndInventoryEntries,
  buildInventorySeedAndShrinkageEntries,
} from '@/lib/accounting/inventory-cogs';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';
import { prisma } from '@/lib/db';
import { isInTransitShipmentStatus } from '@/lib/inventory/shipment-status';

export const dynamic = 'force-dynamic';

// Only show ledger activity from the accounting cutover date forward.
const CUTOVER = getAccountingCutoverDate();
const IN_TRANSIT_ACCOUNT = 'Inventory in Transit';

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

  const transactions = await fetchPaidTransactions();
  const expenses = await fetchApprovedExpenses();
  const refunds = await fetchTransactionRefunds();
  const payments = await fetchTransactionPayments();
  const manualLines = await fetchManualJournalLines({
    from: effectiveFrom,
    to: effectiveTo,
  });

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

  const openingBalanceRows =
    await prisma.clothingAccountingOpeningBalance.findMany({
      where: {
        date: {
          gte: effectiveFrom,
          ...(effectiveTo ? { lte: effectiveTo } : {}),
        },
      },
      orderBy: { date: 'asc' },
    });

  const openingEntries = openingBalanceRows.map((entry) => ({
    id: entry.id,
    date: entry.date.toISOString(),
    ref: entry.ref,
    account: entry.account,
    debit: entry.debit,
    credit: entry.credit,
    description: entry.description ?? 'Opening balance',
  }));

  const reclassRows = await prisma.clothingInventoryReclassEntry.findMany({
    where: {
      deletedAt: null,
      postingDate: {
        gte: effectiveFrom,
        ...(effectiveTo ? { lte: effectiveTo } : {}),
      },
    },
    orderBy: { postingDate: 'asc' },
  });

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

  const transitBuildRows =
    await prisma.clothingInventoryTransitBuildEntry.findMany({
      where: {
        deletedAt: null,
        postingDate: {
          gte: effectiveFrom,
          ...(effectiveTo ? { lte: effectiveTo } : {}),
        },
      },
      orderBy: { postingDate: 'asc' },
    });

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

      if (isCancelledOrderStatus(payment.transaction?.orderStatus)) {
        // For cancelled orders, only reservation/deposit payments are included.
        if (!isReservation) {
          return null;
        }
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
      const ref = `TX-${payment.transactionId}`;
      const customer = (payment.transaction?.customers ?? '').trim();

      const method = (payment.method ?? '').trim();
      const notes = (payment.notes ?? '').trim();
      const suffix = [method, notes].filter(Boolean).join(' • ');
      const baseParts = [customer || `Payment for TX-${payment.transactionId}`];
      if (productRef) {
        baseParts.push(productRef);
      }
      const descriptionBase = baseParts.join(' • ');
      const description = suffix
        ? `${descriptionBase} • ${suffix}`
        : descriptionBase;

      const creditAccount = isReservation
        ? 'Customer Deposits'
        : 'Sales Revenue';

      const creditId = isReservation ? `${idBase}-deposits` : `${idBase}-sales`;

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
          id: creditId,
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

  // ============================================================================
  // ⚠️ CANCELLED STATUS FILTER (LEGACY PAID TRANSACTIONS)
  // ============================================================================
  // Legacy paid entries are excluded only when Order Status is explicitly "Cancelled".
  // ============================================================================
  const legacyTxEntries = transactions
    .filter((tx) => !paymentTransactionIds.has(tx.id))
    .map((tx) => {
      if (isCancelledOrderStatus(tx.orderStatus)) {
        return null;
      }

      const { paymentReceived } = normalizeTransactionAmountsForAccounting(tx);
      const amount = paymentReceived;

      const paidAt = getPaidAtDate(tx);
      if (!isWithinDateRange(paidAt, effectiveFrom, effectiveTo)) {
        return null;
      }

      const amt = Number(amount);
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

  const expenseEntries = expenses
    .map((exp) => {
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
          description: exp.description ?? exp.notes ?? 'Expense',
        },
        {
          id: `${ref}-cash-credit`,
          date: dateStr,
          ref,
          account: 'Cash',
          debit: 0,
          credit: Math.max(amount, 0),
          description: exp.description ?? exp.notes ?? 'Cash payment',
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
      const refundAt = parseDate(refund.refundDate);
      if (!isWithinDateRange(refundAt, effectiveFrom, effectiveTo)) {
        return null;
      }

      const amt = Number(refund.amount ?? 0);
      if (!Number.isFinite(amt) || amt <= 0) {
        return null;
      }

      const dateStr = (refundAt ?? new Date()).toISOString();
      const idBase = `RF-${refund.id}`;
      const productRef = (refund.transaction?.productCode ?? '').trim();
      const ref = productRef || idBase;
      const customer = (refund.transaction?.customers ?? '').trim();

      const reason = (refund.reason ?? '').trim();
      const notes = (refund.notes ?? '').trim();
      const suffix = [reason, notes].filter(Boolean).join(' • ');
      const descriptionBase =
        customer || `Refund for TX-${refund.transactionId}`;
      const description = suffix
        ? `${descriptionBase} • ${suffix}`
        : descriptionBase;

      return [
        {
          id: `${idBase}-sales-returns`,
          date: dateStr,
          ref,
          account: 'Sales Returns',
          debit: Math.max(amt, 0),
          credit: 0,
          description,
        },
        {
          id: `${idBase}-cash`,
          date: dateStr,
          ref,
          account: 'Cash',
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

  const { entries: cogsEntries } = await buildCogsAndInventoryEntries({
    from: effectiveFrom,
    to: effectiveTo,
  });

  const { entries: inventorySeedShrinkageEntries } =
    await buildInventorySeedAndShrinkageEntries({
      from: effectiveFrom,
      to: effectiveTo,
    });

  const manualEntries = manualLines.map((line) => ({
    id: line.id,
    date: line.date.toISOString(),
    ref: line.ref,
    account: line.account,
    debit: Number(line.debit ?? 0),
    credit: Number(line.credit ?? 0),
    description: line.description ?? '',
    sourceType: line.sourceType,
    sourceId: line.sourceId,
    sourceLineKey: line.sourceLineKey,
    systemGenerated: line.systemGenerated,
  }));

  // --------------------------------------------------------------------------
  // Inventory in Transit snapshot adjustment
  // --------------------------------------------------------------------------
  // Balance Sheet forces Inventory in Transit to match shipment-status valuation
  // (products marked in-transit). To keep Ledger aligned (when viewing from
  // cutover through an as-of date), we add a system-generated offset to Opening
  // Equity.
  // --------------------------------------------------------------------------
  const snapshotAdjustments: Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
    systemGenerated?: boolean;
  }> = [];

  const shouldApplySnapshotAdjustment =
    effectiveFrom.getTime() === CUTOVER.getTime() && !!effectiveTo;

  if (shouldApplySnapshotAdjustment) {
    const asOf = effectiveTo as Date;

    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      select: {
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
        ? await prisma.shipment.findMany({
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

    const inTransitProductTotal = products.reduce((sum, row) => {
      const shipmentCode = (row.shipmentCode ?? '').trim();
      if (!shipmentCode) {
        return sum;
      }

      const directStatus = row.shipmentStatus ?? '';
      const fallbackStatus = shipmentCode
        ? (shipmentStatusByCode.get(shipmentCode) ?? '')
        : '';
      const status = directStatus.trim() ? directStatus : fallbackStatus;
      if (!isInTransitShipmentStatus(status)) {
        return sum;
      }

      const cogs = Number(row.cogs ?? 0);
      if (!Number.isFinite(cogs) || cogs <= 0) {
        return sum;
      }

      return sum + cogs;
    }, 0);

    const currentInTransit = [
      ...openingEntries,
      ...reclassEntries,
      ...transitBuildEntries,
      ...paymentEntries,
      ...reservationReclassEntries,
      ...legacyTxEntries,
      ...refundEntries,
      ...expenseEntries,
      ...cogsEntries,
      ...inventorySeedShrinkageEntries,
      ...manualEntries,
    ].reduce((sum, entry) => {
      const account = normalizeAccountForReporting(entry.account).trim();
      if (account !== IN_TRANSIT_ACCOUNT) {
        return sum;
      }
      return sum + (Number(entry.debit ?? 0) - Number(entry.credit ?? 0));
    }, 0);

    const delta = inTransitProductTotal - currentInTransit;
    if (Number.isFinite(delta) && Math.abs(delta) > 0.01) {
      const dateStr = asOf.toISOString();
      const ref = 'INV-TRANSIT-STATUS-ADJ';
      const description =
        'Inventory in Transit adjustment (shipment status snapshot)';
      const idBase = `INV-TRANSIT-STATUS-ADJ-${asOf.toISOString().slice(0, 10)}`;

      if (delta > 0) {
        snapshotAdjustments.push(
          {
            id: `${idBase}-inv-debit`,
            date: dateStr,
            ref,
            account: IN_TRANSIT_ACCOUNT,
            debit: delta,
            credit: 0,
            description,
            systemGenerated: true,
          },
          {
            id: `${idBase}-equity-credit`,
            date: dateStr,
            ref,
            account: 'Opening Equity',
            debit: 0,
            credit: delta,
            description,
            systemGenerated: true,
          }
        );
      } else {
        const abs = Math.abs(delta);
        snapshotAdjustments.push(
          {
            id: `${idBase}-equity-debit`,
            date: dateStr,
            ref,
            account: 'Opening Equity',
            debit: abs,
            credit: 0,
            description,
            systemGenerated: true,
          },
          {
            id: `${idBase}-inv-credit`,
            date: dateStr,
            ref,
            account: IN_TRANSIT_ACCOUNT,
            debit: 0,
            credit: abs,
            description,
            systemGenerated: true,
          }
        );
      }
    }
  }

  const entries = [
    ...openingEntries,
    ...reclassEntries,
    ...transitBuildEntries,
    ...paymentEntries,
    ...reservationReclassEntries,
    ...legacyTxEntries,
    ...refundEntries,
    ...expenseEntries,
    ...cogsEntries,
    ...inventorySeedShrinkageEntries,
    ...snapshotAdjustments,
    ...manualEntries,
  ];

  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    account: normalizeAccountForReporting(entry.account),
  }));

  const sortedByDate = normalizedEntries.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const balances = new Map<string, number>();
  const entriesWithBalances = sortedByDate.map((entry) => {
    const current = balances.get(entry.account) ?? 0;
    const next = current + entry.debit - entry.credit;
    balances.set(entry.account, next);
    return { ...entry, balance: next };
  });

  const totalDebits = normalizedEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredits = normalizedEntries.reduce((sum, e) => sum + e.credit, 0);
  const accounts = new Set(normalizedEntries.map((e) => e.account)).size;

  const stats = {
    totalDebits,
    totalCredits,
    netChange: totalDebits - totalCredits,
    accounts,
    period: buildPeriodLabel(from, to),
  };

  return ApiResponse.success({ entries: entriesWithBalances, stats });
});
