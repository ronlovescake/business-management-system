import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import {
  queryChangeLogs,
  getDistinctChangeLogFilters,
} from '@/core/change-log';
import { getCurrentUser } from '@/lib/auth/session';

function parseNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) {
    return ApiResponse.unauthorized();
  }

  const { searchParams } = new URL(request.url);

  const page = parseNumber(searchParams.get('page'), 1);
  const limit = Math.min(parseNumber(searchParams.get('limit'), 25), 200);
  const entityType = searchParams.get('entityType') ?? undefined;
  const entityId = searchParams.get('entityId') ?? undefined;
  const userId = searchParams.get('userId') ?? undefined;
  const action = searchParams.get('action') ?? undefined;
  const source = searchParams.get('source') ?? undefined;
  const search = searchParams.get('search') ?? undefined;
  const startDate = parseDate(searchParams.get('startDate'));
  const endDate = parseDate(searchParams.get('endDate'));
  const includeFilters =
    (searchParams.get('includeFilters') ?? 'true').toLowerCase() !== 'false';

  const [result, filters] = await Promise.all([
    queryChangeLogs({
      page,
      limit,
      entityType,
      entityId,
      userId,
      action,
      source,
      search,
      startDate,
      endDate,
    }),
    includeFilters ? getDistinctChangeLogFilters() : Promise.resolve(null),
  ]);

  return ApiResponse.success({
    logs: result.data,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      pages: Math.ceil(result.total / result.limit),
    },
    filters,
  });
});
