import fs from 'fs';
import path from 'path';

import { getBackupDirectory } from '@/lib/backup-storage';
import { pruneExpiredBackups } from '@/lib/backup/backupRetention';
import { createBackupJob } from '@/app/api/backup/route';
import { writeFileAtomic } from '@/app/api/backup/backupRouteFileOps';
import {
  findLatestBackupByStrategy,
  listBackupFoldersDescending,
  parseTimestampToDate,
  readManifest,
  type BackupSchedulerMetadata,
  type BackupStrategy,
} from '@/app/api/backup/backupRouteUtils';

type ScheduleCadence = 'daily' | 'weekly';

const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const WEEKLY_FULL_DEFAULT_TIME = '22:00';
const DAILY_DIFF_DEFAULT_TIME = '12:00';

export type SchedulerRequestBody = {
  strategy?: BackupStrategy;
  format?: string;
  retentionDays?: number;
  skipIfAlreadyCompletedToday?: boolean;
  timeZone?: string;
  scheduleTime?: string;
  scheduleCadence?: ScheduleCadence;
  scheduleDayOfWeek?: string;
  allowCatchUpBeforeScheduledTime?: boolean;
};

export class ScheduledBackupConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduledBackupConfigurationError';
  }
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

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function getZonedWeekdayIndex(date: Date, timeZone: string) {
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
  })
    .format(date)
    .toLowerCase();

  return WEEKDAY_NAMES.indexOf(
    weekdayName as (typeof WEEKDAY_NAMES)[number]
  );
}

function parseScheduleCadence(
  value: unknown,
  fallback: ScheduleCadence
): ScheduleCadence {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'weekly' ? 'weekly' : normalized === 'daily' ? 'daily' : fallback;
}

function parseScheduleDayOfWeek(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value >= 0 && value <= 6 ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const numeric = Number(normalized);
  if (Number.isInteger(numeric)) {
    return numeric >= 0 && numeric <= 6 ? numeric : null;
  }

  return WEEKDAY_NAMES.indexOf(
    normalized as (typeof WEEKDAY_NAMES)[number]
  );
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

  return { hour, minute, raw: trimmed };
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

function getSchedulePeriodKey(
  date: Date,
  timeZone: string,
  cadence: ScheduleCadence,
  scheduleDayOfWeek: number | null
) {
  const dateKey = buildDateKey(date, timeZone);
  if (cadence === 'daily') {
    return dateKey;
  }

  if (scheduleDayOfWeek === null) {
    return dateKey;
  }

  const weekdayIndex = getZonedWeekdayIndex(date, timeZone);
  const offset = (weekdayIndex - scheduleDayOfWeek + 7) % 7;
  return shiftDateKey(dateKey, -offset);
}

function getLatestDuePeriodKey(
  date: Date,
  timeZone: string,
  cadence: ScheduleCadence,
  scheduleDayOfWeek: number | null,
  scheduledMinutes: number
) {
  const dateKey = buildDateKey(date, timeZone);
  const currentMinutes = getZonedCurrentMinutes(date, timeZone);

  if (cadence === 'daily') {
    return currentMinutes >= scheduledMinutes
      ? dateKey
      : shiftDateKey(dateKey, -1);
  }

  if (scheduleDayOfWeek === null) {
    return dateKey;
  }

  const weekdayIndex = getZonedWeekdayIndex(date, timeZone);
  const offset = (weekdayIndex - scheduleDayOfWeek + 7) % 7;
  const currentPeriodKey = shiftDateKey(dateKey, -offset);

  return offset === 0 && currentMinutes < scheduledMinutes
    ? shiftDateKey(currentPeriodKey, -7)
    : currentPeriodKey;
}

function isCurrentScheduledPeriodDueNow(
  date: Date,
  timeZone: string,
  cadence: ScheduleCadence,
  scheduleDayOfWeek: number | null,
  scheduledMinutes: number
) {
  const currentMinutes = getZonedCurrentMinutes(date, timeZone);
  if (cadence === 'daily') {
    return currentMinutes >= scheduledMinutes;
  }

  if (scheduleDayOfWeek === null) {
    return false;
  }

  return (
    getZonedWeekdayIndex(date, timeZone) === scheduleDayOfWeek &&
    currentMinutes >= scheduledMinutes
  );
}

function buildMissedDateKeys(
  lastCompletedDate: Date | null,
  latestDuePeriodKey: string,
  timeZone: string,
  cadence: ScheduleCadence,
  scheduleDayOfWeek: number | null
) {
  if (!lastCompletedDate) {
    return [];
  }

  const missed: string[] = [];
  const latestCompletedPeriodKey = getSchedulePeriodKey(
    lastCompletedDate,
    timeZone,
    cadence,
    scheduleDayOfWeek
  );
  const step = cadence === 'weekly' ? 7 : 1;
  let cursor = shiftDateKey(latestCompletedPeriodKey, step);

  while (cursor <= latestDuePeriodKey) {
    missed.push(cursor);
    cursor = shiftDateKey(cursor, step);
  }

  return missed;
}

function isValidStrategy(value: unknown): value is BackupStrategy {
  return value === 'full' || value === 'differential' || value === 'log';
}

function getStrategyLabel(strategy: BackupStrategy) {
  if (strategy === 'full') {
    return 'full dump';
  }

  if (strategy === 'differential') {
    return 'differential backup';
  }

  return 'log backup';
}

function findExistingBackupForToday(
  timeZone: string,
  strategy: BackupStrategy,
  cadence: ScheduleCadence,
  scheduleDayOfWeek: number | null,
  scheduledPeriodKey: string,
  format?: string
) {
  const backupDir = getBackupDirectory();

  for (const folder of listBackupFoldersDescending(backupDir)) {
    const manifest = readManifest(backupDir, folder);
    if (manifest?.strategy !== strategy) {
      continue;
    }

    if (format && manifest.format !== format) {
      continue;
    }

    const manifestDate = parseTimestampToDate(manifest.timestamp ?? folder);
    if (!manifestDate) {
      continue;
    }

    if (
      getSchedulePeriodKey(manifestDate, timeZone, cadence, scheduleDayOfWeek) ===
      scheduledPeriodKey
    ) {
      return {
        timestamp: folder,
        files: manifest.files.map((file) => file.name),
        totalSize: manifest.files.reduce((sum, file) => sum + file.size, 0),
        format: manifest.format,
        strategy,
      };
    }
  }

  return null;
}

async function persistSchedulerMetadata(
  timestamp: string,
  scheduler: BackupSchedulerMetadata,
  strategy: BackupStrategy
) {
  const backupDir = getBackupDirectory();
  const manifestPath = path.join(backupDir, timestamp, 'MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    return;
  }

  const manifest = readManifest(backupDir, timestamp);
  if (!manifest) {
    return;
  }

  const nextManifest = {
    ...manifest,
    strategy,
    scheduler,
  };

  await writeFileAtomic(manifestPath, JSON.stringify(nextManifest, null, 2));
}

export async function runScheduledBackupJob(body: SchedulerRequestBody = {}) {
  const retentionDays = parseRetentionDays(body.retentionDays);
  const strategy: BackupStrategy = isValidStrategy(body.strategy)
    ? body.strategy
    : 'full';
  const timeZone =
    typeof body.timeZone === 'string' && body.timeZone.trim().length > 0
      ? body.timeZone.trim()
      : process.env.BACKUP_AUTO_TIMEZONE || 'Asia/Manila';
  const defaultScheduleTime =
    strategy === 'differential'
      ? process.env.BACKUP_DIFF_AUTO_TIME || DAILY_DIFF_DEFAULT_TIME
      : process.env.BACKUP_AUTO_TIME || WEEKLY_FULL_DEFAULT_TIME;
  const parsedScheduleTime = parseScheduleTime(
    body.scheduleTime ?? defaultScheduleTime
  );
  const scheduleCadence = parseScheduleCadence(
    body.scheduleCadence,
    strategy === 'full'
      ? parseScheduleCadence(process.env.BACKUP_AUTO_CADENCE, 'weekly')
      : 'daily'
  );
  const scheduleDayOfWeek =
    scheduleCadence === 'weekly'
      ? parseScheduleDayOfWeek(
          body.scheduleDayOfWeek ??
            process.env.BACKUP_AUTO_DAY_OF_WEEK ??
            'sunday'
        )
      : null;
  const allowCatchUpBeforeScheduledTime = parseBoolean(
    body.allowCatchUpBeforeScheduledTime,
    true
  );
  const skipIfAlreadyCompletedToday = parseBoolean(
    body.skipIfAlreadyCompletedToday,
    true
  );

  if (!parsedScheduleTime) {
    throw new ScheduledBackupConfigurationError(
      'BACKUP_AUTO_TIME must be HH:MM in 24-hour format'
    );
  }

  if (scheduleCadence === 'weekly' && scheduleDayOfWeek === null) {
    throw new ScheduledBackupConfigurationError(
      'BACKUP_AUTO_DAY_OF_WEEK must be a weekday name or 0-6 when weekly scheduling is enabled'
    );
  }

  const now = new Date();
  const backupDir = getBackupDirectory();
  const scheduledMinutes =
    parsedScheduleTime.hour * 60 + parsedScheduleTime.minute;
  const duePeriodKey = getLatestDuePeriodKey(
    now,
    timeZone,
    scheduleCadence,
    scheduleDayOfWeek,
    scheduledMinutes
  );
  const latestBackup = findLatestBackupByStrategy(backupDir, strategy);
  const latestCompletedAt = parseTimestampToDate(
    latestBackup?.manifest.timestamp ?? latestBackup?.folder ?? null
  );
  const missedScheduledDates = buildMissedDateKeys(
    latestCompletedAt,
    duePeriodKey,
    timeZone,
    scheduleCadence,
    scheduleDayOfWeek
  );
  const existingBackup = findExistingBackupForToday(
    timeZone,
    strategy,
    scheduleCadence,
    scheduleDayOfWeek,
    duePeriodKey,
    strategy === 'full' ? 'dump' : undefined
  );
  const strategyLabel = getStrategyLabel(strategy);

  if (skipIfAlreadyCompletedToday && existingBackup) {
    const prune = pruneExpiredBackups(retentionDays);
    return {
      success: true,
      skipped: true,
      reason: `A scheduled ${strategyLabel} already exists for the current scheduled period`,
      backup: existingBackup,
      prune,
    };
  }

  const dueNow = isCurrentScheduledPeriodDueNow(
    now,
    timeZone,
    scheduleCadence,
    scheduleDayOfWeek,
    scheduledMinutes
  );
  const shouldCatchUp =
    allowCatchUpBeforeScheduledTime && missedScheduledDates.length > 0;

  if (!dueNow && !shouldCatchUp) {
    return {
      success: true,
      skipped: true,
      reason: `Scheduled ${strategyLabel} is not due yet for ${duePeriodKey}`,
    };
  }

  if (strategy === 'differential' && !findLatestBackupByStrategy(backupDir, 'full')) {
    return {
      success: true,
      skipped: true,
      reason:
        'Scheduled differential backup requires an existing full backup baseline',
    };
  }

  const scheduler: BackupSchedulerMetadata = {
    trigger: 'scheduled',
    triggeredAt: now.toISOString(),
    scheduleTime: parsedScheduleTime.raw,
    scheduleCadence,
    scheduleDayOfWeek:
      scheduleDayOfWeek === null ? undefined : WEEKDAY_NAMES[scheduleDayOfWeek],
    timeZone,
    scheduledDateKey: duePeriodKey,
    catchUp: shouldCatchUp,
    missedDateKeys: shouldCatchUp ? missedScheduledDates : [],
  };

  const result = await createBackupJob({
    format: strategy === 'full' ? 'dump' : body.format ?? 'json',
    strategy,
    allowStrategyFallback: false,
    scheduler,
  });

  if (result.backup.strategy !== strategy) {
    throw new Error(
      `Scheduled ${strategyLabel} completed as ${result.backup.strategy}`
    );
  }

  if (!result.manifest.scheduler) {
    result.manifest = {
      ...result.manifest,
      scheduler,
      strategy,
    };
    await persistSchedulerMetadata(result.backup.timestamp, scheduler, strategy);
  }

  const prune = pruneExpiredBackups(retentionDays);

  return {
    ...result,
    prune,
  };
}