import { describe, it, expect } from 'vitest';
import { formatDateTime, formatNumber } from '@/lib/formatters';

describe('formatNumber', () => {
  it('formats numbers with default locale', () => {
    expect(formatNumber(1234.5)).toBe('1,234.5');
  });

  it('respects Intl.NumberFormat options', () => {
    expect(
      formatNumber(1234.5, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    ).toBe('1,234.50');
  });
});

describe('formatDateTime', () => {
  it('formats Date input with provided options', () => {
    const date = new Date('2026-02-04T00:00:00.000Z');
    const formatted = formatDateTime(
      date,
      {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        timeZone: 'UTC',
      },
      'en-US'
    );

    expect(formatted).toBe('Feb 04, 2026');
  });

  it('accepts ISO string input', () => {
    const formatted = formatDateTime(
      '2026-02-04T13:45:00.000Z',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      },
      'en-US'
    );

    expect(formatted).toBe('13:45');
  });
});
