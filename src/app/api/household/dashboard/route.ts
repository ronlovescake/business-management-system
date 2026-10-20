import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import {
  HouseholdDashboardQuerySchema,
  householdDashboardService,
} from '@/modules/household/dashboard/api';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const validation = HouseholdDashboardQuerySchema.safeParse({
    range: request.nextUrl.searchParams.get('range') ?? undefined,
  });

  if (!validation.success) {
    return ApiResponse.badRequest('Invalid dashboard range', {
      range: validation.error.issues.map((issue) => issue.message).join(', '),
    });
  }

  try {
    const summary = await householdDashboardService.getSummary(
      validation.data.range
    );
    return ApiResponse.success(summary, 'Household dashboard summary fetched');
  } catch (error) {
    logger.error('Failed to fetch household dashboard summary', { error });
    return ApiResponse.error(
      'Failed to fetch household dashboard summary',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
