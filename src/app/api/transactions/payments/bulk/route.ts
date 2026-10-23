import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isClothingAccountsReceivableStatus } from '@/lib/transactions/order-status';
import { sanitizers } from '@/lib/security/sanitize';
import {
  transactionPaymentBulkCreateSchema,
  type TransactionPaymentBulkCreateInput,
  formatValidationErrors,
} from '@/lib/validations/transaction-payment.validation';

type TransactionRow = {
  id: number;
  quantity: number;
  unitPrice: number;
  adjustment?: number | null;
  orderStatus?: string | null;
};

type PaymentCreateRow = {
  transactionId: number;
  paymentDate: string;
  amount: number;
  method: string | null;
  notes: string | null;
  isReservation: boolean;
};

async function supportsReservationFlag(): Promise<boolean> {
  try {
    const rows = (await prisma.$queryRaw<
      Array<{ exists: number }>
    >`SELECT 1 as exists FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_payments' AND column_name = 'isReservation' LIMIT 1;`) as Array<{
      exists: number;
    }>;

    return rows.length > 0;
  } catch {
    // If we can't detect (permissions, etc), be conservative.
    return false;
  }
}

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

    const isReservation = Boolean(payment.isReservation);

    sanitizedPayments.push({
      transactionId: payment.transactionId,
      paymentDate,
      amount,
      method,
      notes,
      isReservation,
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
    logger.warn('Bulk transaction payment validation failed', {
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

  const existingTransactions = (await prisma.transaction.findMany({
    where: {
      id: { in: transactionIds },
      deletedAt: null,
    },
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      adjustment: true,
      orderStatus: true,
    },
  })) as TransactionRow[];

  const existingIdSet = new Set(existingTransactions.map((t) => t.id));
  const missingIds = transactionIds.filter((id) => !existingIdSet.has(id));

  if (missingIds.length > 0) {
    return ApiResponse.badRequest('Invalid transaction IDs', {
      transactionIds: `Not found or deleted: ${missingIds.join(', ')}`,
    });
  }

  const hasReservationFlag = await supportsReservationFlag();

  const result = await prisma.$transaction(async (tx) => {
    const currentTransactions = (await tx.transaction.findMany({
      where: { id: { in: transactionIds }, deletedAt: null },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        adjustment: true,
        orderStatus: true,
      },
    })) as TransactionRow[];
    const currentTransactionById = new Map(
      currentTransactions.map((transaction) => [transaction.id, transaction])
    );
    const currentPaymentSums = await tx.transactionPayment.groupBy({
      by: ['transactionId'],
      where: {
        transactionId: { in: transactionIds },
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    const paymentEventsByTransactionId = new Map(
      currentPaymentSums.map(
        (row) => [row.transactionId, row._sum.amount ?? 0] as const
      )
    );
    const incomingPaymentsByTransactionId = new Map<number, number>();

    for (const payment of sanitized.payments) {
      const incoming =
        (incomingPaymentsByTransactionId.get(payment.transactionId) ?? 0) +
        payment.amount;
      incomingPaymentsByTransactionId.set(payment.transactionId, incoming);

      const transaction = currentTransactionById.get(payment.transactionId);
      if (!transaction) {
        return {
          validationError: `Transaction ${payment.transactionId} is no longer available.`,
        };
      }

      if (
        payment.isReservation &&
        isClothingAccountsReceivableStatus(transaction.orderStatus)
      ) {
        return {
          validationError:
            'Accounts Receivable collections cannot be recorded as reservation deposits.',
        };
      }
    }

    const computedBalances = new Map<
      number,
      { adjustment: number; lineTotal: number }
    >();

    for (const transactionId of transactionIds) {
      const transaction = currentTransactionById.get(transactionId);
      if (!transaction) {
        return {
          validationError: `Transaction ${transactionId} is no longer available.`,
        };
      }

      const grossSale =
        (transaction.quantity ?? 0) * (transaction.unitPrice ?? 0);
      const paymentEventsTotal =
        paymentEventsByTransactionId.get(transactionId) ?? 0;
      const currentPaid = Math.max(
        paymentEventsTotal,
        transaction.adjustment ?? 0
      );
      const adjustment =
        currentPaid + (incomingPaymentsByTransactionId.get(transactionId) ?? 0);

      if (adjustment > grossSale + 0.01) {
        return {
          validationError: `Payment exceeds the remaining balance for transaction ${transactionId}.`,
        };
      }

      computedBalances.set(transactionId, {
        adjustment,
        lineTotal: Math.max(grossSale - adjustment, 0),
      });
    }

    await tx.transactionPayment.createMany({
      data: sanitized.payments.map((p) => ({
        transactionId: p.transactionId,
        paymentDate: p.paymentDate,
        amount: p.amount,
        method: p.method,
        notes: p.notes,
        ...(hasReservationFlag ? { isReservation: p.isReservation } : {}),
      })),
    });

    const updates: Array<{
      id: number;
      adjustment: number;
      lineTotal: number;
      orderStatus: string | null;
    }> = [];

    for (const transactionId of transactionIds) {
      const balance = computedBalances.get(transactionId);
      if (!balance) {
        throw new Error(
          `Payment balance missing for transaction ${transactionId}`
        );
      }
      const transaction = currentTransactionById.get(transactionId);
      if (!transaction) {
        throw new Error(
          `Transaction ${transactionId} disappeared during payment`
        );
      }

      const nextStatus =
        isClothingAccountsReceivableStatus(transaction.orderStatus) &&
        balance.lineTotal <= 0.01
          ? 'Shipped'
          : transaction.orderStatus;
      const updated = (await tx.transaction.update({
        where: { id: transactionId },
        data: {
          adjustment: balance.adjustment,
          lineTotal: balance.lineTotal,
          ...(nextStatus !== transaction.orderStatus
            ? { orderStatus: nextStatus }
            : {}),
        },
        select: {
          id: true,
          adjustment: true,
          lineTotal: true,
          orderStatus: true,
        },
      })) as {
        id: number;
        adjustment: number;
        lineTotal: number;
        orderStatus: string | null;
      };

      if (nextStatus !== transaction.orderStatus) {
        await tx.transactionStatusChange.create({
          data: {
            transactionId,
            previousStatus: transaction.orderStatus,
            newStatus: nextStatus,
          },
        });
      }

      updates.push(updated);
    }

    return {
      transactionIds,
      updates,
      paymentsCreated: sanitized.payments.length,
    };
  });

  if (!('transactionIds' in result)) {
    return ApiResponse.badRequest('Payment validation failed', {
      payments: result.validationError ?? 'Unable to validate payment totals.',
    });
  }

  const updatedTransactionIds = result.transactionIds;
  if (!updatedTransactionIds) {
    return ApiResponse.badRequest('Payment validation failed');
  }

  logger.info('Bulk transaction payments created', {
    paymentsCreated: result.paymentsCreated,
    transactionsUpdated: updatedTransactionIds.length,
  });

  return ApiResponse.success(result, 'Payments recorded');
});
