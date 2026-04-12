import { useMemo } from 'react';
import { dayjs } from '@/utils/date';
import type { Backup, BackupStrategy } from '../types';
import { STRATEGY_META, STRATEGY_SEQUENCE, parseTimestamp } from '../types';

type ScheduleCadence = 'daily' | 'weekly';

const BACKUP_TIMEZONE = 'Asia/Manila';

const DEFAULT_SCHEDULE_CONFIG: Record<
  Exclude<BackupStrategy, 'log'>,
  {
    cadence: ScheduleCadence;
    scheduleTime: string;
    scheduleDayOfWeek: string | null;
  }
> = {
  full: {
    cadence: 'weekly',
    scheduleTime: '22:00',
    scheduleDayOfWeek: 'sunday',
  },
  differential: {
    cadence: 'daily',
    scheduleTime: '12:00',
    scheduleDayOfWeek: null,
  },
};

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const parseScheduleTime = (value?: string) => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hour, minute] = value.split(':').map(Number);
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

  return { hour, minute };
};

const resolveScheduleConfig = (
  key: BackupStrategy,
  backup: Backup | undefined
) => {
  if (key === 'log') {
    return null;
  }

  const scheduler = backup?.manifest?.scheduler;
  const defaults = DEFAULT_SCHEDULE_CONFIG[key];

  return {
    cadence:
      scheduler?.scheduleCadence === 'daily' ||
      scheduler?.scheduleCadence === 'weekly'
        ? scheduler.scheduleCadence
        : defaults.cadence,
    scheduleTime: scheduler?.scheduleTime || defaults.scheduleTime,
    scheduleDayOfWeek:
      (scheduler?.scheduleCadence || defaults.cadence) === 'weekly'
        ? scheduler?.scheduleDayOfWeek || defaults.scheduleDayOfWeek
        : null,
  };
};

const getNextScheduledRun = (
  cadence: ScheduleCadence,
  scheduleTime: string,
  scheduleDayOfWeek: string | null,
  reference = new Date()
) => {
  const parsedTime = parseScheduleTime(scheduleTime);
  if (!parsedTime) {
    return null;
  }

  const current = dayjs(reference).tz(BACKUP_TIMEZONE);
  let next = current
    .hour(parsedTime.hour)
    .minute(parsedTime.minute)
    .second(0)
    .millisecond(0);

  if (cadence === 'daily') {
    if (!next.isAfter(current)) {
      next = next.add(1, 'day');
    }
    return next.toDate();
  }

  const targetDay =
    scheduleDayOfWeek === null
      ? null
      : WEEKDAY_INDEX[scheduleDayOfWeek.toLowerCase()] ?? null;

  if (targetDay === null) {
    return null;
  }

  const daysUntil = (targetDay - current.day() + 7) % 7;
  next = next.add(daysUntil, 'day');

  if (!next.isAfter(current)) {
    next = next.add(7, 'day');
  }

  return next.toDate();
};

export const resolveBackupStrategy = (backup: Backup): BackupStrategy => {
  const manifestStrategy = backup.manifest?.strategy;
  if (manifestStrategy === 'differential' || manifestStrategy === 'log') {
    return manifestStrategy;
  }
  if (manifestStrategy === 'full') {
    return manifestStrategy;
  }

  if (backup.strategy === 'differential' || backup.strategy === 'log') {
    return backup.strategy;
  }
  if (backup.strategy === 'full') {
    return backup.strategy;
  }

  return 'full';
};

export const useBackupSchedule = (backups: Backup[]) => {
  const strategyHistory = useMemo(() => {
    const latest: Partial<
      Record<BackupStrategy, { backup: Backup; date: Date }>
    > = {};

    backups.forEach((backup) => {
      const strategy = resolveBackupStrategy(backup);
      const referenceTimestamp =
        backup.manifest?.changeWindow?.until ??
        backup.manifest?.timestamp ??
        backup.timestamp;
      const date = parseTimestamp(referenceTimestamp);
      if (!date) {
        return;
      }

      const existing = latest[strategy];
      if (!existing || date > existing.date) {
        latest[strategy] = { backup, date };
      }
    });

    return latest;
  }, [backups]);

  const scheduleConfigLookup = useMemo(() => {
    const config: Partial<
      Record<BackupStrategy, ReturnType<typeof resolveScheduleConfig>>
    > = {};

    STRATEGY_SEQUENCE.forEach((key) => {
      config[key] = resolveScheduleConfig(key, strategyHistory[key]?.backup);
    });

    return config;
  }, [strategyHistory]);

  const nextDueLookup = useMemo(() => {
    const next: Partial<Record<BackupStrategy, Date | null>> = {};

    STRATEGY_SEQUENCE.forEach((key) => {
      const config = scheduleConfigLookup[key];
      if (!config) {
        next[key] = null;
        return;
      }

      next[key] = getNextScheduledRun(
        config.cadence,
        config.scheduleTime,
        config.scheduleDayOfWeek
      );
    });

    return next;
  }, [scheduleConfigLookup]);

  const strategySchedule = useMemo(
    () =>
      STRATEGY_SEQUENCE.map((key) => ({
        key,
        meta: STRATEGY_META[key],
        lastBackup: strategyHistory[key]?.backup ?? null,
        last: strategyHistory[key]?.date ?? null,
        next: nextDueLookup[key] ?? null,
      })),
    [nextDueLookup, strategyHistory]
  );

  return { strategyHistory, nextDueLookup, strategySchedule };
};
