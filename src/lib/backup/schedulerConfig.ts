import schedulerConfigShared from './schedulerConfigShared';

export type ScheduleCadence = 'daily' | 'weekly';

export type ParsedScheduleTime = {
  hour: number;
  minute: number;
  raw: string;
};

type SchedulerConfigSharedModule = {
  DEFAULT_BACKUP_TIMEZONE: string;
  DEFAULT_BACKUP_RETENTION_DAYS: number;
  DEFAULT_FULL_BACKUP_TIME: string;
  DEFAULT_FULL_BACKUP_CADENCE: ScheduleCadence;
  DEFAULT_FULL_BACKUP_DAY_OF_WEEK: string;
  DEFAULT_DIFFERENTIAL_BACKUP_TIME: string;
  DEFAULT_PITR_BASE_TIME: string;
  DEFAULT_LOG_PRUNE_TIME: string;
  WEEKDAY_NAMES: readonly string[];
  parseBooleanFlag(value: unknown, fallback: boolean): boolean;
  parseRetentionDays(value: unknown, fallback?: number): number;
  parseScheduleTime(value: unknown): ParsedScheduleTime | null;
  parseScheduleCadence(value: unknown): ScheduleCadence | null;
  parseScheduleDayOfWeek(value: unknown): number | null;
};

const schedulerConfig = schedulerConfigShared as SchedulerConfigSharedModule;

export const DEFAULT_BACKUP_TIMEZONE = schedulerConfig.DEFAULT_BACKUP_TIMEZONE;
export const DEFAULT_BACKUP_RETENTION_DAYS =
  schedulerConfig.DEFAULT_BACKUP_RETENTION_DAYS;
export const DEFAULT_FULL_BACKUP_TIME = schedulerConfig.DEFAULT_FULL_BACKUP_TIME;
export const DEFAULT_FULL_BACKUP_CADENCE =
  schedulerConfig.DEFAULT_FULL_BACKUP_CADENCE;
export const DEFAULT_FULL_BACKUP_DAY_OF_WEEK =
  schedulerConfig.DEFAULT_FULL_BACKUP_DAY_OF_WEEK;
export const DEFAULT_DIFFERENTIAL_BACKUP_TIME =
  schedulerConfig.DEFAULT_DIFFERENTIAL_BACKUP_TIME;
export const DEFAULT_PITR_BASE_TIME = schedulerConfig.DEFAULT_PITR_BASE_TIME;
export const DEFAULT_LOG_PRUNE_TIME = schedulerConfig.DEFAULT_LOG_PRUNE_TIME;
export const WEEKDAY_NAMES = schedulerConfig.WEEKDAY_NAMES;

export const parseBooleanFlag = schedulerConfig.parseBooleanFlag;
export const parseRetentionDays = schedulerConfig.parseRetentionDays;
export const parseScheduleTime = schedulerConfig.parseScheduleTime;
export const parseScheduleCadence = schedulerConfig.parseScheduleCadence;
export const parseScheduleDayOfWeek = schedulerConfig.parseScheduleDayOfWeek;