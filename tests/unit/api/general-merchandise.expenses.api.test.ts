import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockExpenseService,
  mockValidateMassDeleteConfirmation,
  mockSchemas,
  mockLogger,
} = vi.hoisted(() => ({
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
    status: { options: ['PENDING', 'APPROVED', 'PAID'] },
    category: {
      safeParse: vi.fn((value) => ({ success: true, data: value })),
    },
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/modules/general-merchandise/ledger/api', () => ({
  generalMerchandiseExpenseService: mockExpenseService,
  GeneralMerchandiseExpenseQuerySchema: mockSchemas.query,
  GeneralMerchandiseExpenseBatchCreateSchema: mockSchemas.batchCreate,
  GeneralMerchandiseExpenseStatusSchema: mockSchemas.status,
  GeneralMerchandiseExpenseCategorySchema: mockSchemas.category,
}));

vi.mock('@/lib/safety/mass-deletion', () => ({
  validateMassDeleteConfirmation: mockValidateMassDeleteConfirmation,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import {
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
} from '@/app/api/general-merchandise/expenses/route';

describe('GM expenses API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSchemas.query.safeParse.mockImplementation((value) => ({
      success: true,
      data: value,
    }));
    mockSchemas.batchCreate.safeParse.mockImplementation((value) => ({
      success: true,
      data: value,
    }));
    mockSchemas.category.safeParse.mockImplementation((value) => ({
      success: true,
      data: value,
    }));
    mockValidateMassDeleteConfirmation.mockReturnValue(null);
  });

  it('fetches filtered GM expenses on GET', async () => {
    mockExpenseService.findWithFilters.mockResolvedValue([{ id: 1 }]);

    const response = await GET(
      new NextRequest(
        'http://localhost/api/general-merchandise/expenses?category=Fuel&status=approved&employeeName=Gamma&minAmount=10'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExpenseService.findWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Fuel',
        status: 'APPROVED',
        employeeName: 'Gamma',
        minAmount: 10,
      })
    );
  });

  it('creates GM expenses on POST', async () => {
    mockExpenseService.createMany.mockResolvedValue({ count: 2 });

    const response = await POST(
      new NextRequest('http://localhost/api/general-merchandise/expenses', {
        method: 'POST',
        body: JSON.stringify([
          { category: 'Fuel', amount: 100 },
          { category: 'Supplies', amount: 50 },
        ]),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(2);
  });

  it('rejects non-array bulk updates on PUT', async () => {
    const response = await PUT(
      new NextRequest('http://localhost/api/general-merchandise/expenses', {
        method: 'PUT',
        body: JSON.stringify({ id: 1, amount: 100 }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Expected array of expenses to update');
  });

  it('updates a single GM expense on PATCH', async () => {
    mockExpenseService.update.mockResolvedValue({ id: 1, amount: 120 });

    const response = await PATCH(
      new NextRequest('http://localhost/api/general-merchandise/expenses', {
        method: 'PATCH',
        body: JSON.stringify({ id: 1, amount: 120 }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(1);
    expect(mockExpenseService.update).toHaveBeenCalledWith(1, { amount: 120 });
  });

  it('deletes all GM expenses after confirmation on DELETE', async () => {
    mockExpenseService.deleteAll.mockResolvedValue({ count: 4 });

    const response = await DELETE(
      new NextRequest('http://localhost/api/general-merchandise/expenses', {
        method: 'DELETE',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(4);
  });
});
