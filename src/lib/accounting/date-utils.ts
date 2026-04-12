/**
 * Shared date and period utilities for accounting modules
 */

import type { PeriodOption } from './constants';
import type { DateRange } from './types';

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
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
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

export function getPeriodRange(period: PeriodOption): DateRange {
  const now = new Date();

  switch (period) {
    case 'This Month': {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { from: toISOString(from), to: toISOString(to) };
    }
    case 'Last Month': {
      const from = startOfDay(
        new Date(now.getFullYear(), now.getMonth() - 1, 1)
      );
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { from: toISOString(from), to: toISOString(to) };
    }
    case 'Last 30 Days': {
      const to = endOfDay(now);
      const from = startOfDay(
        new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
      );
      return { from: toISOString(from), to: toISOString(to) };
    }
    case 'This Year': {
      const from = startOfDay(new Date(now.getFullYear(), 0, 1));
      const to = endOfDay(new Date(now.getFullYear(), 11, 31));
      return { from: toISOString(from), to: toISOString(to) };
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
