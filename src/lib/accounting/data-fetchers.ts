/**
 * Shared data fetching utilities for accounting modules
 */

import { prisma } from '@/lib/db';
import {
  CLOTHING_ACCOUNTS_RECEIVABLE_STATUSES,
  PAID_STATUSES,
} from '@/lib/accounting/constants';
import { parseDate } from '@/lib/accounting/date-utils';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';
import {
  fetchOptionalModelRows,
  fetchWithStatusChangesFallback,
  findChangedAtForStatuses,
  getCancelledAtDateFromStatusChanges,
} from '@/lib/accounting/fetcher-helpers';

type TransactionWithStatusChanges = Awaited<
  ReturnType<typeof prisma.transaction.findMany>
>[number] & {
  statusChanges?: { newStatus: string | null; changedAt: Date }[];
};

const RECOGNIZED_TRANSACTION_STATUSES = [
  ...PAID_STATUSES,
  ...CLOTHING_ACCOUNTS_RECEIVABLE_STATUSES,
] as const;

type TransactionRefundWithTransaction = {
  id: number;
  transactionId: number;
  refundDate: string;
  amount: number;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
  transaction: {
    id: number;
    customers: string | null;
    productCode: string | null;
    orderStatus: string | null;
    payments: { amount: number }[];
  };
};

type TransactionPaymentWithTransaction = {
  id: number;
  transactionId: number;
  paymentDate: string;
  amount: number;
  method: string | null;
  notes: string | null;
  isReservation?: boolean | null;
  createdAt: Date;
  transaction: {
    id: number;
    customers: string | null;
    productCode: string | null;
    orderDate: string | Date | null;
    orderStatus: string | null;
    shippedAt?: Date | null;
    statusChanges?: { newStatus: string | null; changedAt: Date }[];
  };
};

export type ManualJournalLine = {
  id: string;
  date: Date;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string | null;
  sourceType: string;
  sourceId: string | null;
  sourceLineKey: string;
  systemGenerated: boolean;
};

export async function fetchPaidTransactions(): Promise<
  TransactionWithStatusChanges[]
> {
  const baseWhere = {
    deletedAt: null,
    orderStatus: { in: [...PAID_STATUSES] },
  };

  return await fetchWithStatusChangesFallback({
    fetchWithChanges: () =>
      prisma.transaction.findMany({
        where: baseWhere,
        include: {
          statusChanges: {
            where: {
              newStatus: { in: [...RECOGNIZED_TRANSACTION_STATUSES] },
            },
            orderBy: { changedAt: 'asc' },
          },
        },
      }),
    fetchWithoutChanges: () =>
      prisma.transaction.findMany({ where: baseWhere }),
    logMessage: 'Falling back to transactions without statusChanges',
  });
}

export async function fetchRecognizedTransactions(): Promise<
  TransactionWithStatusChanges[]
> {
  const baseWhere = {
    deletedAt: null,
    NOT: {
      orderStatus: { equals: 'Cancelled' },
    },
    OR: [
      { orderStatus: { in: [...RECOGNIZED_TRANSACTION_STATUSES] } },
      // Cash-basis support: include any transaction that has recorded payment
      // so Balance Sheet cash reflects actual receipts even if ops status is
      // not tagged as Pending Payment / Paid yet.
      { adjustment: { gt: 0 } },
      // Prefer real payment events over legacy adjustment fields.
      // This keeps balance sheet cash aligned with transaction_payments.
      { payments: { some: { deletedAt: null, amount: { gt: 0 } } } },
    ],
  };

  // ============================================================================
  // ⚠️ CANCELLED STATUS FILTER (RECOGNIZED TRANSACTIONS)
  // ============================================================================
  // We only treat the explicit "Cancelled" status as cancelled.
  // This matches the transactions dropdown and avoids filtering other labels.
  // ============================================================================
  const rows = await fetchWithStatusChangesFallback({
    fetchWithChanges: () =>
      prisma.transaction.findMany({
        where: baseWhere,
        include: {
          statusChanges: {
            where: {
              newStatus: { in: [...RECOGNIZED_TRANSACTION_STATUSES] },
            },
            orderBy: { changedAt: 'asc' },
          },
        },
      }),
    fetchWithoutChanges: () =>
      prisma.transaction.findMany({ where: baseWhere }),
    logMessage: 'Falling back to transactions without statusChanges',
  });

  return rows.filter((tx) => !isCancelledOrderStatus(tx.orderStatus));
}

export async function fetchAccountsReceivableTransactions(): Promise<
  TransactionWithStatusChanges[]
> {
  const lifecycleStatuses = [...CLOTHING_ACCOUNTS_RECEIVABLE_STATUSES];

  return fetchWithStatusChangesFallback({
    fetchWithChanges: () =>
      prisma.transaction.findMany({
        where: {
          deletedAt: null,
          OR: [
            { orderStatus: { in: lifecycleStatuses } },
            { shippedAt: { not: null } },
            {
              statusChanges: {
                some: { newStatus: { in: lifecycleStatuses } },
              },
            },
          ],
        },
        include: {
          statusChanges: {
            where: { newStatus: { in: lifecycleStatuses } },
            orderBy: { changedAt: 'asc' },
          },
        },
      }),
    fetchWithoutChanges: () =>
      prisma.transaction.findMany({
        where: {
          deletedAt: null,
          OR: [
            {
              orderStatus: { in: [...CLOTHING_ACCOUNTS_RECEIVABLE_STATUSES] },
            },
            { shippedAt: { not: null } },
          ],
        },
      }),
    logMessage: 'Falling back to transactions without statusChanges',
  });
}

export async function fetchApprovedExpenses() {
  return await prisma.expense.findMany({
    where: {
      status: { in: ['approved', 'paid'] },
    },
  });
}

export async function fetchTransactionRefunds(): Promise<
  TransactionRefundWithTransaction[]
> {
  const rows = (await prisma.transactionRefund.findMany({
    where: {
      deletedAt: null,
      transaction: { deletedAt: null },
    },
    include: {
      transaction: {
        select: {
          id: true,
          customers: true,
          productCode: true,
          orderStatus: true,
          payments: {
            where: { deletedAt: null, isReservation: true },
            select: { amount: true },
          },
        },
      },
    },
    orderBy: [{ refundDate: 'asc' }, { createdAt: 'asc' }],
  })) as TransactionRefundWithTransaction[];

  return rows;
}

export async function fetchTransactionPayments(): Promise<
  TransactionPaymentWithTransaction[]
> {
  const transactionPayment = Reflect.get(prisma, 'transactionPayment') as
    | {
        findMany?: (args: unknown) => Promise<unknown>;
      }
    | undefined;

  return fetchOptionalModelRows<TransactionPaymentWithTransaction>({
    model: transactionPayment,
    unavailableLogMessage:
      'TransactionPayment model is unavailable on Prisma Client; returning no payment events',
    unavailableHint:
      'Run `npx prisma generate` and apply the payments migration to enable payment events.',
    query: async () =>
      (await transactionPayment!.findMany!({
        where: {
          deletedAt: null,
          transaction: { deletedAt: null },
        },
        include: {
          transaction: {
            select: {
              id: true,
              customers: true,
              productCode: true,
              orderDate: true,
              orderStatus: true,
              shippedAt: true,
              statusChanges: {
                where: {
                  newStatus: {
                    in: [...CLOTHING_ACCOUNTS_RECEIVABLE_STATUSES],
                  },
                },
                orderBy: { changedAt: 'asc' },
                select: { newStatus: true, changedAt: true },
              },
            },
          },
        },
        orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
      })) as TransactionPaymentWithTransaction[],
  });
}

export async function fetchManualJournalLines(params: {
  from: Date;
  to: Date | null;
}): Promise<ManualJournalLine[]> {
  const { from, to } = params;

  const journalModel = Reflect.get(prisma, 'clothingAccountingJournalLine') as
    | {
        findMany?: (args: unknown) => Promise<unknown>;
      }
    | undefined;

  const lines = await fetchOptionalModelRows<ManualJournalLine>({
    model: journalModel,
    unavailableLogMessage:
      'Manual journal model is unavailable on Prisma Client; returning no manual journal lines',
    unavailableHint:
      'Run `npx prisma generate` and apply the manual journal migration to enable manual entries.',
    missingTableLogMessage:
      'Manual journal table is missing; returning no manual journal lines',
    missingTableHint:
      'Create/apply the ClothingAccountingJournalLine table to enable manual entries.',
    query: async () =>
      (await journalModel!.findMany!({
        where: {
          // Filter out soft-deleted journal lines (column added 2026-04-19).
          deletedAt: null,
          date: {
            gte: from,
            ...(to ? { lte: to } : {}),
          },
        },
        orderBy: { date: 'asc' },
      })) as ManualJournalLine[],
  });
  const productIds = Array.from(
    new Set(
      lines
        .filter((line) => line.sourceType === 'PRODUCT')
        .map((line) => Number(line.sourceId))
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    )
  );
  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, productCode: true, shipmentCode: true },
        })
      : [];
  const productsById = new Map(
    products.map((product) => [product.id, product])
  );
  const currentLines = lines.map((line) => {
    if (line.sourceType !== 'PRODUCT') {
      return line;
    }
    const product = productsById.get(Number(line.sourceId));
    if (!product?.productCode) {
      return line;
    }
    return {
      ...line,
      ref: `PRODUCT:${product.productCode}`,
      description: line.sourceLineKey.startsWith('SUPPLIER_SETTLEMENT:')
        ? [
            'Supplier payment settlement',
            `Product ${product.productCode}`,
            product.shipmentCode ? `Shipment ${product.shipmentCode}` : null,
          ]
            .filter(Boolean)
            .join(' | ')
        : line.description,
    };
  });
  const prefix = 'Loan Payable - Investor ';
  const agreementIds = Array.from(
    new Set(
      currentLines
        .filter((line) => line.account.startsWith(prefix))
        .map((line) => line.account.slice(prefix.length))
    )
  );
  if (!agreementIds.length) {
    return currentLines;
  }
  const agreements = await prisma.clothingInvestmentAgreement.findMany({
    where: { id: { in: agreementIds } },
    select: { id: true, reference: true, investor: { select: { name: true } } },
  });
  const labels = new Map(
    agreements.map((agreement) => [
      `${prefix}${agreement.id}`,
      `Investor Funding Payable - ${agreement.investor.name} - ${agreement.reference}`,
    ])
  );
  return currentLines.map((line) => ({
    ...line,
    account:
      labels.get(line.account) ??
      (line.account.startsWith(prefix)
        ? `Investor Funding Payable - ${line.account.slice(prefix.length)}`
        : line.account),
  }));
}

export async function fetchInvestorReturnExpenses(params: {
  from: Date;
  to: Date | null;
}): Promise<ManualJournalLine[]> {
  const lines = await fetchManualJournalLines(params);
  return lines.filter(
    (line) =>
      line.sourceType === 'INVESTOR_RETURN' &&
      line.account === 'Investor Return Expense'
  );
}

export function getPaidAtDate(
  transaction: TransactionWithStatusChanges & {
    packedDate?: string | Date | null;
  }
): Date | null {
  const packedDate = parseDate(transaction.packedDate);
  const paidStatusChangedAt = findChangedAtForStatuses(
    transaction.statusChanges,
    PAID_STATUSES
  );
  const orderDate = parseDate(transaction.orderDate);

  // Cutover policy: recognition is based on completion, not order date.
  // Prefer packedDate (ops completion), then paid status-change timestamp, then orderDate.
  return packedDate ?? paidStatusChangedAt ?? orderDate ?? null;
}

export function getCancelledAtDate(tx: {
  statusChanges?: { newStatus: string | null; changedAt: Date }[];
  orderStatus?: string | null;
  updatedAt?: Date;
}): Date | null {
  return getCancelledAtDateFromStatusChanges(tx);
}

export function isWithinDateRange(
  date: Date | null,
  from: Date | null,
  to: Date | null
): boolean {
  if (!from && !to) {
    return true;
  }

  if (!date) {
    return false;
  }

  if (from && date < from) {
    return false;
  }

  if (to && date > to) {
    return false;
  }

  return true;
}
