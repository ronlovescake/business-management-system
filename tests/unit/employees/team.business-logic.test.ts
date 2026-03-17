import { describe, it, expect } from 'vitest';
import {
  extractSuffixFromName,
  parseNumberOrZero,
  toOptionalNumber,
  parseOptionalNumericInput,
} from '@/app/clothing/employees/team/hooks/employeeDetailUtils';

// ──────────────────────────────────────────────────────────
// extractSuffixFromName
// ──────────────────────────────────────────────────────────

describe('extractSuffixFromName', () => {
  it('returns empty string for null', () => {
    expect(extractSuffixFromName(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(extractSuffixFromName(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(extractSuffixFromName('')).toBe('');
  });

  it('extracts suffix after a comma', () => {
    expect(extractSuffixFromName('Dela Cruz, Jr.')).toBe('Jr.');
  });

  it('extracts suffix trimmed after comma', () => {
    expect(extractSuffixFromName('Santos,  III')).toBe('III');
  });

  it('extracts "Jr." from end of name without comma', () => {
    expect(extractSuffixFromName('Juan dela Cruz Jr.')).toBe('Jr.');
  });

  it('extracts "Sr" from end of name without comma', () => {
    expect(extractSuffixFromName('Pedro Santos Sr')).toBe('Sr');
  });

  it('extracts "II" from end of name', () => {
    expect(extractSuffixFromName('Robert King II')).toBe('II');
  });

  it('extracts "III" from end of name', () => {
    expect(extractSuffixFromName('James Brown III')).toBe('III');
  });

  it('extracts "IV" from end of name', () => {
    expect(extractSuffixFromName('Michael Scott IV')).toBe('IV');
  });

  it('extracts "V" from end of name', () => {
    expect(extractSuffixFromName('Arthur Prince V')).toBe('V');
  });

  it('returns empty string for names without suffix', () => {
    expect(extractSuffixFromName('Maria Clara')).toBe('');
  });

  it('returns empty string for a single word name', () => {
    expect(extractSuffixFromName('Alice')).toBe('');
  });
});

// ──────────────────────────────────────────────────────────
// parseNumberOrZero
// ──────────────────────────────────────────────────────────

describe('parseNumberOrZero', () => {
  it('returns the number for a valid number', () => {
    expect(parseNumberOrZero(42)).toBe(42);
  });

  it('parses a numeric string', () => {
    expect(parseNumberOrZero('3.14')).toBe(3.14);
  });

  it('returns 0 for null', () => {
    expect(parseNumberOrZero(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(parseNumberOrZero(undefined)).toBe(0);
  });

  it('returns 0 for non-numeric string', () => {
    expect(parseNumberOrZero('abc')).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(parseNumberOrZero(NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(parseNumberOrZero(Infinity)).toBe(0);
  });

  it('handles negative numbers', () => {
    expect(parseNumberOrZero(-5)).toBe(-5);
  });

  it('handles zero', () => {
    expect(parseNumberOrZero(0)).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────
// toOptionalNumber
// ──────────────────────────────────────────────────────────

describe('toOptionalNumber', () => {
  it('returns the number for a valid number', () => {
    expect(toOptionalNumber(99)).toBe(99);
  });

  it('returns 0 for null (Number(null) === 0 which is finite)', () => {
    expect(toOptionalNumber(null)).toBe(0);
  });

  it('returns undefined for undefined', () => {
    expect(toOptionalNumber(undefined)).toBeUndefined();
  });

  it('returns undefined for non-numeric string', () => {
    expect(toOptionalNumber('xyz')).toBeUndefined();
  });

  it('parses a numeric string to number', () => {
    expect(toOptionalNumber('15.5')).toBe(15.5);
  });

  it('returns undefined for Infinity', () => {
    expect(toOptionalNumber(Infinity)).toBeUndefined();
  });

  it('returns 0 for "0"', () => {
    expect(toOptionalNumber('0')).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────
// parseOptionalNumericInput
// ──────────────────────────────────────────────────────────

describe('parseOptionalNumericInput', () => {
  it('parses a valid numeric string', () => {
    expect(parseOptionalNumericInput('42')).toBe(42);
  });

  it('parses a decimal string', () => {
    expect(parseOptionalNumericInput('3.14')).toBeCloseTo(3.14);
  });

  it('returns null for empty string', () => {
    expect(parseOptionalNumericInput('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseOptionalNumericInput('   ')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseOptionalNumericInput(undefined)).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(parseOptionalNumericInput('abc')).toBeNull();
  });

  it('trims whitespace before parsing', () => {
    expect(parseOptionalNumericInput('  7  ')).toBe(7);
  });

  it('returns null for "Infinity"', () => {
    // parseFloat("Infinity") = Infinity → not finite → null
    expect(parseOptionalNumericInput('Infinity')).toBeNull();
  });
});
