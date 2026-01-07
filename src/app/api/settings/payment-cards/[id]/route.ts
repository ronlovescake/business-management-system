import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const DELETE = withErrorHandler(
  async (_request: NextRequest, context?: { params: { id: string } }) => {
    const id = context?.params?.id;

    if (!id) {
      return ApiResponse.badRequest('Payment card id is required');
    }

    await prisma.paymentCard.delete({ where: { id } });
    logger.info('Payment card deleted', { id });

    return ApiResponse.success({ id }, 'Payment card deleted');
  }
);
