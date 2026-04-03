#!/usr/bin/env node
/* eslint-disable no-console */

const DEFAULT_URL = 'http://app:5000/api/internal/backup/run';
const DEFAULT_TIME = '02:00';
const DEFAULT_TIMEZONE = 'Asia/Manila';
const DEFAULT_RETENTION_DAYS = 30;
const CHECK_INTERVAL_MS = 60 * 1000;

const enabled =
  String(process.env.BACKUP_AUTO_ENABLED || 'false')
    .trim()
    .toLowerCase() === 'true';
const runUrl = process.env.BACKUP_AUTO_URL || DEFAULT_URL;
const scheduleTime = process.env.BACKUP_AUTO_TIME || DEFAULT_TIME;
const timeZone = process.env.BACKUP_AUTO_TIMEZONE || DEFAULT_TIMEZONE;
const internalJobToken = process.env.INTERNAL_JOB_TOKEN || '';
const retentionDays = Math.max(
  1,
  Number(process.env.BACKUP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS)
);

if (!enabled) {
  console.log('[backup-scheduler] Disabled by BACKUP_AUTO_ENABLED=false');
  setInterval(() => {}, CHECK_INTERVAL_MS);
} else {
  if (!internalJobToken.trim()) {
    console.error('[backup-scheduler] INTERNAL_JOB_TOKEN is required');
    process.exit(1);
  }

  const [scheduledHour, scheduledMinute] = scheduleTime
    .split(':')
    .map((value) => Number(value));

  if (
    !Number.isInteger(scheduledHour) ||
    !Number.isInteger(scheduledMinute) ||
    scheduledHour < 0 ||
    scheduledHour > 23 ||
    scheduledMinute < 0 ||
    scheduledMinute > 59
  ) {
    console.error(
      '[backup-scheduler] BACKUP_AUTO_TIME must be HH:MM in 24-hour format'
    );
    process.exit(1);
  }

  let lastTriggeredDate = null;

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
      hour: Number(get('hour')),
      minute: Number(get('minute')),
    };
  }

  async function triggerBackup(dateKey) {
    console.log(`[backup-scheduler] Triggering daily full dump for ${dateKey}`);

    const response = await fetch(runUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': internalJobToken,
      },
      body: JSON.stringify({
        retentionDays,
        skipIfAlreadyCompletedToday: true,
        timeZone,
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
  }

  async function tick() {
    const now = new Date();
    const zoned = getZonedParts(now);
    const dateKey = `${zoned.year}-${zoned.month}-${zoned.day}`;
    const currentMinutes = zoned.hour * 60 + zoned.minute;
    const scheduledMinutes = scheduledHour * 60 + scheduledMinute;

    if (currentMinutes < scheduledMinutes || lastTriggeredDate === dateKey) {
      return;
    }

    try {
      await triggerBackup(dateKey);
      lastTriggeredDate = dateKey;
    } catch (error) {
      console.error('[backup-scheduler] Backup trigger failed:', error);
    }
  }

  console.log(
    `[backup-scheduler] Enabled. Daily full dumps at ${scheduleTime} ${timeZone}; retention ${retentionDays} day(s).`
  );

  void tick();
  setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
}
