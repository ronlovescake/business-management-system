import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import {
  generalMerchandiseRecurringPaymentService,
  GeneralMerchandiseRecurringPaymentApproveSchema,
} from '@/modules/general-merchandise/ledger/recurringPayments/api';

const buildValidationErrors = (error: ZodError) => {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
};

/**
 * POST /api/general-merchandise/accounting/recurring-payments/drafts/approve
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();

    const validation =
      GeneralMerchandiseRecurringPaymentApproveSchema.safeParse(payload);
    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const result = await generalMerchandiseRecurringPaymentService.approveDraft(
      validation.data
    );

    return ApiResponse.success(result, 'Recurring payment draft approved');
  } catch (error) {
    logger.error('Failed to approve GM recurring payment draft', { error });
    return ApiResponse.error(
      'Failed to approve recurring payment draft',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
