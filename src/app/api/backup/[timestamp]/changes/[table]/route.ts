import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';

import { prisma } from '@/lib/db';
import { getBackupDirectory } from '@/lib/backup-storage';
import {
  BACKUP_CHANGE_PREVIEW_MAX_ROWS,
  buildBackupChangePreview,
} from '@/lib/backup/backupChangePreview';
import {
  isValidTimestampFolderName,
  requireBackupRestoreAdmin,
} from '@/app/api/backup-restore/sharedRouteUtils';
import { readManifest } from '@/app/api/backup/backupRouteUtils';
import { RESTORE_MODEL_MAP } from '@/app/api/restore/restoreModelMap';
import {
  getModelDelegate,
  type RestoreModelDelegate,
} from '@/app/api/restore/restoreTableService';
import type { RowRecord } from '@/app/api/restore/restorePreviewUtils';

const BACKUP_DIR = getBackupDirectory();

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABLE_PARAM_REGEX = /^[a-z0-9_]+$/i;

async function readAllTableRows(filePath: string, tableName: string) {
  return await new Promise<RowRecord[]>((resolve, reject) => {
    let settled = false;
    const rows: RowRecord[] = [];

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(rows);
    };

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const fileStream = fs.createReadStream(filePath);
    const jsonStream = fileStream
      .pipe(parser())
      .pipe(pick({ filter: `tables.${tableName}.data` }))
      .pipe(streamArray());

    jsonStream.on('data', (data: { value: unknown }) => {
      if (data.value && typeof data.value === 'object') {
        rows.push(data.value as RowRecord);
      }
    });

    jsonStream.on('end', finish);
    jsonStream.on('close', finish);
    jsonStream.on('error', fail);
    fileStream.on('error', fail);
  });
}

function getJsonBackupFilePath(timestamp: string, tableName: string) {
  const manifest = readManifest(BACKUP_DIR, timestamp);
  if (!manifest) {
    throw new Error('Backup manifest not found');
  }

  if ((manifest.strategy ?? 'full') !== 'full') {
    throw new Error(
      'Detailed change preview is currently available only for full backups.'
    );
  }

  const backupCount = manifest.recordCounts?.[tableName] ?? 0;
  if (backupCount > BACKUP_CHANGE_PREVIEW_MAX_ROWS) {
    throw new Error(
      `Detailed change preview is limited to tables with at most ${BACKUP_CHANGE_PREVIEW_MAX_ROWS.toLocaleString()} backup rows.`
    );
  }

  const jsonFile =
    manifest.files.find(
      (file) => file.name.includes('backup-') && file.name.endsWith('.json')
    ) ?? manifest.files.find((file) => file.name.endsWith('.json'));

  if (!jsonFile?.path) {
    throw new Error(
      'This backup does not include a JSON inspection artifact for row-level diff preview.'
    );
  }

  return {
    backupCount,
    filePath: path.resolve(BACKUP_DIR, jsonFile.path),
  };
}

function getRestoreDelegate(tableName: string) {
  const modelName = RESTORE_MODEL_MAP[tableName];
  if (!modelName) {
    throw new Error(
      'Detailed change preview is unavailable for this table because it is not JSON-restorable.'
    );
  }

  return getModelDelegate(prisma, modelName) as RestoreModelDelegate;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { timestamp: string; table: string } }
) {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  const { timestamp, table } = params;

  if (!isValidTimestampFolderName(timestamp)) {
    return NextResponse.json(
      { success: false, error: 'Invalid timestamp format' },
      { status: 400 }
    );
  }

  if (!TABLE_PARAM_REGEX.test(table)) {
    return NextResponse.json(
      { success: false, error: 'Invalid table parameter' },
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

  try {
    const { backupCount, filePath } = getJsonBackupFilePath(timestamp, table);
    const modelDelegate = getRestoreDelegate(table);
    const currentCount = await modelDelegate.count();

    if (currentCount > BACKUP_CHANGE_PREVIEW_MAX_ROWS) {
      return NextResponse.json(
        {
          success: false,
          error: `Detailed change preview is limited to tables with at most ${BACKUP_CHANGE_PREVIEW_MAX_ROWS.toLocaleString()} current rows.`,
        },
        { status: 409 }
      );
    }

    const [backupRows, currentRows] = await Promise.all([
      backupCount > 0 ? readAllTableRows(filePath, table) : Promise.resolve([]),
      modelDelegate.findMany({}) as Promise<RowRecord[]>,
    ]);

    const preview = buildBackupChangePreview(table, backupRows, currentRows);

    return NextResponse.json({ success: true, preview });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to build detailed change preview',
      },
      { status: 409 }
    );
  }
}
