import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import {
  getAuthorizationErrorResponse,
  withErrorHandler,
} from '@/core/api/middleware';
import { requireAuth } from '@/lib/auth/session';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isClothingAccountsReceivableStatus } from '@/lib/transactions/order-status';
import { sanitizers } from '@/lib/security/sanitize';
import {
  FinancialOperationError,
  financialRequestId,
  runFinancialRequest,
} from '@/lib/accounting/financial-transactions';
import {
  computeCollectionBalance,
  computeOriginalDepositAgreement,
} from '@/modules/transactions/api/service-calculations';
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
  initialDepositAmount?: Prisma.Decimal | null;
};

type PaymentCreateRow = {
  transactionId: number;
  paymentDate: string;
  amount: number;
  method: string | null;
  notes: string | null;
  isReservation: boolean;
  originalDepositRate?: 10 | 20;
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
      originalDepositRate: payment.originalDepositRate,
    });
  });

  if (Object.keys(issues).length > 0) {
    return {
      error: ApiResponse.badRequest('Invalid payments payload', issues),
    };
  }

  return { payments: sanitizedPayments };
}

export const POST = withErrorHandler(
  async (request: NextRequest) => {
    const actor = await requireAuth();
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

    const requestId = financialRequestId(request.headers);
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

    const result = await runFinancialRequest(
      requestId,
      'BULK_COLLECTION',
      sanitized,
      async (tx) => {
        const currentTransactions = (await tx.transaction.findMany({
          where: { id: { in: transactionIds }, deletedAt: null },
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            adjustment: true,
            orderStatus: true,
            initialDepositAmount: true,
          },
        })) as TransactionRow[];
        const currentTransactionById = new Map(
          currentTransactions.map((transaction) => [
            transaction.id,
            transaction,
          ])
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
          { adjustment: number; lineTotal: number; orderStatus: string | null }
        >();
        const depositUpdates = new Map<
          number,
          Exclude<
            ReturnType<typeof computeOriginalDepositAgreement>,
            { validationError: string }
          >
        >();

        for (const transactionId of transactionIds) {
          const transaction = currentTransactionById.get(transactionId);
          if (!transaction) {
            return {
              validationError: `Transaction ${transactionId} is no longer available.`,
            };
          }

          const balance = computeCollectionBalance({
            transactionId,
            quantity: transaction.quantity,
            unitPrice: transaction.unitPrice,
            adjustment: transaction.adjustment,
            orderStatus: transaction.orderStatus,
            recordedPayments:
              paymentEventsByTransactionId.get(transactionId) ?? 0,
            incomingAmount:
              incomingPaymentsByTransactionId.get(transactionId) ?? 0,
            isReservation: sanitized.payments.some(
              (payment) =>
                payment.transactionId === transactionId && payment.isReservation
            ),
          });
          if ('validationError' in balance) {
            return balance;
          }
          const orderPayments = sanitized.payments.filter(
            (payment) => payment.transactionId === transactionId
          );
          const reservations = orderPayments.filter(
            (payment) => payment.isReservation
          );
          if (reservations.length > 1) {
            return {
              validationError:
                'Only one original Reservation Deposit can be recorded per order.',
            };
          }
          if (reservations.length && !hasReservationFlag) {
            return {
              validationError:
                'Reservation Deposit storage is unavailable. Update the development schema before collecting a deposit.',
            };
          }
          const original = reservations[0];
          const deposit = computeOriginalDepositAgreement({
            quantity: transaction.quantity,
            unitPrice: transaction.unitPrice,
            incomingAmount:
              original?.amount ??
              incomingPaymentsByTransactionId.get(transactionId) ??
              0,
            recordedPayments:
              paymentEventsByTransactionId.get(transactionId) ?? 0,
            isReservation: Boolean(original),
            originalDepositRate:
              original?.originalDepositRate ??
              orderPayments.find(
                (payment) => payment.originalDepositRate !== undefined
              )?.originalDepositRate,
            initialDepositAmount: transaction.initialDepositAmount,
          });
          if ('validationError' in deposit) {
            return deposit;
          }
          depositUpdates.set(transactionId, deposit);
          computedBalances.set(transactionId, balance);
        }

        await tx.transactionPayment.createMany({
          data: sanitized.payments.map((p) => ({
            transactionId: p.transactionId,
            financialRequestId: requestId,
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

          const nextStatus = balance.orderStatus;
          const deposit = depositUpdates.get(transactionId);
          const depositUpdate: Prisma.TransactionUpdateInput = { ...deposit };
          if (deposit?.initialDepositAmount) {
            depositUpdate.depositConfirmedAt = new Date();
            depositUpdate.depositConfirmedBy =
              actor.name ?? actor.email ?? actor.id;
          }
          const updated = (await tx.transaction.update({
            where: { id: transactionId },
            data: {
              adjustment: balance.adjustment,
              lineTotal: balance.lineTotal,
              ...depositUpdate,
              ...(nextStatus !== (transaction.orderStatus ?? null)
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

          if (nextStatus !== (transaction.orderStatus ?? null)) {
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
      }
    );

    if (!('transactionIds' in result)) {
      return ApiResponse.badRequest('Payment validation failed', {
        payments:
          result.validationError ?? 'Unable to validate payment totals.',
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
  },
  {
    onError: (error) =>
      error instanceof FinancialOperationError
        ? ApiResponse.error(error.message, error.status)
        : (getAuthorizationErrorResponse(error) ?? undefined),
  }
);
