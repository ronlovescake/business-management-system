import type { NextRequest } from 'next/server';
import type { ZodError, ZodSchema, ZodTypeDef } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { logger } from '@/lib/logger';
import { validateMassDeleteConfirmation } from '@/lib/safety/mass-deletion';
import { sanitizers } from '@/lib/security/sanitize';
import { HTTP_STATUS } from '@/shared/constants/api';

type QuerySchemaLike<TQuery extends Record<string, unknown>> = ZodSchema<
  TQuery,
  ZodTypeDef,
  unknown
>;

type BatchCreateSchemaLike<TCreate> = ZodSchema<TCreate[], ZodTypeDef, unknown>;

type CaseInsensitiveSchema<TValue extends string> = {
  safeParse: (value: unknown) => { success: boolean; data?: TValue };
  options?: readonly TValue[];
};

type ExpenseRouteLogMessages = {
  fetched: string;
  fetchFailed: string;
  created: string;
  createFailed: string;
  bulkUpdateFailed: string;
  singleUpdateFailed: string;
  massDeleteExecuted: string;
  deleteFailed: string;
};

type ExpenseRouteService<
  TRecord,
  TCreate,
  TUpdate extends Record<string, unknown>,
  TQuery extends Record<string, unknown>,
> = {
  findAll: () => Promise<TRecord[]>;
  findWithFilters: (filters: TQuery) => Promise<TRecord[]>;
  createMany: (data: TCreate[]) => Promise<{ count: number }>;
  update: (id: number, data: Partial<TUpdate>) => Promise<TRecord>;
  updateMany?: (data: Array<TUpdate & { id: number }>) => Promise<{
    count: number;
  }>;
  deleteAll: () => Promise<{ count: number }>;
};

export interface ExpenseRouteFactoryConfig<
  TRecord,
  TCreate,
  TUpdate extends Record<string, unknown>,
  TQuery extends Record<string, unknown>,
  TStatus extends string,
  TCategory extends string,
> {
  service: ExpenseRouteService<TRecord, TCreate, TUpdate, TQuery>;
  schemas: {
    query: QuerySchemaLike<TQuery>;
    batchCreate: BatchCreateSchemaLike<TCreate>;
  };
  sanitizeStatus: (value: string | null) => TStatus | undefined;
  sanitizeCategory: (value: string | null) => TCategory | undefined;
  buildAdditionalQuery?: (searchParams: URLSearchParams) => Partial<TQuery>;
  logMessages: ExpenseRouteLogMessages;
  useServiceUpdateManyForBulkUpdate?: boolean;
}

export function sanitizeStringQueryParam(
  value: string | null
): string | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = sanitizers.name(value);
  return sanitized || undefined;
}

export function sanitizeUppercaseQueryParam(
  value: string | null
): string | undefined {
  const sanitized = sanitizeStringQueryParam(value);
  return sanitized ? sanitized.toUpperCase() : undefined;
}

export function sanitizeCaseInsensitiveSchemaOption<TValue extends string>(
  value: string | null,
  schema: CaseInsensitiveSchema<TValue>
): TValue | undefined {
  const sanitized = sanitizeStringQueryParam(value);

  if (!sanitized) {
    return undefined;
  }

  if (Array.isArray(schema.options)) {
    const normalized = sanitized.toLowerCase();
    const matched = schema.options.find(
      (option) => option.toLowerCase() === normalized
    );

    return matched;
  }

  const parsed = schema.safeParse(sanitized);
  return parsed.success ? parsed.data : undefined;
}

function sanitizeDateQueryParam(value: string | null): Date | undefined {
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

function sanitizeAmountQueryParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = sanitizers.number(value, { min: 0, decimals: 2 });
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? parsed
    : undefined;
}

function ensureArray<T>(payload: T | T[]): T[] {
  return Array.isArray(payload) ? payload : [payload];
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;
}

function buildValidationErrors(error: ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.') || 'root';
    acc[path] = issue.message;
    return acc;
  }, {});
}

function buildExpenseFilters<
  TQuery extends Record<string, unknown>,
  TStatus extends string,
  TCategory extends string,
>(
  searchParams: URLSearchParams,
  config: Pick<
    ExpenseRouteFactoryConfig<
      unknown,
      unknown,
      Record<string, unknown>,
      TQuery,
      TStatus,
      TCategory
    >,
    'schemas' | 'sanitizeCategory' | 'sanitizeStatus' | 'buildAdditionalQuery'
  >
): {
  filters: TQuery | null;
  errors?: Record<string, string>;
} {
  const candidate = removeUndefined({
    category: config.sanitizeCategory(searchParams.get('category')),
    status: config.sanitizeStatus(searchParams.get('status')),
    employeeName: sanitizeStringQueryParam(searchParams.get('employeeName')),
    startDate: sanitizeDateQueryParam(searchParams.get('startDate')),
    endDate: sanitizeDateQueryParam(searchParams.get('endDate')),
    minAmount: sanitizeAmountQueryParam(searchParams.get('minAmount')),
    maxAmount: sanitizeAmountQueryParam(searchParams.get('maxAmount')),
    ...(config.buildAdditionalQuery?.(searchParams) ?? {}),
  } as Record<string, unknown>);

  if (Object.keys(candidate).length === 0) {
    return { filters: null };
  }

  const validation = config.schemas.query.safeParse(candidate);
  if (!validation.success) {
    return {
      filters: null,
      errors: buildValidationErrors(validation.error),
    };
  }

  return { filters: validation.data };
}

function toValidatedBulkUpdateItems<TUpdate extends Record<string, unknown>>(
  updatePayload: Array<Record<string, unknown>>
): Array<TUpdate & { id: number }> {
  return updatePayload.map((expense) => {
    const id = Number(expense.id);

    if (!Number.isFinite(id)) {
      throw new Error(`Invalid expense ID: ${expense.id}`);
    }

    return {
      ...expense,
      id,
    } as TUpdate & { id: number };
  });
}

export function createExpenseRoutes<
  TRecord,
  TCreate,
  TUpdate extends Record<string, unknown>,
  TQuery extends Record<string, unknown>,
  TStatus extends string,
  TCategory extends string,
>(
  config: ExpenseRouteFactoryConfig<
    TRecord,
    TCreate,
    TUpdate,
    TQuery,
    TStatus,
    TCategory
  >
) {
  const GET = withErrorHandler(async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const { filters, errors } = buildExpenseFilters(searchParams, config);

      if (errors) {
        return ApiResponse.badRequest('Invalid query parameters', errors);
      }

      const expenses = filters
        ? await config.service.findWithFilters(filters)
        : await config.service.findAll();

      logger.info(config.logMessages.fetched, {
        count: expenses.length,
        filtered: Boolean(filters),
      });

      return ApiResponse.success(expenses, 'Expenses fetched');
    } catch (error) {
      logger.error(config.logMessages.fetchFailed, { error });
      return ApiResponse.error(
        'Failed to fetch expenses',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  const POST = withErrorHandler(async (request: NextRequest) => {
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

      const validation = config.schemas.batchCreate.safeParse(items);
      if (!validation.success) {
        return ApiResponse.badRequest(
          'Validation failed',
          buildValidationErrors(validation.error)
        );
      }

      const result = await config.service.createMany(validation.data);

      logger.info(config.logMessages.created, { count: result.count });

      return ApiResponse.success(
        { count: result.count },
        `Successfully imported ${result.count} expense records`,
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      logger.error(config.logMessages.createFailed, { error });
      return ApiResponse.error(
        'Failed to import expenses',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  const PUT = withErrorHandler(async (request: NextRequest) => {
    try {
      const updatePayload = (await request.json()) as Array<
        Record<string, unknown>
      >;

      if (!Array.isArray(updatePayload) || updatePayload.length === 0) {
        return ApiResponse.badRequest('Expected array of expenses to update', {
          payload: 'Provide an array of expense objects to update.',
        });
      }

      if (
        config.useServiceUpdateManyForBulkUpdate &&
        config.service.updateMany
      ) {
        const validated = toValidatedBulkUpdateItems<TUpdate>(updatePayload);
        const { count } = await config.service.updateMany(validated);

        return ApiResponse.success(
          { count },
          `Successfully updated ${count} expense${count === 1 ? '' : 's'}`
        );
      }

      const results = await Promise.all(
        updatePayload.map(async (expense) => {
          const id = Number(expense.id);

          if (!Number.isFinite(id)) {
            throw new Error(`Invalid expense ID: ${expense.id}`);
          }

          const { id: _ignored, ...updateData } = expense;
          return config.service.update(id, updateData as Partial<TUpdate>);
        })
      );

      return ApiResponse.success(
        { count: results.length },
        `Successfully updated ${results.length} expense${
          results.length === 1 ? '' : 's'
        }`
      );
    } catch (error) {
      logger.error(config.logMessages.bulkUpdateFailed, { error });
      return ApiResponse.error(
        'Failed to bulk update expenses',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  const PATCH = withErrorHandler(async (request: NextRequest) => {
    try {
      const updatePayload = (await request.json()) as Record<string, unknown>;

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

      const { id: _ignored, ...updateData } = updatePayload;
      const updatedExpense = await config.service.update(
        id,
        updateData as Partial<TUpdate>
      );

      return ApiResponse.success(
        updatedExpense,
        'Expense updated successfully'
      );
    } catch (error) {
      logger.error(config.logMessages.singleUpdateFailed, { error });
      return ApiResponse.error(
        'Failed to update expense',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  const DELETE = withErrorHandler(async (request: NextRequest) => {
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

      const result = await config.service.deleteAll();

      logger.warn(config.logMessages.massDeleteExecuted, {
        entity: 'expenses',
        count: result.count,
        timestamp: new Date().toISOString(),
      });

      return ApiResponse.success(
        { count: result.count },
        `Successfully deleted ${result.count} expense records`
      );
    } catch (error) {
      logger.error(config.logMessages.deleteFailed, { error });
      return ApiResponse.error(
        'Failed to delete expenses',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return { GET, POST, PUT, PATCH, DELETE };
}
