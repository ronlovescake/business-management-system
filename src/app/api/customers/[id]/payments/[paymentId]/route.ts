import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type RouteContext = { params: { id: string; paymentId: string } };

type TransactionPaymentDelegate = {
  findFirst: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
};

type PaymentRow = { id: number };

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

    const transactionPayment = (
      prisma as unknown as { transactionPayment: TransactionPaymentDelegate }
    ).transactionPayment;

    const existing = (await transactionPayment.findFirst({
      where: {
        id: parsed.paymentId,
        deletedAt: null,
        transaction: {
          deletedAt: null,
          customers: customer.customerName,
        },
      },
      select: { id: true },
    })) as PaymentRow | null;

    if (!existing) {
      return ApiResponse.notFound('Payment');
    }

    await transactionPayment.update({
      where: { id: parsed.paymentId },
      data: { deletedAt: new Date() },
    });

    logger.info('Transaction payment deleted (soft)', {
      customerId: parsed.customerId,
      paymentId: parsed.paymentId,
    });

    return ApiResponse.success({ id: parsed.paymentId }, 'Payment deleted');
  }
);
