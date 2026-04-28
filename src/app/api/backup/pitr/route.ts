import { NextResponse } from 'next/server';
import { requireBackupRestoreAdmin } from '@/app/api/backup-restore/sharedRouteUtils';
import {
  createPitrBaseBackup,
  getPitrStatus,
  isPitrErrorWithStatusCode,
  pruneExpiredPitrArtifacts,
} from '@/lib/backup/pitr';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const authResponse = await requireBackupRestoreAdmin();
  if (authResponse) {
    return authResponse;
  }

  try {
    const status = await getPitrStatus();
    return NextResponse.json({ success: true, status });
  } catch (error) {
    logger.error('Failed to load PITR status', { error });
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to load PITR status',
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  const authResponse = await requireBackupRestoreAdmin();
  if (authResponse) {
    return authResponse;
  }

  try {
    const baseBackup = await createPitrBaseBackup({
      scheduler: {
        trigger: 'manual',
        triggeredAt: new Date().toISOString(),
      },
    });
    const prune = pruneExpiredPitrArtifacts();
    const status = await getPitrStatus();

    return NextResponse.json({
      success: true,
      message: 'PITR base backup created successfully.',
      baseBackup,
      prune,
      status,
    });
  } catch (error) {
    const statusCode = isPitrErrorWithStatusCode(error)
      ? error.statusCode
      : 500;
    logger.error('Failed to create PITR base backup', { error, statusCode });
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create PITR base backup',
      },
      { status: statusCode }
    );
  }
}
