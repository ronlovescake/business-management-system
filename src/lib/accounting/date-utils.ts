/**
 * Shared date and period utilities for accounting modules
 */

import type { PeriodOption } from './constants';
import type { DateRange } from './types';

export function parseDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const d = new Date(value);
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
    date.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
