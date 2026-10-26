import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiResponse } from '@/core/api';
import {
  getAuthorizationErrorResponse,
  withErrorHandler,
} from '@/core/api/middleware';
import { requireAuth } from '@/lib/auth/session';
import {
  approveOrderCancellation,
  cancellationDecisionSchema,
  getOrderCancellationPreview,
} from '@/lib/accounting/customer-money';
import {
  FinancialOperationError,
  financialRequestId,
} from '@/lib/accounting/financial-transactions';
import { formatValidationErrors } from '@/lib/validations/transaction-payment.validation';

type RouteContext = { params: { id: string } };
const orderIdSchema = z.coerce.number().int().positive();
const options = {
  onError: (error: unknown) =>
    error instanceof FinancialOperationError
      ? ApiResponse.error(error.message, error.status)
      : error instanceof z.ZodError
        ? ApiResponse.badRequest(
            'Invalid cancellation details',
            formatValidationErrors(error)
          )
        : (getAuthorizationErrorResponse(error) ?? undefined),
};

export const GET = withErrorHandler<RouteContext>(async (_request, context) => {
  await requireAuth();
  return ApiResponse.success(
    await getOrderCancellationPreview(orderIdSchema.parse(context?.params.id))
  );
}, options);

export const POST = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const actor = await requireAuth();
    const transactionId = orderIdSchema.parse(context?.params.id);
    const decision = cancellationDecisionSchema.parse(await request.json());
    const result = await approveOrderCancellation(
      financialRequestId(request.headers),
      transactionId,
      decision,
      actor
    );
    return ApiResponse.success(result, 'Cancellation decision saved', 201);
  },
  options
);
