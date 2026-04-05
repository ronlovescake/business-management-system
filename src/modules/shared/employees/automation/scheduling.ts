import { dayjs } from '@/utils/date';
import { getCurrentPayrollPeriod } from '@/lib/payroll/currentPayPeriod';
import { normalizePayrollCutoffDays } from './payrollCutoffDays';
import {
  STAY_IN_ATTENDANCE_LOOKBACK_DAYS,
  buildRollingDateRange,
} from './stayInBackfill';

function parseTime(value: string): { hour: number; minute: number } {
  const [rawHour = '0', rawMinute = '0'] = value.split(':');
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);

  return {
    hour: Number.isNaN(hour) ? 0 : hour,
    minute: Number.isNaN(minute) ? 0 : minute,
  };
}

function setScheduledTime(dateTime: ReturnType<typeof dayjs>, value: string) {
  const { hour, minute } = parseTime(value);
  return dateTime.clone().hour(hour).minute(minute).second(0).millisecond(0);
}

export function getDueStayInAutomationTarget(params: {
  scheduleTime: string;
  timezone: string;
  graceMinutes: number;
}) {
  const now = dayjs().tz(params.timezone);
  const scheduled = setScheduledTime(now, params.scheduleTime);
  const graceStart = scheduled.clone().subtract(params.graceMinutes, 'minute');
  const targetMoment = now.isBefore(graceStart)
    ? scheduled.clone().subtract(1, 'day')
    : scheduled;

  const targetDate = targetMoment.format('YYYY-MM-DD');

  return {
    targetDate,
    periodKey: targetDate,
  };
}

export function getStayInBackfillDateRange(params: {
  scheduleTime: string;
  timezone: string;
  graceMinutes: number;
  lookbackDays?: number;
}) {
  const target = getDueStayInAutomationTarget(params);

  return {
    ...target,
    dateRange: buildRollingDateRange(
      target.targetDate,
      params.lookbackDays ?? STAY_IN_ATTENDANCE_LOOKBACK_DAYS
    ),
  };
}

function buildReferenceTime(params: {
  timezone: string;
  referenceTime?: string | Date;
}) {
  return params.referenceTime
    ? dayjs(params.referenceTime).tz(params.timezone)
    : dayjs().tz(params.timezone);
}

function resolveCutoffDate(month: ReturnType<typeof dayjs>, cutoffDay: number) {
  return month
    .clone()
    .date(Math.min(cutoffDay, month.daysInMonth()))
    .startOf('day');
}

export function getDuePayrollAutomationPeriod(params: {
  scheduleTime: string;
  timezone: string;
  cutoffDays: number[];
  referenceTime?: string | Date;
}) {
  const cutoffDays = normalizePayrollCutoffDays(params.cutoffDays);

  if (cutoffDays.length === 0) {
    return null;
  }

  const now = buildReferenceTime(params);
  const months = [-2, -1, 0].map((offset) =>
    now.clone().add(offset, 'month').startOf('month')
  );
  const cutoffs = months
    .flatMap((month) => {
      const entries = cutoffDays.map((cutoffDay) => {
        const cutoffDate = resolveCutoffDate(month, cutoffDay);

        return {
          cutoffDate,
          cutoffDay,
          cutoffDateKey: cutoffDate.format('YYYY-MM-DD'),
          scheduledAt: setScheduledTime(cutoffDate, params.scheduleTime),
        };
      });
      const deduped = new Map<string, (typeof entries)[number]>();

      for (const entry of entries) {
        const existing = deduped.get(entry.cutoffDateKey);
        if (!existing || entry.cutoffDay > existing.cutoffDay) {
          deduped.set(entry.cutoffDateKey, entry);
        }
      }

      return Array.from(deduped.values());
    })
    .sort(
      (left, right) => left.cutoffDate.valueOf() - right.cutoffDate.valueOf()
    );

  const dueIndex = cutoffs.reduce((latestIndex, entry, index) => {
    if (!entry.scheduledAt.isAfter(now)) {
      return index;
    }

    return latestIndex;
  }, -1);

  if (dueIndex < 0) {
    return null;
  }

  const dueCutoff = cutoffs[dueIndex];
  const [year, month, day] = dueCutoff.cutoffDateKey
    .split('-')
    .map((value) => Number.parseInt(value, 10));
  const period = getCurrentPayrollPeriod({
    year,
    month,
    day,
  });

  return {
    periodStart: period.start,
    periodEnd: period.end,
    label: period.label,
    periodKey: `${period.start}:${period.end}`,
    cutoffDate: dueCutoff.cutoffDateKey,
    cutoffDay: dueCutoff.cutoffDay,
  };
}
