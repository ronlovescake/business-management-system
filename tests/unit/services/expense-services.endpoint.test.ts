import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  ExpenseService,
  TruckingExpenseService,
} from '@/services/ExpenseService';

describe('Expense service endpoints', () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('uses /api/expenses for clothing expenses', async () => {
    await ExpenseService.getAll();

    expect(fetchMock).toHaveBeenCalledWith('/api/expenses', {
      headers: { 'Content-Type': 'application/json' },
      method: 'GET',
    });
  });

  it('uses /api/trucking/expenses for trucking expenses', async () => {
    await TruckingExpenseService.getAll();

    expect(fetchMock).toHaveBeenCalledWith('/api/trucking/expenses', {
      headers: { 'Content-Type': 'application/json' },
      method: 'GET',
    });
  });
});
