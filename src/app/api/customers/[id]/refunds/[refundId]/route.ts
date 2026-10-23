import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type RouteContext = { params: { id: string; refundId: string } };

type RefundRow = { id: number };

function buildAutoReturnMovementNote(refundId: number): string {
  return `auto-return refund ${refundId}`;
}

function parseIds(
  context?: RouteContext
):
  | { customerId: number; refundId: number }
  | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const customerParam = context?.params?.id ?? '';
  const refundParam = context?.params?.refundId ?? '';

  const customerId = Number(customerParam);
  const refundId = Number(refundParam);

  if (!customerParam || Number.isNaN(customerId)) {
    return {
      error: ApiResponse.badRequest('Invalid customer ID', {
        id: 'Provide a numeric customer ID in the URL path.',
      }),
    };
  }

  if (!refundParam || Number.isNaN(refundId)) {
    return {
      error: ApiResponse.badRequest('Invalid refund ID', {
        refundId: 'Provide a numeric refund ID in the URL path.',
      }),
    };
  }

  return { customerId, refundId };
}

// DELETE a refund record (soft delete) scoped to the customer
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

    const result = await prisma.$transaction(async (txClient) => {
      const transactionRefund = txClient.transactionRefund;
      const existing = (await transactionRefund.findFirst({
        where: {
          id: parsed.refundId,
          deletedAt: null,
          transaction: {
            deletedAt: null,
            customerId: parsed.customerId,
          },
        },
        select: { id: true },
      })) as RefundRow | null;

      if (!existing) {
        return false;
      }

      const deletedAt = new Date();
      await transactionRefund.update({
        where: { id: parsed.refundId },
        data: { deletedAt },
      });

      await txClient.inventoryMovement.updateMany({
        where: {
          deletedAt: null,
          notes: buildAutoReturnMovementNote(parsed.refundId),
        },
        data: { deletedAt },
      });

      return true;
    });

    if (!result) {
      return ApiResponse.notFound('Refund');
    }

    logger.info('Transaction refund deleted (soft)', {
      customerId: parsed.customerId,
      refundId: parsed.refundId,
    });

    return ApiResponse.success({ id: parsed.refundId }, 'Refund deleted');
  }
);
