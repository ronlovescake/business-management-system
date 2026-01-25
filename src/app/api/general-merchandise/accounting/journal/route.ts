import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import {
  parseDateRangeFromParams,
  buildPeriodLabel,
  parseDate,
} from '@/lib/accounting/date-utils';
import {
  fetchGeneralMerchandisePaidTransactions,
  fetchGeneralMerchandiseApprovedExpenses,
  fetchGeneralMerchandiseTransactionRefunds,
  fetchGeneralMerchandiseTransactionPayments,
  fetchGeneralMerchandiseManualJournalLines,
  getPaidAtDate,
  isWithinDateRange,
} from '@/lib/accounting/general-merchandise/data-fetchers';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import {
  buildCogsAndInventoryEntries,
  buildInventorySeedAndShrinkageEntries,
} from '@/lib/accounting/general-merchandise/inventory-cogs';
import { prisma } from '@/lib/db';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';

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

  const transactions = await fetchGeneralMerchandisePaidTransactions();
  const payments = await fetchGeneralMerchandiseTransactionPayments();
  const expenses = await fetchGeneralMerchandiseApprovedExpenses();
  const refunds = await fetchGeneralMerchandiseTransactionRefunds();
  const manualLines = await fetchGeneralMerchandiseManualJournalLines({
    from: effectiveFrom,
    to: effectiveTo,
  });

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

  const manualEntries = manualLines.flatMap((line) => {
    if (!Number.isFinite(line.debit) && !Number.isFinite(line.credit)) {
      return [];
    }

    const amount = Number.isFinite(line.debit)
      ? Math.max(line.debit, 0)
      : -Math.max(line.credit, 0);

    if (!Number.isFinite(amount) || amount === 0) {
      return [];
    }

    return [
      {
        id: line.id,
        date: line.date.toISOString(),
        ref: line.ref,
        account: line.account,
        debit: line.debit,
        credit: line.credit,
        description: line.description ?? '',
      },
    ];
  });

  const { entries: inventoryEntries } = await buildCogsAndInventoryEntries({
    from: effectiveFrom,
    to: effectiveTo,
  });

  const { entries: seedEntries } = await buildInventorySeedAndShrinkageEntries({
    from: effectiveFrom,
    to: effectiveTo,
  });

  const allEntries = [
    ...paymentEntries,
    ...legacyTxEntries,
    ...expenseEntries,
    ...refundEntries,
    ...reclassEntries,
    ...transitBuildEntries,
    ...manualEntries,
    ...inventoryEntries,
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
