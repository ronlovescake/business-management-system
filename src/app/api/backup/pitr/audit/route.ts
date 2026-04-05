import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireBackupRestoreAdmin } from '@/app/api/backup-restore/sharedRouteUtils';
import { queryAuditLogs } from '@/core/audit-log';
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
    const entityType = searchParams.get('entityType') ?? '';
    const entityId = searchParams.get('entityId') ?? '';
    const action = searchParams.get('action') ?? undefined;
    const eventTime = parseDate(searchParams.get('eventTime'));
    const limit = Math.min(parseNumber(searchParams.get('limit'), 10), 25);

    const logs = await queryAuditLogs({
      entityType,
      entityId,
      action,
      eventTime,
      limit,
    });

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error) {
    logger.error('Failed to load PITR audit logs', { error });
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load PITR audit logs',
      },
      { status: 500 }
    );
  }
}