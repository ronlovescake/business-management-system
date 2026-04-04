import { NextResponse } from 'next/server';
import { requireBackupRestoreAdmin } from '@/app/api/backup-restore/sharedRouteUtils';
import { listPitrBaseBackups } from '@/lib/backup/pitr';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const authResponse = await requireBackupRestoreAdmin();
  if (authResponse) {
    return authResponse;
  }

  try {
    const baseBackups = listPitrBaseBackups();
    return NextResponse.json({ success: true, baseBackups });
  } catch (error) {
    logger.error('Failed to list PITR base backups', { error });
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to list PITR base backups',
      },
      { status: 500 }
    );
  }
}
