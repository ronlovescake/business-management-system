import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import {
  getAuthorizationErrorResponse,
  withErrorHandler,
} from '@/core/api/middleware';
import { requireAuth } from '@/lib/auth/session';
import {
  FinancialOperationError,
  runFinancialTransaction,
} from '@/lib/accounting/financial-transactions';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type RouteContext = { params: { id: string; paymentId: string } };

type TransactionMetaRow = {
  id: number;
  quantity: number;
  unitPrice: number;
  orderStatus?: string | null;
  initialDepositAmount?: unknown;
  cancellation?: { id: string } | null;
};

type PaymentRow = {
  id: number;
  transactionId: number;
  financialRequestId?: string | null;
};

function parseIds(
  context?: RouteContext
):
  | { customerId: number; paymentId: number }
  | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const customerParam = context?.params?.id ?? '';
  const paymentParam = context?.params?.paymentId ?? '';

  const customerId = Number(customerParam);
  const paymentId = Number(paymentParam);

  if (!customerParam || Number.isNaN(customerId)) {
    return {
      error: ApiResponse.badRequest('Invalid customer ID', {
        id: 'Provide a numeric customer ID in the URL path.',
      }),
    };
  }

  if (!paymentParam || Number.isNaN(paymentId)) {
    return {
      error: ApiResponse.badRequest('Invalid payment ID', {
        paymentId: 'Provide a numeric payment ID in the URL path.',
      }),
    };
  }

  return { customerId, paymentId };
}

// DELETE a payment record (soft delete) scoped to the customer
export const DELETE = withErrorHandler<RouteContext>(
  async (_request: NextRequest, context) => {
    await requireAuth();
    const parsed = parseIds(context);
    if ('error' in parsed) {
      return parsed.error;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: parsed.customerId },
      select: { customerName: true },
    });

    if (!customer) {
      return ApiResponse.notFound('Customer');
    }

    const transactionPayment = prisma.transactionPayment;

    const existing = (await transactionPayment.findFirst({
      where: {
        id: parsed.paymentId,
        deletedAt: null,
        transaction: {
          deletedAt: null,
          customerId: parsed.customerId,
        },
      },
      select: { id: true, transactionId: true, financialRequestId: true },
    })) as PaymentRow | null;

    if (!existing) {
      return ApiResponse.notFound('Payment');
    }

    await runFinancialTransaction(async (txp) => {
      const meta = (await txp.transaction.findUnique({
        where: { id: existing.transactionId },
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          orderStatus: true,
          initialDepositAmount: true,
          cancellation: { select: { id: true } },
        },
      })) as TransactionMetaRow | null;
      if (
        !meta ||
        existing.financialRequestId ||
        meta.cancellation ||
        isCancelledOrderStatus(meta.orderStatus) ||
        (meta.initialDepositAmount !== null &&
          meta.initialDepositAmount !== undefined)
      ) {
        throw new FinancialOperationError(
          'This collection is part of preserved financial history and cannot be deleted.'
        );
      }
      await txp.transactionPayment.update({
        where: { id: parsed.paymentId },
        data: { deletedAt: new Date() },
      });

      const paymentDelegate = txp.transactionPayment;

      let paid = 0;
      if (paymentDelegate.aggregate) {
        const paymentAggregate = await paymentDelegate.aggregate({
          where: {
            transactionId: existing.transactionId,
            deletedAt: null,
          },
          _sum: {
            amount: true,
          },
        });
        paid = paymentAggregate._sum.amount ?? 0;
      } else {
        const groupBy = Reflect.get(paymentDelegate, 'groupBy');

        if (typeof groupBy !== 'function') {
          throw new Error('TransactionPayment groupBy is unavailable');
        }

        const groupByAny = groupBy as (
          this: unknown,
          args: Record<string, unknown>
        ) => Promise<unknown>;

        const grouped = (await groupByAny.call(paymentDelegate, {
          by: ['transactionId'],
          where: {
            transactionId: existing.transactionId,
            deletedAt: null,
          },
          _sum: {
            amount: true,
          },
        })) as Array<{ _sum?: { amount?: number | null } }>;
        paid = grouped[0]?._sum?.amount ?? 0;
      }

      const gross = (meta?.quantity ?? 0) * (meta?.unitPrice ?? 0);
      const balance = gross - paid;

      await txp.transaction.update({
        where: { id: existing.transactionId },
        data: {
          adjustment: paid,
          lineTotal: balance,
        },
      });
    });

    logger.info('Transaction payment deleted (soft)', {
      customerId: parsed.customerId,
      paymentId: parsed.paymentId,
    });

    return ApiResponse.success({ id: parsed.paymentId }, 'Payment deleted');
  },
  {
    onError: (error) =>
      error instanceof FinancialOperationError
        ? ApiResponse.error(error.message, error.status)
        : (getAuthorizationErrorResponse(error) ?? undefined),
  }
);
