import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import {
  generalMerchandiseRecurringPaymentService,
  GeneralMerchandiseRecurringPaymentGenerateSchema,
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
 * POST /api/general-merchandise/accounting/recurring-payments/generate
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json().catch(() => ({}));

    const validation =
      GeneralMerchandiseRecurringPaymentGenerateSchema.safeParse({
        upToDate: coerceDate(payload?.upToDate),
      });

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const result =
      await generalMerchandiseRecurringPaymentService.generateDueDrafts(
        validation.data
      );

    return ApiResponse.success(result, 'Recurring drafts generated');
  } catch (error) {
    logger.error('Failed to generate GM recurring payment drafts', { error });
    return ApiResponse.error(
      'Failed to generate recurring payment drafts',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
