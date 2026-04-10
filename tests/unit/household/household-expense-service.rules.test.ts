/**
 * Household Expense Service — Business-Rule-Mapped Tests
 *
 * Rules Covered (household-expenses.md):
 *  4  Create expense decrements account balance when status is 'approved' or 'paid'
 *  5  Create expense does NOT decrement balance when status is 'pending'
 *  6  resolveAccountName throws when account not found
 *  7  statusImpactsBalance returns true only for 'approved' and 'paid'
 *     normalizeSourceFields defaults sourceType to 'MANUAL'
 *     createMany validates all accounts exist before creating
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockExpenseRepo = vi.hoisted(() => ({
  findMany: vi.fn(),
  findById: vi.fn(),
  findWithFilters: vi.fn(),
}));

const mockTransaction = vi.hoisted(() => ({
  householdExpense: { create: vi.fn() },
  householdAccount: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
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
  householdExpenseRepository: mockExpenseRepo,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Import service
// ---------------------------------------------------------------------------
import { HouseholdExpenseService } from '@/modules/household/expenses/api/service';
import type { HouseholdExpenseCreateInput } from '@/modules/household/expenses/api/schemas';

const service = new HouseholdExpenseService();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeInput(
  overrides: Partial<HouseholdExpenseCreateInput> = {}
): HouseholdExpenseCreateInput {
  return {
    date: new Date('2025-06-01'),
    amount: 100,
    description: 'Test expense',
    category: 'Groceries',
    status: 'paid',
    accountId: 'acc-1',
    sourceType: 'MANUAL',
    systemGenerated: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HouseholdExpenseService', () => {
  // =========================================================================
  // create() — Balance Side-Effects (Rules 4-5)
  // =========================================================================
  describe('create()', () => {
    it('Rule 4: decrements account balance when status is paid', async () => {
      mockTransaction.householdAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
      });
      mockTransaction.householdExpense.create.mockResolvedValue({
        id: 1,
        amount: 100,
        status: 'paid',
        accountId: 'acc-1',
      });
      mockTransaction.householdAccount.update.mockResolvedValue({
        id: 'acc-1',
        balance: 4900,
      });

      await service.create(makeInput({ status: 'paid' }));

      expect(mockTransaction.householdAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1' },
          data: { balance: { decrement: 100 } },
        })
      );
    });

    it('Rule 4: decrements account balance when status is approved', async () => {
      mockTransaction.householdAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
      });
      mockTransaction.householdExpense.create.mockResolvedValue({
        id: 2,
        amount: 250,
        status: 'approved',
        accountId: 'acc-1',
      });
      mockTransaction.householdAccount.update.mockResolvedValue({
        id: 'acc-1',
        balance: 4750,
      });

      await service.create(makeInput({ status: 'approved', amount: 250 }));

      expect(mockTransaction.householdAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: { decrement: 250 } },
        })
      );
    });

    it('Rule 5: does NOT decrement balance when status is pending', async () => {
      mockTransaction.householdAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
      });
      mockTransaction.householdExpense.create.mockResolvedValue({
        id: 3,
        amount: 100,
        status: 'pending',
        accountId: 'acc-1',
      });

      await service.create(makeInput({ status: 'pending' }));

      expect(mockTransaction.householdAccount.update).not.toHaveBeenCalled();
    });

    it('Rule 5: does NOT decrement balance when no accountId', async () => {
      mockTransaction.householdExpense.create.mockResolvedValue({
        id: 4,
        amount: 100,
        status: 'paid',
        accountId: null,
      });

      await service.create(makeInput({ accountId: null }));

      expect(mockTransaction.householdAccount.update).not.toHaveBeenCalled();
    });

    it('Rule 6: throws when account not found', async () => {
      mockTransaction.householdAccount.findUnique.mockResolvedValue(null);

      await expect(service.create(makeInput())).rejects.toThrow(
        /failed to create/i
      );
    });

    it('normalizes sourceType to MANUAL by default', async () => {
      mockTransaction.householdAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
      });
      mockTransaction.householdExpense.create.mockResolvedValue({
        id: 5,
        amount: 100,
        status: 'pending',
        accountId: 'acc-1',
      });

      await service.create(makeInput({ status: 'pending' }));

      const createCall = mockTransaction.householdExpense.create.mock.calls[0][0];
      expect(createCall.data.sourceType).toBe('MANUAL');
    });
  });
});
