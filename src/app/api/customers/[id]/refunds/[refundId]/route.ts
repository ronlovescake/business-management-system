import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import {
  getAuthorizationErrorResponse,
  withErrorHandler,
} from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth/session';

type RouteContext = { params: { id: string; refundId: string } };

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

    const existing = await prisma.transactionRefund.findFirst({
      where: {
        id: parsed.refundId,
        deletedAt: null,
        transaction: { customerId: parsed.customerId },
      },
      select: { id: true },
    });

    if (!existing) {
      return ApiResponse.notFound('Refund');
    }

    return ApiResponse.error(
      'Recorded refunds stay in history and cannot be deleted.',
      409
    );
  },
  { onError: (error) => getAuthorizationErrorResponse(error) ?? undefined }
);
