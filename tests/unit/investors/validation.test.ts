import { describe, expect, it } from 'vitest';
import {
  agreementInput,
  investorInput,
  investorMutation,
  paymentInput,
} from '@/lib/investors/validation';
import { getRequiredRolesForPath } from '@/core/routePermissions';

describe('investor input and route policy', () => {
  const agreement = {
    investorId: 'investor-1',
    reference: 'CR-001',
    effectiveDate: '2026-01-25',
    principal: '100000.00',
  };

  it('validates money, calendar dates, and rates', () => {
    expect(agreementInput.parse(agreement).monthlyRateBps).toBe(500);
    for (const principal of [
      '0',
      '-1',
      '0.001',
      '1e5',
      '9999999999999',
      'NaN',
    ]) {
      expect(
        agreementInput.safeParse({ ...agreement, principal }).success
      ).toBe(false);
    }
    expect(
      agreementInput.safeParse({ ...agreement, effectiveDate: '2026-02-30' })
        .success
    ).toBe(false);
    expect(
      agreementInput.safeParse({ ...agreement, monthlyRateBps: 500.5 }).success
    ).toBe(false);
  });

  it('requires names and validates email while allowing empty optional details', () => {
    expect(investorInput.parse({ name: ' Investor ' }).name).toBe('Investor');
    expect(
      investorInput.parse({ name: 'Investor', investorCode: 'INV-999' })
    ).not.toHaveProperty('investorCode');
    expect(investorInput.safeParse({ name: ' ' }).success).toBe(false);
    expect(
      investorInput.safeParse({ name: 'Investor', email: 'invalid' }).success
    ).toBe(false);
    expect(
      investorMutation.safeParse({ kind: 'unknown', data: {} }).success
    ).toBe(false);
  });

  it('validates payout month, actual amount, and paid date', () => {
    const payment = {
      agreementId: 'agreement-1',
      month: 3,
      amount: '49.99',
      paidDate: '2026-10-17',
    };
    expect(paymentInput.parse(payment)).toEqual(payment);
    for (const invalid of [
      { ...payment, month: 0 },
      { ...payment, month: 37 },
      { ...payment, amount: '0' },
      { ...payment, amount: '-10' },
      { ...payment, amount: '1.001' },
      { ...payment, paidDate: '2026-02-30' },
    ]) {
      expect(paymentInput.safeParse(invalid).success).toBe(false);
    }
    expect(
      investorMutation.safeParse({ kind: 'payment', data: payment }).success
    ).toBe(true);
  });

  it('restricts both API and page routes to admins', () => {
    expect(getRequiredRolesForPath('/api/clothing/investors')).toEqual([
      'ADMIN',
      'SUPER_ADMIN',
    ]);
    expect(
      getRequiredRolesForPath('/api/clothing/investors/generate-statements')
    ).toEqual(['ADMIN', 'SUPER_ADMIN']);
    expect(getRequiredRolesForPath('/clothing/accounting/investors')).toEqual([
      'ADMIN',
      'SUPER_ADMIN',
    ]);
  });
});
