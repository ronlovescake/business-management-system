import { describe, it, expect } from 'vitest';
import {
  parseCsvLine,
  normalizeCsvHeader,
  parseCsvText,
  parseCsvAmount,
  parseCsvDateToISO,
} from '@/lib/accounting/csv-import';

describe('parseCsvLine', () => {
  it('splits a simple comma-separated line', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace from each field', () => {
    expect(parseCsvLine(' foo , bar , baz ')).toEqual(['foo', 'bar', 'baz']);
  });

  it('handles quoted fields', () => {
    expect(parseCsvLine('"hello world",test')).toEqual(['hello world', 'test']);
  });

  it('handles quoted fields containing commas', () => {
    expect(parseCsvLine('"Smith, John",30')).toEqual(['Smith, John', '30']);
  });

  it('handles escaped double quotes inside quoted field', () => {
    expect(parseCsvLine('"He said ""hello"""')).toEqual(['He said "hello"']);
  });

  it('handles empty fields', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('returns a single element array for a line with no commas', () => {
    expect(parseCsvLine('hello')).toEqual(['hello']);
  });

  it('handles an empty string', () => {
    expect(parseCsvLine('')).toEqual(['']);
  });
});

describe('normalizeCsvHeader', () => {
  it('lowercases the header', () => {
    expect(normalizeCsvHeader('OrderDate')).toBe('orderdate');
  });

  it('removes spaces', () => {
    expect(normalizeCsvHeader('Order Date')).toBe('orderdate');
  });

  it('handles multiple spaces', () => {
    expect(normalizeCsvHeader('Unit  Price')).toBe('unitprice');
  });

  it('preserves numbers', () => {
    expect(normalizeCsvHeader('Column 1')).toBe('column1');
  });

  it('handles already-lowercase headers', () => {
    expect(normalizeCsvHeader('amount')).toBe('amount');
  });
});

describe('parseCsvText', () => {
  it('parses a simple CSV text with headers and rows', () => {
    const csv = 'Name,Amount\nAlice,100\nBob,200';
    const result = parseCsvText(csv);
    expect(result.headers).toEqual(['name', 'amount']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ name: 'Alice', amount: '100' });
    expect(result.rows[1]).toEqual({ name: 'Bob', amount: '200' });
  });

  it('returns empty headers and rows for empty text', () => {
    expect(parseCsvText('')).toEqual({ headers: [], rows: [] });
  });

  it('returns empty rows for header-only CSV', () => {
    const result = parseCsvText('Name,Amount');
    expect(result.headers).toEqual(['name', 'amount']);
    expect(result.rows).toHaveLength(0);
  });

  it('handles Windows-style \\r\\n line endings', () => {
    const csv = 'Name,Amount\r\nAlice,100';
    const result = parseCsvText(csv);
    expect(result.rows[0]).toEqual({ name: 'Alice', amount: '100' });
  });

  it('ignores blank lines', () => {
    const csv = 'Name,Amount\n\nAlice,100\n\n';
    const result = parseCsvText(csv);
    expect(result.rows).toHaveLength(1);
  });

  it('fills missing fields with empty string', () => {
    const csv = 'A,B,C\n1,2';
    const result = parseCsvText(csv);
    expect(result.rows[0]).toEqual({ a: '1', b: '2', c: '' });
  });
});

describe('parseCsvAmount', () => {
  it('parses a plain number string', () => {
    expect(parseCsvAmount('1500')).toBe(1500);
  });

  it('parses a number with peso sign', () => {
    expect(parseCsvAmount('₱1,500.50')).toBe(1500.5);
  });

  it('parses a number with dollar sign', () => {
    expect(parseCsvAmount('$25.00')).toBe(25);
  });

  it('strips commas', () => {
    expect(parseCsvAmount('10,000.00')).toBe(10000);
  });

  it('strips spaces', () => {
    expect(parseCsvAmount(' 500 ')).toBe(500);
  });

  it('returns null for non-numeric strings', () => {
    expect(parseCsvAmount('N/A')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCsvAmount('')).toBeNull();
  });

  it('handles negative amounts', () => {
    expect(parseCsvAmount('-200')).toBe(-200);
  });
});

describe('parseCsvDateToISO', () => {
  it('parses a valid date string to YYYY-MM-DD', () => {
    const result = parseCsvDateToISO('2026-01-15');
    expect(result).toBe('2026-01-15');
  });

  it('parses a date in MM/DD/YYYY format', () => {
    const result = parseCsvDateToISO('01/15/2026');
    expect(result).toMatch(/^2026-01-\d{2}$/);
  });

  it('returns null for invalid date string', () => {
    expect(parseCsvDateToISO('not-a-date')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCsvDateToISO('')).toBeNull();
  });

  it('returns a string in YYYY-MM-DD format', () => {
    const result = parseCsvDateToISO('2026-03-17');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
