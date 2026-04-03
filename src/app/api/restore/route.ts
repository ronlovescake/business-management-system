import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireBackupRestoreAdmin } from '../backup-restore/sharedRouteUtils';

const RETIRED_RESTORE_MESSAGE =
  'Browser/API restore has been retired for disaster recovery. Use the Docker full-dump restore workflow: npm run docker:restore:docker-db -- <dump-file> --confirm';

export async function POST(_request: NextRequest) {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  return NextResponse.json(
    {
      success: false,
      code: 'RESTORE_RETIRED',
      error: RETIRED_RESTORE_MESSAGE,
      supportedRestorePath:
        'npm run docker:restore:docker-db -- <dump-file> --confirm',
    },
    { status: 410 }
  );
}
