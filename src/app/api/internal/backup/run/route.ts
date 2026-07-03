import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { requireInternalToken } from '@/lib/internal-jobs/auth';
import {
  ScheduledBackupConfigurationError,
  runScheduledBackupJob,
  type SchedulerRequestBody,
} from '@/lib/backup/scheduledBackupRunner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const authError = requireInternalToken(request);
  if (authError) {
    return authError;
  }

  let body: SchedulerRequestBody = {};
  try {
    body = (await request.json()) as SchedulerRequestBody;
  } catch {
    body = {};
  }

  try {
    const result = await runScheduledBackupJob(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ScheduledBackupConfigurationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    logger.error('Internal scheduled backup failed', { error });
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Scheduled backup failed',
      },
      { status: 500 }
    );
  }
}
