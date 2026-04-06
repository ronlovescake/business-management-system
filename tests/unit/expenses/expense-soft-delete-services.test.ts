import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clothingRepository: {
    softDelete: vi.fn(),
    softDeleteMany: vi.fn(),
  },
  truckingRepository: {
    softDelete: vi.fn(),
    softDeleteMany: vi.fn(),
  },
  generalMerchandiseRepository: {
    findById: vi.fn(),
    softDelete: vi.fn(),
    softDeleteMany: vi.fn(),
  },
  recordChange: vi.fn(),
}));

vi.mock('@/modules/clothing/ledger/api/repository', () => ({
  expenseRepository: mocks.clothingRepository,
}));

vi.mock('@/modules/trucking/employees/expenses/api/repository', () => ({
  expenseRepository: mocks.truckingRepository,
}));

vi.mock('@/modules/general-merchandise/ledger/api/repository', () => ({
  generalMerchandiseExpenseRepository: mocks.generalMerchandiseRepository,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/core/change-log', () => ({
  recordChange: mocks.recordChange,
}));

import { expenseService as clothingExpenseService } from '@/modules/clothing/ledger/api/service';
import { expenseService as truckingExpenseService } from '@/modules/trucking/employees/expenses/api/service';
import { generalMerchandiseExpenseService } from '@/modules/general-merchandise/ledger/api/service';

describe('Expense soft delete services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('soft deletes clothing expenses through the shared service base', async () => {
    mocks.clothingRepository.softDelete.mockResolvedValue({ id: 7 });
    mocks.clothingRepository.softDeleteMany.mockResolvedValue({ count: 2 });

    await clothingExpenseService.delete(7);
    const result = await clothingExpenseService.deleteAll();

    expect(mocks.clothingRepository.softDelete).toHaveBeenCalledWith(7);
    expect(mocks.clothingRepository.softDeleteMany).toHaveBeenCalledWith();
    expect(result).toEqual({ count: 2 });
  });

  it('soft deletes trucking expenses through the shared service base', async () => {
    mocks.truckingRepository.softDelete.mockResolvedValue({ id: 11 });
    mocks.truckingRepository.softDeleteMany.mockResolvedValue({ count: 3 });

    await truckingExpenseService.delete(11);
    const result = await truckingExpenseService.deleteAll();

    expect(mocks.truckingRepository.softDelete).toHaveBeenCalledWith(11);
    expect(mocks.truckingRepository.softDeleteMany).toHaveBeenCalledWith();
    expect(result).toEqual({ count: 3 });
  });

  it('soft deletes GM expenses and records the change log', async () => {
    mocks.generalMerchandiseRepository.findById.mockResolvedValue({
      id: 15,
      description: 'Office supplies',
    });
    mocks.generalMerchandiseRepository.softDelete.mockResolvedValue({
      id: 15,
      deletedAt: new Date('2026-04-06T00:00:00.000Z'),
    });
    mocks.generalMerchandiseRepository.softDeleteMany.mockResolvedValue({
      count: 4,
    });

    await generalMerchandiseExpenseService.delete(15);
    const result = await generalMerchandiseExpenseService.deleteAll();

    expect(mocks.generalMerchandiseRepository.softDelete).toHaveBeenCalledWith(
      15
    );
    expect(mocks.recordChange).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'general_merchandise_expense',
        entityId: 15,
        action: 'delete',
      }),
      { source: 'api' }
    );
    expect(
      mocks.generalMerchandiseRepository.softDeleteMany
    ).toHaveBeenCalledWith();
    expect(result).toEqual({ count: 4 });
  });
});
