import { describe, it, expect } from 'vitest';
import {
  createManualEntryFormState,
  buildManualEntryFormFromLines,
  validateManualEntryInput,
  type ManualEntryLine,
} from '@/lib/accounting/manual-entry';

// ──────────────────────────────────────────────────────────
// createManualEntryFormState
// ──────────────────────────────────────────────────────────

describe('createManualEntryFormState', () => {
  it('returns a form state with the provided date', () => {
    const state = createManualEntryFormState('2026-01-15');
    expect(state.date).toBe('2026-01-15');
  });

  it('returns a form state with empty ref by default', () => {
    const state = createManualEntryFormState('2026-01-15');
    expect(state.ref).toBe('');
  });

  it('returns a form state with empty debit and credit accounts', () => {
    const state = createManualEntryFormState('2026-01-15');
    expect(state.debitAccount).toBe('');
    expect(state.creditAccount).toBe('');
  });

  it('returns a form state with amount = 0', () => {
    const state = createManualEntryFormState('2026-01-15');
    expect(state.amount).toBe(0);
  });

  it('returns a form state with empty description', () => {
    const state = createManualEntryFormState('2026-01-15');
    expect(state.description).toBe('');
  });

  it('uses a date string when called with default', () => {
    const state = createManualEntryFormState();
    expect(typeof state.date).toBe('string');
    expect(state.date.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────
// buildManualEntryFormFromLines
// ──────────────────────────────────────────────────────────

describe('buildManualEntryFormFromLines', () => {
  const debitLine: ManualEntryLine = {
    date: '2026-01-15T00:00:00.000Z',
    ref: 'REF-001',
    account: 'Cash',
    debit: 500,
    description: 'Payment received',
  };
  const creditLine: ManualEntryLine = {
    date: '2026-01-15T00:00:00.000Z',
    account: 'Accounts Payable – Supplier A',
    credit: 500,
  };

  it('sets date to the first 10 characters of the debit line date', () => {
    const result = buildManualEntryFormFromLines(debitLine, creditLine);
    expect(result.date).toBe('2026-01-15');
  });

  it('sets ref from the debit line', () => {
    const result = buildManualEntryFormFromLines(debitLine, creditLine);
    expect(result.ref).toBe('REF-001');
  });

  it('sets debitAccount to Cash', () => {
    const result = buildManualEntryFormFromLines(debitLine, creditLine);
    expect(result.debitAccount).toBe('Cash');
  });

  it('splits tagged credit account into account and tag', () => {
    const result = buildManualEntryFormFromLines(debitLine, creditLine);
    expect(result.creditAccount).toBe('Accounts Payable');
    expect(result.creditAccountTag).toBe('Supplier A');
  });

  it('uses debit amount', () => {
    const result = buildManualEntryFormFromLines(debitLine, creditLine);
    expect(result.amount).toBe(500);
  });

  it('uses description from debit line', () => {
    const result = buildManualEntryFormFromLines(debitLine, creditLine);
    expect(result.description).toBe('Payment received');
  });

  it('falls back to credit line ref when debit has no ref', () => {
    const result = buildManualEntryFormFromLines(
      { ...debitLine, ref: undefined },
      { ...creditLine, ref: 'REF-999' }
    );
    expect(result.ref).toBe('REF-999');
  });
});

// ──────────────────────────────────────────────────────────
// validateManualEntryInput
// ──────────────────────────────────────────────────────────

describe('validateManualEntryInput', () => {
  const validInput = {
    ref: 'PAYMENT-001',
    debitAccount: 'Cash',
    creditAccount: 'Revenue',
    amount: 500,
  };

  it('returns null for valid input', () => {
    expect(validateManualEntryInput(validInput)).toBeNull();
  });

  it('returns error when ref is empty', () => {
    const result = validateManualEntryInput({ ...validInput, ref: '' });
    expect(result).not.toBeNull();
    expect(result?.title).toContain('Reference');
  });

  it('returns error when ref is whitespace-only', () => {
    const result = validateManualEntryInput({ ...validInput, ref: '   ' });
    expect(result).not.toBeNull();
  });

  it('returns error when debitAccount is empty', () => {
    const result = validateManualEntryInput({
      ...validInput,
      debitAccount: '',
    });
    expect(result).not.toBeNull();
    expect(result?.title).toContain('Accounts');
  });

  it('returns error when creditAccount is empty', () => {
    const result = validateManualEntryInput({
      ...validInput,
      creditAccount: '',
    });
    expect(result).not.toBeNull();
  });

  it('returns error when debit and credit accounts are the same', () => {
    const result = validateManualEntryInput({
      ...validInput,
      debitAccount: 'Cash',
      creditAccount: 'Cash',
    });
    expect(result).not.toBeNull();
    expect(result?.title).toContain('differ');
  });

  it('returns error when amount is zero', () => {
    const result = validateManualEntryInput({ ...validInput, amount: 0 });
    expect(result).not.toBeNull();
    expect(result?.title).toContain('Amount');
  });

  it('returns error when amount is negative', () => {
    const result = validateManualEntryInput({ ...validInput, amount: -100 });
    expect(result).not.toBeNull();
  });

  it('returns error when amount is NaN', () => {
    const result = validateManualEntryInput({ ...validInput, amount: NaN });
    expect(result).not.toBeNull();
  });
});
