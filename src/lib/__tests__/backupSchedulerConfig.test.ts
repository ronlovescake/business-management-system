import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BACKUP_RETENTION_DAYS,
  DEFAULT_BACKUP_TIMEZONE,
  DEFAULT_DIFFERENTIAL_BACKUP_TIME,
  DEFAULT_FULL_BACKUP_CADENCE,
  DEFAULT_FULL_BACKUP_DAY_OF_WEEK,
  DEFAULT_FULL_BACKUP_TIME,
  DEFAULT_LOG_PRUNE_TIME,
  DEFAULT_PITR_BASE_TIME,
  WEEKDAY_NAMES,
  parseBooleanFlag,
  parseRetentionDays,
  parseScheduleCadence,
  parseScheduleDayOfWeek,
  parseScheduleTime,
} from '@/lib/backup/schedulerConfig';

const scriptSchedulerConfig = require('../../../scripts/schedulerConfigShared.js');

describe('backup scheduler config helpers', () => {
  it('parses boolean-like scheduler flags', () => {
    expect(parseBooleanFlag(true, false)).toBe(true);
    expect(parseBooleanFlag('yes', false)).toBe(true);
    expect(parseBooleanFlag('0', true)).toBe(false);
    expect(parseBooleanFlag('unexpected', true)).toBe(true);
  });

  it('sanitizes retention days with fallback handling', () => {
    expect(parseRetentionDays(14.9, DEFAULT_BACKUP_RETENTION_DAYS)).toBe(14);
    expect(parseRetentionDays('21', DEFAULT_BACKUP_RETENTION_DAYS)).toBe(21);
    expect(parseRetentionDays('invalid', 45)).toBe(45);
    expect(parseRetentionDays(undefined, 0)).toBe(1);
  });

  it('parses schedule times in 24-hour format', () => {
    expect(parseScheduleTime('08:30')).toEqual({
      hour: 8,
      minute: 30,
      raw: '08:30',
    });
    expect(parseScheduleTime('24:00')).toBeNull();
    expect(parseScheduleTime('8:30')).toBeNull();
  });

  it('parses schedule cadence values', () => {
    expect(parseScheduleCadence('daily')).toBe('daily');
    expect(parseScheduleCadence(' WEEKLY ')).toBe('weekly');
    expect(parseScheduleCadence('monthly')).toBeNull();
  });

  it('parses schedule day of week values', () => {
    expect(parseScheduleDayOfWeek('sunday')).toBe(0);
    expect(parseScheduleDayOfWeek('5')).toBe(5);
    expect(parseScheduleDayOfWeek(2)).toBe(2);
    expect(parseScheduleDayOfWeek('funday')).toBeNull();
    expect(parseScheduleDayOfWeek(8)).toBeNull();
  });

  it('keeps script and app scheduler config exports aligned', () => {
    expect(scriptSchedulerConfig.DEFAULT_BACKUP_TIMEZONE).toBe(
      DEFAULT_BACKUP_TIMEZONE
    );
    expect(scriptSchedulerConfig.DEFAULT_BACKUP_RETENTION_DAYS).toBe(
      DEFAULT_BACKUP_RETENTION_DAYS
    );
    expect(scriptSchedulerConfig.DEFAULT_FULL_BACKUP_TIME).toBe(
      DEFAULT_FULL_BACKUP_TIME
    );
    expect(scriptSchedulerConfig.DEFAULT_FULL_BACKUP_CADENCE).toBe(
      DEFAULT_FULL_BACKUP_CADENCE
    );
    expect(scriptSchedulerConfig.DEFAULT_FULL_BACKUP_DAY_OF_WEEK).toBe(
      DEFAULT_FULL_BACKUP_DAY_OF_WEEK
    );
    expect(scriptSchedulerConfig.DEFAULT_DIFFERENTIAL_BACKUP_TIME).toBe(
      DEFAULT_DIFFERENTIAL_BACKUP_TIME
    );
    expect(scriptSchedulerConfig.DEFAULT_PITR_BASE_TIME).toBe(
      DEFAULT_PITR_BASE_TIME
    );
    expect(scriptSchedulerConfig.DEFAULT_LOG_PRUNE_TIME).toBe(
      DEFAULT_LOG_PRUNE_TIME
    );
    expect(scriptSchedulerConfig.WEEKDAY_NAMES).toEqual(WEEKDAY_NAMES);
  });
});
