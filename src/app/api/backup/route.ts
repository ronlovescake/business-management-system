/**
 * Backup API Route
 *
 * Handles database backup operations with multiple formats
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDatabaseUrl } from '@/lib/env';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Force dynamic rendering for this route due to fs operations
export const dynamic = 'force-dynamic';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const TIMESTAMP_FOLDER_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

type BackupStrategy = 'full' | 'differential' | 'log';

interface BackupManifestFile {
  timestamp: string;
  database: string;
  format: string;
  strategy?: BackupStrategy;
  includeSoftDeleted?: boolean;
  baseTimestamp?: string | null;
  baseFolder?: string | null;
  changeWindow?: {
    since: string | null;
    until: string;
  } | null;
  files: Array<{
    name: string;
    size: number;
    path: string;
  }>;
  recordCounts?: Record<string, number>;
  differentialFallbackTables?: string[];
  logStats?: Record<string, number>;
}

interface BackupLookup {
  folder: string;
  manifest: BackupManifestFile;
}

const LOG_TABLES = [
  { name: 'change_log', model: 'changeLog', dateField: 'createdAt' },
  { name: 'audit_logs', model: 'auditLog', dateField: 'timestamp' },
];

function writeWorkbookToFile(workbook: XLSX.WorkBook, filePath: string) {
  const buffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer',
    compression: true,
  });
  fs.writeFileSync(filePath, buffer);
}

function isValidStrategy(value: unknown): value is BackupStrategy {
  return value === 'full' || value === 'differential' || value === 'log';
}

function sanitizeTimestamp(timestamp: string) {
  if (TIMESTAMP_FOLDER_REGEX.test(timestamp)) {
    return timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z');
  }
  return timestamp;
}

function parseTimestampToDate(timestamp?: string | null) {
  if (!timestamp) {
    return null;
  }
  const normalized = sanitizeTimestamp(timestamp);
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function listBackupFoldersDescending() {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }

  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => {
      const fullPath = path.join(BACKUP_DIR, name);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort()
    .reverse();
}

function readManifest(folder: string): BackupManifestFile | null {
  const manifestPath = path.join(BACKUP_DIR, folder, 'MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(
      fs.readFileSync(manifestPath, 'utf8')
    ) as BackupManifestFile;
  } catch (error) {
    logger.warn('Failed to parse manifest', { folder, error });
    return null;
  }
}

function findLatestBackupByStrategy(
  strategy: BackupStrategy
): BackupLookup | null {
  const folders = listBackupFoldersDescending();
  for (const folder of folders) {
    const manifest = readManifest(folder);
    if (manifest?.strategy === strategy) {
      return { folder, manifest };
    }
  }
  return null;
}

// Tables to backup
const TABLES = [
  { name: 'transactions', model: 'transaction' },
  { name: 'customers', model: 'customer' },
  { name: 'products', model: 'product' },
  { name: 'prices', model: 'price' },
  { name: 'shipments', model: 'shipment' },
  { name: 'employees', model: 'employee' },
  { name: 'schedules', model: 'schedule' },
  { name: 'attendance', model: 'attendance' },
  { name: 'payrolls', model: 'payroll' },
  { name: 'leave_requests', model: 'leaveRequest' },
  { name: 'expenses', model: 'expense' },
  { name: 'cash_advances', model: 'cashAdvanceRecord' },
  { name: 'cash_advance_deductions', model: 'cashAdvanceDeduction' },
  { name: 'checkout_links', model: 'checkoutLink' },
  { name: 'item_weights', model: 'itemWeight' },
];

function buildTableQueryOptions(
  sampleRecord: Record<string, unknown> | null,
  {
    includeSoftDeleted,
    strategy,
    differentialSince,
  }: {
    includeSoftDeleted: boolean;
    strategy: BackupStrategy;
    differentialSince: Date | null;
  }
) {
  const where: Record<string, unknown> = {};
  const hasDeletedAt = !!(sampleRecord && 'deletedAt' in sampleRecord);
  const hasUpdatedAt = !!(sampleRecord && 'updatedAt' in sampleRecord);
  let differentialUnsupported = false;

  if (hasDeletedAt && !includeSoftDeleted) {
    where.deletedAt = null;
  }

  if (strategy === 'differential' && differentialSince) {
    if (hasUpdatedAt) {
      where.updatedAt = { gte: differentialSince };
    } else {
      differentialUnsupported = true;
    }
  }

  return { where, hasDeletedAt, hasUpdatedAt, differentialUnsupported };
}

function parseDatabaseUrl() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found');
  }

  const match = dbUrl.match(
    /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/
  );
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }

  const [, user, password, host, port, database] = match;
  return { user, password, host, port, database };
}

function ensureBackupDir(timestamp: string) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestampDir = path.join(BACKUP_DIR, timestamp);
  if (!fs.existsSync(timestampDir)) {
    fs.mkdirSync(timestampDir, { recursive: true });
  }

  return timestampDir;
}

async function createSqlDump(
  timestamp: string,
  backupDir: string
): Promise<string | null> {
  try {
    const { user, password, host, port, database } = parseDatabaseUrl();
    const sqlFile = path.join(backupDir, `backup-${timestamp}.sql`);

    // Set PGPASSWORD environment variable for pg_dump
    const env = { ...process.env, PGPASSWORD: password };

    // Execute pg_dump
    const command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F p -f "${sqlFile}"`;

    logger.info(
      `Executing SQL dump: pg_dump -h ${host} -p ${port} -U ${user} -d ${database}`
    );

    await execAsync(command, { env });

    if (fs.existsSync(sqlFile)) {
      logger.info(`SQL dump created successfully: ${sqlFile}`);
      return sqlFile;
    }

    logger.warn('SQL dump file was not created');
    return null;
  } catch (error) {
    logger.error('SQL dump failed:', error);
    // Return null instead of throwing to allow backup to continue with CSV and JSON
    return null;
  }
}

// POST - Create backup
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      format?: string;
      includeSoftDeleted?: boolean;
      strategy?: BackupStrategy;
    };
    const { format = 'all', includeSoftDeleted = false } = body;
    let strategy: BackupStrategy = isValidStrategy(body.strategy)
      ? body.strategy
      : 'full';
    const requestedFormat = strategy === 'log' ? 'json' : format;

    // Generate timestamp in Manila timezone (UTC+8)
    const now = new Date();
    const manilaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const timestamp = manilaTime
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    const backupDir = ensureBackupDir(timestamp);

    let backupFile = '';
    const files: string[] = [];
    const recordCounts: Record<string, number> = {};
    const differentialFallbackTables: string[] = [];

    let baseReference: BackupLookup | null = null;
    let changeWindowStart: Date | null = null;

    if (strategy === 'differential') {
      baseReference = findLatestBackupByStrategy('full');
      if (!baseReference) {
        logger.warn(
          'Differential backup requested but no full backup exists. Falling back to full backup.'
        );
        strategy = 'full';
      } else {
        changeWindowStart = parseTimestampToDate(
          baseReference.manifest.timestamp
        );
      }
    } else if (strategy === 'log') {
      baseReference = findLatestBackupByStrategy('log');
      changeWindowStart = parseTimestampToDate(
        baseReference?.manifest.changeWindow?.until ??
          baseReference?.manifest.timestamp ??
          null
      );
    }

    const differentialSince =
      strategy === 'differential' ? changeWindowStart : null;
    const logSince = strategy === 'log' ? changeWindowStart : null;
    const changeWindow =
      strategy === 'full'
        ? null
        : {
            since:
              differentialSince?.toISOString() ??
              logSince?.toISOString() ??
              null,
            until: manilaTime.toISOString(),
          };

    // JSON or Log Backup
    if (requestedFormat === 'json' || requestedFormat === 'all') {
      const metadata = {
        createdAt: manilaTime.toISOString(),
        database: parseDatabaseUrl().database,
        format: 'json',
        version: '1.1',
        includeSoftDeleted,
        strategy,
        baseTimestamp: baseReference?.manifest.timestamp ?? null,
        baseFolder: baseReference?.folder ?? null,
        changeWindow,
      };

      const tables: Record<string, unknown> = {};

      if (strategy === 'log') {
        for (const logTable of LOG_TABLES) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const delegate = prisma[
              logTable.model as keyof typeof prisma
            ] as any;
            const where: Record<string, unknown> = {};
            if (logSince && logTable.dateField) {
              where[logTable.dateField] = { gt: logSince };
            }

            const orderBy = logTable.dateField
              ? { [logTable.dateField]: 'asc' }
              : undefined;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await delegate.findMany({ where, orderBy });
            tables[logTable.name] = {
              count: data.length,
              data,
              since: logSince?.toISOString() ?? null,
            };
            recordCounts[logTable.name] = data.length;
          } catch (error) {
            tables[logTable.name] = {
              count: 0,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
      } else {
        for (const { name, model } of TABLES) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const modelDelegate = prisma[model as keyof typeof prisma] as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sampleRecord = await modelDelegate.findFirst();
            const { where, differentialUnsupported } = buildTableQueryOptions(
              sampleRecord,
              {
                includeSoftDeleted,
                strategy,
                differentialSince,
              }
            );

            if (differentialUnsupported) {
              differentialFallbackTables.push(name);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await modelDelegate.findMany({ where });
            tables[name] = {
              count: data.length,
              data,
            };
            recordCounts[name] = data.length;
          } catch (error) {
            tables[name] = {
              count: 0,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
      }

      const jsonFileName =
        strategy === 'log'
          ? `log-backup-${timestamp}.json`
          : `backup-${timestamp}.json`;
      backupFile = path.join(backupDir, jsonFileName);
      fs.writeFileSync(
        backupFile,
        JSON.stringify(
          {
            metadata,
            tables,
          },
          null,
          2
        )
      );
      files.push(backupFile);
    }

    if (
      strategy !== 'log' &&
      (requestedFormat === 'csv' || requestedFormat === 'all')
    ) {
      logger.info('Starting CSV backup generation...');
      try {
        for (const { name, model } of TABLES) {
          try {
            logger.info(`Processing table: ${name}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const modelDelegate = prisma[model as keyof typeof prisma] as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sampleRecord = await modelDelegate.findFirst();
            const { where } = buildTableQueryOptions(sampleRecord, {
              includeSoftDeleted,
              strategy,
              differentialSince,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await modelDelegate.findMany({ where });
            recordCounts[name] = recordCounts[name] ?? data.length;

            logger.info(`Table ${name} has ${data.length} records`);

            if (data.length > 0) {
              const csvFile = path.join(backupDir, `${name}-${timestamp}.csv`);
              logger.info(`Generating CSV for ${name}...`);

              // Convert Prisma objects to plain objects and handle special types
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const plainData = data.map((record: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const plain: Record<string, any> = {};
                for (const key in record) {
                  const value = record[key];
                  if (value instanceof Date) {
                    plain[key] = value.toISOString();
                  } else if (typeof value === 'bigint') {
                    plain[key] = value.toString();
                  } else if (
                    value === null ||
                    value === undefined ||
                    typeof value === 'string' ||
                    typeof value === 'number' ||
                    typeof value === 'boolean'
                  ) {
                    plain[key] = value;
                  } else {
                    plain[key] = JSON.stringify(value);
                  }
                }
                return plain;
              });

              const csv = Papa.unparse(plainData);
              logger.info(`CSV generated, writing to file: ${csvFile}`);
              fs.writeFileSync(csvFile, csv);
              files.push(csvFile);
              backupFile = csvFile;
              logger.info(`CSV file created successfully: ${csvFile}`);
            } else {
              logger.info(`Skipping ${name} - no data`);
            }
          } catch (error) {
            logger.error(`CSV backup failed for table ${name}:`, error);
          }
        }
        logger.info(`CSV backup completed. Total files: ${files.length}`);
      } catch (error) {
        logger.error('CSV backup failed:', error);
      }
    }

    if (
      strategy !== 'log' &&
      (requestedFormat === 'sql' || requestedFormat === 'all')
    ) {
      logger.info('Starting SQL dump generation...');
      const sqlFile = await createSqlDump(timestamp, backupDir);
      if (sqlFile) {
        files.push(sqlFile);
        backupFile = sqlFile;
        logger.info('SQL dump completed successfully');
      } else {
        logger.warn('SQL dump was not created');
      }
    }

    if (
      strategy !== 'log' &&
      (requestedFormat === 'xlsx' || requestedFormat === 'all')
    ) {
      logger.info('Starting XLSX backup generation...');
      try {
        const wb = XLSX.utils.book_new();
        let sheetCount = 0;

        for (const { name, model } of TABLES) {
          try {
            logger.info(`Processing table for XLSX: ${name}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const modelDelegate = prisma[model as keyof typeof prisma] as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sampleRecord = await modelDelegate.findFirst();
            const { where } = buildTableQueryOptions(sampleRecord, {
              includeSoftDeleted,
              strategy,
              differentialSince,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await modelDelegate.findMany({ where });
            recordCounts[name] = recordCounts[name] ?? data.length;

            logger.info(`Table ${name} has ${data.length} records for XLSX`);

            if (data.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const plainData = data.map((record: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const plain: Record<string, any> = {};
                for (const key in record) {
                  const value = record[key];
                  if (value instanceof Date) {
                    plain[key] = value.toISOString();
                  } else if (typeof value === 'bigint') {
                    plain[key] = value.toString();
                  } else if (
                    value === null ||
                    value === undefined ||
                    typeof value === 'string' ||
                    typeof value === 'number' ||
                    typeof value === 'boolean'
                  ) {
                    plain[key] = value;
                  } else {
                    plain[key] = JSON.stringify(value);
                  }
                }
                return plain;
              });

              const ws = XLSX.utils.json_to_sheet(plainData);
              const sheetName = name.substring(0, 31);
              XLSX.utils.book_append_sheet(wb, ws, sheetName);
              sheetCount++;
              logger.info(`Added sheet ${sheetName} to workbook`);
            } else {
              logger.info(`Skipping ${name} for XLSX - no data`);
            }
          } catch (error) {
            logger.error(`XLSX backup failed for table ${name}:`, error);
          }
        }

        if (sheetCount > 0) {
          const xlsxFile = path.join(backupDir, `backup-${timestamp}.xlsx`);
          writeWorkbookToFile(wb, xlsxFile);
          files.push(xlsxFile);
          backupFile = xlsxFile;
          logger.info(
            `XLSX backup completed successfully with ${sheetCount} sheets: ${xlsxFile}`
          );
        } else {
          logger.warn('No data to write to XLSX file');
        }
      } catch (error) {
        logger.error('XLSX backup failed:', error);
      }
    }

    const manifest: BackupManifestFile = {
      timestamp: manilaTime.toISOString(),
      database: parseDatabaseUrl().database,
      format: requestedFormat,
      strategy,
      includeSoftDeleted,
      baseTimestamp: baseReference?.manifest.timestamp ?? null,
      baseFolder: baseReference?.folder ?? null,
      changeWindow,
      files: files.map((file) => ({
        name: path.basename(file),
        size: fs.statSync(file).size,
        path: path.relative(BACKUP_DIR, file),
      })),
      recordCounts,
      differentialFallbackTables:
        strategy === 'differential' && differentialFallbackTables.length
          ? differentialFallbackTables
          : undefined,
    };

    const manifestFile = path.join(backupDir, 'MANIFEST.json');
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

    const totalSize = files.reduce((sum, file) => {
      return sum + fs.statSync(file).size;
    }, 0);

    return NextResponse.json({
      success: true,
      message: 'Backup created successfully',
      backup: {
        timestamp,
        path: backupDir,
        files: files.map((f) => path.basename(f)),
        totalSize,
        format: requestedFormat,
        strategy,
      },
    });
  } catch (error) {
    logger.error('Backup failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Backup failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET - List available backups
export async function GET() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return NextResponse.json({ success: true, backups: [] });
    }

    const backupFolders = fs
      .readdirSync(BACKUP_DIR)
      .filter((name) => {
        const fullPath = path.join(BACKUP_DIR, name);
        return fs.statSync(fullPath).isDirectory();
      })
      .sort()
      .reverse(); // Most recent first

    const backups = backupFolders.map((folder) => {
      const folderPath = path.join(BACKUP_DIR, folder);
      const manifestPath = path.join(folderPath, 'MANIFEST.json');

      let manifest = null;
      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch {
          // Ignore invalid manifest
        }
      }

      const files = fs.readdirSync(folderPath);
      const totalSize = files.reduce((sum, file) => {
        const filePath = path.join(folderPath, file);
        return sum + fs.statSync(filePath).size;
      }, 0);

      return {
        timestamp: folder,
        path: folderPath,
        files: files,
        totalSize,
        manifest,
        strategy: manifest?.strategy,
      };
    });

    return NextResponse.json({ success: true, backups });
  } catch (error) {
    logger.error('Failed to list backups:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list backups',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific backup
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('timestamp');

    if (!timestamp) {
      return NextResponse.json(
        { success: false, error: 'Timestamp parameter required' },
        { status: 400 }
      );
    }

    const backupPath = path.join(BACKUP_DIR, timestamp);

    if (!fs.existsSync(backupPath)) {
      return NextResponse.json(
        { success: false, error: 'Backup not found' },
        { status: 404 }
      );
    }

    // Delete backup folder recursively
    fs.rmSync(backupPath, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      message: 'Backup deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete backup:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete backup',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
