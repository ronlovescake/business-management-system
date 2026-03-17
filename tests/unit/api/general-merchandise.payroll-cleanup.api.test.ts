import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl, mockLogger } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    generalMerchandisePayroll: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

import { DELETE } from '@/app/api/general-merchandise/payroll/cleanup/route';

const createRequest = (query = ''): NextRequest =>
  new NextRequest(
    getTestApiUrl(`/api/general-merchandise/payroll/cleanup${query}`)
  );

describe('General merchandise payroll cleanup API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires periodStart and periodEnd parameters', async () => {
    const response = await DELETE(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.validationErrors?.periodStart).toBeDefined();
    expect(payload.validationErrors?.periodEnd).toBeDefined();
  });

  it('deletes soft-deleted GM payrolls for the requested period', async () => {
    mockPrisma.generalMerchandisePayroll.deleteMany.mockResolvedValue({
      count: 2,
    });

    const response = await DELETE(
      createRequest('?periodStart=2026-03-01&periodEnd=2026-03-15')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.count).toBe(2);
    expect(
      mockPrisma.generalMerchandisePayroll.deleteMany
    ).toHaveBeenCalledWith({
      where: {
        periodStart: '2026-03-01',
        periodEnd: '2026-03-15',
        deletedAt: { not: null },
      },
    });
  });
});
