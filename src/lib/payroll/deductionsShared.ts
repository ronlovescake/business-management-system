import { Prisma } from '@prisma/client';

export const roundToCents = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export const normalizeIdentifier = (value?: string | null): string =>
  (value ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();

export const toDecimalValue = (value: number): Prisma.Decimal =>
  new Prisma.Decimal(roundToCents(value).toFixed(2));

export const toDateOnlyUtc = (input: Date): Date =>
  new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));

export const parseDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return toDateOnlyUtc(parsed);
};

export const parsePeriodDate = (
  value: string | null | undefined,
  fallback?: string
): Date | null => {
  const direct = parseDate(value ?? undefined);
  if (direct) {
    return direct;
  }

  if (!fallback) {
    return null;
  }

  return parseDate(fallback);
};

export const extractPeriodBounds = (
  payPeriod: string | null | undefined
): {
  start?: string;
  end?: string;
} => {
  if (!payPeriod) {
    return {};
  }

  const [rawStart, rawEnd] = payPeriod
    .split(' to ')
    .map((part) => part?.trim());
  return { start: rawStart, end: rawEnd };
};

export const formatDate = (date: Date): string =>
  date.toISOString().slice(0, 10);

export const parseTimeToMinutes = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(':').map((part) => Number(part));

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

type Schedulable = {
  employeeId: string;
  date: string;
};

export const countScheduledDays = <TSchedule extends Schedulable>(
  employeeId: string,
  start: Date,
  end: Date,
  schedules: TSchedule[]
): number => {
  if (start > end) {
    return 0;
  }

  const startStr = formatDate(start);
  const endStr = formatDate(end);

  const scheduledDates = new Set(
    schedules
      .filter(
        (schedule) =>
          schedule.employeeId === employeeId &&
          schedule.date >= startStr &&
          schedule.date <= endStr
      )
      .map((schedule) => schedule.date)
  );

  return scheduledDates.size;
};

export const getOverlapScheduledDays = <TSchedule extends Schedulable>(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
  leaveStart: Date,
  leaveEnd: Date,
  schedules: TSchedule[]
): number => {
  const overlapStart = leaveStart > periodStart ? leaveStart : periodStart;
  const overlapEnd = leaveEnd < periodEnd ? leaveEnd : periodEnd;

  if (overlapStart > overlapEnd) {
    return 0;
  }

  return countScheduledDays(employeeId, overlapStart, overlapEnd, schedules);
};
