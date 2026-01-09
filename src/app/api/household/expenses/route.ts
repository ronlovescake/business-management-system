import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import { validateMassDeleteConfirmation } from '@/lib/safety/mass-deletion';
import { sanitizers } from '@/lib/security/sanitize';
import {
  householdExpenseService,
  HouseholdExpenseQuerySchema,
  HouseholdExpenseBatchCreateSchema,
  type HouseholdExpenseQuery,
  type HouseholdExpenseStatus,
  type HouseholdExpenseCategory,
} from '@/modules/household/expenses/api';

const ensureArray = <T>(payload: T | T[]): T[] =>
  Array.isArray(payload) ? payload : [payload];

const buildValidationErrors = (error: ZodError) => {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
};

const buildExpenseFilters = (searchParams: URLSearchParams) => {
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const minAmountParam = searchParams.get('minAmount');
  const maxAmountParam = searchParams.get('maxAmount');
  const categoryParam = searchParams.get('category');
  const statusParam = searchParams.get('status');
  const loggedByParam = searchParams.get('loggedBy');
  const sourceTypeParam = searchParams.get('sourceType');

  const queryParams = {
    category: categoryParam
      ? (sanitizers.name(categoryParam) as HouseholdExpenseCategory)
      : undefined,
    status: statusParam
      ? (sanitizers.name(statusParam) as HouseholdExpenseStatus)
      : undefined,
    loggedBy: loggedByParam ? sanitizers.name(loggedByParam) : undefined,
    sourceType: sourceTypeParam ? sanitizers.name(sourceTypeParam) : undefined,
    startDate: startDateParam
      ? new Date(sanitizers.date(startDateParam))
      : undefined,
    endDate: endDateParam ? new Date(sanitizers.date(endDateParam)) : undefined,
    minAmount: minAmountParam
      ? (sanitizers.number(minAmountParam, { min: 0, decimals: 2 }) ??
        undefined)
      : undefined,
    maxAmount: maxAmountParam
      ? (sanitizers.number(maxAmountParam, { min: 0, decimals: 2 }) ??
        undefined)
      : undefined,
  } satisfies HouseholdExpenseQuery;

  // Remove undefined values
  const filters = Object.fromEntries(
    Object.entries(queryParams).filter(([_, v]) => v !== undefined)
  );

  if (Object.keys(filters).length === 0) {
    return { filters: undefined, errors: null };
  }

  const validation = HouseholdExpenseQuerySchema.safeParse(filters);
  if (!validation.success) {
    return {
      filters: undefined,
      errors: buildValidationErrors(validation.error),
    };
  }

  return { filters: validation.data, errors: null };
};

/**
 * GET /api/household/expenses
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const { filters, errors } = buildExpenseFilters(searchParams);

    if (errors) {
      return ApiResponse.badRequest('Invalid query parameters', errors);
    }

    const expenses = filters
      ? await householdExpenseService.findWithFilters(filters)
      : await householdExpenseService.findAll();

    logger.info('Household expenses fetched', {
      count: expenses.length,
      filtered: Boolean(filters),
    });

    return ApiResponse.success(expenses, 'Household expenses fetched');
  } catch (error) {
    logger.error('Failed to fetch household expenses', { error });
    return ApiResponse.error(
      'Failed to fetch household expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * POST /api/household/expenses
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const items = ensureArray(payload);

    if (items.length === 0) {
      return ApiResponse.badRequest(
        'Request body must contain one or more expenses',
        {
          expenses: 'Provide at least one expense record to import.',
        }
      );
    }

    const validation = HouseholdExpenseBatchCreateSchema.safeParse(items);
    if (!validation.success) {
      logger.warn('Household expense validation failed', {
        issues: validation.error.issues,
      });
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const result = await householdExpenseService.createMany(validation.data);

    logger.info('Household expenses created', { count: result.count });

    return ApiResponse.success(
      { count: result.count },
      `Successfully imported ${result.count} household expense records`,
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('Failed to import household expenses', { error });
    return ApiResponse.error(
      'Failed to import household expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * PUT /api/household/expenses
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
  try {
    const updatePayload = await request.json();

    if (!Array.isArray(updatePayload) || updatePayload.length === 0) {
      return ApiResponse.badRequest('Expected array of expenses to update', {
        payload: 'Provide an array of expense objects to update.',
      });
    }

    const updatePromises = updatePayload.map(async (expense) => {
      const id = Number(expense.id);
      if (!Number.isFinite(id)) {
        throw new Error(`Invalid expense ID: ${expense.id}`);
      }

      const { id: _, ...updateData } = expense;
      return householdExpenseService.update(id, updateData);
    });

    const results = await Promise.all(updatePromises);

    return ApiResponse.success(
      { count: results.length },
      `Successfully updated ${results.length} household expense${
        results.length === 1 ? '' : 's'
      }`
    );
  } catch (error) {
    logger.error('Failed to bulk update household expenses', { error });
    return ApiResponse.error(
      'Failed to bulk update household expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * PATCH /api/household/expenses
 */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  try {
    const updatePayload = await request.json();

    if (!updatePayload || typeof updatePayload !== 'object') {
      return ApiResponse.badRequest('Request body must be an object');
    }

    if (updatePayload.id === undefined) {
      return ApiResponse.badRequest('Expense ID is required', {
        id: 'Provide the expense ID to update.',
      });
    }

    const id = Number(updatePayload.id);
    if (!Number.isFinite(id)) {
      return ApiResponse.badRequest('Expense ID must be a number', {
        id: 'Use a numeric expense ID.',
      });
    }

    const { id: _, ...updateData } = updatePayload;

    const updatedExpense = await householdExpenseService.update(id, updateData);

    return ApiResponse.success(
      updatedExpense,
      'Household expense updated successfully'
    );
  } catch (error) {
    logger.error('Failed to update household expense', { error });
    return ApiResponse.error(
      'Failed to update household expense',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * DELETE /api/household/expenses
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  try {
    const validation = validateMassDeleteConfirmation(request, 'EXPENSES');
    if (validation) {
      return validation;
    }

    const result = await householdExpenseService.deleteAll();

    logger.warn('Household expenses deleted', { count: result.count });

    return ApiResponse.success(
      { count: result.count },
      `Deleted ${result.count} household expense records`
    );
  } catch (error) {
    logger.error('Failed to delete household expenses', { error });
    return ApiResponse.error(
      'Failed to delete household expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
