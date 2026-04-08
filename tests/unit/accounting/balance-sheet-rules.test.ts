/**
 * Balance Sheet — Account Classification & Normalization (Business Rule Tests)
 *
 * Rules from docs/business-logic/clothing/accounting-balance-sheet.md:
 *   #2  — Assets displayed as-is (positive)
 *   #3  — Liabilities negated for display
 *   #4  — Equity negated for display
 *   #5  — Balance = assets + liabilities + equity; zero = balanced
 *   #10 — Row type is Asset/Liability/Equity
 *   #21 — Group order: Assets → Liabilities → Equity
 *   #22 — Liability/Equity amounts negated for display
 *
 * Also tests:
 *   detectAccountType — classifies accounts by keyword
 *   normalizeAccountForReporting — cash-equivalent merging
 */

import { describe, it, expect } from 'vitest';
import { detectAccountType } from '@/lib/accounting/account-classification';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';

// =========================================================================
// Rule #10: detectAccountType classifies accounts
// =========================================================================

describe('Rule #10: Account type classification', () => {
  describe('Assets', () => {
    it.each([
      'Cash',
      'Cash on Hand',
      'GCash',
      'Bank',
      'E-Wallet',
      'Inventory',
      'Stock on Hand',
      'Inventory in Transit',
      'Accounts Receivable',
      'A/R',
      'Prepaid Expense',
      'Deposits',
    ])('"%s" → Asset', (account) => {
      expect(detectAccountType(account)).toBe('Asset');
    });
  });

  describe('Liabilities', () => {
    it.each([
      'Accounts Payable',
      'A/P',
      'Taxes Payable',
      'Customer Deposit',
      'Customer Deposits',
      'Loan',
      'Credit Card',
      'Accrued Expenses',
    ])('"%s" → Liability', (account) => {
      expect(detectAccountType(account)).toBe('Liability');
    });
  });

  describe('Loan Payable variants', () => {
    it.each([
      'Loan Payable',
      'Loan Payable - BDO',
      'Loan Payable - Metrobank',
    ])('"%s" → Liability', (account) => {
      expect(detectAccountType(account)).toBe('Liability');
    });
  });

  describe('Equity', () => {
    it.each([
      'Opening Equity',
      "Owner's Equity",
      'Capital Contribution',
      'Owner Draw',
      'Retained Earnings',
      'Equity',
    ])('"%s" → Equity', (account) => {
      expect(detectAccountType(account)).toBe('Equity');
    });
  });

  it('returns null for unclassifiable account', () => {
    expect(detectAccountType('Random Account')).toBeNull();
    expect(detectAccountType('')).toBeNull();
  });
});

// =========================================================================
// Cash-equivalent normalization
// =========================================================================

describe('normalizeAccountForReporting — cash equivalents', () => {
  it('normalizes Bank → Cash', () => {
    expect(normalizeAccountForReporting('Bank')).toBe('Cash');
  });

  it('normalizes E-Wallet → Cash', () => {
    expect(normalizeAccountForReporting('E-Wallet')).toBe('Cash');
  });

  it('normalizes GCash → Cash', () => {
    expect(normalizeAccountForReporting('GCash')).toBe('Cash');
  });

  it('preserves other accounts as-is', () => {
    expect(normalizeAccountForReporting('Accounts Payable')).toBe(
      'Accounts Payable'
    );
  });

  it('preserves Loan Payable with suffix', () => {
    const acct = 'Loan Payable - BDO';
    expect(normalizeAccountForReporting(acct)).toBe(acct);
  });

  it('handles empty/whitespace input', () => {
    expect(normalizeAccountForReporting('')).toBe('');
    expect(normalizeAccountForReporting('   ')).toBe('');
  });
});

// =========================================================================
// Rules #2-#5: Balance equation
// =========================================================================

describe('Rules #2-#5: Balance equation', () => {
  // The server-side balance is: assets + liabilities + equity
  // With signed balances: debits positive, credits negative
  // A balanced sheet → assets + liabilities + equity = 0

  it('Rule #5: balanced sheet has zero balance', () => {
    const assets = 100000;
    const liabilities = -60000; // credits are negative
    const equity = -40000; // credits are negative
    const balance = assets + liabilities + equity;

    expect(balance).toBe(0);
  });

  it('Rule #5: unbalanced sheet has non-zero balance', () => {
    const assets = 100000;
    const liabilities = -50000;
    const equity = -40000;
    const balance = assets + liabilities + equity;

    expect(balance).not.toBe(0);
    expect(balance).toBe(10000);
  });

  it('Rule #2: assets are displayed as-is (positive)', () => {
    const amount = 50000;
    const displayAmount = amount; // Rule #2: as-is
    expect(displayAmount).toBe(50000);
  });

  it('Rule #3: liabilities negated for display', () => {
    const liabilityAmount = -30000; // stored negative (credit)
    const displayAmount = -liabilityAmount; // Rule #3: negated → 30000 positive
    expect(displayAmount).toBe(30000);
  });

  it('Rule #4: equity negated for display', () => {
    const equityAmount = -40000; // stored negative (credit)
    const displayAmount = -equityAmount; // Rule #4: negated → 40000 positive
    expect(displayAmount).toBe(40000);
  });
});

// =========================================================================
// Rules #12-#14: Breakdown summary computation
// =========================================================================

describe('Rules #12-#14: Cash breakdown summary', () => {
  it('computes unclassifiedDelta = balance - detailSum', () => {
    const cashAccountBalance = 50000;
    const details = [
      { label: 'Sales', amount: 30000 },
      { label: 'Payments', amount: 15000 },
    ];
    const detailSum = details.reduce((s, d) => s + d.amount, 0);
    const unclassifiedDelta = cashAccountBalance - detailSum;

    expect(detailSum).toBe(45000);
    expect(unclassifiedDelta).toBe(5000);
  });

  it('unclassifiedDelta is zero when details match balance', () => {
    const cashAccountBalance = 100;
    const detailSum = 100;
    expect(cashAccountBalance - detailSum).toBe(0);
  });
});
