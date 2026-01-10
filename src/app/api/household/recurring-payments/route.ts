import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import {
  householdRecurringPaymentService,
  HouseholdRecurringPaymentCreateSchema,
} from '@/modules/household/recurringPayments/api';

const buildValidationErrors = (error: ZodError) => {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
};

/**
 * GET /api/household/recurring-payments
 */
export const GET = withErrorHandler(async () => {
  try {
    const items = await householdRecurringPaymentService.findAll();
    return ApiResponse.success(items, 'Recurring payments fetched');
  } catch (error) {
    logger.error('Failed to fetch recurring payments', { error });
    return ApiResponse.error(
      'Failed to fetch recurring payments',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * POST /api/household/recurring-payments
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();

    const validation = HouseholdRecurringPaymentCreateSchema.safeParse({
      ...payload,
      startDate: payload?.startDate ? new Date(payload.startDate) : undefined,
    });

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const created = await householdRecurringPaymentService.create(
      validation.data
    );

    return ApiResponse.success(
      created,
      'Recurring payment created',
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('Failed to create recurring payment', { error });
    return ApiResponse.error(
      'Failed to create recurring payment',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
