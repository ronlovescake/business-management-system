import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import {
  transactionPaymentBulkCreateSchema,
  type TransactionPaymentBulkCreateInput,
  formatValidationErrors,
} from '@/lib/validations/transaction-payment.validation';

type TransactionPaymentDelegate = {
  createMany: (args: unknown) => Promise<unknown>;
  groupBy: (args: unknown) => Promise<unknown>;
};

type TransactionDelegate = {
  findMany: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
};

type TransactionRow = {
  id: number;
  quantity: number;
  unitPrice: number;
};

type PaymentCreateRow = {
  transactionId: number;
  paymentDate: string;
  amount: number;
  method: string | null;
  notes: string | null;
};

const gmPrisma = prisma as unknown as {
  generalMerchandiseTransaction: TransactionDelegate;
  generalMerchandiseTransactionPayment: TransactionPaymentDelegate;
};

function sanitizeBulkInput(
  input: TransactionPaymentBulkCreateInput
):
  | { payments: PaymentCreateRow[] }
  | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const issues: Record<string, string> = {};
  const sanitizedPayments: PaymentCreateRow[] = [];

  input.payments.forEach((payment, index) => {
    const paymentDate = sanitizers.date(payment.paymentDate);
    if (!paymentDate) {
      issues[`payments.${index}.paymentDate`] =
        'Provide a valid date (YYYY-MM-DD or ISO format).';
      return;
    }

    const amount = sanitizers.number(payment.amount, { min: 0, decimals: 2 });
    if (amount === null || amount <= 0) {
      issues[`payments.${index}.amount`] =
        'Provide a positive amount (greater than 0).';
      return;
    }

    const method =
      payment.method === undefined || payment.method === null
        ? null
        : sanitizers.name(payment.method) || null;

    const notes =
      payment.notes === undefined || payment.notes === null
        ? null
        : sanitizers.notes(payment.notes) || null;

    sanitizedPayments.push({
      transactionId: payment.transactionId,
      paymentDate,
      amount,
      method,
      notes,
    });
  });

  if (Object.keys(issues).length > 0) {
    return {
      error: ApiResponse.badRequest('Invalid payments payload', issues),
    };
  }

  return { payments: sanitizedPayments };
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validation = transactionPaymentBulkCreateSchema.safeParse(body);

  if (!validation.success) {
    logger.warn('GM bulk transaction payment validation failed', {
      issues: validation.error.issues,
    });
    return ApiResponse.badRequest(
      'Validation failed',
      formatValidationErrors(validation.error)
    );
  }

  const sanitized = sanitizeBulkInput(validation.data);
  if ('error' in sanitized) {
    return sanitized.error;
  }

  const transactionIds = Array.from(
    new Set(sanitized.payments.map((p) => p.transactionId))
  );

  const existingTransactions =
    (await gmPrisma.generalMerchandiseTransaction.findMany({
      where: {
        id: { in: transactionIds },
        deletedAt: null,
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
      },
    })) as TransactionRow[];

  const existingIdSet = new Set(existingTransactions.map((t) => t.id));
  const missingIds = transactionIds.filter((id) => !existingIdSet.has(id));

  if (missingIds.length > 0) {
    return ApiResponse.badRequest('Invalid transaction IDs', {
      transactionIds: `Not found or deleted: ${missingIds.join(', ')}`,
    });
  }

  const transactionMetaById = new Map(
    existingTransactions.map((t) => [t.id, t] as const)
  );

  const result = await prisma.$transaction(async (tx) => {
    const gmTx = tx as unknown as typeof gmPrisma;

    await gmTx.generalMerchandiseTransactionPayment.createMany({
      data: sanitized.payments.map((p) => ({
        transactionId: p.transactionId,
        paymentDate: p.paymentDate,
        amount: p.amount,
        method: p.method,
        notes: p.notes,
      })),
    });

    const sums = (await gmTx.generalMerchandiseTransactionPayment.groupBy({
      by: ['transactionId'],
      where: {
        transactionId: { in: transactionIds },
        deletedAt: null,
      },
      _sum: {
        amount: true,
      },
    })) as Array<{ transactionId: number; _sum: { amount: number | null } }>;

    const sumByTransactionId = new Map(
      sums.map((row) => [row.transactionId, row._sum.amount ?? 0] as const)
    );

    const updates: Array<{
      id: number;
      adjustment: number;
      lineTotal: number;
    }> = [];

    for (const transactionId of transactionIds) {
      const adjustment = sumByTransactionId.get(transactionId) ?? 0;
      const meta = transactionMetaById.get(transactionId);
      const quantity = meta?.quantity ?? 0;
      const unitPrice = meta?.unitPrice ?? 0;
      const lineTotal = quantity * unitPrice - adjustment;

      const updated = (await gmTx.generalMerchandiseTransaction.update({
        where: { id: transactionId },
        data: {
          adjustment,
          lineTotal,
        },
        select: { id: true, adjustment: true, lineTotal: true },
      })) as { id: number; adjustment: number; lineTotal: number };

      updates.push(updated);
    }

    return {
      transactionIds,
      updates,
      paymentsCreated: sanitized.payments.length,
    };
  });

  logger.info('GM bulk transaction payments created', {
    paymentsCreated: result.paymentsCreated,
    transactionsUpdated: result.transactionIds.length,
  });

  return ApiResponse.success(result, 'Payments recorded');
});
