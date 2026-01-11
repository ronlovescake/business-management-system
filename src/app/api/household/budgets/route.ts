import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import {
  householdBudgetService,
  HouseholdBudgetCreateSchema,
  HouseholdBudgetUpdateSchema,
  HouseholdBudgetDeleteSchema,
} from '@/modules/household/budgets/api';

const buildValidationErrors = (error: ZodError) => {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
};

/**
 * GET /api/household/budgets
 */
export const GET = withErrorHandler(async () => {
  try {
    const items = await householdBudgetService.findAll();
    return ApiResponse.success(items, 'Household budgets fetched');
  } catch (error) {
    logger.error('Failed to fetch household budgets', { error });
    return ApiResponse.error(
      'Failed to fetch household budgets',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * POST /api/household/budgets
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const validation = HouseholdBudgetCreateSchema.safeParse(payload);

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const created = await householdBudgetService.create(validation.data);

    return ApiResponse.success(
      created,
      'Household budget created',
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('Failed to create household budget', { error });
    return ApiResponse.error(
      'Failed to create household budget',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * PATCH /api/household/budgets
 */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const validation = HouseholdBudgetUpdateSchema.safeParse(payload);

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const updated = await householdBudgetService.update(
      validation.data.id,
      validation.data
    );

    return ApiResponse.success(updated, 'Household budget updated');
  } catch (error) {
    logger.error('Failed to update household budget', { error });
    return ApiResponse.error(
      'Failed to update household budget',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * DELETE /api/household/budgets
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  try {
    const searchId = request.nextUrl.searchParams.get('id');
    const body = searchId ? { id: searchId } : await request.json();

    const validation = HouseholdBudgetDeleteSchema.safeParse(body);

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const deleted = await householdBudgetService.delete(validation.data);

    return ApiResponse.success(deleted, 'Household budget deleted');
  } catch (error) {
    logger.error('Failed to delete household budget', { error });
    return ApiResponse.error(
      'Failed to delete household budget',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
