import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import {
  householdRecurringPaymentService,
  HouseholdRecurringPaymentGenerateSchema,
} from '@/modules/household/recurringPayments/api';

const buildValidationErrors = (error: ZodError) => {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
};

/**
 * POST /api/household/recurring-payments/generate
 * Body: { month?: "YYYY-MM" }
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    let payload: unknown = undefined;
    try {
      payload = await request.json();
    } catch {
      payload = undefined;
    }

    const validation =
      HouseholdRecurringPaymentGenerateSchema.safeParse(payload);
    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const result = await householdRecurringPaymentService.generateForMonth(
      validation.data ?? undefined
    );

    return ApiResponse.success(result, 'Recurring payments generated');
  } catch (error) {
    logger.error('Failed to generate recurring payments', { error });
    return ApiResponse.error(
      'Failed to generate recurring payments',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
