import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import {
  generalMerchandiseRecurringPaymentService,
  GeneralMerchandiseRecurringPaymentDraftListSchema,
} from '@/modules/general-merchandise/ledger/recurringPayments/api';

export const dynamic = 'force-dynamic';

const buildValidationErrors = (error: ZodError) => {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
};

const parseDateParam = (value: string | null): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

/**
 * GET /api/general-merchandise/accounting/recurring-payments/drafts
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const status = request.nextUrl.searchParams.get('status');
    const dueFrom = parseDateParam(request.nextUrl.searchParams.get('dueFrom'));
    const dueTo = parseDateParam(request.nextUrl.searchParams.get('dueTo'));
    const dueOnOrBefore = parseDateParam(
      request.nextUrl.searchParams.get('dueOnOrBefore')
    );

    const validation =
      GeneralMerchandiseRecurringPaymentDraftListSchema.safeParse({
        status: status || undefined,
        dueFrom,
        dueTo,
        dueOnOrBefore,
      });

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const drafts = await generalMerchandiseRecurringPaymentService.listDrafts(
      validation.data
    );

    return ApiResponse.success(drafts, 'Recurring payment drafts fetched');
  } catch (error) {
    logger.error('Failed to fetch GM recurring payment drafts', { error });
    return ApiResponse.error(
      'Failed to fetch recurring payment drafts',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
