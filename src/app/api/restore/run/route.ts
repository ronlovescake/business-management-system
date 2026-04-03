import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import {
  buildPendingRestoreJobStatus,
  isRestoreJobActive,
  isRestoreRunnerAvailable,
  readRestoreJobStatus,
  readRestoreRunnerHeartbeat,
  resolveFullDumpRestoreTarget,
  writeRestoreJobStatus,
} from '@/lib/backup/restoreJobState';
import {
  isValidTimestampFolderName,
  requireBackupRestoreAdmin,
} from '@/app/api/backup-restore/sharedRouteUtils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

class RestoreRequestValidationError extends Error {}

type RestoreRunRequestBody = {
  timestamp?: string;
  confirmationText?: string;
};

function getRunnerState() {
  const heartbeat = readRestoreRunnerHeartbeat();
  return {
    heartbeat,
    runnerAvailable: isRestoreRunnerAvailable(heartbeat),
    status: readRestoreJobStatus(),
  };
}

export async function GET() {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  const { heartbeat, runnerAvailable, status } = getRunnerState();

  return NextResponse.json({
    success: true,
    runnerAvailable,
    runnerHeartbeatAt: heartbeat?.updatedAt ?? null,
    status,
  });
}

export async function POST(request: NextRequest) {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  try {
    const body = (await request.json()) as RestoreRunRequestBody;
    const timestamp = body.timestamp?.trim() || '';
    const confirmationText = body.confirmationText?.trim() || '';

    if (!timestamp || !isValidTimestampFolderName(timestamp)) {
      throw new RestoreRequestValidationError('Invalid backup timestamp.');
    }

    if (confirmationText !== `RESTORE ${timestamp}`) {
      throw new RestoreRequestValidationError(
        `Type RESTORE ${timestamp} to confirm this restore.`
      );
    }

    const { heartbeat, runnerAvailable, status } = getRunnerState();

    if (!runnerAvailable) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Restore runner is not available. Start the restore-runner service before restoring from the UI.',
          runnerAvailable,
          runnerHeartbeatAt: heartbeat?.updatedAt ?? null,
          status,
        },
        { status: 503 }
      );
    }

    if (isRestoreJobActive(status)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'A restore job is already pending or running. Wait for it to finish before submitting another restore.',
          runnerAvailable,
          runnerHeartbeatAt: heartbeat?.updatedAt ?? null,
          status,
        },
        { status: 409 }
      );
    }

    const target = resolveFullDumpRestoreTarget(timestamp);
    const nextStatus = await writeRestoreJobStatus(
      buildPendingRestoreJobStatus(target)
    );

    return NextResponse.json(
      {
        success: true,
        message:
          'Restore job accepted. The application will become temporarily unavailable while the Docker database is replaced.',
        runnerAvailable,
        runnerHeartbeatAt: heartbeat?.updatedAt ?? null,
        status: nextStatus,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof RestoreRequestValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    logger.error('Failed to submit UI restore request', { error });
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to submit restore request',
      },
      { status: 500 }
    );
  }
}
