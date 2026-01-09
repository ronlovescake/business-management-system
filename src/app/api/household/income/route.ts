import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import { sanitizers, sanitizeRequestBody } from '@/lib/security/sanitize';
import {
  householdIncomeService,
  HouseholdIncomeQuerySchema,
  HouseholdIncomeBatchCreateSchema,
  HouseholdIncomeUpdateSchema,
  type HouseholdIncomeQuery,
} from '@/modules/household/income/api';

const ensureArray = <T>(payload: T | T[]): T[] =>
  Array.isArray(payload) ? payload : [payload];

const buildValidationErrors = (error: ZodError) => {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
};

/**
 * GET /api/household/income
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    const typeParam = searchParams.get('type');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const accountParam = searchParams.get('account');
    const searchParam = searchParams.get('search');

    const filters = HouseholdIncomeQuerySchema.parse({
      type: typeParam ? sanitizers.name(typeParam) : undefined,
      startDate: startDateParam
        ? new Date(sanitizers.date(startDateParam))
        : undefined,
      endDate: endDateParam
        ? new Date(sanitizers.date(endDateParam))
        : undefined,
      account: accountParam ? sanitizers.name(accountParam) : undefined,
      search: searchParam ? sanitizers.name(searchParam) : undefined,
    }) as HouseholdIncomeQuery;

    const income = Object.values(filters).some((v) => typeof v !== 'undefined')
      ? await householdIncomeService.findWithFilters(filters)
      : await householdIncomeService.findAll();

    return ApiResponse.success(income, 'Household income fetched successfully');
  } catch (error) {
    logger.error('Failed to fetch household income', { error });
    return ApiResponse.error(
      'Failed to fetch household income',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * POST /api/household/income
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const items = ensureArray(payload);

    if (items.length === 0) {
      return ApiResponse.badRequest(
        'Request body must contain one or more income records',
        {
          income: 'Provide at least one income record to create.',
        }
      );
    }

    const validation = HouseholdIncomeBatchCreateSchema.safeParse(items);
    if (!validation.success) {
      logger.warn('Household income validation failed', {
        issues: validation.error.issues,
      });
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    if (validation.data.length === 1) {
      const created = await householdIncomeService.create(validation.data[0]);
      return ApiResponse.success(
        created,
        'Household income created successfully',
        HTTP_STATUS.CREATED
      );
    }

    const result = await householdIncomeService.createMany(validation.data);

    logger.info('Household income created', { count: result.count });

    return ApiResponse.success(
      { count: result.count },
      `Successfully created ${result.count} household income records`,
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('Failed to create household income', { error });
    return ApiResponse.error(
      'Failed to create household income',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * PATCH /api/household/income
 */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const sanitized =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? sanitizeRequestBody(payload as Record<string, unknown>)
        : {};

    const validation = HouseholdIncomeUpdateSchema.safeParse(sanitized);
    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const { id, ...updateData } = validation.data;
    const updated = await householdIncomeService.update(id, updateData);

    return ApiResponse.success(
      updated,
      'Household income updated successfully'
    );
  } catch (error) {
    logger.error('Failed to update household income', { error });
    return ApiResponse.error(
      'Failed to update household income',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * DELETE /api/household/income?id=...
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return ApiResponse.badRequest('Income id is required', {
        id: 'Provide an income id via ?id=...',
      });
    }

    await householdIncomeService.delete(id);

    return ApiResponse.success({ id }, 'Household income deleted successfully');
  } catch (error) {
    logger.error('Failed to delete household income', { error });
    return ApiResponse.error(
      'Failed to delete household income',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
