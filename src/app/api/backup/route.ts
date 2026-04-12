/**
 * Backup API Route
 *
 * Handles database backup operations with multiple formats
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getDatabaseUrl } from '@/lib/env';
import { getBackupDirectory } from '@/lib/backup-storage';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { spawn } from 'child_process';
import {
  isValidTimestampFolderName,
  requireBackupRestoreAdmin,
} from '../backup-restore/sharedRouteUtils';
import {
  buildFileChecksums,
  isStrictMissingTablesEnabled,
  verifyFileChecksums,
  writeFileAtomic,
  writeWorkbookToFile,
} from './backupRouteFileOps';
import {
  buildBackupFolderTimestamp,
  describeFiles,
  findLatestBackupByStrategy,
  parseTimestampToDate,
  type BackupLookup,
  type BackupManifestFile,
  type BackupSchedulerMetadata,
  type BackupStrategy,
} from './backupRouteUtils';
import {
  LOG_BACKUP_TABLES as LOG_TABLES,
  SELECTIVE_BACKUP_TABLES as TABLES,
} from '@/lib/backup/backupModelRegistry';
import {
  buildRecordCountsFromSnapshot,
  collectRestoreVerificationSnapshot,
  type RestoreVerificationSnapshot,
} from '@/lib/backup/restoreVerification';

// Force dynamic rendering for this route due to fs operations
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BACKUP_DIR = getBackupDirectory();

type BackupFormat = 'json' | 'csv' | 'xlsx' | 'dump' | 'all';

type TableAvailabilityCache = Map<string, boolean>;

type BackupRowRecord = Record<string, unknown>;
type TabularCell = string | number | boolean | null;
type TabularRecord = Record<string, TabularCell>;

type BackupModelDelegate = {
  findFirst: (args?: unknown) => Promise<BackupRowRecord | null>;
  findMany: (args?: unknown) => Promise<BackupRowRecord[]>;
};

class MissingRequiredTablesError extends Error {
  missingTables: string[];

  constructor(missingTables: string[]) {
    super('Backup strict mode failed due to missing required tables');
    this.name = 'MissingRequiredTablesError';
    this.missingTables = missingTables;
  }
}

class BackupGenerationError extends Error {
  details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = 'BackupGenerationError';
    this.details = details;
  }
}

export type CreateBackupJobOptions = {
  format?: string;
  includeSoftDeleted?: boolean;
  strategy?: BackupStrategy;
  strictMissingTables?: boolean;
  allowStrategyFallback?: boolean;
  scheduler?: BackupSchedulerMetadata;
};

export type CreateBackupJobResult = {
  success: true;
  message: string;
  warnings?: string[];
  backup: {
    totalSize: number;
    timestamp: string;
    files: string[];
    format: BackupFormat;
    strategy: BackupStrategy;
  };
  manifest: BackupManifestFile;
};

function isValidStrategy(value: unknown): value is BackupStrategy {
  return value === 'full' || value === 'differential' || value === 'log';
}

type GenericRecord = Record<string, unknown>;

interface PrismaFindManyDelegate<
  TRecord extends GenericRecord = GenericRecord,
> {
  findMany: (args?: Record<string, unknown>) => Promise<TRecord[]>;
}

interface PrismaQueryDelegate<TRecord extends GenericRecord = GenericRecord>
  extends PrismaFindManyDelegate<TRecord> {
  findFirst: (args?: Record<string, unknown>) => Promise<TRecord | null>;
}

function getFindManyDelegate(
  model: (typeof TABLES)[number]['model'] | (typeof LOG_TABLES)[number]['model']
): PrismaFindManyDelegate {
  const delegate = prisma[model as keyof typeof prisma];
  if (
    !delegate ||
    typeof delegate !== 'object' ||
    typeof (delegate as { findMany?: unknown }).findMany !== 'function'
  ) {
    throw new Error(`Model ${model} does not support findMany operations`);
  }
  return delegate as PrismaFindManyDelegate;
}

function getQueryDelegate(
  model: (typeof TABLES)[number]['model']
): PrismaQueryDelegate {
  const delegate = prisma[model as keyof typeof prisma];
  if (
    !delegate ||
    typeof delegate !== 'object' ||
    typeof (delegate as { findMany?: unknown }).findMany !== 'function' ||
    typeof (delegate as { findFirst?: unknown }).findFirst !== 'function'
  ) {
    throw new Error(`Model ${model} does not support expected Prisma queries`);
  }
  return delegate as PrismaQueryDelegate;
}

function toPrismaModelName(modelDelegateName: string) {
  if (!modelDelegateName.length) {
    return modelDelegateName;
  }
  return modelDelegateName[0].toUpperCase() + modelDelegateName.slice(1);
}

function getSchemaForModelName(modelName: string) {
  return modelName.startsWith('GeneralMerchandise')
    ? 'general_merchandise'
    : 'public';
}

function isMissingTableError(error: unknown): error is {
  code: string;
  meta?: { table?: string; modelName?: string };
} {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2021'
  );
}

async function isModelTableAvailable(
  model: (typeof TABLES)[number]['model'],
  cache: TableAvailabilityCache
) {
  const cached = cache.get(model);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const modelName = toPrismaModelName(model);
    const dmmfModel = Prisma.dmmf.datamodel.models.find(
      (entry) => entry.name === modelName
    );

    if (!dmmfModel?.dbName) {
      cache.set(model, true);
      return true;
    }

    const schema = getSchemaForModelName(modelName);
    const regclassName = `${schema}.${dmmfModel.dbName}`;
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass(${regclassName}) IS NOT NULL AS "exists"
    `;
    const exists = !!result?.[0]?.exists;

    cache.set(model, exists);
    return exists;
  } catch (error) {
    logger.warn('Failed to pre-check table availability; continuing backup', {
      model,
      error,
    });
    cache.set(model, true);
    return true;
  }
}

function reserveUniqueSheetName(baseName: string, usedNames: Set<string>) {
  const fallback = 'Sheet';
  const normalizedBase = (baseName || fallback).slice(0, 31);
  let candidate = normalizedBase;
  let suffixNumber = 2;

  while (usedNames.has(candidate)) {
    const suffix = `_${suffixNumber}`;
    candidate = `${normalizedBase.slice(0, 31 - suffix.length)}${suffix}`;
    suffixNumber++;
  }

  usedNames.add(candidate);
  return candidate;
}

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

function getBackupModelDelegate(model: string): BackupModelDelegate {
  const candidate = prisma[model as keyof typeof prisma] as unknown;
  const delegate = candidate as Partial<BackupModelDelegate>;

  if (
    !delegate ||
    typeof delegate.findFirst !== 'function' ||
    typeof delegate.findMany !== 'function'
  ) {
    throw new Error(`Invalid backup model delegate for: ${model}`);
  }

  return delegate as BackupModelDelegate;
}

function normalizeTabularValue(value: unknown): TabularCell {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value ?? null;
  }

  return JSON.stringify(value);
}

function toTabularRecords(data: BackupRowRecord[]): TabularRecord[] {
  return data.map((record) =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        key,
        normalizeTabularValue(value),
      ])
    )
  );
}

function parseDatabaseUrl() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found');
  }

  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Invalid DATABASE_URL format'
    );
  }

  if (!parsed.username || !parsed.pathname) {
    throw new Error('Invalid DATABASE_URL format');
  }

  const database = parsed.pathname.replace(/^\//, '');
  if (!database) {
    throw new Error('Invalid DATABASE_URL format');
  }

  return {
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password ?? ''),
    host: parsed.hostname,
    port: parsed.port || '5432',
    database,
  };
}

const normalizeJsonValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }

  if (typeof value === 'object') {
    const serializable = value as { toJSON?: () => unknown };
    if (typeof serializable.toJSON === 'function') {
      return serializable.toJSON();
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        normalizeJsonValue(val),
      ])
    );
  }

  return value;
};

const normalizeJsonRecord = (record: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      normalizeJsonValue(value),
    ])
  );

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

function cleanupPartialBackup(backupDir: string | null) {
  if (!backupDir) {
    return;
  }

  const resolvedRoot = path.resolve(BACKUP_DIR);
  const resolvedBackupDir = path.resolve(backupDir);

  if (
    resolvedBackupDir === resolvedRoot ||
    !resolvedBackupDir.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    logger.warn('Refusing to clean up backup directory outside backup root', {
      backupDir: resolvedBackupDir,
      backupRoot: resolvedRoot,
    });
    return;
  }

  try {
    fs.rmSync(resolvedBackupDir, { recursive: true, force: true });
  } catch (error) {
    logger.warn('Failed to clean up partial backup directory', {
      backupDir: resolvedBackupDir,
      error,
    });
  }
}

type DatabaseDumpResult =
  | { ok: true; filePath: string }
  | { ok: false; error: string };

type DatabaseConnectionConfig = {
  user: string;
  password: string;
  host: string;
  port: string;
  database: string;
};

function isCommandNotFoundError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as NodeJS.ErrnoException;
  return (
    maybeError.code === 'ENOENT' ||
    maybeError.message?.includes('ENOENT') ||
    maybeError.message?.includes('command not found')
  );
}

function runLocalPgDump(
  config: DatabaseConnectionConfig,
  dumpFile: string
): Promise<void> {
  const env = {
    ...process.env,
    ...(config.password ? { PGPASSWORD: config.password } : {}),
  };

  const args = [
    '-h',
    config.host,
    '-p',
    config.port,
    '-U',
    config.user,
    '-d',
    config.database,
    '-F',
    'c',
    '-f',
    dumpFile,
  ];

  logger.info(
    `Executing PostgreSQL custom dump: pg_dump -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database}`
  );

  return new Promise<void>((resolve, reject) => {
    const child = spawn('pg_dump', args, { env });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `pg_dump failed with code ${code}`));
    });
  });
}

function runDockerPgDump(
  config: DatabaseConnectionConfig,
  dumpFile: string
): Promise<void> {
  const composeArgs = ['compose'];
  const envFilePath = path.resolve(process.cwd(), '.env.docker');
  if (fs.existsSync(envFilePath)) {
    composeArgs.push('--env-file', envFilePath);
  }

  composeArgs.push(
    'exec',
    '-T',
    '-e',
    `PGUSER=${config.user}`,
    '-e',
    `PGDATABASE=${config.database}`,
    '-e',
    'PGPORT=5432'
  );

  if (config.password) {
    composeArgs.push('-e', `PGPASSWORD=${config.password}`);
  }

  composeArgs.push(
    'db',
    'sh',
    '-lc',
    'exec pg_dump -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -F c'
  );

  logger.info(
    `Local pg_dump unavailable; falling back to docker compose exec db pg_dump for ${config.database}`
  );

  return new Promise<void>((resolve, reject) => {
    const child = spawn('docker', composeArgs, {
      cwd: process.cwd(),
      env: process.env,
    });
    const fileStream = fs.createWriteStream(dumpFile);
    let stderr = '';

    child.stdout.pipe(fileStream);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      fileStream.destroy();
      reject(error);
    });

    fileStream.on('error', (error) => {
      child.kill('SIGTERM');
      reject(error);
    });

    child.on('close', (code) => {
      fileStream.end(() => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            stderr || `docker compose exec db pg_dump failed with code ${code}`
          )
        );
      });
    });
  });
}

function normalizeBackupFormat(value: unknown): BackupFormat {
  if (
    value === 'json' ||
    value === 'csv' ||
    value === 'xlsx' ||
    value === 'dump' ||
    value === 'all'
  ) {
    return value;
  }

  if (value === 'sql') {
    return 'dump';
  }

  return 'all';
}

async function createDatabaseDump(
  timestamp: string,
  backupDir: string,
  strategy: string
): Promise<DatabaseDumpResult> {
  try {
    const { user, password, host, port, database } = parseDatabaseUrl();
    const config = {
      user,
      password,
      host,
      port,
      database,
    } satisfies DatabaseConnectionConfig;
    const dumpFile = path.join(backupDir, `${strategy}-backup-${timestamp}.dump`);

    try {
      await runLocalPgDump(config, dumpFile);
    } catch (error) {
      if (!isCommandNotFoundError(error)) {
        throw error;
      }

      if (fs.existsSync(dumpFile)) {
        fs.rmSync(dumpFile, { force: true });
      }

      await runDockerPgDump(config, dumpFile);
    }

    if (fs.existsSync(dumpFile)) {
      logger.info(`Database dump created successfully: ${dumpFile}`);
      return { ok: true, filePath: dumpFile };
    }

    logger.warn('Database dump file was not created');
    return {
      ok: false,
      error: 'pg_dump completed without producing a dump file',
    };
  } catch (error) {
    logger.error('Database dump failed:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function createBackupJob({
  format = 'all',
  includeSoftDeleted = false,
  strategy: requestedStrategy,
  strictMissingTables = isStrictMissingTablesEnabled(),
  allowStrategyFallback = true,
  scheduler,
}: CreateBackupJobOptions = {}): Promise<CreateBackupJobResult> {
  let backupDirForCleanup: string | null = null;

  try {
    let strategy: BackupStrategy = isValidStrategy(requestedStrategy)
      ? requestedStrategy
      : 'full';
    const requestedFormat: BackupFormat =
      strategy === 'log' ? 'json' : normalizeBackupFormat(format);

    const now = new Date();
    const timestamp = buildBackupFolderTimestamp(now);
    const folderName = `${timestamp}-${strategy}-backup`;
    const backupDir = ensureBackupDir(folderName);
    backupDirForCleanup = backupDir;

    let backupFile = '';
    const files: string[] = [];
    const warnings: string[] = [];
    const recordCounts: Record<string, number> = {};
    let restoreVerification: RestoreVerificationSnapshot | undefined;
    const differentialFallbackTables: string[] = [];
    const tableAvailabilityCache: TableAvailabilityCache = new Map();
    const missingTables = new Set<string>();

    const markMissingTable = ({
      name,
      model,
      table,
      stage,
    }: {
      name: string;
      model: string;
      table?: string;
      stage: 'json' | 'csv' | 'xlsx';
    }) => {
      missingTables.add(name);
      logger.warn(`Missing table encountered during ${stage} backup: ${name}`, {
        model,
        table,
      });

      if (strictMissingTables) {
        throw new MissingRequiredTablesError(Array.from(missingTables));
      }
    };

    let baseReference: BackupLookup | null = null;
    let changeWindowStart: Date | null = null;

    if (strategy === 'differential') {
      baseReference = findLatestBackupByStrategy(BACKUP_DIR, 'full');
      if (!baseReference) {
        if (!allowStrategyFallback) {
          throw new BackupGenerationError(
            'Backup failed: differential backup requires an existing full baseline',
            'Create at least one full backup before scheduling or creating a differential backup without fallback.'
          );
        }

        warnings.push(
          'No full backup baseline was found, so the requested differential backup was promoted to a full backup.'
        );
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
      baseReference = findLatestBackupByStrategy(BACKUP_DIR, 'log');
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
            until: now.toISOString(),
          };

    if (requestedFormat === 'json' || requestedFormat === 'all') {
      const metadata = {
        createdAt: now.toISOString(),
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
            const delegate = getFindManyDelegate(logTable.model);
            const where: Record<string, unknown> = {};
            if (logSince && logTable.dateField) {
              where[logTable.dateField] = { gt: logSince };
            }

            const orderBy = logTable.dateField
              ? { [logTable.dateField]: 'asc' }
              : undefined;

            const data = await delegate.findMany({ where, orderBy });
            const normalizedData = data.map((record) =>
              normalizeJsonRecord(record as Record<string, unknown>)
            );
            tables[logTable.name] = {
              count: normalizedData.length,
              data: normalizedData,
              since: logSince?.toISOString() ?? null,
            };
            recordCounts[logTable.name] = normalizedData.length;
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
            const isAvailable = await isModelTableAvailable(
              model,
              tableAvailabilityCache
            );
            if (!isAvailable) {
              tables[name] = {
                count: 0,
                skipped: true,
                reason: 'table-missing',
              };
              recordCounts[name] = 0;
              markMissingTable({ name, model, stage: 'json' });
              continue;
            }

            const modelDelegate = getQueryDelegate(model);
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

            const data = await modelDelegate.findMany({ where });
            const normalizedData = data.map((record) =>
              normalizeJsonRecord(record as Record<string, unknown>)
            );
            tables[name] = {
              count: normalizedData.length,
              data: normalizedData,
            };
            recordCounts[name] = normalizedData.length;
          } catch (error) {
            tables[name] = {
              count: 0,
              ...(isMissingTableError(error)
                ? { skipped: true, reason: 'table-missing' }
                : {
                    error:
                      error instanceof Error ? error.message : String(error),
                  }),
            };
            if (isMissingTableError(error)) {
              tableAvailabilityCache.set(model, false);
              markMissingTable({
                name,
                model,
                table: error.meta?.table,
                stage: 'json',
              });
            }
          }
        }
      }

      const jsonFileName =
        strategy === 'log'
          ? `log-backup-${timestamp}.json`
          : `${strategy}-backup-${timestamp}.json`;
      backupFile = path.join(backupDir, jsonFileName);
      await writeFileAtomic(
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
            const isAvailable = await isModelTableAvailable(
              model,
              tableAvailabilityCache
            );
            if (!isAvailable) {
              recordCounts[name] = recordCounts[name] ?? 0;
              markMissingTable({ name, model, stage: 'csv' });
              continue;
            }

            logger.info(`Processing table: ${name}`);
            const modelDelegate = getBackupModelDelegate(model);
            const sampleRecord = await modelDelegate.findFirst();
            const { where } = buildTableQueryOptions(sampleRecord, {
              includeSoftDeleted,
              strategy,
              differentialSince,
            });

            const data = await modelDelegate.findMany({ where });
            recordCounts[name] = recordCounts[name] ?? data.length;

            logger.info(`Table ${name} has ${data.length} records`);

            if (data.length > 0) {
              const csvFile = path.join(backupDir, `${name}-${timestamp}.csv`);
              logger.info(`Generating CSV for ${name}...`);

              const plainData = toTabularRecords(data);

              const csv = Papa.unparse(plainData);
              logger.info(`CSV generated, writing to file: ${csvFile}`);
              await writeFileAtomic(csvFile, csv);
              files.push(csvFile);
              backupFile = csvFile;
              logger.info(`CSV file created successfully: ${csvFile}`);
            } else {
              logger.info(`Skipping ${name} - no data`);
            }
          } catch (error) {
            if (isMissingTableError(error)) {
              tableAvailabilityCache.set(model, false);
              markMissingTable({
                name,
                model,
                table: error.meta?.table,
                stage: 'csv',
              });
            } else {
              logger.error(`CSV backup failed for table ${name}:`, error);
            }
          }
        }
        logger.info(`CSV backup completed. Total files: ${files.length}`);
      } catch (error) {
        logger.error('CSV backup failed:', error);
      }
    }

    if (
      strategy !== 'log' &&
      (requestedFormat === 'dump' || requestedFormat === 'all')
    ) {
      logger.info('Starting PostgreSQL custom dump generation...');
      const databaseDump = await createDatabaseDump(timestamp, backupDir, strategy);
      if (databaseDump.ok) {
        files.push(databaseDump.filePath);
        backupFile = databaseDump.filePath;
        logger.info('Database dump completed successfully');
      } else if (requestedFormat === 'all') {
        const warning = `PostgreSQL dump skipped: ${databaseDump.error}`;
        warnings.push(warning);
        logger.warn(warning);
      } else {
        throw new BackupGenerationError(
          'Backup failed: database dump generation failed',
          databaseDump.error
        );
      }

      if (strategy === 'full') {
        restoreVerification = await collectRestoreVerificationSnapshot();
        Object.assign(
          recordCounts,
          buildRecordCountsFromSnapshot(restoreVerification)
        );
      }
    }

    if (
      strategy !== 'log' &&
      (requestedFormat === 'xlsx' || requestedFormat === 'all')
    ) {
      logger.info('Starting XLSX backup generation...');
      try {
        const wb = XLSX.utils.book_new();
        const usedSheetNames = new Set<string>();
        let sheetCount = 0;

        for (const { name, model } of TABLES) {
          try {
            const isAvailable = await isModelTableAvailable(
              model,
              tableAvailabilityCache
            );
            if (!isAvailable) {
              recordCounts[name] = recordCounts[name] ?? 0;
              markMissingTable({ name, model, stage: 'xlsx' });
              continue;
            }

            logger.info(`Processing table for XLSX: ${name}`);
            const modelDelegate = getBackupModelDelegate(model);
            const sampleRecord = await modelDelegate.findFirst();
            const { where } = buildTableQueryOptions(sampleRecord, {
              includeSoftDeleted,
              strategy,
              differentialSince,
            });

            const data = await modelDelegate.findMany({ where });
            recordCounts[name] = recordCounts[name] ?? data.length;

            logger.info(`Table ${name} has ${data.length} records for XLSX`);

            if (data.length > 0) {
              const plainData = toTabularRecords(data);

              const ws = XLSX.utils.json_to_sheet(plainData);
              const sheetName = reserveUniqueSheetName(name, usedSheetNames);
              XLSX.utils.book_append_sheet(wb, ws, sheetName);
              sheetCount++;
              logger.info(`Added sheet ${sheetName} to workbook`);
            } else {
              logger.info(`Skipping ${name} for XLSX - no data`);
            }
          } catch (error) {
            if (isMissingTableError(error)) {
              tableAvailabilityCache.set(model, false);
              markMissingTable({
                name,
                model,
                table: error.meta?.table,
                stage: 'xlsx',
              });
            } else {
              logger.error(`XLSX backup failed for table ${name}:`, error);
            }
          }
        }

        if (sheetCount > 0) {
          const xlsxFile = path.join(backupDir, `${strategy}-backup-${timestamp}.xlsx`);
          await writeWorkbookToFile(wb, xlsxFile);
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

    const describedFiles = await describeFiles(files);

    if (!describedFiles.length) {
      throw new BackupGenerationError(
        'Backup failed: no output files were generated'
      );
    }

    if (!restoreVerification) {
      restoreVerification = await collectRestoreVerificationSnapshot();
    }

    const fileChecksums = await buildFileChecksums(files);
    const integrityVerified = await verifyFileChecksums(files, fileChecksums);

    const manifest: BackupManifestFile = {
      timestamp: now.toISOString(),
      database: parseDatabaseUrl().database,
      format: requestedFormat,
      strategy,
      includeSoftDeleted,
      baseTimestamp: baseReference?.manifest.timestamp ?? null,
      baseFolder: baseReference?.folder ?? null,
      changeWindow,
      files: describedFiles.map(({ filePath, size }) => ({
        name: path.basename(filePath),
        size,
        path: path.relative(BACKUP_DIR, filePath),
        checksum: fileChecksums[path.basename(filePath)],
      })),
      recordCounts,
      differentialFallbackTables:
        strategy === 'differential' && differentialFallbackTables.length
          ? differentialFallbackTables
          : undefined,
      integrity: {
        algorithm: 'sha256',
        verified: integrityVerified,
        generatedAt: new Date().toISOString(),
        fileChecksums,
      },
      restoreVerification,
      scheduler,
    };

    const manifestFile = path.join(backupDir, 'MANIFEST.json');
    await writeFileAtomic(manifestFile, JSON.stringify(manifest, null, 2));

    if (!integrityVerified) {
      throw new BackupGenerationError('Backup integrity verification failed');
    }

    const totalSize = describedFiles.reduce((sum, { size }) => {
      return sum + size;
    }, 0);

    return {
      success: true,
      message: warnings.length
        ? 'Backup created with warnings'
        : 'Backup created successfully',
      warnings: warnings.length ? warnings : undefined,
      backup: {
        timestamp: folderName,
        files: files.map((f) => path.basename(f)),
        totalSize,
        format: requestedFormat,
        strategy,
      },
      manifest,
    };
  } catch (error) {
    cleanupPartialBackup(backupDirForCleanup);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// POST - Create backup
export async function POST(request: NextRequest) {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  try {
    const body = (await request.json()) as {
      format?: string;
      includeSoftDeleted?: boolean;
      strategy?: BackupStrategy;
      strictMissingTables?: boolean;
    };
    const result = await createBackupJob({
      format: body.format,
      includeSoftDeleted: body.includeSoftDeleted,
      strategy: body.strategy,
      strictMissingTables: body.strictMissingTables,
      scheduler: {
        trigger: 'manual',
        triggeredAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      warnings: result.warnings,
      backup: result.backup,
    });
  } catch (error) {
    if (error instanceof MissingRequiredTablesError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Backup strict mode failed: missing required tables',
          missingTables: error.missingTables,
        },
        { status: 500 }
      );
    }

    if (error instanceof BackupGenerationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error.details,
        },
        { status: 500 }
      );
    }

    logger.error('Backup failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Backup failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET - List available backups
export async function GET() {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return NextResponse.json({ success: true, backups: [] });
    }

    const backupFolders = fs
      .readdirSync(BACKUP_DIR, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && isValidTimestampFolderName(entry.name)
      )
      .map((entry) => entry.name)
      .sort()
      .reverse(); // Most recent first

    const backups = await Promise.all(
      backupFolders.map(async (folder) => {
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
        const describedFolderFiles = await describeFiles(
          files.map((file) => path.join(folderPath, file))
        );
        const totalSize = describedFolderFiles.reduce((sum, { size }) => {
          return sum + size;
        }, 0);

        return {
          timestamp: folder,
          files,
          totalSize,
          manifest,
          strategy: manifest?.strategy,
        };
      })
    );

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
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('timestamp');

    if (!timestamp) {
      return NextResponse.json(
        { success: false, error: 'Timestamp parameter required' },
        { status: 400 }
      );
    }

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
