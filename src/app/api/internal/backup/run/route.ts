import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getBackupDirectory } from '@/lib/backup-storage';
import { createFullDumpBackup } from '@/lib/backup/fullDumpBackupJob';
import { pruneExpiredBackups } from '@/lib/backup/backupRetention';
import {
  listBackupFoldersDescending,
  parseTimestampToDate,
  readManifest,
} from '@/app/api/backup/backupRouteUtils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SchedulerRequestBody = {
  retentionDays?: number;
  skipIfAlreadyCompletedToday?: boolean;
  timeZone?: string;
};

function requireInternalToken(req: NextRequest): NextResponse | null {
  const expected = (process.env.INTERNAL_JOB_TOKEN || '').trim();
  if (!expected) {
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_JOB_TOKEN is not configured on the server',
      },
      { status: 500 }
    );
  }

  const provided = (req.headers.get('x-internal-token') || '').trim();
  if (!provided || provided !== expected) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
    );
  }

  return null;
}

function parseRetentionDays(value: unknown) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 1) {
    const envValue = Number(process.env.BACKUP_RETENTION_DAYS || 30);
    return Number.isFinite(envValue) && envValue > 0 ? envValue : 30;
  }

  return Math.floor(parsed);
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }

  return fallback;
}

function buildDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}

function findExistingFullDumpForToday(timeZone: string) {
  const backupDir = getBackupDirectory();
  const todayKey = buildDateKey(new Date(), timeZone);

  for (const folder of listBackupFoldersDescending(backupDir)) {
    const manifest = readManifest(backupDir, folder);
    if (manifest?.strategy !== 'full' || manifest.format !== 'dump') {
      continue;
    }

    const manifestDate = parseTimestampToDate(manifest.timestamp ?? folder);
    if (!manifestDate) {
      continue;
    }

    if (buildDateKey(manifestDate, timeZone) === todayKey) {
      return {
        timestamp: folder,
        files: manifest.files.map((file) => file.name),
        totalSize: manifest.files.reduce((sum, file) => sum + file.size, 0),
        format: 'dump' as const,
        strategy: 'full' as const,
      };
    }
  }

  return null;
}

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

  const retentionDays = parseRetentionDays(body.retentionDays);
  const timeZone =
    typeof body.timeZone === 'string' && body.timeZone.trim().length > 0
      ? body.timeZone.trim()
      : process.env.BACKUP_AUTO_TIMEZONE || 'Asia/Manila';
  const skipIfAlreadyCompletedToday = parseBoolean(
    body.skipIfAlreadyCompletedToday,
    true
  );

  try {
    if (skipIfAlreadyCompletedToday) {
      const existingBackup = findExistingFullDumpForToday(timeZone);
      if (existingBackup) {
        const prune = pruneExpiredBackups(retentionDays);
        return NextResponse.json({
          success: true,
          skipped: true,
          reason:
            'Daily full dump already exists for the current scheduled day',
          backup: existingBackup,
          prune,
        });
      }
    }

    const result = await createFullDumpBackup();
    const prune = pruneExpiredBackups(retentionDays);

    return NextResponse.json({
      ...result,
      prune,
    });
  } catch (error) {
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
