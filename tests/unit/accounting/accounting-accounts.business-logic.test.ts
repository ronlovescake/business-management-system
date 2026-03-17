import { describe, it, expect } from 'vitest';
import { detectAccountType } from '@/lib/accounting/account-classification';
import {
  normalizeAccountTag,
  buildTaggedAccountName,
  splitTaggedAccountName,
  toTaggableSelection,
  collapseTaggableAccountsForOptions,
} from '@/lib/accounting/account-tagging';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';

// ──────────────────────────────────────────────────────────
// detectAccountType
// ──────────────────────────────────────────────────────────

describe('detectAccountType', () => {
  it('classifies "cash" as Asset', () => {
    expect(detectAccountType('cash')).toBe('Asset');
  });

  it('classifies "Cash" (title-case) as Asset', () => {
    expect(detectAccountType('Cash')).toBe('Asset');
  });

  it('classifies "gcash" as Asset', () => {
    expect(detectAccountType('gcash')).toBe('Asset');
  });

  it('classifies "inventory" as Asset', () => {
    expect(detectAccountType('inventory')).toBe('Asset');
  });

  it('classifies "accounts receivable" as Asset', () => {
    expect(detectAccountType('accounts receivable')).toBe('Asset');
  });

  it('classifies "accounts payable" as Liability', () => {
    expect(detectAccountType('accounts payable')).toBe('Liability');
  });

  it('classifies "loan" as Liability', () => {
    expect(detectAccountType('loan')).toBe('Liability');
  });

  it('classifies "credit card" as Liability', () => {
    expect(detectAccountType('credit card')).toBe('Liability');
  });

  it('classifies "customer deposit" as Liability', () => {
    expect(detectAccountType('customer deposit')).toBe('Liability');
  });

  it('classifies "capital" as Equity', () => {
    expect(detectAccountType('capital')).toBe('Equity');
  });

  it('classifies "owner\'s equity" as Equity', () => {
    expect(detectAccountType("owner's equity")).toBe('Equity');
  });

  it('classifies "retained earnings" as Equity', () => {
    expect(detectAccountType('retained earnings')).toBe('Equity');
  });

  it('returns null for unrecognized account name', () => {
    expect(detectAccountType('unknown xyz account 999')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectAccountType('')).toBeNull();
  });

  it('classifies "Loan Payable – Supplier Name" as Liability', () => {
    expect(detectAccountType('Loan Payable – Supplier')).toBe('Liability');
  });
});

// ──────────────────────────────────────────────────────────
// normalizeAccountTag
// ──────────────────────────────────────────────────────────

describe('normalizeAccountTag', () => {
  it('returns the tag as-is for a clean tag', () => {
    expect(normalizeAccountTag('BDO Bank')).toBe('BDO Bank');
  });

  it('trims whitespace', () => {
    expect(normalizeAccountTag('  MyTag  ')).toBe('MyTag');
  });

  it('strips leading dashes', () => {
    expect(normalizeAccountTag('- Some Tag')).toBe('Some Tag');
  });

  it('strips leading em-dashes', () => {
    expect(normalizeAccountTag('– LoanTag')).toBe('LoanTag');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeAccountTag('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeAccountTag('   ')).toBe('');
  });
});

// ──────────────────────────────────────────────────────────
// buildTaggedAccountName
// ──────────────────────────────────────────────────────────

describe('buildTaggedAccountName', () => {
  it('builds a tagged name with separator', () => {
    expect(buildTaggedAccountName('Loan Payable', 'BDO')).toBe(
      'Loan Payable – BDO'
    );
  });

  it('returns parent name when tag is empty', () => {
    expect(buildTaggedAccountName('Accounts Payable', '')).toBe(
      'Accounts Payable'
    );
  });

  it('normalizes tags with leading dashes', () => {
    expect(buildTaggedAccountName('Loan Payable', '- BDO')).toBe(
      'Loan Payable – BDO'
    );
  });
});

// ──────────────────────────────────────────────────────────
// splitTaggedAccountName
// ──────────────────────────────────────────────────────────

describe('splitTaggedAccountName', () => {
  it('splits a tagged loan payable account', () => {
    const result = splitTaggedAccountName('Loan Payable – BDO');
    expect(result).not.toBeNull();
    expect(result?.parent).toBe('Loan Payable');
    expect(result?.tag).toBe('BDO');
  });

  it('splits a tagged accounts payable account', () => {
    const result = splitTaggedAccountName('Accounts Payable – Supplier A');
    expect(result).not.toBeNull();
    expect(result?.parent).toBe('Accounts Payable');
    expect(result?.tag).toBe('Supplier A');
  });

  it('returns empty tag for exact parent name match', () => {
    const result = splitTaggedAccountName('Loan Payable');
    expect(result).not.toBeNull();
    expect(result?.tag).toBe('');
  });

  it('returns null for non-taggable account', () => {
    expect(splitTaggedAccountName('Cash')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(splitTaggedAccountName('')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────
// toTaggableSelection
// ──────────────────────────────────────────────────────────

describe('toTaggableSelection', () => {
  it('returns parent and tag for a tagged account', () => {
    const result = toTaggableSelection('Loan Payable – BDO');
    expect(result.account).toBe('Loan Payable');
    expect(result.tag).toBe('BDO');
  });

  it('returns the account as-is with empty tag for non-taggable', () => {
    const result = toTaggableSelection('Cash');
    expect(result.account).toBe('Cash');
    expect(result.tag).toBe('');
  });
});

// ──────────────────────────────────────────────────────────
// collapseTaggableAccountsForOptions
// ──────────────────────────────────────────────────────────

describe('collapseTaggableAccountsForOptions', () => {
  it('collapses tagged variants to the parent', () => {
    const result = collapseTaggableAccountsForOptions([
      'Loan Payable – BDO',
      'Loan Payable – MetroBank',
      'Cash',
    ]);
    expect(result).toContain('Loan Payable');
    expect(result).toContain('Cash');
    expect(result).not.toContain('Loan Payable – BDO');
  });

  it('deduplicates repeated parents', () => {
    const result = collapseTaggableAccountsForOptions([
      'Loan Payable – BDO',
      'Loan Payable – MetroBank',
    ]);
    const loanCount = result.filter((r) => r === 'Loan Payable').length;
    expect(loanCount).toBe(1);
  });

  it('returns sorted array', () => {
    const result = collapseTaggableAccountsForOptions([
      'Loan Payable',
      'Accounts Payable',
      'Cash',
    ]);
    const sorted = [...result].sort((a, b) => a.localeCompare(b));
    expect(result).toEqual(sorted);
  });
});

// ──────────────────────────────────────────────────────────
// normalizeAccountForReporting
// ──────────────────────────────────────────────────────────

describe('normalizeAccountForReporting', () => {
  it('returns "Cash" for "bank"', () => {
    expect(normalizeAccountForReporting('bank')).toBe('Cash');
  });

  it('returns "Cash" for "e-wallet"', () => {
    expect(normalizeAccountForReporting('e-wallet')).toBe('Cash');
  });

  it('returns "Cash" for "e wallet"', () => {
    expect(normalizeAccountForReporting('e wallet')).toBe('Cash');
  });

  it('returns "Cash" for accounts containing "gcash"', () => {
    expect(normalizeAccountForReporting('GCash')).toBe('Cash');
  });

  it('preserves "Loan Payable – BDO" unchanged', () => {
    expect(normalizeAccountForReporting('Loan Payable – BDO')).toBe(
      'Loan Payable – BDO'
    );
  });

  it('returns the account name unchanged for unrecognized accounts', () => {
    expect(normalizeAccountForReporting('Accounts Receivable')).toBe(
      'Accounts Receivable'
    );
  });

  it('returns empty string for empty input', () => {
    expect(normalizeAccountForReporting('')).toBe('');
  });
});
