import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireBackupRestoreAdmin } from '@/app/api/backup-restore/sharedRouteUtils';
import {
  getDistinctChangeLogFilters,
  queryChangeLogs,
} from '@/core/change-log';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export async function GET(request: NextRequest) {
  const authResponse = await requireBackupRestoreAdmin();
  if (authResponse) {
    return authResponse;
  }

  try {
    const { searchParams } = new URL(request.url);

    const page = parseNumber(searchParams.get('page'), 1);
    const limit = Math.min(parseNumber(searchParams.get('limit'), 100), 200);
    const entityType = searchParams.get('entityType') ?? undefined;
    const entityId = searchParams.get('entityId') ?? undefined;
    const userId = searchParams.get('userId') ?? undefined;
    const actor = searchParams.get('actor') ?? undefined;
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
        actor,
        action,
        source,
        search,
        startDate,
        endDate,
      }),
      includeFilters ? getDistinctChangeLogFilters() : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      logs: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit),
      },
      filters,
    });
  } catch (error) {
    logger.error('Failed to load PITR investigation logs', { error });
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load PITR investigation logs',
      },
      { status: 500 }
    );
  }
}
