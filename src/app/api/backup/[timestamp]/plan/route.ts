import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { getBackupDirectory } from '@/lib/backup-storage';
import { planRestoreChain } from '@/lib/backup/restorePlanner';
import {
  isValidTimestampFolderName,
  requireBackupRestoreAdmin,
} from '@/app/api/backup-restore/sharedRouteUtils';

const BACKUP_DIR = getBackupDirectory();

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { timestamp: string } }
) {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  const timestamp = params.timestamp;
  if (!isValidTimestampFolderName(timestamp)) {
    return NextResponse.json(
      { success: false, error: 'Invalid timestamp format' },
      { status: 400 }
    );
  }

  const backupPath = path.join(BACKUP_DIR, timestamp);
  const resolvedPath = path.resolve(backupPath);
  const resolvedBackupDir = path.resolve(BACKUP_DIR);
  if (!resolvedPath.startsWith(resolvedBackupDir)) {
    return NextResponse.json(
      { success: false, error: 'Access denied' },
      { status: 403 }
    );
  }

  if (!fs.existsSync(backupPath)) {
    return NextResponse.json(
      { success: false, error: 'Backup not found' },
      { status: 404 }
    );
  }

  const plan = planRestoreChain({ folder: timestamp });

  return NextResponse.json({ success: true, plan });
}
