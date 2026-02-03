import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl, mockLogger } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      payroll: {
        deleteMany: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { DELETE } from '@/app/api/payroll/cleanup/route';

const createRequest = (query = ''): NextRequest => {
  const url = getTestApiUrl(`/api/payroll/cleanup${query}`);
  return new NextRequest(url);
};

describe('Payroll Cleanup API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires periodStart and periodEnd parameters', async () => {
    const response = await DELETE(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.validationErrors?.periodStart).toBeDefined();
    expect(payload.validationErrors?.periodEnd).toBeDefined();
    expect(mockPrisma.payroll.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes soft-deleted payrolls for the requested period', async () => {
    mockPrisma.payroll.deleteMany.mockResolvedValue({ count: 3 });

    const response = await DELETE(
      createRequest('?periodStart=2025-10-01&periodEnd=2025-10-15')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.count).toBe(3);
    expect(payload.data.filters).toEqual({
      periodStart: '2025-10-01',
      periodEnd: '2025-10-15',
    });

    expect(mockPrisma.payroll.deleteMany).toHaveBeenCalledWith({
      where: {
        periodStart: '2025-10-01',
        periodEnd: '2025-10-15',
        deletedAt: { not: null },
      },
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Soft-deleted payroll records permanently removed',
      expect.objectContaining({ count: 3 })
    );
  });

  it('returns success even when no records are removed', async () => {
    mockPrisma.payroll.deleteMany.mockResolvedValue({ count: 0 });

    const response = await DELETE(
      createRequest('?periodStart=2025-09-01&periodEnd=2025-09-15')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.count).toBe(0);
  });
});
