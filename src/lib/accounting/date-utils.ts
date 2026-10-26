/**
 * Shared date and period utilities for accounting modules
 */

import type { PeriodOption } from './constants';
import type { DateRange } from './types';
import { dayjs } from '@/utils/date';

export function parseDate(value?: string | Date | null): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();

  // Handle simple "Month D, YYYY" strings (e.g. "Jan 13, 2026") as calendar dates.
  // We intentionally construct a UTC date to avoid timezone shifting the day bucket.
  const monthDayYear = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (monthDayYear) {
    const [, monthRaw, dayRaw, yearRaw] = monthDayYear;
    const month = monthRaw.toLowerCase();
    const day = Number(dayRaw);
    const year = Number(yearRaw);

    const monthIndexByName: Record<string, number> = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      sept: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    };

    const monthIndex = monthIndexByName[month];
    if (
      Number.isFinite(monthIndex) &&
      Number.isFinite(day) &&
      day >= 1 &&
      day <= 31 &&
      Number.isFinite(year)
    ) {
      const d = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfDay(date: Date): Date {
  return dayjs(date).tz('Asia/Manila').startOf('day').toDate();
}

export function endOfDay(date: Date): Date {
  return dayjs(date).tz('Asia/Manila').endOf('day').toDate();
}

export function toISOString(date: Date): string {
  return date.toISOString();
}

export function buildPeriodLabel(from: Date | null, to: Date | null): string {
  if (!from && !to) {
    return 'All Time';
  }

  const format = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    });

  if (from && to) {
    return `${format(from)} - ${format(to)}`;
  }

  if (from) {
    return `From ${format(from)}`;
  }

  if (to) {
    return `Until ${format(to)}`;
  }

  return 'All Time';
}

export function getPeriodRange(
  period: PeriodOption,
  now: Date = new Date()
): DateRange {
  const current = dayjs(now).tz('Asia/Manila');
  const to = current.endOf('day').toISOString();

  switch (period) {
    case 'This Month': {
      return { from: current.startOf('month').toISOString(), to };
    }
    case 'Last Month': {
      const previous = current.subtract(1, 'month');
      return {
        from: previous.startOf('month').toISOString(),
        to: previous.endOf('month').toISOString(),
      };
    }
    case 'Last 30 Days': {
      return {
        from: current.subtract(29, 'day').startOf('day').toISOString(),
        to,
      };
    }
    case 'This Year': {
      return { from: current.startOf('year').toISOString(), to };
    }
    case 'Full Calendar Year': {
      return {
        from: current.startOf('year').toISOString(),
        to: current.endOf('year').toISOString(),
      };
    }
    default:
      return {};
  }
}

export function parseDateRangeFromParams(params: URLSearchParams): {
  from: Date | null;
  to: Date | null;
} {
  const fromParam = parseDate(params.get('from'));
  const toParam = parseDate(params.get('to'));
  const from = fromParam ? startOfDay(fromParam) : null;
  const to = toParam ? endOfDay(toParam) : null;

  return { from, to };
}
