import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  truckingPayroll: {
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { DELETE } from '@/app/api/trucking/payroll/cleanup/route';

describe('Trucking payroll cleanup API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires period filters', async () => {
    const response = await DELETE(
      new NextRequest('http://localhost/api/trucking/payroll/cleanup', {
        method: 'DELETE',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('periodStart and periodEnd are required');
  });

  it('deletes soft-deleted trucking payroll records for a period', async () => {
    mockPrisma.truckingPayroll.deleteMany.mockResolvedValue({ count: 2 });

    const response = await DELETE(
      new NextRequest(
        'http://localhost/api/trucking/payroll/cleanup?periodStart=2026-03-01&periodEnd=2026-03-15',
        { method: 'DELETE' }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    expect(mockPrisma.truckingPayroll.deleteMany).toHaveBeenCalledWith({
      where: {
        periodStart: '2026-03-01',
        periodEnd: '2026-03-15',
        deletedAt: { not: null },
      },
    });
  });
});
