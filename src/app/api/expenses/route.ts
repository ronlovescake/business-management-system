import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import { validateMassDeleteConfirmation } from '@/lib/safety/mass-deletion';
import { sanitizers } from '@/lib/security/sanitize';
import {
  expenseService,
  ExpenseQuerySchema,
  ExpenseBatchCreateSchema,
  type ExpenseQuery,
} from '@/modules/clothing/employees/expenses/api';

/**
 * Expenses API Route
 *
 * Handles CRUD operations for employee expenses using service layer:
 * - GET: Fetch all expenses with optional filters
 * - POST: Create multiple expenses (for CSV import)
 * - PUT: Bulk update multiple expenses
 * - PATCH: Update a single expense
 * - DELETE: Delete all expenses
 */

/**
 * GET /api/expenses
 *
 * Fetch all expenses with optional filters
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const { filters, errors } = buildExpenseFilters(searchParams);

    if (errors) {
      return ApiResponse.badRequest('Invalid query parameters', errors);
    }

    const expenses = filters
      ? await expenseService.findWithFilters(filters)
      : await expenseService.findAll();

    logger.info('Expenses fetched', {
      count: expenses.length,
      filtered: Boolean(filters),
    });

    return ApiResponse.success(expenses, 'Expenses fetched');
  } catch (error) {
    logger.error('Failed to fetch expenses', { error });
    return ApiResponse.error(
      'Failed to fetch expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * POST /api/expenses
 *
 * Create multiple expenses (batch import)
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

    const validation = ExpenseBatchCreateSchema.safeParse(items);
    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const result = await expenseService.createMany(validation.data);

    logger.info('Expenses created', { count: result.count });

    return ApiResponse.success(
      { count: result.count },
      `Successfully imported ${result.count} expense records`,
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('Failed to import expenses', { error });
    return ApiResponse.error(
      'Failed to import expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * PUT /api/expenses
 *
 * Bulk update multiple expenses
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
      return expenseService.update(id, updateData);
    });

    const results = await Promise.all(updatePromises);

    return ApiResponse.success(
      { count: results.length },
      `Successfully updated ${results.length} expense${
        results.length === 1 ? '' : 's'
      }`
    );
  } catch (error) {
    logger.error('Failed to bulk update expenses', { error });
    return ApiResponse.error(
      'Failed to bulk update expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * PATCH /api/expenses
 *
 * Update a single expense
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

    const updatedExpense = await expenseService.update(id, updateData);

    return ApiResponse.success(updatedExpense, 'Expense updated successfully');
  } catch (error) {
    logger.error('Failed to update expense', { error });
    return ApiResponse.error(
      'Failed to update expense',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * DELETE /api/expenses
 *
 * Delete all expenses (requires mass deletion confirmation)
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  try {
    const validation = validateMassDeleteConfirmation(request, 'EXPENSES');
    if (validation) {
      const payload = (await validation.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;

      return ApiResponse.error(
        (payload?.error as string) ?? 'Mass deletion protection',
        HTTP_STATUS.BAD_REQUEST,
        (payload?.details as string) ??
          (payload?.message as string) ??
          'Confirmation token required to delete all expenses.',
        {
          validationErrors: payload?.requiredValue
            ? {
                confirm: `Provide ?confirm=${payload.requiredValue} to proceed with mass deletion.`,
              }
            : undefined,
          suggestion: (payload?.warning as string) ?? undefined,
        }
      );
    }

    const result = await expenseService.deleteAll();

    logger.warn('Mass deletion executed', {
      entity: 'expenses',
      count: result.count,
      timestamp: new Date().toISOString(),
    });

    return ApiResponse.success(
      { count: result.count },
      `Successfully deleted ${result.count} expense records`
    );
  } catch (error) {
    logger.error('Failed to delete expenses', { error });

    return ApiResponse.error(
      'Failed to delete expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

function buildExpenseFilters(searchParams: URLSearchParams): {
  filters: ExpenseQuery | null;
  errors?: Record<string, string>;
} {
  const candidate: Partial<ExpenseQuery> = removeUndefined({
    category: sanitizeStringParam(searchParams.get('category')),
    status: sanitizeStringParam(searchParams.get('status')),
    employeeName: sanitizeStringParam(searchParams.get('employeeName')),
    startDate: sanitizeDateParam(searchParams.get('startDate')),
    endDate: sanitizeDateParam(searchParams.get('endDate')),
    minAmount: sanitizeAmountParam(searchParams.get('minAmount')),
    maxAmount: sanitizeAmountParam(searchParams.get('maxAmount')),
  });

  if (Object.keys(candidate).length === 0) {
    return { filters: null };
  }

  const validation = ExpenseQuerySchema.safeParse(candidate);
  if (!validation.success) {
    return {
      filters: null,
      errors: buildValidationErrors(validation.error),
    };
  }

  return { filters: validation.data };
}

function sanitizeStringParam(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const sanitized = sanitizers.name(value);
  return sanitized ? sanitized : undefined;
}

function sanitizeDateParam(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const sanitized = sanitizers.date(value);
  if (!sanitized) {
    return undefined;
  }
  const parsed = new Date(sanitized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function sanitizeAmountParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = sanitizers.number(value, { min: 0, decimals: 2 });
  return parsed ?? undefined;
}

function ensureArray<T>(payload: T | T[]): T[] {
  return Array.isArray(payload) ? payload : [payload];
}

function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as T;
}

function buildValidationErrors(error: ZodError): Record<string, string> {
  return error.errors.reduce<Record<string, string>>((acc, issue) => {
    const key = issue.path.join('.') || 'root';
    acc[key] = issue.message;
    return acc;
  }, {});
}
