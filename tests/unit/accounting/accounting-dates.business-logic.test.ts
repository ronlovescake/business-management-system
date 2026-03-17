import { describe, it, expect } from 'vitest';
import {
  parseDate,
  startOfDay,
  endOfDay,
  buildPeriodLabel,
  getPeriodRange,
  parseDateRangeFromParams,
} from '@/lib/accounting/date-utils';

describe('parseDate', () => {
  it('returns null for null input', () => {
    expect(parseDate(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull();
  });

  it('parses an ISO date string', () => {
    const result = parseDate('2026-01-15');
    expect(result).toBeInstanceOf(Date);
  });

  it('parses a Date object', () => {
    const d = new Date('2026-01-15');
    const result = parseDate(d);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getTime()).toBe(d.getTime());
  });

  it('returns null for an invalid Date object', () => {
    expect(parseDate(new Date('not-a-date'))).toBeNull();
  });

  it('parses "Jan 13, 2026" as UTC date', () => {
    const result = parseDate('Jan 13, 2026');
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getUTCFullYear()).toBe(2026);
    expect((result as Date).getUTCMonth()).toBe(0); // January
    expect((result as Date).getUTCDate()).toBe(13);
  });

  it('parses "March 1, 2025" correctly', () => {
    const result = parseDate('March 1, 2025');
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getUTCMonth()).toBe(2); // March
    expect((result as Date).getUTCDate()).toBe(1);
  });

  it('parses "December 31, 2025" correctly', () => {
    const result = parseDate('December 31, 2025');
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getUTCMonth()).toBe(11); // December
    expect((result as Date).getUTCDate()).toBe(31);
  });

  it('returns null for invalid string', () => {
    expect(parseDate('not-a-date')).toBeNull();
  });
});

describe('startOfDay', () => {
  it('sets time to 00:00:00.000', () => {
    const d = new Date('2026-03-15T14:30:00Z');
    const result = startOfDay(d);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('does not mutate the original date', () => {
    const d = new Date('2026-03-15T14:30:00');
    const originalTime = d.getTime();
    startOfDay(d);
    expect(d.getTime()).toBe(originalTime);
  });
});

describe('endOfDay', () => {
  it('sets time to 23:59:59.999', () => {
    const d = new Date('2026-03-15T08:00:00');
    const result = endOfDay(d);
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
    expect(result.getMilliseconds()).toBe(999);
  });

  it('does not mutate the original date', () => {
    const d = new Date('2026-03-15T14:30:00');
    const originalTime = d.getTime();
    endOfDay(d);
    expect(d.getTime()).toBe(originalTime);
  });
});

describe('buildPeriodLabel', () => {
  it('returns "All Time" when both from and to are null', () => {
    expect(buildPeriodLabel(null, null)).toBe('All Time');
  });

  it('returns "From ..." when only from is provided', () => {
    const from = new Date('2026-01-01');
    const label = buildPeriodLabel(from, null);
    expect(label).toMatch(/^From /);
  });

  it('returns "Until ..." when only to is provided', () => {
    const to = new Date('2026-12-31');
    const label = buildPeriodLabel(null, to);
    expect(label).toMatch(/^Until /);
  });

  it('returns a range string when both are provided', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');
    const label = buildPeriodLabel(from, to);
    expect(label).toContain(' - ');
  });
});

describe('getPeriodRange', () => {
  it('returns from and to ISO strings for "This Month"', () => {
    const range = getPeriodRange('This Month');
    expect(range.from).toBeDefined();
    expect(range.to).toBeDefined();
    const from = new Date(range.from as string);
    const to = new Date(range.to as string);
    expect(from.getDate()).toBe(1);
    expect(to.getHours()).toBe(23);
  });

  it('returns from and to ISO strings for "Last Month"', () => {
    const range = getPeriodRange('Last Month');
    expect(range.from).toBeDefined();
    expect(range.to).toBeDefined();
    const from = new Date(range.from as string);
    const to = new Date(range.to as string);
    expect(from.getDate()).toBe(1);
    expect(to >= from).toBe(true);
  });

  it('returns 30-day window for "Last 30 Days"', () => {
    const range = getPeriodRange('Last 30 Days');
    const from = new Date(range.from as string);
    const to = new Date(range.to as string);
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    // from = startOfDay(now - 29 days), to = endOfDay(now) → diff ≈ 29.9999 days
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThan(30.1);
  });

  it('returns full year for "This Year"', () => {
    const range = getPeriodRange('This Year');
    const from = new Date(range.from as string);
    const to = new Date(range.to as string);
    const now = new Date();
    expect(from.getFullYear()).toBe(now.getFullYear());
    expect(to.getFullYear()).toBe(now.getFullYear());
    expect(from.getMonth()).toBe(0); // January
    expect(to.getMonth()).toBe(11); // December
  });

  it('returns empty object for unknown period', () => {
    // @ts-expect-error - testing unknown period
    const range = getPeriodRange('Unknown Period');
    expect(range).toEqual({});
  });
});

describe('parseDateRangeFromParams', () => {
  it('parses from and to from URLSearchParams', () => {
    const params = new URLSearchParams('from=2026-01-01&to=2026-01-31');
    const { from, to } = parseDateRangeFromParams(params);
    expect(from).toBeInstanceOf(Date);
    expect(to).toBeInstanceOf(Date);
    expect((from as Date).getHours()).toBe(0);
    expect((to as Date).getHours()).toBe(23);
  });

  it('returns null for missing from and to', () => {
    const params = new URLSearchParams();
    const { from, to } = parseDateRangeFromParams(params);
    expect(from).toBeNull();
    expect(to).toBeNull();
  });

  it('returns only to when from is missing', () => {
    const params = new URLSearchParams('to=2026-03-31');
    const { from, to } = parseDateRangeFromParams(params);
    expect(from).toBeNull();
    expect(to).toBeInstanceOf(Date);
  });

  it('returns only from when to is missing', () => {
    const params = new URLSearchParams('from=2026-01-01');
    const { from, to } = parseDateRangeFromParams(params);
    expect(from).toBeInstanceOf(Date);
    expect(to).toBeNull();
  });
});
