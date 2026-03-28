/**
 * Restore API Route
 *
 * Handles database restore operations from backups
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getBackupDirectory } from '@/lib/backup-storage';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { sortTablesForRestore } from './restore-order';
import { type RowRecord } from './restorePreviewUtils';
import { RESTORE_MODEL_MAP } from './restoreModelMap';
import {
  ensureModelSupportsDeletedAt,
  getModelDelegate,
  processTablePreview,
  processTableRestore,
  type PreviewTableResult,
} from './restoreTableService';
import {
  computeFileSha256,
  isSafeBackupFilename,
  isValidTimestampFolderName,
  requireBackupRestoreAdmin,
} from '../backup-restore/sharedRouteUtils';
const BACKUP_DIR = getBackupDirectory();
const RESTORE_MUTEX_KEY = '__restore_global__';
const activeRestoreMutexes = new Set<string>();

// POST - Restore from backup
export async function POST(request: NextRequest) {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  let lockAcquired = false;

  try {
    const body = (await request.json()) as {
      timestamp?: string;
      file?: string;
      tables?: string[];
      forceOverwrite?: boolean;
      previewOnly?: boolean;
      stopOnError?: boolean;
    };
    const {
      timestamp,
      file,
      tables,
      forceOverwrite = false,
      previewOnly = false,
      stopOnError = true,
    } = body;

    if (
      typeof forceOverwrite !== 'boolean' ||
      typeof previewOnly !== 'boolean' ||
      typeof stopOnError !== 'boolean'
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid restore options payload' },
        { status: 400 }
      );
    }

    const shouldAbortOnError = stopOnError && !previewOnly;

    if (!previewOnly) {
      if (activeRestoreMutexes.has(RESTORE_MUTEX_KEY)) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Another restore operation is already in progress. Please retry after it completes.',
          },
          { status: 409 }
        );
      }

      activeRestoreMutexes.add(RESTORE_MUTEX_KEY);
      lockAcquired = true;
    }

    if (!timestamp || !file) {
      return NextResponse.json(
        { success: false, error: 'Missing timestamp or file parameter' },
        { status: 400 }
      );
    }

    if (!isValidTimestampFolderName(timestamp)) {
      return NextResponse.json(
        { success: false, error: 'Invalid timestamp format' },
        { status: 400 }
      );
    }

    if (!isSafeBackupFilename(file)) {
      return NextResponse.json(
        { success: false, error: 'Invalid backup filename' },
        { status: 400 }
      );
    }

    const backupPath = path.join(BACKUP_DIR, timestamp, file);
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
        { success: false, error: 'Backup file not found' },
        { status: 404 }
      );
    }

    // Only JSON restore is supported via API (SQL requires psql command)
    if (!file.endsWith('.json')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only JSON backups can be restored via API',
        },
        { status: 400 }
      );
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as {
      tables?: Record<string, { data?: RowRecord[] }>;
    };

    if (!backupData.tables || typeof backupData.tables !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid backup file format' },
        { status: 400 }
      );
    }

    // If manifest includes checksums, verify selected backup file integrity before restore.
    const manifestPath = path.join(BACKUP_DIR, timestamp, 'MANIFEST.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        files?: Array<{ name: string; checksum?: string }>;
        integrity?: { fileChecksums?: Record<string, string> };
      };
      const manifestEntry = manifest.files?.find(
        (entry) => entry.name === file
      );
      const expectedChecksum =
        manifestEntry?.checksum ?? manifest.integrity?.fileChecksums?.[file];

      if (expectedChecksum) {
        const actualChecksum = await computeFileSha256(backupPath);
        if (actualChecksum !== expectedChecksum) {
          return NextResponse.json(
            {
              success: false,
              error: 'Backup integrity verification failed',
            },
            { status: 409 }
          );
        }
      }
    }

    const results: Record<
      string,
      {
        count: number;
        updated?: number;
        error?: string;
        beforeCount?: number;
        afterCount?: number;
        attempted?: number;
        skipped?: number;
      }
    > = {};
    const previewResults: Record<string, PreviewTableResult> = {};
    const requestedTablesRaw = tables ?? Object.keys(backupData.tables);

    if (!Array.isArray(requestedTablesRaw)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tables payload' },
        { status: 400 }
      );
    }

    const requestedTables = Array.from(
      new Set(
        requestedTablesRaw
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      )
    );

    if (!requestedTables.length) {
      return NextResponse.json(
        { success: false, error: 'No tables selected for restore' },
        { status: 400 }
      );
    }

    const unknownTables = requestedTables.filter(
      (tableName) => !RESTORE_MODEL_MAP[tableName]
    );
    if (unknownTables.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown tables requested: ${unknownTables.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const tablesToRestore = sortTablesForRestore(requestedTables);

    if (previewOnly) {
      for (const tableName of tablesToRestore) {
        const tableData = backupData.tables[tableName];

        if (!tableData || !Array.isArray(tableData.data)) {
          previewResults[tableName] = {
            attempted: 0,
            inserts: [],
            updates: [],
            skipped: 0,
            notice: 'No data to preview',
          };
          continue;
        }

        if (tableData.data.length === 0) {
          previewResults[tableName] = {
            attempted: 0,
            inserts: [],
            updates: [],
            skipped: 0,
            notice: 'No data to restore',
          };
          continue;
        }

        try {
          const modelName = RESTORE_MODEL_MAP[tableName];
          const modelDelegate = getModelDelegate(prisma, modelName);
          previewResults[tableName] = await processTablePreview(
            modelDelegate,
            { data: tableData.data },
            forceOverwrite
          );
        } catch (error) {
          previewResults[tableName] = {
            attempted: tableData.data.length,
            inserts: [],
            updates: [],
            skipped: 0,
            notice:
              error instanceof Error
                ? error.message
                : 'Failed to generate preview',
          };
        }
      }

      return NextResponse.json({
        success: true,
        preview: previewResults,
      });
    }

    if (shouldAbortOnError) {
      let abortedAt: string | null = null;

      try {
        await prisma.$transaction(async (tx) => {
          for (const tableName of tablesToRestore) {
            const tableData = backupData.tables?.[tableName];

            if (!tableData || !Array.isArray(tableData.data)) {
              results[tableName] = { count: 0, error: 'No data to restore' };
              abortedAt = tableName;
              throw new Error('Restore aborted due to invalid table data');
            }

            if (tableData.data.length === 0) {
              results[tableName] = { count: 0, error: 'No data to restore' };
              continue;
            }

            try {
              const modelName = RESTORE_MODEL_MAP[tableName];
              const txDelegate = getModelDelegate(tx, modelName);
              results[tableName] = await processTableRestore(
                txDelegate,
                { data: tableData.data },
                forceOverwrite
              );
            } catch (error) {
              results[tableName] = {
                count: 0,
                error: error instanceof Error ? error.message : String(error),
              };
              abortedAt = tableName;
              throw error;
            }
          }
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message: 'Restore aborted due to table restore error',
            abortedAt,
            results,
            error: error instanceof Error ? error.message : String(error),
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Restore completed',
        results,
      });
    }

    for (const tableName of tablesToRestore) {
      const tableData = backupData.tables[tableName];

      if (
        !tableData ||
        !Array.isArray(tableData.data) ||
        tableData.data.length === 0
      ) {
        results[tableName] = { count: 0, error: 'No data to restore' };
        continue;
      }

      const modelName = RESTORE_MODEL_MAP[tableName];
      const tableRows = tableData.data;
      if (!modelName) {
        results[tableName] = { count: 0, error: 'Unknown table' };
        if (shouldAbortOnError) {
          return NextResponse.json(
            {
              success: false,
              message: 'Restore aborted due to unknown table',
              abortedAt: tableName,
              results,
            },
            { status: 400 }
          );
        }
        continue;
      }

      try {
        results[tableName] = await prisma.$transaction(async (tx) => {
          const txDelegate = getModelDelegate(tx, modelName);
          return processTableRestore(
            txDelegate,
            { data: tableRows },
            forceOverwrite
          );
        });
      } catch (error) {
        if (previewOnly) {
          previewResults[tableName] = {
            attempted: tableRows.length,
            inserts: [],
            updates: [],
            skipped: 0,
            notice:
              error instanceof Error
                ? error.message
                : 'Failed to generate preview',
          };
        } else {
          results[tableName] = {
            count: 0,
            error: error instanceof Error ? error.message : String(error),
          };

          if (shouldAbortOnError) {
            return NextResponse.json(
              {
                success: false,
                message: 'Restore aborted due to table restore error',
                abortedAt: tableName,
                results,
              },
              { status: 500 }
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Restore completed',
      results,
    });
  } catch (error) {
    logger.error('Restore failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Restore failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    if (lockAcquired) {
      activeRestoreMutexes.delete(RESTORE_MUTEX_KEY);
    }
    await prisma.$disconnect();
  }
}

// GET - Get soft-deleted records for restoration
export async function GET(request: NextRequest) {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const date = searchParams.get('date');

    if (!table) {
      return NextResponse.json(
        { success: false, error: 'Table parameter required' },
        { status: 400 }
      );
    }

    const modelName = RESTORE_MODEL_MAP[table];
    if (!modelName) {
      return NextResponse.json(
        { success: false, error: 'Unknown table' },
        { status: 400 }
      );
    }

    const where: { deletedAt: { not: null; gte?: Date } } = {
      deletedAt: { not: null },
    };

    if (date) {
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid date parameter' },
          { status: 400 }
        );
      }
      where.deletedAt.gte = parsedDate;
    }

    const modelDelegate = getModelDelegate(prisma, modelName);
    const supportsDeletedAt = await ensureModelSupportsDeletedAt(
      modelDelegate,
      table
    );
    if (!supportsDeletedAt.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Table does not support soft-delete restore',
          details: supportsDeletedAt.error,
        },
        { status: 400 }
      );
    }

    const deletedRecords = await modelDelegate.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      take: 100, // Limit to 100 records
    });

    return NextResponse.json({
      success: true,
      table,
      count: deletedRecords.length,
      records: deletedRecords,
    });
  } catch (error) {
    logger.error('Failed to get deleted records:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get deleted records',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH - Restore soft-deleted records
export async function PATCH(request: NextRequest) {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  try {
    const body = (await request.json()) as {
      table?: string;
      ids?: Array<number | string>;
    };
    const { table, ids } = body;

    if (!table || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing table or ids parameter' },
        { status: 400 }
      );
    }

    if (
      ids.some(
        (value) =>
          (typeof value !== 'number' && typeof value !== 'string') ||
          `${value}`.trim() === ''
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid ids parameter' },
        { status: 400 }
      );
    }

    const modelName = RESTORE_MODEL_MAP[table];
    if (!modelName) {
      return NextResponse.json(
        { success: false, error: 'Unknown table' },
        { status: 400 }
      );
    }

    const modelDelegate = getModelDelegate(prisma, modelName);
    const supportsDeletedAt = await ensureModelSupportsDeletedAt(
      modelDelegate,
      table
    );
    if (!supportsDeletedAt.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Table does not support soft-delete restore',
          details: supportsDeletedAt.error,
        },
        { status: 400 }
      );
    }

    const result = await modelDelegate.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null },
    });

    return NextResponse.json({
      success: true,
      message: `Restored ${result.count} records`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Failed to restore records:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to restore records',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
