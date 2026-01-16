import { describe, expect, it } from 'vitest';
import { detectAccountType } from '@/lib/accounting/account-classification';

describe('account classification', () => {
  it('classifies cash accounts as assets', () => {
    expect(detectAccountType('Cash')).toBe('Asset');
  });

  it('classifies GCash as an asset', () => {
    expect(detectAccountType('GCash')).toBe('Asset');
  });

  it('classifies loan payable accounts as liabilities', () => {
    expect(detectAccountType('Loan Payable – Truck')).toBe('Liability');
    expect(detectAccountType('Loan Payable – GCASH 1')).toBe('Liability');
  });
});
