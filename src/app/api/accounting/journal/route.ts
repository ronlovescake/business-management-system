import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import {
  parseDateRangeFromParams,
  buildPeriodLabel,
  parseDate,
} from '@/lib/accounting/date-utils';
import {
  fetchPaidTransactions,
  fetchApprovedExpenses,
  fetchTransactionRefunds,
  fetchTransactionPayments,
  getPaidAtDate,
  isWithinDateRange,
} from '@/lib/accounting/data-fetchers';
import { normalizeTransactionAmounts } from '@/lib/accounting/transaction-normalization';
import {
  buildCogsAndInventoryEntries,
  buildInventorySeedAndShrinkageEntries,
} from '@/lib/accounting/inventory-cogs';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CUTOVER = new Date(Date.UTC(2026, 0, 1));

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
  const payments = await fetchTransactionPayments();
  const expenses = await fetchApprovedExpenses();
  const refunds = await fetchTransactionRefunds();

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

  const paymentTransactionIds = new Set(payments.map((p) => p.transactionId));

  const paymentEntries = payments
    .map((payment) => {
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
          id: `${idBase}-sales`,
          date: dateStr,
          ref,
          account: 'Sales Revenue',
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
    .map((tx) => {
      const { paymentReceived } = normalizeTransactionAmounts(tx);
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

  const { entries: cogsEntries } = await buildCogsAndInventoryEntries({
    from: effectiveFrom,
    to: effectiveTo,
  });

  const { entries: inventorySeedShrinkageEntries } =
    await buildInventorySeedAndShrinkageEntries({
      from: effectiveFrom,
      to: effectiveTo,
    });

  const entries = [
    ...reclassEntries,
    ...transitBuildEntries,
    ...paymentEntries,
    ...legacyTxEntries,
    ...refundEntries,
    ...expenseEntries,
    ...cogsEntries,
    ...inventorySeedShrinkageEntries,
  ];

  const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
  const netChange = totalDebits - totalCredits;

  const now = new Date();
  const entriesThisMonth = entries.filter((e) => {
    const d = parseDate(e.date);
    return (
      d &&
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth()
    );
  }).length;

  const stats = {
    totalDebits,
    totalCredits,
    netChange,
    entriesThisMonth,
    period: buildPeriodLabel(from, to),
  };

  const sortedEntries = entries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return ApiResponse.success({ entries: sortedEntries, stats });
});
