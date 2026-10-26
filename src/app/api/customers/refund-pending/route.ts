import { ApiResponse } from '@/core/api';
import {
  getAuthorizationErrorResponse,
  withErrorHandler,
} from '@/core/api/middleware';
import { requireAuth } from '@/lib/auth/session';
import { getRefundObligations } from '@/lib/accounting/refund-obligations';
import { FinancialOperationError } from '@/lib/accounting/financial-transactions';

export const GET = withErrorHandler(
  async (request) => {
    await requireAuth();
    const asOf = request.nextUrl.searchParams.get('asOf') ?? undefined;
    const from = request.nextUrl.searchParams.get('from') ?? undefined;
    return ApiResponse.success(await getRefundObligations(asOf, from));
  },
  {
    onError: (error) =>
      error instanceof FinancialOperationError
        ? ApiResponse.error(error.message, error.status)
        : (getAuthorizationErrorResponse(error) ?? undefined),
  }
);
