import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { prisma } from '@/lib/db';
import { getDatabaseUrl } from '@/lib/env';
import { logger } from '@/lib/logger';
import { getBackupDirectory } from '@/lib/backup-storage';

export interface PitrBaseBackupFile {
  name: string;
  path: string;
  size: number;
}

export interface PitrBaseBackupManifest {
  folder: string;
  timestamp: string;
  createdAt: string;
  database: string;
  host: string;
  port: string;
  label: string;
  scheduler?: PitrBaseBackupSchedulerMetadata;
  files: PitrBaseBackupFile[];
  totalSize: number;
}

export interface PitrBaseBackupSchedulerMetadata {
  trigger: 'manual' | 'scheduled';
  triggeredAt: string;
  scheduleTime?: string;
  timeZone?: string;
  scheduledDateKey?: string;
  catchUp?: boolean;
  missedDateKeys?: string[];
}

export interface PitrRuntimeStatus {
  archiveMode: string | null;
  archiveCommand: string | null;
  archiveTimeout: string | null;
  walLevel: string | null;
  archivedCount: number;
  failedCount: number;
  lastArchivedWal: string | null;
  lastArchivedAt: string | null;
  lastFailedWal: string | null;
  lastFailedAt: string | null;
  statsResetAt: string | null;
  databaseConnected: boolean;
  error?: string;
}

export interface PitrStatusSnapshot {
  enabled: boolean;
  baseBackupDirectory: string;
  walArchiveDirectory: string;
  schedule: {
    enabled: boolean;
    time: string | null;
    timeZone: string | null;
  };
  baseBackupCount: number;
  latestBaseBackup: PitrBaseBackupManifest | null;
  walArchiveFileCount: number;
  walArchiveTotalSize: number;
  latestArchivedWalFile: string | null;
  latestArchivedWalMtime: string | null;
  runtime: PitrRuntimeStatus;
  recoveryWindow: {
    start: string | null;
    end: string | null;
  };
  restoreCommandPreview: string | null;
}

class PitrConfigurationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PitrConfigurationError';
    this.statusCode = statusCode;
  }
}

class PitrConflictError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 409) {
    super(message);
    this.name = 'PitrConflictError';
    this.statusCode = statusCode;
  }
}

export class ScheduledPitrConfigurationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ScheduledPitrConfigurationError';
    this.statusCode = statusCode;
  }
}

type ShowSettingRow = Record<string, string>;

type PgStatArchiverRow = {
  archived_count?: bigint | number | string;
  failed_count?: bigint | number | string;
  last_archived_wal?: string | null;
  last_archived_time?: string | Date | null;
  last_failed_wal?: string | null;
  last_failed_time?: string | Date | null;
  stats_reset?: string | Date | null;
};

const PITR_ROOT_FOLDER = 'pitr';
const PITR_BASE_FOLDER = 'base';
const PITR_WAL_FOLDER = 'wal';
const BASE_BACKUP_LOCK_FILE = '.base-backup.lock';

export type CreatePitrBaseBackupOptions = {
  scheduler?: PitrBaseBackupSchedulerMetadata;
};

export type ScheduledPitrRequestBody = {
  skipIfAlreadyCompletedToday?: boolean;
  timeZone?: string;
  scheduleTime?: string;
  allowCatchUpBeforeScheduledTime?: boolean;
};

function formatTimestampFolder(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, '').replace(/:/g, '-');
}

function normalizeRelativePath(filePath: string) {
  return filePath.split(path.sep).join('/');
}

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeReadJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    logger.warn('Failed to parse PITR manifest', { filePath, error });
    return null;
  }
}

function getPitrRootDirectory() {
  return path.join(getBackupDirectory(), PITR_ROOT_FOLDER);
}

function getPitrBaseBackupDirectory() {
  return path.join(getPitrRootDirectory(), PITR_BASE_FOLDER);
}

function getPitrWalArchiveDirectory() {
  return path.join(getPitrRootDirectory(), PITR_WAL_FOLDER);
}

function getBaseBackupLockPath() {
  return path.join(getPitrBaseBackupDirectory(), BASE_BACKUP_LOCK_FILE);
}

function parseDatabaseUrl() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    throw new PitrConfigurationError('DATABASE_URL is not configured.', 500);
  }

  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch (error) {
    throw new PitrConfigurationError(
      error instanceof Error ? error.message : 'Invalid DATABASE_URL format',
      500
    );
  }

  const database = parsed.pathname.replace(/^\//, '');
  if (!parsed.username || !database) {
    throw new PitrConfigurationError('Invalid DATABASE_URL format.', 500);
  }

  return {
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password ?? ''),
    host: parsed.hostname,
    port: parsed.port || '5432',
    database,
  };
}

function asNumber(value: bigint | number | string | undefined) {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function asIsoString(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function readBaseBackupManifest(folderPath: string) {
  return safeReadJson<PitrBaseBackupManifest>(
    path.join(folderPath, 'MANIFEST.json')
  );
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

function parseScheduleTime(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    return null;
  }

  const [hourValue, minuteValue] = trimmed.split(':');
  const hour = Number(hourValue);
  const minute = Number(minuteValue);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return {
    hour,
    minute,
    raw: trimmed,
  };
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

function getZonedCurrentMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || '';

  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));

  return hour * 60 + minute;
}

function addDays(date: Date, days: number) {
  const clone = new Date(date.getTime());
  clone.setUTCDate(clone.getUTCDate() + days);
  return clone;
}

function buildMissedDateKeys(
  lastCompletedDate: Date | null,
  today: Date,
  timeZone: string
) {
  if (!lastCompletedDate) {
    return [];
  }

  const missed: string[] = [];
  let cursor = addDays(lastCompletedDate, 1);
  const todayKey = buildDateKey(today, timeZone);

  while (buildDateKey(cursor, timeZone) < todayKey) {
    missed.push(buildDateKey(cursor, timeZone));
    cursor = addDays(cursor, 1);
  }

  return missed;
}

function parseTimestampToDate(timestamp?: string | null) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function findExistingBaseBackupForToday(timeZone: string) {
  const todayKey = buildDateKey(new Date(), timeZone);

  for (const manifest of listBaseBackups()) {
    const manifestDate = parseTimestampToDate(manifest.timestamp);
    if (!manifestDate) {
      continue;
    }

    if (buildDateKey(manifestDate, timeZone) === todayKey) {
      return manifest;
    }
  }

  return null;
}

function listBaseBackups() {
  const baseRoot = getPitrBaseBackupDirectory();
  if (!fs.existsSync(baseRoot)) {
    return [] as PitrBaseBackupManifest[];
  }

  return fs
    .readdirSync(baseRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !entry.name.endsWith('.tmp')
    )
    .map((entry) =>
      readBaseBackupManifest(path.join(baseRoot, entry.name)) ?? null
    )
    .filter((entry): entry is PitrBaseBackupManifest => entry !== null)
    .sort((left, right) => right.folder.localeCompare(left.folder));
}

function describeWalArchiveDirectory() {
  const walRoot = getPitrWalArchiveDirectory();
  if (!fs.existsSync(walRoot)) {
    return {
      walArchiveFileCount: 0,
      walArchiveTotalSize: 0,
      latestArchivedWalFile: null,
      latestArchivedWalMtime: null,
    };
  }

  const files = fs
    .readdirSync(walRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const filePath = path.join(walRoot, entry.name);
      const stats = fs.statSync(filePath);
      return {
        name: entry.name,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
      };
    })
    .sort((left, right) => right.name.localeCompare(left.name));

  return {
    walArchiveFileCount: files.length,
    walArchiveTotalSize: files.reduce((sum, file) => sum + file.size, 0),
    latestArchivedWalFile: files[0]?.name ?? null,
    latestArchivedWalMtime: files[0]?.mtime ?? null,
  };
}

async function queryShowSetting(setting: string) {
  const rows = await prisma.$queryRawUnsafe<ShowSettingRow[]>(
    `SHOW ${setting}`
  );
  const [firstRow] = rows ?? [];
  return (firstRow?.[setting] ?? null) as string | null;
}

async function queryRuntimeStatus(): Promise<PitrRuntimeStatus> {
  try {
    const [archiveMode, archiveCommand, archiveTimeout, walLevel, archiverRows] =
      await Promise.all([
        queryShowSetting('archive_mode'),
        queryShowSetting('archive_command'),
        queryShowSetting('archive_timeout'),
        queryShowSetting('wal_level'),
        prisma.$queryRawUnsafe<PgStatArchiverRow[]>(`
          SELECT
            archived_count,
            failed_count,
            last_archived_wal,
            last_archived_time,
            last_failed_wal,
            last_failed_time,
            stats_reset
          FROM pg_stat_archiver
        `),
      ]);

    const archiver = archiverRows?.[0] ?? {};
    return {
      archiveMode,
      archiveCommand,
      archiveTimeout,
      walLevel,
      archivedCount: asNumber(archiver.archived_count),
      failedCount: asNumber(archiver.failed_count),
      lastArchivedWal: archiver.last_archived_wal ?? null,
      lastArchivedAt: asIsoString(archiver.last_archived_time),
      lastFailedWal: archiver.last_failed_wal ?? null,
      lastFailedAt: asIsoString(archiver.last_failed_time),
      statsResetAt: asIsoString(archiver.stats_reset),
      databaseConnected: true,
    };
  } catch (error) {
    logger.warn('Failed to query PITR runtime status', { error });
    return {
      archiveMode: null,
      archiveCommand: null,
      archiveTimeout: null,
      walLevel: null,
      archivedCount: 0,
      failedCount: 0,
      lastArchivedWal: null,
      lastArchivedAt: null,
      lastFailedWal: null,
      lastFailedAt: null,
      statsResetAt: null,
      databaseConnected: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

async function describeDirectoryFiles(rootDir: string) {
  const entries = await fsPromises.readdir(rootDir, { withFileTypes: true });
  const results: PitrBaseBackupFile[] = [];

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await describeDirectoryFiles(entryPath)));
      continue;
    }

    if (!entry.isFile() || entry.name === 'MANIFEST.json') {
      continue;
    }

    const stats = await fsPromises.stat(entryPath);
    results.push({
      name: entry.name,
      path: normalizeRelativePath(entryPath),
      size: stats.size,
    });
  }

  return results.sort((left, right) => left.path.localeCompare(right.path));
}

function runPgBaseBackup(
  destinationDir: string,
  label: string,
  config: ReturnType<typeof parseDatabaseUrl>
) {
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
    '-D',
    destinationDir,
    '-Fp',
    '-X',
    'stream',
    '-c',
    'fast',
    '-l',
    label,
  ];

  logger.info('Executing PostgreSQL physical base backup', {
    host: config.host,
    port: config.port,
    database: config.database,
    label,
    destinationDir,
  });

  return new Promise<void>((resolve, reject) => {
    const child = spawn('pg_basebackup', args, { env });
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
      reject(
        new Error(stderr || `pg_basebackup failed with exit code ${code}`)
      );
    });
  });
}

export function listPitrBaseBackups() {
  return listBaseBackups();
}

export function getPitrWalFiles() {
  const walRoot = getPitrWalArchiveDirectory();
  if (!fs.existsSync(walRoot)) {
    return {
      files: [] as Array<{ name: string; size: number }>,
      totalSize: 0,
      totalCount: 0,
    };
  }

  const files = fs
    .readdirSync(walRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const filePath = path.join(walRoot, entry.name);
      const stats = fs.statSync(filePath);
      return { name: entry.name, size: stats.size };
    })
    .sort((left, right) => right.name.localeCompare(left.name));

  return {
    files,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    totalCount: files.length,
  };
}

export async function getPitrStatus() {
  const baseBackups = listBaseBackups();
  const latestBaseBackup = baseBackups[0] ?? null;
  const walArchive = describeWalArchiveDirectory();
  const runtime = await queryRuntimeStatus();

  return {
    enabled: process.env.PITR_ENABLED === 'true',
    baseBackupDirectory: getPitrBaseBackupDirectory(),
    walArchiveDirectory: getPitrWalArchiveDirectory(),
    schedule: {
      enabled: process.env.PITR_BASE_AUTO_ENABLED === 'true',
      time: process.env.PITR_BASE_AUTO_TIME || null,
      timeZone: process.env.BACKUP_AUTO_TIMEZONE || 'Asia/Manila',
    },
    baseBackupCount: baseBackups.length,
    latestBaseBackup,
    walArchiveFileCount: walArchive.walArchiveFileCount,
    walArchiveTotalSize: walArchive.walArchiveTotalSize,
    latestArchivedWalFile:
      runtime.lastArchivedWal ?? walArchive.latestArchivedWalFile,
    latestArchivedWalMtime:
      runtime.lastArchivedAt ?? walArchive.latestArchivedWalMtime,
    runtime,
    recoveryWindow: {
      start: latestBaseBackup?.createdAt ?? null,
      end: runtime.lastArchivedAt ?? walArchive.latestArchivedWalMtime,
    },
    restoreCommandPreview: latestBaseBackup
      ? `npm run docker:restore:pitr -- --base-backup ${latestBaseBackup.folder} --target-time ${runtime.lastArchivedAt ?? '<timestamp>'} --confirm`
      : null,
  } satisfies PitrStatusSnapshot;
}

export async function createPitrBaseBackup(
  options: CreatePitrBaseBackupOptions = {}
) {
  if (process.env.PITR_ENABLED !== 'true') {
    throw new PitrConfigurationError(
      'PITR is disabled. Set PITR_ENABLED=true and restart the Docker stack first.'
    );
  }

  const runtime = await queryRuntimeStatus();
  const archiveModeActive =
    runtime.archiveMode === 'on' || runtime.archiveMode === 'always';
  const replicaWalLevel =
    runtime.walLevel === 'replica' || runtime.walLevel === 'logical';

  if (!runtime.databaseConnected) {
    throw new PitrConfigurationError(
      runtime.error || 'Database connection is unavailable for PITR status.'
    );
  }

  if (!archiveModeActive || !replicaWalLevel) {
    throw new PitrConfigurationError(
      'PostgreSQL is not running with PITR archiving enabled yet. Restart the Docker database with PITR enabled and verify archive_mode=on and wal_level=replica.'
    );
  }

  const baseRoot = getPitrBaseBackupDirectory();
  ensureDirectory(baseRoot);

  const lockPath = getBaseBackupLockPath();
  let lockHandle: number | null = null;
  try {
    lockHandle = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(
      lockPath,
      JSON.stringify({ startedAt: new Date().toISOString() }, null, 2)
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
      throw new PitrConflictError(
        'A PITR base backup is already running. Wait for it to finish before starting another one.'
      );
    }
    throw error;
  }

  const startedAt = new Date();
  const folder = formatTimestampFolder(startedAt);
  const label = `pitr-base-${folder}`;
  const tempDir = path.join(baseRoot, `${folder}.tmp`);
  const finalDir = path.join(baseRoot, folder);
  const config = parseDatabaseUrl();

  try {
    ensureDirectory(tempDir);
    await runPgBaseBackup(tempDir, label, config);

    const backupRoot = getBackupDirectory();
    const files = await describeDirectoryFiles(tempDir);
    const manifest: PitrBaseBackupManifest = {
      folder,
      timestamp: startedAt.toISOString(),
      createdAt: new Date().toISOString(),
      database: config.database,
      host: config.host,
      port: config.port,
      label,
      scheduler: options.scheduler,
      files: files.map((file) => ({
        ...file,
        path: normalizeRelativePath(path.relative(backupRoot, file.path)),
      })),
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
    };

    await fsPromises.writeFile(
      path.join(tempDir, 'MANIFEST.json'),
      JSON.stringify(manifest, null, 2)
    );
    await fsPromises.rename(tempDir, finalDir);

    return manifest;
  } catch (error) {
    try {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      logger.warn('Failed to clean up partial PITR base backup directory', {
        tempDir,
        cleanupError,
      });
    }
    throw error;
  } finally {
    if (lockHandle !== null) {
      fs.closeSync(lockHandle);
    }
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  }
}

export async function runScheduledPitrBaseBackup(
  body: ScheduledPitrRequestBody = {}
) {
  const timeZone =
    typeof body.timeZone === 'string' && body.timeZone.trim().length > 0
      ? body.timeZone.trim()
      : process.env.BACKUP_AUTO_TIMEZONE || 'Asia/Manila';
  const parsedScheduleTime = parseScheduleTime(
    body.scheduleTime ?? process.env.PITR_BASE_AUTO_TIME ?? '01:00'
  );
  const allowCatchUpBeforeScheduledTime = parseBoolean(
    body.allowCatchUpBeforeScheduledTime,
    true
  );
  const skipIfAlreadyCompletedToday = parseBoolean(
    body.skipIfAlreadyCompletedToday,
    true
  );

  if (process.env.PITR_ENABLED !== 'true') {
    throw new ScheduledPitrConfigurationError(
      'PITR must be enabled before scheduled base backups can run'
    );
  }

  if (process.env.PITR_BASE_AUTO_ENABLED !== 'true') {
    throw new ScheduledPitrConfigurationError(
      'PITR base backup scheduling is disabled'
    );
  }

  if (!parsedScheduleTime) {
    throw new ScheduledPitrConfigurationError(
      'PITR_BASE_AUTO_TIME must be HH:MM in 24-hour format'
    );
  }

  const now = new Date();
  const todayKey = buildDateKey(now, timeZone);
  const currentMinutes = getZonedCurrentMinutes(now, timeZone);
  const scheduledMinutes =
    parsedScheduleTime.hour * 60 + parsedScheduleTime.minute;
  const latestBackup = listBaseBackups()[0] ?? null;
  const latestCompletedAt = parseTimestampToDate(latestBackup?.timestamp ?? null);
  const missedScheduledDates = buildMissedDateKeys(
    latestCompletedAt,
    now,
    timeZone
  );

  if (skipIfAlreadyCompletedToday) {
    const existingBackup = findExistingBaseBackupForToday(timeZone);
    if (existingBackup) {
      return {
        success: true,
        skipped: true,
        reason:
          'A scheduled PITR base backup already exists for the current scheduled day',
        baseBackup: existingBackup,
      };
    }
  }

  const dueNow = currentMinutes >= scheduledMinutes;
  const shouldCatchUp =
    allowCatchUpBeforeScheduledTime &&
    (missedScheduledDates.length > 0 || !latestBackup);

  if (!dueNow && !shouldCatchUp) {
    return {
      success: true,
      skipped: true,
      reason: `Scheduled PITR base backup is not due yet for ${todayKey}`,
    };
  }

  const scheduler: PitrBaseBackupSchedulerMetadata = {
    trigger: 'scheduled',
    triggeredAt: now.toISOString(),
    scheduleTime: parsedScheduleTime.raw,
    timeZone,
    scheduledDateKey: todayKey,
    catchUp: shouldCatchUp,
    missedDateKeys: shouldCatchUp ? missedScheduledDates : [],
  };

  const baseBackup = await createPitrBaseBackup({
    scheduler,
  });

  return {
    success: true,
    baseBackup,
  };
}

export function isPitrErrorWithStatusCode(
  error: unknown
): error is
  | PitrConfigurationError
  | PitrConflictError
  | ScheduledPitrConfigurationError {
  return (
    !!error &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
  );
}