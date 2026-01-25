import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import { validateMassDeleteConfirmation } from '@/lib/safety/mass-deletion';
import { sanitizers } from '@/lib/security/sanitize';
import {
  generalMerchandiseExpenseService,
  GeneralMerchandiseExpenseQuerySchema,
  GeneralMerchandiseExpenseBatchCreateSchema,
  GeneralMerchandiseExpenseStatusSchema,
  GeneralMerchandiseExpenseCategorySchema,
  type GeneralMerchandiseExpenseQuery,
  type GeneralMerchandiseExpenseStatus,
  type GeneralMerchandiseExpenseCategory,
} from '@/modules/general-merchandise/ledger/api';

export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const { filters, errors } = buildExpenseFilters(searchParams);

    if (errors) {
      return ApiResponse.badRequest('Invalid query parameters', errors);
    }

    const expenses = filters
      ? await generalMerchandiseExpenseService.findWithFilters(filters)
      : await generalMerchandiseExpenseService.findAll();

    logger.info('GM expenses fetched', {
      count: expenses.length,
      filtered: Boolean(filters),
    });

    return ApiResponse.success(expenses, 'Expenses fetched');
  } catch (error) {
    logger.error('Failed to fetch GM expenses', { error });
    return ApiResponse.error(
      'Failed to fetch expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

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

    const validation =
      GeneralMerchandiseExpenseBatchCreateSchema.safeParse(items);
    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const result = await generalMerchandiseExpenseService.createMany(
      validation.data
    );

    logger.info('GM expenses created', { count: result.count });

    return ApiResponse.success(
      { count: result.count },
      `Successfully imported ${result.count} expense records`,
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('Failed to import GM expenses', { error });
    return ApiResponse.error(
      'Failed to import expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

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
      return generalMerchandiseExpenseService.update(id, updateData);
    });

    const results = await Promise.all(updatePromises);

    return ApiResponse.success(
      { count: results.length },
      `Successfully updated ${results.length} expense${
        results.length === 1 ? '' : 's'
      }`
    );
  } catch (error) {
    logger.error('Failed to bulk update GM expenses', { error });
    return ApiResponse.error(
      'Failed to bulk update expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

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

    const updatedExpense = await generalMerchandiseExpenseService.update(
      id,
      updateData
    );

    return ApiResponse.success(updatedExpense, 'Expense updated successfully');
  } catch (error) {
    logger.error('Failed to update GM expense', { error });
    return ApiResponse.error(
      'Failed to update expense',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

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

    const result = await generalMerchandiseExpenseService.deleteAll();

    logger.warn('GM mass deletion executed', {
      entity: 'expenses',
      count: result.count,
      timestamp: new Date().toISOString(),
    });

    return ApiResponse.success(
      { count: result.count },
      `Successfully deleted ${result.count} expense records`
    );
  } catch (error) {
    logger.error('Failed to delete GM expenses', { error });

    return ApiResponse.error(
      'Failed to delete expenses',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

function buildExpenseFilters(searchParams: URLSearchParams): {
  filters: GeneralMerchandiseExpenseQuery | null;
  errors?: Record<string, string>;
} {
  const candidate: Partial<GeneralMerchandiseExpenseQuery> = removeUndefined({
    category: sanitizeCategoryFilter(searchParams.get('category')),
    status: sanitizeStatusFilter(searchParams.get('status')),
    employeeName: sanitizeStringParam(searchParams.get('employeeName')),
    startDate: sanitizeDateParam(searchParams.get('startDate')),
    endDate: sanitizeDateParam(searchParams.get('endDate')),
    minAmount: sanitizeAmountParam(searchParams.get('minAmount')),
    maxAmount: sanitizeAmountParam(searchParams.get('maxAmount')),
    sourceType: sanitizeSourceTypeParam(searchParams.get('sourceType')),
  });

  if (Object.keys(candidate).length === 0) {
    return { filters: null };
  }

  const parsed = GeneralMerchandiseExpenseQuerySchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      filters: null,
      errors: buildValidationErrors(parsed.error),
    };
  }

  return { filters: parsed.data };
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

function sanitizeStatusFilter(
  value: string | null
): GeneralMerchandiseExpenseStatus | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = sanitizers.name(value);
  if (!sanitized) {
    return undefined;
  }

  const normalized = sanitized.toLowerCase();
  const match = GeneralMerchandiseExpenseStatusSchema.options.find(
    (status) => status.toLowerCase() === normalized
  );

  return match as GeneralMerchandiseExpenseStatus | undefined;
}

function sanitizeCategoryFilter(
  value: string | null
): GeneralMerchandiseExpenseCategory | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = sanitizers.name(value);
  if (!sanitized) {
    return undefined;
  }

  const parsed = GeneralMerchandiseExpenseCategorySchema.safeParse(sanitized);
  return parsed.success ? parsed.data : undefined;
}

function sanitizeSourceTypeParam(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = sanitizers.name(value);
  if (!sanitized) {
    return undefined;
  }

  return sanitized.toUpperCase();
}

function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as T;
}

function ensureArray<T>(payload: T | T[]): T[] {
  return Array.isArray(payload) ? payload : [payload];
}

function buildValidationErrors(error: ZodError) {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.') || 'expense';
    acc[path] = issue.message;
    return acc;
  }, {});
}
