/**
 * Household Income Service — Business-Rule-Mapped Tests
 *
 * Rules Covered (household-income.md):
 *  - Income creation ALWAYS increments account balance (when accountId present)
 *  - resolveAccountName resolves and returns account name
 *  - resolveAccountName throws when account not found
 *  - account field is auto-populated from resolved account name
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockIncomeRepo = vi.hoisted(() => ({
  findMany: vi.fn(),
  findWithFilters: vi.fn(),
  createMany: vi.fn(),
}));

const mockTransaction = vi.hoisted(() => ({
  householdIncome: { create: vi.fn() },
  householdAccount: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn((fn: (tx: typeof mockTransaction) => Promise<unknown>) =>
    fn(mockTransaction)
  ),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('./repository', () => ({
  householdIncomeRepository: mockIncomeRepo,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
import { HouseholdIncomeService } from '@/modules/household/income/api/service';
import type { HouseholdIncomeCreateInput } from '@/modules/household/income/api/schemas';

const service = new HouseholdIncomeService();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeInput(
  overrides: Partial<HouseholdIncomeCreateInput> = {}
): HouseholdIncomeCreateInput {
  return {
    date: new Date('2025-06-01'),
    amount: 500,
    type: 'SALARY',
    accountId: 'acc-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HouseholdIncomeService', () => {
  describe('create()', () => {
    it('ALWAYS increments account balance when accountId present', async () => {
      mockTransaction.householdAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
        name: 'BDO Savings',
      });
      mockTransaction.householdIncome.create.mockResolvedValue({
        id: 1,
        amount: 500,
        accountId: 'acc-1',
        account: 'BDO Savings',
      });
      mockTransaction.householdAccount.update.mockResolvedValue({
        id: 'acc-1',
        balance: 5500,
      });

      await service.create(makeInput());

      expect(mockTransaction.householdAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1' },
          data: { balance: { increment: 500 } },
        })
      );
    });

    it('does NOT increment balance when no accountId', async () => {
      mockTransaction.householdIncome.create.mockResolvedValue({
        id: 2,
        amount: 500,
        accountId: null,
        account: null,
      });

      await service.create(makeInput({ accountId: null }));

      expect(mockTransaction.householdAccount.update).not.toHaveBeenCalled();
    });

    it('resolves account name from accountId', async () => {
      mockTransaction.householdAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
        name: 'BDO Savings',
      });
      mockTransaction.householdIncome.create.mockResolvedValue({
        id: 3,
        amount: 500,
        accountId: 'acc-1',
        account: 'BDO Savings',
      });
      mockTransaction.householdAccount.update.mockResolvedValue({});

      await service.create(makeInput());

      const createCall = mockTransaction.householdIncome.create.mock.calls[0][0];
      expect(createCall.data.account).toBe('BDO Savings');
    });

    it('throws when account not found', async () => {
      mockTransaction.householdAccount.findUnique.mockResolvedValue(null);

      await expect(service.create(makeInput())).rejects.toThrow(
        /failed to create/i
      );
    });

    it('normalizes date to YYYY-MM-DD string', async () => {
      mockTransaction.householdAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
        name: 'Cash',
      });
      mockTransaction.householdIncome.create.mockResolvedValue({
        id: 4,
        amount: 500,
        accountId: 'acc-1',
      });
      mockTransaction.householdAccount.update.mockResolvedValue({});

      await service.create(makeInput({ date: new Date('2025-12-25T10:30:00Z') }));

      const createCall = mockTransaction.householdIncome.create.mock.calls[0][0];
      expect(createCall.data.date).toBe('2025-12-25');
    });
  });
});
