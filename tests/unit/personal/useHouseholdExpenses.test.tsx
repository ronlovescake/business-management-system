import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHouseholdExpenses } from '@/app/personal/hooks/useHouseholdExpenses';
import { showError } from '@/lib/alerts';

const createExpenseMock = vi.fn();
const updateExpenseMock = vi.fn();
const deleteExpenseMock = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        name: 'Test User',
        email: 'test@example.com',
      },
    },
  }),
}));

vi.mock('@/hooks/useSheetData', () => ({
  useHouseholdExpenseData: () => ({
    data: [],
    isLoading: false,
    create: createExpenseMock,
    update: updateExpenseMock,
    delete: deleteExpenseMock,
    bulkUpdate: vi.fn(),
    bulkCreate: vi.fn(),
  }),
}));

vi.mock('@/lib/alerts', () => ({
  showError: vi.fn(),
  showLoading: vi.fn(),
  closeAlert: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock('@mantine/notifications', () => ({
  showNotification: vi.fn(),
}));

describe('useHouseholdExpenses', () => {
  beforeEach(() => {
    createExpenseMock.mockClear();
    updateExpenseMock.mockClear();
    deleteExpenseMock.mockClear();
    vi.mocked(showError).mockClear();

    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        data: [
          {
            id: 'acct-1',
            name: 'Ronald Allan Balnig',
            isActive: true,
          },
        ],
      }),
    }) as typeof fetch;
  });

  it('supports consecutive save-and-add-new submissions without losing default account', async () => {
    const { result } = renderHook(() => useHouseholdExpenses());

    await waitFor(() => {
      expect(result.current.accountOptions).toEqual([
        { value: 'acct-1', label: 'Ronald Allan Balnig' },
      ]);
    });

    act(() => {
      result.current.handleAddExpense();
    });

    expect(result.current.formAccountId).toBe('acct-1');

    act(() => {
      result.current.setFormDate('2026-02-16');
      result.current.setFormAmount(100);
      result.current.setFormDescription('Electricity bill');
      result.current.setFormCategory('Utilities - Electricity');
    });

    await act(async () => {
      await result.current.handleSaveAndAddExpense();
    });

    expect(createExpenseMock).toHaveBeenCalledTimes(1);
    expect(result.current.formAccountId).toBe('acct-1');

    act(() => {
      result.current.setFormDate('2026-02-16');
      result.current.setFormAmount(200);
      result.current.setFormDescription('Water bill');
      result.current.setFormCategory('Utilities - Water');
    });

    await act(async () => {
      await result.current.handleSaveAndAddExpense();
    });

    expect(createExpenseMock).toHaveBeenCalledTimes(2);
    expect(showError).not.toHaveBeenCalled();
  });
});
