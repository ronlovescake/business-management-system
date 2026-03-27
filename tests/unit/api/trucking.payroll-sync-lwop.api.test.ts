import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  truckingPayroll: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  truckingLeaveRequest: {
    findMany: vi.fn(),
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

import { POST } from '@/app/api/trucking/payroll/sync-lwop/route';

describe('Trucking payroll sync-lwop API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a sync scope', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/trucking/payroll/sync-lwop', {
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Please specify payrollId');
  });

  it('updates trucking payroll lwop from approved unpaid leave', async () => {
    mockPrisma.truckingPayroll.findMany.mockResolvedValue([
      {
        id: 'truck-pay-1',
        employeeId: 'DRV-1',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-15',
        basicSalary: 26000,
        dailyRate: 1000,
        lwop: 0,
        sss: 500,
        philHealth: 200,
        pagIbig: 100,
        tax: 300,
        loans: 0,
        cashAdvance: 0,
        absentsLates: 0,
        grossPay: 13000,
      },
    ]);
    mockPrisma.truckingLeaveRequest.findMany.mockResolvedValue([
      {
        id: 1,
        employeeId: 'DRV-1',
        employeeName: 'Driver One',
        startDate: '2026-03-03',
        endDate: '2026-03-04',
        numberOfDays: 2,
        paymentStatus: 'unpaid',
        status: 'approved',
      },
    ]);
    mockPrisma.truckingPayroll.update.mockResolvedValue({});

    const response = await POST(
      new NextRequest(
        'http://localhost/api/trucking/payroll/sync-lwop?employeeId=DRV-1',
        {
          method: 'POST',
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.synced).toBe(1);
    expect(mockPrisma.truckingPayroll.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'truck-pay-1' },
        data: expect.objectContaining({
          lwop: 2000,
          unpaidDays: 2,
        }),
      })
    );
  });
});
