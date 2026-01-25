import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  ACCOUNTS_RECEIVABLE_STATUSES,
  PAID_STATUSES,
} from '@/lib/accounting/constants';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';

const ACCOUNTING_CUTOVER = getAccountingCutoverDate();

type TransactionWithStatusChanges = Awaited<
  ReturnType<typeof prisma.generalMerchandiseTransaction.findMany>
>[number] & {
  statusChanges?: { newStatus: string | null; changedAt: Date }[];
};

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
  };
};

type TransactionPaymentWithTransaction = {
  id: number;
  transactionId: number;
  paymentDate: string;
  amount: number;
  method: string | null;
  notes: string | null;
  createdAt: Date;
  transaction: {
    id: number;
    customers: string | null;
    productCode: string | null;
    orderStatus: string | null;
  };
};

export type GeneralMerchandiseExpenseRow = {
  id: number;
  date: string;
  amount: number;
  description: string;
  category: string;
  paymentMethod: string | null;
  employeeName: string | null;
  sourceId: string | null;
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

export async function fetchGeneralMerchandisePaidTransactions(): Promise<
  TransactionWithStatusChanges[]
> {
  const baseWhere = {
    deletedAt: null,
    orderStatus: { in: [...PAID_STATUSES] },
  };

  try {
    return await prisma.generalMerchandiseTransaction.findMany({
      where: baseWhere,
      include: {
        statusChanges: {
          where: { newStatus: { in: [...PAID_STATUSES] } },
          orderBy: { changedAt: 'asc' },
        },
      },
    });
  } catch (error) {
    logger.warn('GM: Falling back to transactions without statusChanges', {
      error,
    });
    return await prisma.generalMerchandiseTransaction.findMany({
      where: baseWhere,
    });
  }
}

export async function fetchGeneralMerchandiseRecognizedTransactions(): Promise<
  TransactionWithStatusChanges[]
> {
  const recognizedStatuses = [
    ...PAID_STATUSES,
    ...ACCOUNTS_RECEIVABLE_STATUSES,
  ] as const;

  const baseWhere = {
    deletedAt: null,
    NOT: {
      orderStatus: { equals: 'Cancelled' },
    },
    OR: [
      { orderStatus: { in: [...recognizedStatuses] } },
      { adjustment: { gt: 0 } },
    ],
  };

  try {
    const rows = await prisma.generalMerchandiseTransaction.findMany({
      where: baseWhere,
      include: {
        statusChanges: {
          where: { newStatus: { in: [...PAID_STATUSES] } },
          orderBy: { changedAt: 'asc' },
        },
      },
    });
    return rows.filter((tx) => !isCancelledOrderStatus(tx.orderStatus));
  } catch (error) {
    logger.warn('GM: Falling back to transactions without statusChanges', {
      error,
    });
    const rows = await prisma.generalMerchandiseTransaction.findMany({
      where: baseWhere,
    });
    return rows.filter((tx) => !isCancelledOrderStatus(tx.orderStatus));
  }
}

export async function fetchGeneralMerchandiseApprovedExpenses(): Promise<
  GeneralMerchandiseExpenseRow[]
> {
  const expenseModel = (
    prisma as unknown as {
      generalMerchandiseExpense?: {
        findMany?: (args: unknown) => Promise<unknown>;
      };
    }
  ).generalMerchandiseExpense;

  if (!expenseModel?.findMany) {
    logger.warn(
      'GM Expense model is unavailable on Prisma Client; returning no approved expenses',
      {
        hint: 'Run `npx prisma generate` and apply the GM expenses migration to enable GM expenses.',
      }
    );
    return [];
  }

  return (await expenseModel.findMany({
    where: {
      status: { in: ['approved', 'paid'] },
    },
  })) as GeneralMerchandiseExpenseRow[];
}

export async function fetchGeneralMerchandiseTransactionRefunds(): Promise<
  TransactionRefundWithTransaction[]
> {
  const rows = (await prisma.generalMerchandiseTransactionRefund.findMany({
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
        },
      },
    },
    orderBy: [{ refundDate: 'asc' }, { createdAt: 'asc' }],
  })) as TransactionRefundWithTransaction[];

  return rows;
}

export async function fetchGeneralMerchandiseTransactionPayments(): Promise<
  TransactionPaymentWithTransaction[]
> {
  const transactionPayment = (
    prisma as unknown as {
      generalMerchandiseTransactionPayment?: {
        findMany?: (args: unknown) => Promise<unknown>;
      };
    }
  ).generalMerchandiseTransactionPayment;

  if (!transactionPayment?.findMany) {
    logger.warn(
      'GM TransactionPayment model is unavailable on Prisma Client; returning no payment events',
      {
        hint: 'Run `npx prisma generate` and apply the GM payments migration to enable payment events.',
      }
    );
    return [];
  }

  const rows = (await transactionPayment.findMany({
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
        },
      },
    },
    orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
  })) as TransactionPaymentWithTransaction[];

  return rows;
}

export async function fetchGeneralMerchandiseManualJournalLines(params: {
  from: Date;
  to: Date | null;
}): Promise<ManualJournalLine[]> {
  const { from, to } = params;

  const journalModel = (
    prisma as unknown as {
      generalMerchandiseAccountingJournalLine?: {
        findMany?: (args: unknown) => Promise<unknown>;
      };
    }
  ).generalMerchandiseAccountingJournalLine;

  if (!journalModel?.findMany) {
    logger.warn(
      'GM manual journal model is unavailable on Prisma Client; returning no manual journal lines',
      {
        hint: 'Run `npx prisma generate` and apply the GM manual journal migration to enable manual entries.',
      }
    );
    return [];
  }

  try {
    const rows = (await journalModel.findMany({
      where: {
        date: {
          gte: from,
          ...(to ? { lte: to } : {}),
        },
      },
      orderBy: { date: 'asc' },
    })) as ManualJournalLine[];

    return rows;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const message = (error as { message?: string })?.message ?? '';
    if (code === 'P2021' || message.includes('does not exist')) {
      logger.warn(
        'GM manual journal table is missing; returning no manual journal lines',
        {
          hint: 'Create/apply the GeneralMerchandiseAccountingJournalLine table to enable manual entries.',
        }
      );
      return [];
    }

    logger.error('Failed to fetch GM manual journal lines', { error });
    throw error;
  }
}

export function getPaidAtDate(tx: {
  statusChanges?: { newStatus: string | null; changedAt: Date }[];
  orderStatus?: string | null;
  updatedAt?: Date;
}): Date | null {
  if (!tx.statusChanges || tx.statusChanges.length === 0) {
    return tx.updatedAt ?? null;
  }

  const paid = tx.statusChanges.find((status) =>
    (PAID_STATUSES as readonly string[]).includes(
      (status.newStatus ?? '').trim()
    )
  );

  return paid?.changedAt ?? tx.updatedAt ?? null;
}

export function isWithinDateRange(
  date: Date | null,
  from: Date | null,
  to: Date | null
): boolean {
  if (!date) {
    return false;
  }

  const clampedFrom = from ?? ACCOUNTING_CUTOVER;
  if (date < clampedFrom) {
    return false;
  }

  if (to && date > to) {
    return false;
  }

  return true;
}

export function getAccountingCutoverDateRange() {
  return ACCOUNTING_CUTOVER;
}
