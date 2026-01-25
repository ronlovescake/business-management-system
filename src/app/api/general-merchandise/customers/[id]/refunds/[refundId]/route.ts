import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type RouteContext = { params: { id: string; refundId: string } };

type TransactionRefundDelegate = {
  findFirst: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
};

type RefundRow = { id: number };

const gmPrisma = prisma as unknown as {
  generalMerchandiseCustomer: typeof prisma.customer;
  generalMerchandiseTransactionRefund: TransactionRefundDelegate;
  generalMerchandiseInventoryMovement: typeof prisma.inventoryMovement;
};

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

    const customer = await gmPrisma.generalMerchandiseCustomer.findUnique({
      where: { id: parsed.customerId },
      select: { customerName: true },
    });

    if (!customer) {
      return ApiResponse.notFound('Customer');
    }

    const existing =
      (await gmPrisma.generalMerchandiseTransactionRefund.findFirst({
        where: {
          id: parsed.refundId,
          deletedAt: null,
          transaction: {
            deletedAt: null,
            customers: customer.customerName,
          },
        },
        select: { id: true },
      })) as RefundRow | null;

    if (!existing) {
      return ApiResponse.notFound('Refund');
    }

    await gmPrisma.generalMerchandiseTransactionRefund.update({
      where: { id: parsed.refundId },
      data: { deletedAt: new Date() },
    });

    // Keep the inventory sub-ledger consistent: hide any auto-created return movement.
    await gmPrisma.generalMerchandiseInventoryMovement.updateMany({
      where: {
        deletedAt: null,
        notes: buildAutoReturnMovementNote(parsed.refundId),
      },
      data: { deletedAt: new Date() },
    });

    logger.info('GM transaction refund deleted (soft)', {
      customerId: parsed.customerId,
      refundId: parsed.refundId,
    });

    return ApiResponse.success({ id: parsed.refundId }, 'Refund deleted');
  }
);
