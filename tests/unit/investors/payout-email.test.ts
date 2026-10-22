import { describe, expect, it } from 'vitest';
import { buildPayoutEmail } from '@/modules/clothing/accounting/investors/useInvestorStatements';

const payout = (payoutNumber: number) =>
  buildPayoutEmail({
    investorName: 'Carrei Cyrell R. Mabanag',
    reference: 'CR-2026-003',
    payoutNumber,
    amount: '₱25,000.00',
    bankingDate: '2027-02-12',
    paidDate: '2027-02-13',
  });

describe('investor payout email', () => {
  it('includes ordinal, contract, banking date, payment date and amount', () => {
    const email = payout(2);
    expect(email).toContain(
      'Subject: Second Investment Payout for CR-2026-003 — February 12'
    );
    expect(email).toContain('Dear Carrei Cyrell R. Mabanag,');
    expect(email).toContain(
      'Your second investment payout of ₱25,000.00 for agreement CR-2026-003 was transferred on February 13, 2027.'
    );
    expect(email).toContain(
      'Attached are your payout statement and a copy of the bank transfer confirmation'
    );
    expect(email.endsWith('Kind regards,\nCzarlie & Ron')).toBe(true);
  });

  it.each([
    [1, 'First'],
    [11, 'Eleventh'],
    [20, 'Twentieth'],
    [21, 'Twenty-first'],
    [32, 'Thirty-second'],
  ])('formats payout %i as %s', (number, ordinal) => {
    expect(payout(number)).toContain(
      `Subject: ${ordinal} Investment Payout for CR-2026-003`
    );
  });
});
