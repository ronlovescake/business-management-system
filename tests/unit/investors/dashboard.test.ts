import { describe, expect, it } from 'vitest';
import {
  buildInvestorDashboard,
  type DashboardInvestor,
} from '@/modules/clothing/accounting/investors/dashboard';
import { buildInvestmentSchedule } from '@/lib/investors/schedule';

const agreement = (
  id: string,
  fundedDate: string | null,
  repaidDate: string | null = null
) => ({
  id,
  reference: id,
  principal: '1000000.10',
  accounting: { fundedDate, repaidDate, unpostedPayments: 0 },
  schedule: {
    ...buildInvestmentSchedule({
      effectiveDate: '2023-11-01',
      principalCents: 100000010,
      monthlyRateBps: 500,
    }),
    payouts: [
      {
        month: 33,
        anniversaryDate: '2026-08-01',
        dueDate: '2026-08-03',
        status: 'scheduled' as const,
        amountCents: 5000001,
        payment: { amount: '50000.01', paidDate: '2026-08-04' },
      },
      {
        month: 34,
        anniversaryDate: '2026-09-01',
        dueDate: '2026-09-01',
        status: 'scheduled' as const,
        amountCents: 5000001,
        payment: null,
      },
      {
        month: 35,
        anniversaryDate: '2026-10-01',
        dueDate: '2026-10-01',
        status: 'scheduled' as const,
        amountCents: 5000001,
        payment: null,
      },
      {
        month: 36,
        anniversaryDate: '2026-11-01',
        dueDate: '2026-11-02',
        status: 'scheduled' as const,
        amountCents: 5000001,
        payment: null,
      },
    ],
  },
});

describe('investor dashboard', () => {
  it('counts only confirmed outstanding principal and separates due returns from future returns', () => {
    const data: DashboardInvestor[] = [
      {
        id: 'investor',
        name: 'Investor',
        agreements: [
          agreement('funded', '2026-01-25'),
          agreement('legacy', null),
          agreement('repaid', '2026-01-25', '2026-10-10'),
        ],
      },
    ];
    const dashboard = buildInvestorDashboard(data, '2026-10-17');
    expect(dashboard.outstanding).toBe(100000010);
    expect(dashboard.maturing90).toBe(100000010);
    expect(dashboard.due).toHaveLength(6);
    expect(dashboard.next30).toBe(15000003);
    expect(dashboard.warnings.unlinked.map((row) => row.id)).toEqual([
      'legacy',
    ]);
    expect(dashboard.maturities.map((row) => row.id)).toEqual(['funded']);
    expect(dashboard.investors[0].outstanding).toBe(100000010);
    expect(dashboard.investors[0].nextPayout).toBe('2026-09-01');
    expect(dashboard.activity[0].kind).toBe('Investment repaid');
    expect(
      dashboard.activity.find((row) => row.kind === 'Return paid')?.cents
    ).toBe(5000001);
  });

  it('uses cumulative 30/60/90-day deadlines including overdue unpaid amounts', () => {
    const dashboard = buildInvestorDashboard(
      [
        {
          id: 'investor',
          name: 'Investor',
          agreements: [agreement('funded', '2026-01-25')],
        },
      ],
      '2026-10-17'
    );
    expect(dashboard.forecast.map((row) => row.returns)).toEqual([
      15000003, 15000003, 15000003,
    ]);
    expect(dashboard.forecast.map((row) => row.principal)).toEqual([
      0, 100000010, 100000010,
    ]);
    expect(dashboard.forecast[1].total).toBe(115000013);
    const overdue = buildInvestorDashboard(
      [
        {
          id: 'investor',
          name: 'Investor',
          agreements: [agreement('funded', '2026-01-25')],
        },
      ],
      '2027-01-01'
    );
    expect(overdue.warnings.matured).toHaveLength(1);
    expect(overdue.forecast[0].principal).toBe(100000010);
    expect(overdue.maturing90).toBe(0);
  });

  it('returns safe empty states', () => {
    const dashboard = buildInvestorDashboard([], '2026-10-17');
    expect(dashboard.outstanding).toBe(0);
    expect(dashboard.forecast.every((row) => row.total === 0)).toBe(true);
    expect(dashboard.activity).toEqual([]);
    expect(dashboard.cashByMonth).toHaveLength(13);
    expect(
      dashboard.cashByMonth.every(
        (row) => row.returns === 0 && row.principal === 0
      )
    ).toBe(true);
    expect(dashboard.principalByMaturity).toEqual([]);
  });

  it('charts unpaid cash by banking month and repayment deadline, keeping overdue distinct', () => {
    const dashboard = buildInvestorDashboard(
      [
        {
          id: 'investor',
          name: 'Investor',
          agreements: [
            agreement('funded', '2026-01-25'),
            agreement('legacy', null),
            agreement('repaid', '2026-01-25', '2026-10-10'),
          ],
        },
      ],
      '2026-10-17'
    );
    expect(dashboard.cashByMonth[0]).toEqual({
      month: 'Overdue',
      returns: 30000006,
      principal: 0,
    });
    expect(
      dashboard.cashByMonth.find((row) => row.month === '2026-11')
    ).toEqual({ month: '2026-11', returns: 15000003, principal: 0 });
    expect(
      dashboard.cashByMonth.find((row) => row.month === '2026-12')?.principal
    ).toBe(100000010);
    expect(dashboard.cashByMonth.at(-1)?.month).toBe('2027-09');
    expect(dashboard.principalByMaturity).toEqual([
      { month: '2026-11', principal: 100000010 },
    ]);
    const overdue = buildInvestorDashboard(
      [
        {
          id: 'investor',
          name: 'Investor',
          agreements: [agreement('funded', '2026-01-25')],
        },
      ],
      '2027-01-01'
    );
    expect(overdue.cashByMonth[0].principal).toBe(100000010);
  });
});
