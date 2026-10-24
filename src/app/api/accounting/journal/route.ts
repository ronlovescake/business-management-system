import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import {
  parseDateRangeFromParams,
  buildPeriodLabel,
  parseDate,
} from '@/lib/accounting/date-utils';
import {
  fetchAccountsReceivableTransactions,
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
import { getExpenseCreditAccount } from '@/lib/accounting/payment-accounts';
import {
  buildAccountsReceivableShipmentEntries,
  getAccountsReceivableRecognitionDate,
  getReservationDepositRecognitionCreditAccount,
  getTransactionRefundDebitAccount,
  getTransactionRefundDescription,
  getTransactionPaymentCreditAccount,
  getTransactionPaymentDebitAccount,
} from '@/lib/accounting/transaction-recognition';
import {
  buildCogsAndInventoryEntries,
  buildInventorySeedAndShrinkageEntries,
} from '@/lib/accounting/inventory-cogs';
import { prisma } from '@/lib/db';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';
import {
  isCancelledOrderStatus,
  isDepositForfeitureOrderStatus,
} from '@/lib/transactions/order-status';
import {
  getObjectField,
  isReservationPayment,
} from '@/app/api/_shared/castUtils';

export const dynamic = 'force-dynamic';

function clampFrom(from: Date | null, cutover: Date): Date {
  if (!from) {
    return cutover;
  }
  return from < cutover ? cutover : from;
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const cutover = await getRuntimeAccountingCutoverDate();
  const { from, to } = parseDateRangeFromParams(req.nextUrl.searchParams);
  const effectiveFrom = clampFrom(from, cutover);
  const effectiveTo = to ?? null;

  const [transactions, accountsReceivableTransactions] = await Promise.all([
    fetchPaidTransactions(),
    fetchAccountsReceivableTransactions(),
  ]);
  const payments = await fetchTransactionPayments();
  const expenses = await fetchApprovedExpenses();
  const refunds = await fetchTransactionRefunds();
  const manualLines = await fetchManualJournalLines({
    from: effectiveFrom,
    to: effectiveTo,
  });

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
  const accountsReceivableTransactionIds = new Set(
    accountsReceivableTransactions.map((transaction) => transaction.id)
  );

  const paidAtByTxId = new Map<number, Date | null>();
  for (const tx of transactions) {
    paidAtByTxId.set(tx.id, getPaidAtDate(tx));
  }

  const reservationPayments = payments.filter((p) => isReservationPayment(p));

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

  const accountsReceivablePaymentDebitIds = new Set<string>();
  const paymentEntries = payments
    .map((payment) => {
      const isReservation = isReservationPayment(payment);

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

      const creditAccount = getTransactionPaymentCreditAccount(payment);
      const creditSuffix = isReservation
        ? 'deposits'
        : creditAccount === 'Accounts Receivable'
          ? 'receivable'
          : 'sales';
      const creditId = `${idBase}-${creditSuffix}`;
      const debitAccount = getTransactionPaymentDebitAccount(payment);
      if (creditAccount === 'Accounts Receivable') {
        accountsReceivablePaymentDebitIds.add(`${idBase}-cash`);
      }

      return [
        {
          id: `${idBase}-cash`,
          date: dateStr,
          ref,
          account: debitAccount,
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

  const legacyTxEntries = transactions
    .filter((tx) => !paymentTransactionIds.has(tx.id))
    .filter((tx) => !accountsReceivableTransactionIds.has(tx.id))
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
      const orderStatus = reservationPayments.find(
        (payment) => payment.transactionId === txId
      )?.transaction?.orderStatus;
      const targetCredit = getReservationDepositRecognitionCreditAccount({
        orderStatus,
        isForfeited: Boolean(cancelledAt),
      });
      if (!targetCredit) {
        return null;
      }

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

      const isForfeited = targetCredit === 'Forfeited Deposits';
      const description = isForfeited
        ? `${customer || 'Unknown customer'} • Reservation fee forfeited`
        : `${customer || 'Unknown customer'} • Reservation fee recognized`;

      const idBase = isForfeited
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

  const accountsReceivableShipmentEntries =
    accountsReceivableTransactions.flatMap((transaction) => {
      const recognitionAt = getAccountsReceivableRecognitionDate(transaction);
      return isWithinDateRange(recognitionAt, effectiveFrom, effectiveTo)
        ? buildAccountsReceivableShipmentEntries(transaction)
        : [];
    });

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
      const creditAccount = getExpenseCreditAccount(exp);
      const creditDescription =
        creditAccount === 'Accounts Payable'
          ? 'Approved expense payable'
          : `${creditAccount} expense settlement`;

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
          id: `${ref}-${creditAccount}-credit`,
          date: dateStr,
          ref,
          account: creditAccount,
          debit: 0,
          credit: Math.max(amount, 0),
          description: exp.description ?? exp.notes ?? creditDescription,
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
      const refundDebitAccount = getTransactionRefundDebitAccount({
        orderStatus: refund.transaction?.orderStatus,
        isReservationRefund: (refund.transaction?.payments?.length ?? 0) > 0,
      });
      const isVoidedReservationRefund =
        refundDebitAccount === 'Customer Deposits';
      const ref = isVoidedReservationRefund
        ? `VOID-REFUND-TX-${refund.transactionId}`
        : productRef || idBase;
      const description = getTransactionRefundDescription({
        orderStatus: refund.transaction?.orderStatus,
        isReservationRefund: (refund.transaction?.payments?.length ?? 0) > 0,
        transactionId: refund.transactionId,
        customerName: refund.transaction?.customers,
        reason: refund.reason,
        notes: refund.notes,
      });

      return [
        {
          id: `${idBase}-refund-debit`,
          date: dateStr,
          ref,
          account: refundDebitAccount,
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

  const extractTransitIdentityFromNotes = (
    notes: unknown
  ): { name: string | null; code: string | null } => {
    if (typeof notes !== 'string') {
      return { name: null, code: null };
    }

    const codeMatch = notes.match(/\bCode:\s*([^|\n]+)/);
    const nameMatch = notes.match(/\bName:\s*([^|\n]+)/);

    const code = codeMatch?.[1]?.trim() ?? null;
    const name = nameMatch?.[1]?.trim() ?? null;

    return {
      name: name && name.length ? name : null,
      code: code && code.length ? code : null,
    };
  };

  const parseTransitBuildComponent = (
    idempotencyKey: unknown
  ): string | null => {
    if (typeof idempotencyKey !== 'string') {
      return null;
    }
    if (!idempotencyKey.startsWith('PRODUCT_TRANSIT_BUILD:')) {
      return null;
    }
    const parts = idempotencyKey.split(':');
    const component = parts[parts.length - 1]?.trim();
    return component && component.length ? component : null;
  };

  const groupedComponentLabels: Record<string, string> = {
    FORWARDER_FEE: 'Forwarder',
    LALAMOVE: 'Lalamove',
  };

  const groupedComponents = new Set(['FORWARDER_FEE', 'LALAMOVE']);

  const transitBuildRowsForExport = (() => {
    type RowForExport = {
      exportId: string;
      amount: number;
      postingDate: Date;
      shipmentCode: string | null;
      shipmentId: number | null;
      debitAccount: string;
      creditAccount: string;
      idempotencyKey: string | null;
      notes: unknown;
      component: string | null;
      isGroupedComponent: boolean;
    };

    const directRows: RowForExport[] = [];
    const grouped = new Map<string, RowForExport>();

    for (const row of transitBuildRows) {
      const amount = Number(getObjectField(row, 'amount') ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }

      const component = parseTransitBuildComponent(
        getObjectField(row, 'idempotencyKey')
      );
      const postingDay = row.postingDate.toISOString().slice(0, 10);
      const shipmentLabel =
        (row.shipmentCode ?? '').trim() || `SHIP-${row.shipmentId}`;

      if (component && groupedComponents.has(component)) {
        const groupKey = [
          shipmentLabel,
          postingDay,
          row.debitAccount,
          row.creditAccount,
          component,
        ].join('|');

        const existing = grouped.get(groupKey);
        if (existing) {
          existing.amount += amount;
          if (row.postingDate < existing.postingDate) {
            existing.postingDate = row.postingDate;
          }
          continue;
        }

        grouped.set(groupKey, {
          exportId: `GROUP-${shipmentLabel}-${postingDay}-${row.debitAccount}-${row.creditAccount}-${component}`,
          amount,
          postingDate: row.postingDate,
          shipmentCode: row.shipmentCode,
          shipmentId: row.shipmentId,
          debitAccount: row.debitAccount,
          creditAccount: row.creditAccount,
          idempotencyKey:
            typeof row.idempotencyKey === 'string' ? row.idempotencyKey : null,
          notes: row.notes,
          component,
          isGroupedComponent: true,
        });
        continue;
      }

      directRows.push({
        exportId: row.id,
        amount,
        postingDate: row.postingDate,
        shipmentCode: row.shipmentCode,
        shipmentId: row.shipmentId,
        debitAccount: row.debitAccount,
        creditAccount: row.creditAccount,
        idempotencyKey:
          typeof row.idempotencyKey === 'string' ? row.idempotencyKey : null,
        notes: row.notes,
        component,
        isGroupedComponent: false,
      });
    }

    return [...directRows, ...Array.from(grouped.values())].sort(
      (a, b) => a.postingDate.getTime() - b.postingDate.getTime()
    );
  })();

  const transitBuildEntries = transitBuildRowsForExport
    .flatMap((row) => {
      const amount = row.amount;
      const dateStr = row.postingDate.toISOString();
      const ref = (row.shipmentCode ?? '').trim() || `SHIP-${row.shipmentId}`;

      const shipmentLabel = (row.shipmentCode ?? '').trim() || ref;
      const isProductTransitBuild =
        typeof row.idempotencyKey === 'string' &&
        row.idempotencyKey.startsWith('PRODUCT_TRANSIT_BUILD:');

      const identity = isProductTransitBuild
        ? extractTransitIdentityFromNotes(row.notes)
        : { name: null, code: null };

      const description =
        row.isGroupedComponent && row.component
          ? `${shipmentLabel} • ${groupedComponentLabels[row.component] ?? row.component}`
          : (() => {
              const descriptionBase = `Transit build-up • ${shipmentLabel}`;
              return identity.name && identity.code
                ? `${descriptionBase} • ${identity.name} (${identity.code})`
                : identity.name
                  ? `${descriptionBase} • ${identity.name}`
                  : identity.code
                    ? `${descriptionBase} • ${identity.code}`
                    : descriptionBase;
            })();

      const idBase = `TB-${row.exportId}`;

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
    cogsDescriptionStyle: 'short',
  });

  const { entries: inventorySeedEntries } =
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

  const entries = [
    ...reclassEntries,
    ...transitBuildEntries,
    ...paymentEntries,
    ...accountsReceivableShipmentEntries,
    ...reservationReclassEntries,
    ...legacyTxEntries,
    ...refundEntries,
    ...expenseEntries,
    ...cogsEntries,
    ...inventorySeedEntries,
    ...manualEntries,
  ];

  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    account: accountsReceivablePaymentDebitIds.has(entry.id)
      ? entry.account
      : normalizeAccountForReporting(entry.account),
  }));

  const totalDebits = normalizedEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredits = normalizedEntries.reduce((sum, e) => sum + e.credit, 0);
  const netChange = totalDebits - totalCredits;

  const now = new Date();
  const entriesThisMonth = normalizedEntries.filter((e) => {
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

  const sortedEntries = normalizedEntries.sort((a, b) => {
    const aIsPayment = a.id.startsWith('PM-');
    const bIsPayment = b.id.startsWith('PM-');
    if (aIsPayment !== bIsPayment) {
      return aIsPayment ? -1 : 1;
    }

    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }

    const aTime = parseDate(a.date)?.getTime() ?? 0;
    const bTime = parseDate(b.date)?.getTime() ?? 0;
    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return a.id.localeCompare(b.id);
  });

  return ApiResponse.success({ entries: sortedEntries, stats });
});
