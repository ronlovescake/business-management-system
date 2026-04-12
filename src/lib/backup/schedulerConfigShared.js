const DEFAULT_BACKUP_TIMEZONE = 'Asia/Manila';
const DEFAULT_BACKUP_RETENTION_DAYS = 30;
const DEFAULT_FULL_BACKUP_TIME = '22:00';
const DEFAULT_FULL_BACKUP_CADENCE = 'weekly';
const DEFAULT_FULL_BACKUP_DAY_OF_WEEK = 'sunday';
const DEFAULT_DIFFERENTIAL_BACKUP_TIME = '12:00';
const DEFAULT_PITR_BASE_TIME = '01:00';
const DEFAULT_LOG_PRUNE_TIME = '03:00';

const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function parseBooleanFlag(value, fallback) {
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

function parseRetentionDays(
  value,
  fallback = DEFAULT_BACKUP_RETENTION_DAYS
) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 1) {
    return Math.max(1, Math.floor(fallback));
  }

  return Math.floor(parsed);
}

function parseScheduleTime(value) {
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

function parseScheduleCadence(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'daily' || normalized === 'weekly') {
    return normalized;
  }

  return null;
}

function parseScheduleDayOfWeek(value) {
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

  const dayIndex = WEEKDAY_NAMES.indexOf(normalized);
  return dayIndex >= 0 ? dayIndex : null;
}

module.exports = {
  DEFAULT_BACKUP_TIMEZONE,
  DEFAULT_BACKUP_RETENTION_DAYS,
  DEFAULT_FULL_BACKUP_TIME,
  DEFAULT_FULL_BACKUP_CADENCE,
  DEFAULT_FULL_BACKUP_DAY_OF_WEEK,
  DEFAULT_DIFFERENTIAL_BACKUP_TIME,
  DEFAULT_PITR_BASE_TIME,
  DEFAULT_LOG_PRUNE_TIME,
  WEEKDAY_NAMES,
  parseBooleanFlag,
  parseRetentionDays,
  parseScheduleTime,
  parseScheduleCadence,
  parseScheduleDayOfWeek,
};