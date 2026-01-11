import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import {
  householdRecurringPaymentService,
  HouseholdRecurringPaymentCreateSchema,
  HouseholdRecurringPaymentUpdateSchema,
  HouseholdRecurringPaymentDeleteSchema,
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

/**
 * PATCH /api/household/recurring-payments
 */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();

    const validation = HouseholdRecurringPaymentUpdateSchema.safeParse({
      ...payload,
      startDate: payload?.startDate ? new Date(payload.startDate) : undefined,
    });

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const updated = await householdRecurringPaymentService.update(
      validation.data.id,
      validation.data
    );

    return ApiResponse.success(updated, 'Recurring payment updated');
  } catch (error) {
    logger.error('Failed to update recurring payment', { error });
    return ApiResponse.error(
      'Failed to update recurring payment',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * DELETE /api/household/recurring-payments
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  try {
    const searchId = request.nextUrl.searchParams.get('id');
    const body = searchId ? { id: searchId } : await request.json();

    const validation = HouseholdRecurringPaymentDeleteSchema.safeParse(body);

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const deleted = await householdRecurringPaymentService.delete(
      validation.data
    );

    return ApiResponse.success(deleted, 'Recurring payment deleted');
  } catch (error) {
    logger.error('Failed to delete recurring payment', { error });
    return ApiResponse.error(
      'Failed to delete recurring payment',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
