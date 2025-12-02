import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type RouteContext = {
  params: {
    id: string;
  };
};

const RESTORE_ACTION = 'restore';

const TRANSACTION_SELECT = {
  id: true,
  deletedAt: true,
  customers: true,
  productCode: true,
} as const;

/**
 * DELETE /api/transactions/[id]
 * Soft-delete a single transaction by ID
 */
export const DELETE = withErrorHandler(
  async (_request: NextRequest, { params }: RouteContext) => {
    const id = parseTransactionId(params.id);
    if (id === null) {
      return ApiResponse.badRequest('Invalid transaction ID');
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: TRANSACTION_SELECT,
    });

    if (!transaction) {
      return ApiResponse.notFound('Transaction');
    }

    if (transaction.deletedAt) {
      return ApiResponse.badRequest('Transaction already deleted');
    }

    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info('Transaction soft deleted', {
      transactionId: id,
      customer: transaction.customers,
      productCode: transaction.productCode,
    });

    return ApiResponse.success(
      {
        id,
      },
      'Transaction deleted successfully'
    );
  }
);

/**
 * PUT /api/transactions/[id]/restore
 * Restore a soft-deleted transaction
 */
export const PUT = withErrorHandler(
  async (request: NextRequest, { params }: RouteContext) => {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action !== RESTORE_ACTION) {
      return ApiResponse.badRequest(
        'Invalid action. Use ?action=restore to restore a deleted transaction'
      );
    }

    const id = parseTransactionId(params.id);
    if (id === null) {
      return ApiResponse.badRequest('Invalid transaction ID');
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: TRANSACTION_SELECT,
    });

    if (!transaction) {
      return ApiResponse.notFound('Transaction');
    }

    if (!transaction.deletedAt) {
      return ApiResponse.badRequest('Transaction is not deleted');
    }

    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: null },
    });

    logger.info('Transaction restored', {
      transactionId: id,
      customer: transaction.customers,
      productCode: transaction.productCode,
    });

    return ApiResponse.success(
      {
        id,
      },
      'Transaction restored successfully'
    );
  }
);

function parseTransactionId(value: string): number | null {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  return id;
}
