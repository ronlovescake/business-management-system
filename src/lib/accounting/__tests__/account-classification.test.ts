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

  it('classifies courier/forwarder payables as liabilities', () => {
    expect(detectAccountType('Forwarder Payable')).toBe('Liability');
    expect(detectAccountType('Courier Payable')).toBe('Liability');
    expect(detectAccountType('Forwarder Payable – KPC 23930A-00222')).toBe(
      'Liability'
    );
  });

  it('classifies landed cost clearing as an asset', () => {
    expect(detectAccountType('Landed Cost Clearing')).toBe('Asset');
  });

  it('classifies owner contribution as equity', () => {
    expect(detectAccountType('Owner Contribution')).toBe('Equity');
  });
});
