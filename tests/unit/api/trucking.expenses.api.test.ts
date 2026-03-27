import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockExpenseService, mockValidateMassDeleteConfirmation, mockSchemas } =
  vi.hoisted(() => ({
    mockExpenseService: {
      findWithFilters: vi.fn(),
      findAll: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      deleteAll: vi.fn(),
    },
    mockValidateMassDeleteConfirmation: vi.fn(() => null),
    mockSchemas: {
      query: { safeParse: vi.fn((value) => ({ success: true, data: value })) },
      batchCreate: {
        safeParse: vi.fn((value) => ({ success: true, data: value })),
      },
      status: {
        safeParse: vi.fn((value) => ({
          success: true,
          data: String(value ?? '').toUpperCase(),
        })),
      },
      category: {
        safeParse: vi.fn((value) => ({ success: true, data: value })),
      },
    },
  }));

vi.mock('@/modules/trucking/employees/expenses/api', () => ({
  expenseService: mockExpenseService,
  ExpenseQuerySchema: mockSchemas.query,
  ExpenseBatchCreateSchema: mockSchemas.batchCreate,
  ExpenseStatusSchema: mockSchemas.status,
  ExpenseCategorySchema: mockSchemas.category,
}));

vi.mock('@/lib/safety/mass-deletion', () => ({
  validateMassDeleteConfirmation: mockValidateMassDeleteConfirmation,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { DELETE, GET, PATCH, POST } from '@/app/api/trucking/expenses/route';

describe('Trucking expenses API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateMassDeleteConfirmation.mockReturnValue(null);
  });

  it('fetches filtered trucking expenses', async () => {
    mockExpenseService.findWithFilters.mockResolvedValue([{ id: 1 }]);

    const response = await GET(
      new NextRequest(
        'http://localhost/api/trucking/expenses?category=Fuel&status=approved&employeeName=Driver&minAmount=10'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExpenseService.findWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Fuel',
        status: 'APPROVED',
        employeeName: 'Driver',
        minAmount: 10,
      })
    );
  });

  it('creates trucking expenses on POST', async () => {
    mockExpenseService.createMany.mockResolvedValue({ count: 2 });

    const response = await POST(
      new NextRequest('http://localhost/api/trucking/expenses', {
        method: 'POST',
        body: JSON.stringify([
          { category: 'Fuel', amount: 100 },
          { category: 'Repairs', amount: 50 },
        ]),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(2);
  });

  it('updates a single trucking expense on PATCH', async () => {
    mockExpenseService.update.mockResolvedValue({ id: 1, amount: 120 });

    const response = await PATCH(
      new NextRequest('http://localhost/api/trucking/expenses', {
        method: 'PATCH',
        body: JSON.stringify({ id: 1, amount: 120 }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExpenseService.update).toHaveBeenCalledWith(1, { amount: 120 });
  });

  it('deletes all trucking expenses after confirmation', async () => {
    mockExpenseService.deleteAll.mockResolvedValue({ count: 4 });

    const response = await DELETE(
      new NextRequest('http://localhost/api/trucking/expenses', {
        method: 'DELETE',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(4);
  });
});
