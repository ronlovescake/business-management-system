import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiResponse } from '@/core/api';
import {
  getAuthorizationErrorResponse,
  withErrorHandler,
} from '@/core/api/middleware';
import { requireAuth } from '@/lib/auth/session';
import {
  cancellationPayoutSchema,
  payApprovedCancellationRefund,
} from '@/lib/accounting/customer-money';
import {
  FinancialOperationError,
  financialRequestId,
} from '@/lib/accounting/financial-transactions';
import { formatValidationErrors } from '@/lib/validations/transaction-payment.validation';

type RouteContext = { params: { id: string } };

export const POST = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const actor = await requireAuth();
    const customerId = z.coerce
      .number()
      .int()
      .positive()
      .parse(context?.params.id);
    const payout = cancellationPayoutSchema.parse(await request.json());
    const result = await payApprovedCancellationRefund(
      financialRequestId(request.headers),
      customerId,
      payout,
      actor
    );
    return ApiResponse.success(result, 'Refund payout recorded', 201);
  },
  {
    onError: (error) =>
      error instanceof FinancialOperationError
        ? ApiResponse.error(error.message, error.status)
        : error instanceof z.ZodError
          ? ApiResponse.badRequest(
              'Invalid payout details',
              formatValidationErrors(error)
            )
          : (getAuthorizationErrorResponse(error) ?? undefined),
  }
);
