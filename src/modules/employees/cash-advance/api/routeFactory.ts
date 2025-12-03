import type { NextRequest } from 'next/server';
import type { ZodIssue, ZodSchema, ZodTypeDef } from 'zod';
import { ApiResponse } from '@/core/api/response';
import { withErrorHandler } from '@/core/api/middleware';
import { sanitizeNumber, sanitizeString } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';

export interface CashAdvanceRouteConfig<
  TRecord,
  TCreateInput,
  TUpdateInput,
  TQuery extends Record<string, unknown>,
> {
  service: {
    findAll: () => Promise<TRecord[]>;
    findWithFilters: (filters: TQuery) => Promise<TRecord[]>;
    create: (data: TCreateInput) => Promise<TRecord>;
    update: (id: string, data: Partial<TUpdateInput>) => Promise<TRecord>;
    delete: (id: string) => Promise<void>;
  };
  schemas: {
    query: ZodSchema<TQuery, ZodTypeDef, unknown>;
    create: ZodSchema<TCreateInput, ZodTypeDef, unknown>;
    update: ZodSchema<TUpdateInput, ZodTypeDef, unknown>;
  };
  loggerScope?: string;
}

interface SerializedRequest {
  id?: string;
  employeeId?: string;
  employeeName?: string;
  amount?: number | null;
  termsMonths?: number | null;
  monthlyPayment?: number | null;
  settledAmount?: number | null;
  remainingBalance?: number | null;
  purpose?: string | null;
  notes?: string | null;
  requestDate?: Date | null;
  status?: string;
  approvedBy?: string | null;
  approvedDate?: Date | null;
  rejectedBy?: string | null | undefined;
  rejectedDate?: Date | null;
  rejectionReason?: string | null | undefined;
  deductionCycle?: string | null;
  nextDeductionDate?: Date | null;
  lastDeductedDate?: Date | null;
}

const formatValidationErrors = (issues: ZodIssue[]) =>
  issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.') || 'root';
    acc[path] = issue.message;
    return acc;
  }, {});

const sanitizeAmount = (value: unknown) =>
  sanitizeNumber(value, { min: 0, decimals: 2 });

const sanitizeOptionalDate = (value: unknown): Date | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const sanitizeNullableDate = (value: unknown): Date | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const sanitized = sanitizeOptionalDate(value);
  return sanitized ?? null;
};

const sanitizePositiveInt = (value: unknown): number | undefined => {
  const sanitized = sanitizeNumber(value, { min: 1 });
  if (sanitized === null) {
    return undefined;
  }
  const floored = Math.floor(sanitized);
  return floored > 0 ? floored : undefined;
};

const sanitizeNullablePositiveInt = (
  value: unknown
): number | null | undefined => {
  if (value === null) {
    return null;
  }
  return sanitizePositiveInt(value);
};

const sanitizeMonetaryValue = (value: unknown): number | undefined => {
  const sanitized = sanitizeNumber(value, { min: 0, decimals: 2 });
  return sanitized === null ? undefined : sanitized;
};

const sanitizeNullableMonetaryValue = (
  value: unknown,
  defaultValue?: number
): number | null | undefined => {
  if (value === null) {
    return null;
  }
  if (value === undefined && defaultValue !== undefined) {
    return defaultValue;
  }
  const sanitized = sanitizeMonetaryValue(value);
  return sanitized ?? undefined;
};

const sanitizeStringField = (
  value: unknown,
  maxLength: number,
  fallback?: string
) => {
  const sanitized = sanitizeString(value, { maxLength });
  if (!sanitized && fallback !== undefined) {
    return fallback;
  }
  return sanitized || undefined;
};

const sanitizeNullableStringField = (
  value: unknown,
  options: { maxLength: number; fallback?: string; allowUndefined?: boolean }
) => {
  if (value === undefined) {
    return options.allowUndefined === false
      ? (options.fallback ?? undefined)
      : undefined;
  }

  if (value === null) {
    return null;
  }

  const sanitized = sanitizeString(value, { maxLength: options.maxLength });

  if (!sanitized) {
    if (options.allowUndefined === false) {
      return options.fallback ?? null;
    }

    return undefined;
  }

  return sanitized;
};

const sanitizeCreatePayload = (
  body: Record<string, unknown>
): SerializedRequest => {
  return {
    employeeId: sanitizeString(body.employeeId, { maxLength: 50 }),
    employeeName: sanitizeString(body.employeeName ?? body.employee, {
      maxLength: 255,
    }),
    amount: sanitizeAmount(body.amount) ?? undefined,
    termsMonths: sanitizePositiveInt(body.termsMonths),
    monthlyPayment: sanitizeMonetaryValue(body.monthlyPayment),
    settledAmount: sanitizeNullableMonetaryValue(body.settledAmount, 0),
    remainingBalance: sanitizeMonetaryValue(body.remainingBalance),
    purpose: sanitizeStringField(body.purpose, 255),
    notes: sanitizeString(body.notes),
    requestDate: sanitizeOptionalDate(body.requestDate) ?? new Date(),
    status: sanitizeStringField(body.status, 50, 'pending'),
    approvedBy: sanitizeNullableStringField(body.approvedBy, {
      maxLength: 255,
      fallback: undefined,
    }),
    approvedDate: sanitizeNullableDate(body.approvedDate),
    rejectedBy: sanitizeNullableStringField(body.rejectedBy, {
      maxLength: 255,
      allowUndefined: true,
    }),
    rejectedDate: sanitizeNullableDate(body.rejectedDate),
    rejectionReason: sanitizeNullableStringField(body.rejectionReason, {
      maxLength: 2000,
      allowUndefined: true,
    }),
    deductionCycle: sanitizeNullableStringField(body.deductionCycle, {
      maxLength: 50,
      fallback: undefined,
    }),
    nextDeductionDate: sanitizeNullableDate(body.nextDeductionDate),
    lastDeductedDate: sanitizeNullableDate(body.lastDeductedDate),
  };
};

const sanitizeUpdatePayload = (
  body: Record<string, unknown>
): SerializedRequest => {
  const payload: SerializedRequest = {
    id: sanitizeString(body.id, { maxLength: 50 }),
  };

  if (body.employeeId !== undefined) {
    payload.employeeId = sanitizeString(body.employeeId, { maxLength: 50 });
  }

  if (body.employeeName !== undefined || body.employee !== undefined) {
    payload.employeeName = sanitizeString(body.employeeName ?? body.employee, {
      maxLength: 255,
    });
  }

  if (body.amount !== undefined) {
    payload.amount = sanitizeAmount(body.amount);
  }

  if (body.termsMonths !== undefined) {
    payload.termsMonths = sanitizeNullablePositiveInt(body.termsMonths);
  }

  if (body.monthlyPayment !== undefined) {
    payload.monthlyPayment = sanitizeMonetaryValue(body.monthlyPayment);
  }

  if (body.settledAmount !== undefined) {
    payload.settledAmount = sanitizeMonetaryValue(body.settledAmount);
  }

  if (body.remainingBalance !== undefined) {
    payload.remainingBalance = sanitizeMonetaryValue(body.remainingBalance);
  }

  if (body.purpose !== undefined) {
    payload.purpose = body.purpose
      ? sanitizeString(body.purpose, { maxLength: 255 })
      : null;
  }

  if (body.notes !== undefined) {
    payload.notes = body.notes ? sanitizeString(body.notes) : null;
  }

  if (body.requestDate !== undefined) {
    payload.requestDate = sanitizeNullableDate(body.requestDate);
  }

  if (body.status !== undefined) {
    payload.status = sanitizeString(body.status, { maxLength: 50 });
  }

  if (body.approvedBy !== undefined) {
    payload.approvedBy = sanitizeNullableStringField(body.approvedBy, {
      maxLength: 255,
    });
  }

  if (body.approvedDate !== undefined) {
    payload.approvedDate = sanitizeNullableDate(body.approvedDate);
  }

  if (body.rejectedBy !== undefined) {
    payload.rejectedBy = sanitizeNullableStringField(body.rejectedBy, {
      maxLength: 255,
      allowUndefined: true,
    });
  }

  if (body.rejectedDate !== undefined) {
    payload.rejectedDate = sanitizeNullableDate(body.rejectedDate);
  }

  if (body.rejectionReason !== undefined) {
    payload.rejectionReason = body.rejectionReason
      ? sanitizeString(body.rejectionReason)
      : undefined;
  }

  if (body.deductionCycle !== undefined) {
    payload.deductionCycle = body.deductionCycle
      ? sanitizeString(body.deductionCycle, { maxLength: 50 })
      : null;
  }

  if (body.nextDeductionDate !== undefined) {
    payload.nextDeductionDate = sanitizeNullableDate(body.nextDeductionDate);
  }

  if (body.lastDeductedDate !== undefined) {
    payload.lastDeductedDate = sanitizeNullableDate(body.lastDeductedDate);
  }

  return payload;
};

export function createCashAdvanceRoutes<
  TRecord,
  TCreateInput,
  TUpdateInput,
  TQuery extends Record<string, unknown>,
>(config: CashAdvanceRouteConfig<TRecord, TCreateInput, TUpdateInput, TQuery>) {
  const { service, schemas, loggerScope = 'Cash advance' } = config;

  const GET = withErrorHandler(async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status');
      const employeeId = searchParams.get('employeeId');

      const queryCandidate: Record<string, unknown> = {};

      if (status && status !== 'all') {
        queryCandidate.status = status;
      }

      if (employeeId) {
        queryCandidate.employeeId = employeeId.trim();
      }

      const validation = schemas.query.safeParse(queryCandidate);

      if (!validation.success) {
        return ApiResponse.badRequest(
          'Invalid query parameters',
          formatValidationErrors(validation.error.errors)
        );
      }

      const filters = validation.data;
      const data = Object.keys(filters).length
        ? await service.findWithFilters(filters)
        : await service.findAll();

      logger.info(`[${loggerScope}] Cash advances fetched`, {
        filters: Object.keys(filters),
        count: Array.isArray(data) ? data.length : 0,
      });

      return ApiResponse.success(data, 'Cash advances fetched');
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to fetch cash advances`, { error });
      return ApiResponse.error('Failed to fetch cash advances');
    }
  });

  const POST = withErrorHandler(async (request: NextRequest) => {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const sanitized = sanitizeCreatePayload(body);
      const validation = schemas.create.safeParse(sanitized);

      if (!validation.success) {
        return ApiResponse.badRequest(
          'Validation failed',
          formatValidationErrors(validation.error.errors)
        );
      }

      const result = await service.create(validation.data);

      logger.info(`[${loggerScope}] Cash advance created`, {
        employeeId: sanitized.employeeId,
      });

      return ApiResponse.success(result, 'Cash advance created', 201);
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to create cash advance`, { error });
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create cash advance';

      if (message.toLowerCase().includes('validation')) {
        return ApiResponse.badRequest('Validation failed');
      }

      return ApiResponse.error('Failed to create cash advance');
    }
  });

  const PUT = withErrorHandler(async (request: NextRequest) => {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const sanitized = sanitizeUpdatePayload(body);

      if (!sanitized.id) {
        return ApiResponse.badRequest('Cash advance ID is required');
      }

      const validation = schemas.update.safeParse(sanitized);

      if (!validation.success) {
        return ApiResponse.badRequest(
          'Validation failed',
          formatValidationErrors(validation.error.errors)
        );
      }

      const { id, ...updateData } = validation.data as {
        id: string;
      } & Partial<TUpdateInput>;

      const result = await service.update(
        id,
        updateData as Partial<TUpdateInput>
      );

      logger.info(`[${loggerScope}] Cash advance updated`, { id });

      return ApiResponse.success(result, 'Cash advance updated');
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to update cash advance`, { error });

      if (error instanceof Error && error.message.includes('not found')) {
        return ApiResponse.notFound('Cash advance');
      }

      return ApiResponse.error('Failed to update cash advance');
    }
  });

  const DELETE = withErrorHandler(async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return ApiResponse.badRequest('Cash advance ID is required');
      }

      const sanitizedId = sanitizeString(id, { maxLength: 50 });
      await service.delete(sanitizedId);

      logger.warn(`[${loggerScope}] Cash advance deleted`, { id: sanitizedId });

      return ApiResponse.success(
        { id: sanitizedId },
        'Cash advance deleted successfully'
      );
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to delete cash advance`, { error });

      if (
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message.includes('does not exist'))
      ) {
        return ApiResponse.notFound('Cash advance');
      }

      return ApiResponse.error('Failed to delete cash advance');
    }
  });

  return { GET, POST, PUT, DELETE };
}
