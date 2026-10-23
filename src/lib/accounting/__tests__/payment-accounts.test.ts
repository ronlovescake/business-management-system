import { describe, expect, it } from 'vitest';
import {
  getExpenseCreditAccount,
  getPaymentAccountForMethod,
  getSupplierSettlementCreditAccount,
} from '../payment-accounts';

describe('accounting payment accounts', () => {
  it('maps supplier methods to their actual settlement accounts', () => {
    expect(getSupplierSettlementCreditAccount('CASH')).toBe('Cash');
    expect(getSupplierSettlementCreditAccount('BANK')).toBe('Bank');
    expect(getSupplierSettlementCreditAccount('GCASH')).toBe('GCash');
    expect(getSupplierSettlementCreditAccount('CHECK')).toBe('Bank');
    expect(getSupplierSettlementCreditAccount('CARD')).toBe(
      'Credit Card Payable'
    );
    expect(getSupplierSettlementCreditAccount('OTHER')).toBeNull();
  });

  it('keeps approved expenses payable until paid', () => {
    expect(
      getExpenseCreditAccount({ status: 'approved', paymentMethod: 'Cash' })
    ).toBe('Accounts Payable');
    expect(
      getExpenseCreditAccount({ status: 'paid', paymentMethod: 'GCASH' })
    ).toBe('GCash');
    expect(getExpenseCreditAccount({ status: 'paid' })).toBe('Cash');
  });

  it('returns null for unsupported settlement methods', () => {
    expect(getPaymentAccountForMethod('unrecognized')).toBeNull();
  });
});
