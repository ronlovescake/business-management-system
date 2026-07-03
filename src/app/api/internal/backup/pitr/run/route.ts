import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireInternalToken } from '@/lib/internal-jobs/auth';
import { logger } from '@/lib/logger';
import {
  isPitrErrorWithStatusCode,
  runScheduledPitrBaseBackup,
  type ScheduledPitrRequestBody,
} from '@/lib/backup/pitr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const authError = requireInternalToken(request, {
    missingTokenBody: {
      success: false,
      error: 'Internal scheduler token is not configured',
    },
    unauthorizedBody: {
      success: false,
      error: 'Invalid internal scheduler token',
    },
    unauthorizedHeaders: {},
  });
  if (authError) {
    if (authError.status === 500) {
      logger.error('Internal PITR trigger missing INTERNAL_JOB_TOKEN env');
    }
    return authError;
  }

  let body: ScheduledPitrRequestBody = {};
  try {
    body = (await request.json()) as ScheduledPitrRequestBody;
  } catch {
    body = {};
  }

  try {
    const result = await runScheduledPitrBaseBackup(body);
    return NextResponse.json(result);
  } catch (error) {
    const statusCode = isPitrErrorWithStatusCode(error)
      ? error.statusCode
      : 500;

    logger.error('Internal scheduled PITR base backup failed', {
      error,
      statusCode,
    });

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal scheduled PITR base backup failed',
      },
      { status: statusCode }
    );
  }
}
