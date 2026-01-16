import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import {
  clothingRecurringPaymentService,
  ClothingRecurringPaymentApproveSchema,
} from '@/modules/clothing/ledger/recurringPayments/api';

const buildValidationErrors = (error: ZodError) => {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
};

/**
 * POST /api/accounting/recurring-payments/drafts/approve
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();

    const validation = ClothingRecurringPaymentApproveSchema.safeParse(payload);
    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const result = await clothingRecurringPaymentService.approveDraft(
      validation.data
    );

    return ApiResponse.success(result, 'Recurring payment draft approved');
  } catch (error) {
    logger.error('Failed to approve recurring payment draft', { error });
    return ApiResponse.error(
      'Failed to approve recurring payment draft',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
