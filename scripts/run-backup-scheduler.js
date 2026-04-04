#!/usr/bin/env node
/* eslint-disable no-console */

const DEFAULT_URL = 'http://app:5000/api/internal/backup/run';
const DEFAULT_PITR_BASE_URL = 'http://app:5000/api/internal/backup/pitr/run';
const DEFAULT_LOG_PRUNE_URL = 'http://app:5000/api/internal/maintenance/prune-logs';
const DEFAULT_PITR_BASE_TIME = '01:00';
const DEFAULT_FULL_TIME = '22:00';
const DEFAULT_FULL_CADENCE = 'weekly';
const DEFAULT_FULL_DAY_OF_WEEK = 'sunday';
const DEFAULT_DIFF_TIME = '12:00';
const DEFAULT_LOG_PRUNE_TIME = '03:00';
const DEFAULT_TIMEZONE = 'Asia/Manila';
const DEFAULT_RETENTION_DAYS = 30;
const CHECK_INTERVAL_MS = 60 * 1000;
const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const fullEnabled =
  String(process.env.BACKUP_AUTO_ENABLED || 'false')
    .trim()
    .toLowerCase() === 'true';
const differentialEnabled =
  String(process.env.BACKUP_DIFF_AUTO_ENABLED || 'false')
    .trim()
    .toLowerCase() === 'true';
const pitrBaseEnabled =
  String(process.env.PITR_BASE_AUTO_ENABLED || 'false')
    .trim()
    .toLowerCase() === 'true';
const logPruneEnabled =
  String(process.env.LOG_PRUNE_AUTO_ENABLED || 'false')
    .trim()
    .toLowerCase() === 'true';
const runUrl = process.env.BACKUP_AUTO_URL || DEFAULT_URL;
const pitrBaseUrl = process.env.PITR_BASE_AUTO_URL || DEFAULT_PITR_BASE_URL;
const timeZone = process.env.BACKUP_AUTO_TIMEZONE || DEFAULT_TIMEZONE;
const retentionDays = Math.max(
  1,
  Number(process.env.BACKUP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS)
);
const scheduleConfigs = [
  {
    key: 'pitr-base',
    label: 'PITR base backup',
    enabled: pitrBaseEnabled,
    url: pitrBaseUrl,
    scheduleTime: process.env.PITR_BASE_AUTO_TIME || DEFAULT_PITR_BASE_TIME,
    payload: {},
  },
  {
    key: 'full',
    label: 'full dump',
    enabled: fullEnabled,
    url: runUrl,
    scheduleTime: process.env.BACKUP_AUTO_TIME || DEFAULT_FULL_TIME,
    scheduleCadence:
      process.env.BACKUP_AUTO_CADENCE || DEFAULT_FULL_CADENCE,
    scheduleDayOfWeek:
      process.env.BACKUP_AUTO_DAY_OF_WEEK || DEFAULT_FULL_DAY_OF_WEEK,
    payload: {
      strategy: 'full',
      format: 'dump',
      retentionDays,
    },
  },
  {
    key: 'differential',
    label: 'differential backup',
    enabled: differentialEnabled,
    url: runUrl,
    scheduleTime: process.env.BACKUP_DIFF_AUTO_TIME || DEFAULT_DIFF_TIME,
    scheduleCadence: 'daily',
    payload: {
      strategy: 'differential',
      format: process.env.BACKUP_DIFF_AUTO_FORMAT || 'json',
      retentionDays,
    },
  },
  {
    key: 'log-prune',
    label: 'log pruning',
    enabled: logPruneEnabled,
    url: process.env.LOG_PRUNE_AUTO_URL || DEFAULT_LOG_PRUNE_URL,
    scheduleTime: process.env.LOG_PRUNE_AUTO_TIME || DEFAULT_LOG_PRUNE_TIME,
    payload: {},
  },
].filter((config) => config.enabled);
const internalJobToken = process.env.INTERNAL_JOB_TOKEN || '';

if (scheduleConfigs.length === 0) {
  console.log(
    '[backup-scheduler] Disabled by BACKUP_AUTO_ENABLED=false, BACKUP_DIFF_AUTO_ENABLED=false, PITR_BASE_AUTO_ENABLED=false, and LOG_PRUNE_AUTO_ENABLED=false'
  );
  setInterval(() => {}, CHECK_INTERVAL_MS);
} else {
  if (!internalJobToken.trim()) {
    console.error('[backup-scheduler] INTERNAL_JOB_TOKEN is required');
    process.exit(1);
  }

  const stateByKey = new Map(
    scheduleConfigs.map((config) => [
      config.key,
      {
        lastTriggeredPeriodKey: null,
      },
    ])
  );

  function parseScheduleTime(label, value) {
    const [scheduledHour, scheduledMinute] = value
      .split(':')
      .map((part) => Number(part));

    if (
      !Number.isInteger(scheduledHour) ||
      !Number.isInteger(scheduledMinute) ||
      scheduledHour < 0 ||
      scheduledHour > 23 ||
      scheduledMinute < 0 ||
      scheduledMinute > 59
    ) {
      console.error(
        `[backup-scheduler] ${label} schedule time must be HH:MM in 24-hour format`
      );
      process.exit(1);
    }

    return {
      scheduledHour,
      scheduledMinute,
    };
  }

  function parseScheduleCadence(label, value) {
    const normalized = String(value || 'daily')
      .trim()
      .toLowerCase();

    if (normalized === 'daily' || normalized === 'weekly') {
      return normalized;
    }

    console.error(
      `[backup-scheduler] ${label} schedule cadence must be daily or weekly`
    );
    process.exit(1);
  }

  function parseScheduleDayOfWeek(label, value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    const numeric = Number(normalized);

    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) {
      return numeric;
    }

    const dayIndex = WEEKDAY_NAMES.indexOf(normalized);
    if (dayIndex >= 0) {
      return dayIndex;
    }

    console.error(
      `[backup-scheduler] ${label} schedule day must be a weekday name or 0-6`
    );
    process.exit(1);
  }

  function shiftDateKey(dateKey, days) {
    const [year, month, day] = dateKey.split('-').map((part) => Number(part));
    const value = new Date(Date.UTC(year, month - 1, day));
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  const parsedConfigByKey = new Map(
    scheduleConfigs.map((config) => [
      config.key,
      {
        ...config,
        ...parseScheduleTime(config.label, config.scheduleTime),
        scheduleCadence: parseScheduleCadence(
          config.label,
          config.scheduleCadence || 'daily'
        ),
        scheduleDayOfWeek:
          (config.scheduleCadence || 'daily') === 'weekly'
            ? parseScheduleDayOfWeek(config.label, config.scheduleDayOfWeek)
            : null,
      },
    ])
  );

  function getZonedParts(date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value || '';
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: Number(get('hour')) % 24,
      minute: Number(get('minute')),
      weekday: WEEKDAY_NAMES.indexOf(
        new Intl.DateTimeFormat('en-US', {
          timeZone,
          weekday: 'long',
        })
          .format(date)
          .toLowerCase()
      ),
    };
  }

  function getCurrentPeriodKey(zoned, config) {
    const dateKey = `${zoned.year}-${zoned.month}-${zoned.day}`;
    if (config.scheduleCadence === 'daily') {
      return dateKey;
    }

    const offset = (zoned.weekday - config.scheduleDayOfWeek + 7) % 7;
    return shiftDateKey(dateKey, -offset);
  }

  function getDuePeriodKey(zoned, config) {
    const dateKey = `${zoned.year}-${zoned.month}-${zoned.day}`;
    const currentMinutes = zoned.hour * 60 + zoned.minute;

    if (config.scheduleCadence === 'daily') {
      return currentMinutes >= config.scheduledHour * 60 + config.scheduledMinute
        ? dateKey
        : shiftDateKey(dateKey, -1);
    }

    const currentPeriodKey = getCurrentPeriodKey(zoned, config);
    return zoned.weekday === config.scheduleDayOfWeek &&
      currentMinutes < config.scheduledHour * 60 + config.scheduledMinute
      ? shiftDateKey(currentPeriodKey, -7)
      : currentPeriodKey;
  }

  async function triggerBackup(config, periodKey) {
    console.log(
      `[backup-scheduler] Checking scheduled ${config.label} for ${periodKey}`
    );

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': internalJobToken,
      },
      body: JSON.stringify({
        ...config.payload,
        skipIfAlreadyCompletedToday: true,
        scheduleTime: config.scheduleTime,
        scheduleCadence: config.scheduleCadence,
        scheduleDayOfWeek:
          config.scheduleDayOfWeek === null
            ? undefined
            : WEEKDAY_NAMES[config.scheduleDayOfWeek],
        timeZone,
        allowCatchUpBeforeScheduledTime: true,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        payload?.error ||
          payload?.message ||
          `Scheduler backup failed (${response.status})`
      );
    }

    console.log(
      '[backup-scheduler] Backup job result:',
      JSON.stringify(payload)
    );

    return payload;
  }

  async function tick() {
    const now = new Date();
    const zoned = getZonedParts(now);

    for (const config of parsedConfigByKey.values()) {
      const state = stateByKey.get(config.key);
      if (!state) {
        continue;
      }

      const duePeriodKey = getDuePeriodKey(zoned, config);

      if (state.lastTriggeredPeriodKey === duePeriodKey) {
        continue;
      }

      try {
        const payload = await triggerBackup(config, duePeriodKey);
        state.bootCheckPending = false;
        if (
          payload?.success &&
          (!payload?.skipped ||
            String(payload?.reason || '').includes(
              'already exists for the current scheduled'
            ) ||
            String(payload?.reason || '').includes('is not due yet'))
        ) {
          state.lastTriggeredPeriodKey = duePeriodKey;
        }
      } catch (error) {
        console.error(
          `[backup-scheduler] ${config.label} trigger failed:`,
          error
        );
      }
    }
  }

  console.log(
    `[backup-scheduler] Enabled. ${scheduleConfigs
      .map((config) => {
        const cadence = config.scheduleCadence || 'daily';
        const suffix =
          cadence === 'weekly'
            ? ` every ${config.scheduleDayOfWeek || DEFAULT_FULL_DAY_OF_WEEK}`
            : ' daily';
        return `${config.label} at ${config.scheduleTime}${suffix}`;
      })
      .join('; ')} ${timeZone}; retention ${retentionDays} day(s); startup performs one catch-up check per missed period.`
  );

  void tick();
  setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
}
