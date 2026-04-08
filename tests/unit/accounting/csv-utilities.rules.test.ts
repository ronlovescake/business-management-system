/**
 * CSV Utility Functions — Business-Rule-Mapped Tests
 *
 * Covers shared CSV parsing/formatting utilities across:
 *  - src/lib/accounting/csv-import.ts (parseCsvLine, normalizeCsvHeader, parseCsvText, parseCsvAmount, parseCsvDateToISO)
 *  - src/lib/accounting/csv.ts (escapeCsvValue, buildCsvContent)
 *  - src/lib/accounting/manual-entry-import.ts (parseManualEntryCsv)
 *  - src/lib/accounting/expense-import.ts (getMissingRequiredColumns, buildExpenseImportMissingColumnsMessage)
 *  - src/modules/clothing/ledger/services/ExpensesCSV.ts (parseCSVLine, normalizeDate, cleanAmount, parseCSV)
 *
 * Rules Covered:
 *  acct #42-46  Import validation (required columns, date/amount parsing)
 *  acct #24-26  CSV export (escapeCSV, buildCsvContent, headers)
 *  acct #44     Robust CSV parsing (quoted fields, escaped quotes)
 *  acct #45     Amount cleaning (₱, $, commas)
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Shared csv-import.ts
// ---------------------------------------------------------------------------
import {
  parseCsvLine,
  normalizeCsvHeader,
  parseCsvText,
  parseCsvAmount,
  parseCsvDateToISO,
} from '@/lib/accounting/csv-import';

describe('csv-import utilities', () => {
  describe('parseCsvLine()', () => {
    it('Rule #44: splits simple comma-separated values', () => {
      expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('Rule #44: handles quoted fields with commas', () => {
      expect(parseCsvLine('"hello, world",b,c')).toEqual(['hello, world', 'b', 'c']);
    });

    it('Rule #44: handles escaped quotes inside quoted field', () => {
      expect(parseCsvLine('"say ""hello""",b')).toEqual(['say "hello"', 'b']);
    });

    it('Rule #44: trims whitespace from fields', () => {
      expect(parseCsvLine(' a , b , c ')).toEqual(['a', 'b', 'c']);
    });

    it('Rule #44: handles empty fields', () => {
      expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
    });
  });

  describe('normalizeCsvHeader()', () => {
    it('lowercases and removes spaces', () => {
      expect(normalizeCsvHeader('Debit Account')).toBe('debitaccount');
      expect(normalizeCsvHeader('  Date  ')).toBe('date');
      expect(normalizeCsvHeader('Credit  Account')).toBe('creditaccount');
    });
  });

  describe('parseCsvText()', () => {
    it('parses header + rows into structured objects', () => {
      const text = 'Date,Amount,Ref\n2025-01-01,100,REF-1\n2025-01-02,200,REF-2';
      const result = parseCsvText(text);

      expect(result.headers).toEqual(['date', 'amount', 'ref']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ date: '2025-01-01', amount: '100', ref: 'REF-1' });
    });

    it('returns empty for empty input', () => {
      const result = parseCsvText('');
      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it('handles single header row (no data)', () => {
      const result = parseCsvText('Date,Amount');
      expect(result.headers).toEqual(['date', 'amount']);
      expect(result.rows).toEqual([]);
    });

    it('handles \\r\\n line endings', () => {
      const text = 'Date,Amount\r\n2025-01-01,100';
      const result = parseCsvText(text);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('parseCsvAmount()', () => {
    it('Rule #45: strips peso sign', () => {
      expect(parseCsvAmount('₱1,234.56')).toBe(1234.56);
    });

    it('Rule #45: strips dollar sign', () => {
      expect(parseCsvAmount('$500.00')).toBe(500);
    });

    it('Rule #45: strips commas and spaces', () => {
      expect(parseCsvAmount('1, 234, 567')).toBe(1234567);
    });

    it('Rule #45: returns null for non-numeric', () => {
      expect(parseCsvAmount('abc')).toBeNull();
    });

    it('Rule #45: parses negative numbers', () => {
      expect(parseCsvAmount('-100.50')).toBe(-100.5);
    });

    it('Rule #45: parses plain number', () => {
      expect(parseCsvAmount('42')).toBe(42);
    });
  });

  describe('parseCsvDateToISO()', () => {
    it('parses standard date strings to YYYY-MM-DD', () => {
      expect(parseCsvDateToISO('2025-06-15')).toBe('2025-06-15');
    });

    it('returns null for invalid date', () => {
      expect(parseCsvDateToISO('not-a-date')).toBeNull();
    });

    it('parses slash-separated dates', () => {
      const result = parseCsvDateToISO('01/15/2025');
      expect(result).toBe('2025-01-15');
    });
  });
});

// ---------------------------------------------------------------------------
// csv.ts (export helpers)
// ---------------------------------------------------------------------------
import { escapeCsvValue, buildCsvContent } from '@/lib/accounting/csv';

describe('csv export utilities', () => {
  describe('escapeCsvValue()', () => {
    it('Rule #24: returns empty string for null', () => {
      expect(escapeCsvValue(null)).toBe('');
    });

    it('Rule #24: returns empty string for undefined', () => {
      expect(escapeCsvValue(undefined)).toBe('');
    });

    it('Rule #24: wraps values containing commas in quotes', () => {
      expect(escapeCsvValue('hello, world')).toBe('"hello, world"');
    });

    it('Rule #24: escapes double quotes', () => {
      expect(escapeCsvValue('say "hello"')).toBe('"say ""hello"""');
    });

    it('Rule #24: wraps values containing newlines', () => {
      expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
    });

    it('Rule #24: returns plain string when no special chars', () => {
      expect(escapeCsvValue('hello')).toBe('hello');
    });

    it('Rule #24: converts numbers to string', () => {
      expect(escapeCsvValue(42)).toBe('42');
    });
  });

  describe('buildCsvContent()', () => {
    it('Rule #26: builds header + rows joined by newlines', () => {
      const result = buildCsvContent(
        ['Date', 'Amount'],
        [['2025-01-01', '100'], ['2025-01-02', '200']]
      );
      expect(result).toBe('Date,Amount\n2025-01-01,100\n2025-01-02,200');
    });

    it('Rule #26: handles empty rows', () => {
      const result = buildCsvContent(['Name', 'Value'], []);
      expect(result).toBe('Name,Value');
    });
  });
});

// ---------------------------------------------------------------------------
// manual-entry-import.ts
// ---------------------------------------------------------------------------
import { parseManualEntryCsv } from '@/lib/accounting/manual-entry-import';

describe('parseManualEntryCsv()', () => {
  const validCsv = [
    'Date,Amount,Ref,DebitAccount,CreditAccount,Description',
    '2025-01-01,1000,REF-001,Cash,Revenue,Sale received',
    '2025-01-02,500,REF-002,Expenses,Cash,Office supplies',
  ].join('\n');

  it('Rule #42: parses valid CSV into rows', () => {
    const { rows, errors } = parseManualEntryCsv(validCsv);
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(rows[0].date).toBe('2025-01-01');
    expect(rows[0].amount).toBe(1000);
    expect(rows[0].ref).toBe('REF-001');
    expect(rows[0].debitAccount).toBe('Cash');
    expect(rows[0].creditAccount).toBe('Revenue');
    expect(rows[0].description).toBe('Sale received');
  });

  it('Rule #42: returns error for empty CSV', () => {
    const { rows, errors } = parseManualEntryCsv('');
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/empty/i);
  });

  it('Rule #42: returns error for missing required columns', () => {
    const { rows, errors } = parseManualEntryCsv('Date,Amount\n2025-01-01,100');
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/missing required columns/i);
  });

  it('Rule #43: reports invalid amount per row', () => {
    const csv = 'Date,Amount,Ref,DebitAccount,CreditAccount\n2025-01-01,abc,REF-1,Cash,Revenue';
    const { rows, errors } = parseManualEntryCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/invalid amount/i);
  });

  it('Rule #43: reports invalid date per row', () => {
    const csv = 'Date,Amount,Ref,DebitAccount,CreditAccount\nnot-a-date,100,REF-1,Cash,Revenue';
    const { rows, errors } = parseManualEntryCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/invalid date/i);
  });

  it('Rule #43: reports missing debit/credit account per row', () => {
    const csv = 'Date,Amount,Ref,DebitAccount,CreditAccount\n2025-01-01,100,REF-1,,Revenue';
    const { rows, errors } = parseManualEntryCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/missing debit or credit/i);
  });

  it('Rule #43: reports missing reference per row', () => {
    const csv = 'Date,Amount,Ref,DebitAccount,CreditAccount\n2025-01-01,100,,Cash,Revenue';
    const { rows, errors } = parseManualEntryCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/missing reference/i);
  });

  it('Rule #42: skips blank rows', () => {
    const csv = 'Date,Amount,Ref,DebitAccount,CreditAccount\n,,,,\n2025-01-01,100,REF-1,Cash,Revenue';
    const { rows } = parseManualEntryCsv(csv);
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// expense-import.ts
// ---------------------------------------------------------------------------
import {
  getMissingRequiredColumns,
  buildExpenseImportMissingColumnsMessage,
} from '@/lib/accounting/expense-import';

describe('expense-import utilities', () => {
  it('getMissingRequiredColumns: returns missing headers', () => {
    const missing = getMissingRequiredColumns(['date', 'amount']);
    expect(missing).toContain('description');
    expect(missing).toContain('category');
    expect(missing).not.toContain('date');
  });

  it('getMissingRequiredColumns: empty when all present', () => {
    const missing = getMissingRequiredColumns(['date', 'amount', 'description', 'category']);
    expect(missing).toHaveLength(0);
  });

  it('buildExpenseImportMissingColumnsMessage: includes required and optional', () => {
    const msg = buildExpenseImportMissingColumnsMessage(['category'], ['notes', 'receipt']);
    expect(msg).toContain('category');
    expect(msg).toContain('Required columns');
    expect(msg).toContain('Optional columns');
    expect(msg).toContain('notes');
  });
});

// ---------------------------------------------------------------------------
// ExpensesCSV.ts (clothing ledger)
// ---------------------------------------------------------------------------
import {
  parseCSVLine as ledgerParseCSVLine,
  normalizeDate,
  cleanAmount,
  parseCSV as ledgerParseCSV,
} from '@/modules/clothing/ledger/services/ExpensesCSV';

describe('Clothing Ledger ExpensesCSV', () => {
  describe('parseCSVLine()', () => {
    it('Rule #44: handles quoted fields with commas', () => {
      expect(ledgerParseCSVLine('"hello, world",b,c')).toEqual(['hello, world', 'b', 'c']);
    });

    it('Rule #44: handles escaped quotes', () => {
      expect(ledgerParseCSVLine('"say ""hi""",b')).toEqual(['say "hi"', 'b']);
    });
  });

  describe('normalizeDate()', () => {
    it('parses valid date to YYYY-MM-DD', () => {
      expect(normalizeDate('2025-03-15')).toBe('2025-03-15');
    });

    it('returns null for invalid date', () => {
      expect(normalizeDate('garbage')).toBeNull();
    });
  });

  describe('cleanAmount()', () => {
    it('Rule #45: strips currency symbols', () => {
      expect(cleanAmount('₱1,000.50')).toBe(1000.5);
    });

    it('Rule #45: returns null for non-numeric', () => {
      expect(cleanAmount('abc')).toBeNull();
    });
  });

  describe('parseCSV()', () => {
    it('Rule #42: parses valid expense CSV', () => {
      const csv = 'Date,Amount,Description,Category\n2025-01-01,100,Office supplies,Misc';
      const result = ledgerParseCSV(csv);
      expect(result.expenses).toHaveLength(1);
      expect(result.summary.successCount).toBe(1);
      expect(result.summary.errorCount).toBe(0);
    });

    it('Rule #42: returns error for empty CSV', () => {
      const result = ledgerParseCSV('');
      expect(result.expenses).toHaveLength(0);
      expect(result.summary.errors[0]).toMatch(/empty/i);
    });

    it('Rule #42: returns error for missing required columns', () => {
      const result = ledgerParseCSV('Date,Amount\n2025-01-01,100');
      expect(result.expenses).toHaveLength(0);
      expect(result.summary.errors[0]).toMatch(/missing required/i);
    });

    it('Rule #43: reports invalid date per row', () => {
      const csv = 'Date,Amount,Description,Category\nnot-a-date,100,Office,Misc';
      const result = ledgerParseCSV(csv);
      expect(result.summary.errorCount).toBe(1);
      expect(result.summary.errors[0]).toMatch(/invalid date/i);
    });

    it('Rule #43: reports invalid amount per row', () => {
      const csv = 'Date,Amount,Description,Category\n2025-01-01,abc,Office,Misc';
      const result = ledgerParseCSV(csv);
      expect(result.summary.errorCount).toBe(1);
      expect(result.summary.errors[0]).toMatch(/invalid amount/i);
    });

    it('Rule #43: reports missing required fields per row', () => {
      const csv = 'Date,Amount,Description,Category\n2025-01-01,100,,Misc';
      const result = ledgerParseCSV(csv);
      expect(result.summary.errorCount).toBe(1);
      expect(result.summary.errors[0]).toMatch(/missing required/i);
    });

    it('Rule #46: defaults status to pending if invalid', () => {
      const csv = 'Date,Amount,Description,Category,Status\n2025-01-01,100,Office,Misc,INVALID';
      const result = ledgerParseCSV(csv);
      expect(result.expenses[0].status).toBe('pending');
    });

    it('Rule #46: accepts valid status values', () => {
      const csv = 'Date,Amount,Description,Category,Status\n2025-01-01,100,Office,Misc,approved';
      const result = ledgerParseCSV(csv);
      expect(result.expenses[0].status).toBe('approved');
    });

    it('Rule #42: reports invalid category', () => {
      const csv = 'Date,Amount,Description,Category\n2025-01-01,100,Office,InvalidCategory';
      const result = ledgerParseCSV(csv);
      expect(result.summary.errorCount).toBe(1);
      expect(result.summary.errors[0]).toMatch(/invalid category/i);
    });

    it('skips fully empty rows', () => {
      const csv = 'Date,Amount,Description,Category\n2025-01-01,100,Office,Misc\n,,,';
      const result = ledgerParseCSV(csv);
      expect(result.expenses).toHaveLength(1);
    });
  });
});
