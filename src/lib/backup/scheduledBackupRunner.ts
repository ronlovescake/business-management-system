import fs from 'fs';
import path from 'path';

import { getBackupDirectory } from '@/lib/backup-storage';
import { pruneExpiredBackups } from '@/lib/backup/backupRetention';
import {
  DEFAULT_BACKUP_RETENTION_DAYS,
  DEFAULT_BACKUP_TIMEZONE,
  DEFAULT_DIFFERENTIAL_BACKUP_TIME,
  DEFAULT_FULL_BACKUP_CADENCE,
  DEFAULT_FULL_BACKUP_DAY_OF_WEEK,
  DEFAULT_FULL_BACKUP_TIME,
  WEEKDAY_NAMES,
  parseBooleanFlag,
  parseRetentionDays,
  parseScheduleCadence,
  parseScheduleDayOfWeek,
  parseScheduleTime,
  type ScheduleCadence,
} from '@/lib/backup/schedulerConfig';
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

  return WEEKDAY_NAMES.indexOf(weekdayName);
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
  const retentionDays = parseRetentionDays(
    body.retentionDays,
    parseRetentionDays(
      process.env.BACKUP_RETENTION_DAYS,
      DEFAULT_BACKUP_RETENTION_DAYS
    )
  );
  const strategy: BackupStrategy = isValidStrategy(body.strategy)
    ? body.strategy
    : 'full';
  const timeZone =
    typeof body.timeZone === 'string' && body.timeZone.trim().length > 0
      ? body.timeZone.trim()
      : process.env.BACKUP_AUTO_TIMEZONE || DEFAULT_BACKUP_TIMEZONE;
  const defaultScheduleTime =
    strategy === 'differential'
      ? process.env.BACKUP_DIFF_AUTO_TIME || DEFAULT_DIFFERENTIAL_BACKUP_TIME
      : process.env.BACKUP_AUTO_TIME || DEFAULT_FULL_BACKUP_TIME;
  const parsedScheduleTime = parseScheduleTime(
    body.scheduleTime ?? defaultScheduleTime
  );
  const defaultScheduleCadence: ScheduleCadence =
    strategy === 'full'
      ? parseScheduleCadence(process.env.BACKUP_AUTO_CADENCE) ??
        DEFAULT_FULL_BACKUP_CADENCE
      : 'daily';
  const scheduleCadence =
    parseScheduleCadence(body.scheduleCadence) ?? defaultScheduleCadence;
  const scheduleDayOfWeek =
    scheduleCadence === 'weekly'
      ? parseScheduleDayOfWeek(
          body.scheduleDayOfWeek ??
            process.env.BACKUP_AUTO_DAY_OF_WEEK ??
            DEFAULT_FULL_BACKUP_DAY_OF_WEEK
        )
      : null;
  const allowCatchUpBeforeScheduledTime = parseBooleanFlag(
    body.allowCatchUpBeforeScheduledTime,
    true
  );
  const skipIfAlreadyCompletedToday = parseBooleanFlag(
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