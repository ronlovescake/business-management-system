import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import {
  generalMerchandiseRecurringPaymentService,
  GeneralMerchandiseRecurringPaymentTemplateCreateSchema,
  GeneralMerchandiseRecurringPaymentTemplateUpdateSchema,
  GeneralMerchandiseRecurringPaymentTemplateDeleteSchema,
} from '@/modules/general-merchandise/ledger/recurringPayments/api';

const buildValidationErrors = (error: ZodError) => {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
};

const coerceDate = (value: unknown): Date | undefined => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
};

/**
 * GET /api/general-merchandise/accounting/recurring-payments/templates
 */
export const GET = withErrorHandler(async () => {
  try {
    const items =
      await generalMerchandiseRecurringPaymentService.findTemplates();
    return ApiResponse.success(items, 'Recurring payment templates fetched');
  } catch (error) {
    logger.error('Failed to fetch GM recurring payment templates', { error });
    return ApiResponse.error(
      'Failed to fetch recurring payment templates',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * POST /api/general-merchandise/accounting/recurring-payments/templates
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();

    const validation =
      GeneralMerchandiseRecurringPaymentTemplateCreateSchema.safeParse({
        ...payload,
        nextDueDate: coerceDate(payload?.nextDueDate),
        endDate: payload?.endDate ? coerceDate(payload.endDate) : null,
      });

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const created =
      await generalMerchandiseRecurringPaymentService.createTemplate(
        validation.data
      );

    return ApiResponse.success(
      created,
      'Recurring payment template created',
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('Failed to create GM recurring payment template', { error });
    return ApiResponse.error(
      'Failed to create recurring payment template',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * PATCH /api/general-merchandise/accounting/recurring-payments/templates
 */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();

    const validation =
      GeneralMerchandiseRecurringPaymentTemplateUpdateSchema.safeParse({
        ...payload,
        nextDueDate: coerceDate(payload?.nextDueDate),
        endDate:
          payload?.endDate === undefined
            ? undefined
            : payload?.endDate
              ? coerceDate(payload.endDate)
              : null,
      });

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const updated =
      await generalMerchandiseRecurringPaymentService.updateTemplate(
        validation.data.id,
        validation.data
      );

    return ApiResponse.success(updated, 'Recurring payment template updated');
  } catch (error) {
    logger.error('Failed to update GM recurring payment template', { error });
    return ApiResponse.error(
      'Failed to update recurring payment template',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * DELETE /api/general-merchandise/accounting/recurring-payments/templates
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  try {
    const searchId = request.nextUrl.searchParams.get('id');
    const body = searchId ? { id: searchId } : await request.json();

    const validation =
      GeneralMerchandiseRecurringPaymentTemplateDeleteSchema.safeParse(body);

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const deleted =
      await generalMerchandiseRecurringPaymentService.deleteTemplate(
        validation.data
      );

    return ApiResponse.success(deleted, 'Recurring payment template deleted');
  } catch (error) {
    logger.error('Failed to delete GM recurring payment template', { error });
    return ApiResponse.error(
      'Failed to delete recurring payment template',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
