import { describe, expect, it } from 'vitest';
import {
  parseCsvAmount,
  parseCsvDateToISO,
  parseCsvText,
} from '@/lib/accounting/csv-import';

describe('csv-import helpers', () => {
  it('parses csv text with quoted commas', () => {
    const text = 'date,amount,description\n2026-01-16,1234.50,"Lunch, team"';
    const parsed = parseCsvText(text);

    expect(parsed.headers).toEqual(['date', 'amount', 'description']);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toEqual({
      date: '2026-01-16',
      amount: '1234.50',
      description: 'Lunch, team',
    });
  });

  it('parses csv text with escaped quotes', () => {
    const text =
      'date,amount,description\n2026-01-16,12.50,"Said ""hello"" to team"';
    const parsed = parseCsvText(text);

    expect(parsed.headers).toEqual(['date', 'amount', 'description']);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toEqual({
      date: '2026-01-16',
      amount: '12.50',
      description: 'Said "hello" to team',
    });
  });

  it('parses csv amounts with currency symbols', () => {
    expect(parseCsvAmount('₱ 1,234.56')).toBeCloseTo(1234.56, 2);
    expect(parseCsvAmount('$2,000')).toBe(2000);
    expect(parseCsvAmount('bad')).toBeNull();
  });

  it('parses csv dates to ISO date strings', () => {
    expect(parseCsvDateToISO('2026-01-16')).toBe('2026-01-16');
    expect(parseCsvDateToISO('Jan 16, 2026')).toBe('2026-01-16');
    expect(parseCsvDateToISO('invalid')).toBeNull();
  });
});
