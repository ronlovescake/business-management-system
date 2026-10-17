import { describe, expect, it } from 'vitest';
import {
  buildInvestmentSchedule,
  isCalendarDate,
} from '@/lib/investors/schedule';

const terms = {
  effectiveDate: '2026-01-25',
  principalCents: 10000000,
  monthlyRateBps: 500,
};

describe('investment payout schedule', () => {
  it('uses the initial 81-day threshold then effective-date anniversaries', () => {
    const schedule = buildInvestmentSchedule(terms);
    expect(schedule.eligibleDate).toBe('2026-04-16');
    expect(schedule.payouts.slice(0, 2).map((row) => row.status)).toEqual([
      'deferred',
      'deferred',
    ]);
    expect(schedule.payouts[2]).toMatchObject({
      anniversaryDate: '2026-04-25',
      dueDate: '2026-04-27',
      amountCents: 500000,
    });
    expect(schedule.payouts[3].anniversaryDate).toBe('2026-05-25');
    expect(schedule.maturityDate).toBe('2029-01-25');
    expect(schedule.principalRepaymentDeadline).toBe('2029-02-24');
    expect(schedule.payouts).toHaveLength(36);
  });

  it('waives March without accruing or carrying it into April', () => {
    const schedule = buildInvestmentSchedule(terms);
    expect(schedule.payouts[13]).toMatchObject({
      anniversaryDate: '2027-03-25',
      status: 'waived',
      amountCents: 0,
      dueDate: null,
    });
    expect(schedule.payouts[14].amountCents).toBe(500000);
  });

  it('pays a February return shifted into March and skips consecutive bank closures', () => {
    const schedule = buildInvestmentSchedule(
      { ...terms, effectiveDate: '2025-10-28' },
      ['2026-03-02']
    );
    expect(schedule.payouts[3]).toMatchObject({
      anniversaryDate: '2026-02-28',
      dueDate: '2026-03-03',
      status: 'scheduled',
    });
    expect(schedule.payouts[4].status).toBe('waived');
  });

  it('clamps short months without losing the original day or leap-year maturity', () => {
    const schedule = buildInvestmentSchedule({
      ...terms,
      effectiveDate: '2026-01-31',
    });
    expect(schedule.payouts[0].anniversaryDate).toBe('2026-02-28');
    expect(schedule.payouts[1].anniversaryDate).toBe('2026-03-31');
    expect(
      buildInvestmentSchedule({ ...terms, effectiveDate: '2024-02-29' })
        .maturityDate
    ).toBe('2027-02-28');
  });

  it('rounds returns to centavos without compounding', () => {
    const schedule = buildInvestmentSchedule({ ...terms, principalCents: 101 });
    expect(schedule.monthlyReturnCents).toBe(5);
    expect(
      schedule.payouts
        .filter((row) => row.status === 'scheduled')
        .every((row) => row.amountCents === 5)
    ).toBe(true);
  });

  it('rejects invalid dates and unsafe amounts', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(() =>
      buildInvestmentSchedule({ ...terms, principalCents: NaN })
    ).toThrow();
    expect(() => buildInvestmentSchedule(terms, ['invalid'])).toThrow();
  });
});
