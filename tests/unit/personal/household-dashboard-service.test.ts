import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    householdExpense: { findMany: vi.fn() },
    householdIncome: { findMany: vi.fn() },
    householdAccount: { findMany: vi.fn() },
    householdRecurringPayment: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

import { HouseholdDashboardService } from '@/modules/household/dashboard/api/service';

describe('household dashboard service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.householdExpense.findMany.mockImplementation(
      (args: { where?: Record<string, unknown> }) =>
        Promise.resolve(
          args.where?.status === 'rejected'
            ? [
                {
                  amount: 300,
                  category: 'Utilities',
                  date: '2026-10-22',
                  status: 'rejected',
                  sourceType: 'RECURRING',
                  sourceId: 'bill-1',
                  sourceLineKey: '2026-10',
                },
              ]
            : []
        )
    );
    mockPrisma.householdIncome.findMany.mockResolvedValue([]);
    mockPrisma.householdAccount.findMany.mockResolvedValue([]);
    mockPrisma.householdRecurringPayment.findMany.mockResolvedValue([
      {
        id: 'bill-1',
        name: 'Internet',
        category: 'Utilities',
        amount: 300,
        startDate: '2026-10-22',
        monthsCount: null,
        isActive: true,
        accountRef: null,
      },
    ]);
  });

  it('loads rejected generated rows separately and omits that bill from upcoming bills', async () => {
    const summary = await new HouseholdDashboardService().getSummary(
      'mtd',
      new Date('2026-10-21T12:00:00.000Z')
    );

    expect(mockPrisma.householdExpense.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { status: { not: 'rejected' } } })
    );
    expect(mockPrisma.householdExpense.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { status: 'rejected', sourceType: 'RECURRING' },
      })
    );
    expect(summary.upcomingBills).toEqual([]);
  });
});
