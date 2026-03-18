import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  householdRecurringPayment: {
    findMany: vi.fn(),
  },
  householdExpense: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  householdAccount: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('HouseholdRecurringPaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockPrisma);
    });

    mockPrisma.householdRecurringPayment.findMany.mockResolvedValue([]);
    mockPrisma.householdExpense.findFirst.mockResolvedValue(null);
    mockPrisma.householdExpense.create.mockResolvedValue({
      id: 101,
      amount: 125,
      status: 'paid',
    });
    mockPrisma.householdAccount.findFirst.mockResolvedValue({
      id: 'fallback-account',
    });
    mockPrisma.householdAccount.findUnique.mockResolvedValue({
      id: 'fallback-account',
    });
    mockPrisma.householdAccount.update.mockResolvedValue({
      id: 'fallback-account',
      balance: 875,
    });
  });

  it('creates a paid recurring expense with a clamped date and fallback account', async () => {
    vi.resetModules();
    const { householdRecurringPaymentService } = await import('../service');

    mockPrisma.householdRecurringPayment.findMany.mockResolvedValue([
      {
        id: 'tpl-1',
        name: 'Internet Bill',
        amount: 125,
        category: 'Utilities - Internet',
        notes: 'Monthly internet',
        startDate: '2026-01-31',
        monthsCount: null,
        isActive: true,
        deductOnGenerate: true,
        accountId: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await householdRecurringPaymentService.generateForMonth({
      month: '2026-02',
    });

    expect(mockPrisma.householdExpense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        date: '2026-02-28',
        amount: 125,
        description: 'Internet Bill',
        category: 'Utilities - Internet',
        status: 'paid',
        accountId: 'fallback-account',
        sourceType: 'RECURRING',
        sourceId: 'tpl-1',
        sourceLineKey: '2026-02',
        systemGenerated: true,
      }),
      select: { id: true, amount: true, status: true },
    });
    expect(mockPrisma.householdAccount.update).toHaveBeenCalledWith({
      where: { id: 'fallback-account' },
      data: { balance: { decrement: 125 } },
    });
    expect(result).toEqual({
      month: '2026-02',
      created: 1,
      skipped: 0,
    });
  });

  it('skips future, expired, and already-generated templates', async () => {
    vi.resetModules();
    const { householdRecurringPaymentService } = await import('../service');

    mockPrisma.householdRecurringPayment.findMany.mockResolvedValue([
      {
        id: 'future-template',
        name: 'Future Rent',
        amount: 500,
        category: 'House Rent',
        notes: null,
        startDate: '2026-04-15',
        monthsCount: null,
        isActive: true,
        deductOnGenerate: true,
        accountId: 'acct-1',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      {
        id: 'expired-template',
        name: 'Short Term Bill',
        amount: 90,
        category: 'Utilities - Water',
        notes: null,
        startDate: '2026-01-15',
        monthsCount: 2,
        isActive: true,
        deductOnGenerate: true,
        accountId: 'acct-2',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'duplicate-template',
        name: 'Existing Subscription',
        amount: 49,
        category: 'Subsciptions',
        notes: null,
        startDate: '2026-01-01',
        monthsCount: null,
        isActive: true,
        deductOnGenerate: false,
        accountId: 'acct-3',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    mockPrisma.householdExpense.findFirst.mockImplementation(
      async ({ where }) => {
        return where?.sourceId === 'duplicate-template' ? { id: 999 } : null;
      }
    );

    const result = await householdRecurringPaymentService.generateForMonth({
      month: '2026-03',
    });

    expect(mockPrisma.householdExpense.create).not.toHaveBeenCalled();
    expect(mockPrisma.householdAccount.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      month: '2026-03',
      created: 0,
      skipped: 3,
    });
  });
});
