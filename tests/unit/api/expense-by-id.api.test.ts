import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  expense: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { DELETE, GET } from '@/app/api/expenses/[id]/route';

describe('Expense by id API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches only active expenses by id', async () => {
    mockPrisma.expense.findFirst.mockResolvedValue({
      id: 9,
      description: 'Fuel reimbursement',
      deletedAt: null,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/expenses/9'),
      { params: { id: '9' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe(9);
    expect(mockPrisma.expense.findFirst).toHaveBeenCalledWith({
      where: { id: 9, deletedAt: null },
    });
  });

  it('soft deletes an active expense by id', async () => {
    mockPrisma.expense.findFirst.mockResolvedValue({
      id: 9,
      description: 'Fuel reimbursement',
      deletedAt: null,
    });
    mockPrisma.expense.update.mockResolvedValue({
      id: 9,
      description: 'Fuel reimbursement',
      deletedAt: new Date('2026-04-06T00:00:00.000Z'),
    });

    const response = await DELETE(
      new NextRequest('http://localhost/api/expenses/9', { method: 'DELETE' }),
      { params: { id: '9' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Expense deleted successfully');
    expect(mockPrisma.expense.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
