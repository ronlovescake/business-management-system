import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { getBackupDirectory } from '@/lib/backup-storage';
import { buildBackupChangesComparison } from '@/lib/backup/backupChanges';
import {
  buildRecordCountsFromSnapshot,
  collectRestoreVerificationSnapshot,
} from '@/lib/backup/restoreVerification';
import {
  isValidTimestampFolderName,
  requireBackupRestoreAdmin,
} from '@/app/api/backup-restore/sharedRouteUtils';
import { readManifest } from '@/app/api/backup/backupRouteUtils';

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

  const manifest = readManifest(BACKUP_DIR, timestamp);
  if (!manifest) {
    return NextResponse.json(
      { success: false, error: 'Backup manifest not found' },
      { status: 404 }
    );
  }

  const backupStrategy = manifest.strategy ?? 'full';
  if (backupStrategy !== 'full') {
    return NextResponse.json(
      {
        success: false,
        error:
          'Change summaries are currently available only for full backups with snapshot counts.',
      },
      { status: 409 }
    );
  }

  const backupRecordCounts =
    manifest.recordCounts ??
    buildRecordCountsFromSnapshot(manifest.restoreVerification);

  if (!Object.keys(backupRecordCounts).length) {
    return NextResponse.json(
      {
        success: false,
        error:
          'This backup does not contain enough count metadata to compare against the live database.',
      },
      { status: 409 }
    );
  }

  const liveSnapshot = await collectRestoreVerificationSnapshot();
  const comparison = buildBackupChangesComparison({
    backupTimestamp: timestamp,
    backupCreatedAt: manifest.timestamp ?? null,
    backupStrategy,
    backupRecordCounts,
    liveSnapshot,
  });

  return NextResponse.json({ success: true, comparison });
}
