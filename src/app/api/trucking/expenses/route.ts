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
  ExpenseStatusSchema,
  ExpenseCategorySchema,
  type ExpenseQuery,
  type ExpenseStatus,
  type ExpenseCategory,
} from '@/modules/trucking/employees/expenses/api';

/**
 * Trucking Expenses API Route
 *
 * Handles CRUD operations for trucking employee expenses using service layer:
 * - GET: Fetch all expenses with optional filters
 * - POST: Create multiple expenses (for CSV import)
 * - PUT: Bulk update multiple expenses
 * - PATCH: Update a single expense
 * - DELETE: Delete all expenses
 */

/**
 * GET /api/trucking/expenses
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

    logger.info('Trucking expenses fetched', {
      count: expenses.length,
      filtered: Boolean(filters),
    });

    return ApiResponse.success(expenses, 'Expenses fetched');
  } catch (error) {
    logger.error('Failed to fetch trucking expenses', { error });
    return ApiResponse.error(
      'Failed to fetch expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * POST /api/trucking/expenses
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

    logger.info('Trucking expenses created', { count: result.count });

    return ApiResponse.success(
      { count: result.count },
      `Successfully imported ${result.count} expense records`,
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('Failed to import trucking expenses', { error });
    return ApiResponse.error(
      'Failed to import expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * PUT /api/trucking/expenses
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
  try {
    const updatePayload = await request.json();

    if (!Array.isArray(updatePayload) || updatePayload.length === 0) {
      return ApiResponse.badRequest('Expected array of expenses to update', {
        payload: 'Provide an array of expense objects to update.',
      });
    }

    const validated = updatePayload.map((expense) => {
      const id = Number(expense.id);
      if (!Number.isFinite(id)) {
        throw new Error(`Invalid expense ID: ${expense.id}`);
      }
      return { ...expense, id };
    });

    const { count } = await expenseService.updateMany(validated);

    return ApiResponse.success(
      { count },
      `Successfully updated ${count} expense${count === 1 ? '' : 's'}`
    );
  } catch (error) {
    logger.error('Failed to bulk update trucking expenses', { error });
    return ApiResponse.error(
      'Failed to bulk update expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * PATCH /api/trucking/expenses
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
    logger.error('Failed to update trucking expense', { error });
    return ApiResponse.error(
      'Failed to update expense',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * DELETE /api/trucking/expenses
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

    logger.warn('Trucking mass deletion executed', {
      entity: 'expenses',
      count: result.count,
      timestamp: new Date().toISOString(),
    });

    return ApiResponse.success(
      { count: result.count },
      `Successfully deleted ${result.count} expense records`
    );
  } catch (error) {
    logger.error('Failed to delete trucking expenses', { error });
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
    category: sanitizeCategoryFilter(searchParams.get('category')),
    status: sanitizeStatusFilter(searchParams.get('status')),
    startDate: sanitizeDateParam(searchParams.get('startDate')),
    endDate: sanitizeDateParam(searchParams.get('endDate')),
    employeeName: sanitizeStringParam(searchParams.get('employeeName')),
    vehicleId: sanitizeStringParam(searchParams.get('vehicleId')),
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
  return sanitized || undefined;
}

function sanitizeDateParam(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = sanitizers.date(value);
  return sanitized ? new Date(sanitized) : undefined;
}

function sanitizeAmountParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = sanitizers.number(value, { min: 0, decimals: 2 });
  return typeof sanitized === 'number' && Number.isFinite(sanitized)
    ? sanitized
    : undefined;
}

function sanitizeStatusFilter(value: string | null): ExpenseStatus | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = sanitizers.name(value);
  const validation = ExpenseStatusSchema.safeParse(sanitized);
  return validation.success ? validation.data : undefined;
}

function sanitizeCategoryFilter(
  value: string | null
): ExpenseCategory | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = sanitizers.name(value);
  const validation = ExpenseCategorySchema.safeParse(sanitized);
  return validation.success ? validation.data : undefined;
}

function ensureArray<T>(payload: T | T[]): T[] {
  return Array.isArray(payload) ? payload : [payload];
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;
}

function buildValidationErrors(error: ZodError) {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
}
