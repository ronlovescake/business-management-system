import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  truckingPayroll: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  truckingAttendance: {
    findMany: vi.fn(),
  },
  truckingEmployee: {
    findMany: vi.fn(),
  },
  truckingThirteenthMonthPayRecord: {
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

import { POST } from '@/app/api/trucking/payroll/generate/route';

describe('Trucking payroll generate API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T09:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates trucking payroll for the selected period', async () => {
    mockPrisma.truckingPayroll.findMany.mockResolvedValue([]);
    mockPrisma.truckingAttendance.findMany.mockResolvedValue([
      { employeeId: 'DRV-1', employeeName: 'Driver One', totalHours: 80 },
    ]);
    mockPrisma.truckingEmployee.findMany.mockResolvedValue([
      {
        employeeId: 'DRV-1',
        name: 'Driver One',
        basicSalary: 26000,
        currentSalary: 26000,
        allowance: 500,
        sssMonthlyContribution: 1000,
        philHealthMonthlyContribution: 500,
        pagibigMonthlyContribution: 200,
        taxMonthlyContribution: 700,
        bankAccount: null,
        gcashAccount: '09171234567',
      },
    ]);
    mockPrisma.truckingThirteenthMonthPayRecord.findMany.mockResolvedValue([]);
    mockPrisma.truckingPayroll.createMany.mockResolvedValue({ count: 1 });

    const response = await POST(
      new NextRequest('http://localhost/api/trucking/payroll/generate', {
        method: 'POST',
        body: JSON.stringify({
          periodStart: '2026-03-16',
          periodEnd: '2026-03-31',
          payPeriodLabel: '2026-03-16 to 2026-03-31',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.count).toBe(1);
    expect(mockPrisma.truckingPayroll.createMany).toHaveBeenCalled();
  });

  it('ignores soft-deleted payroll rows and only checks active payroll conflicts', async () => {
    mockPrisma.truckingPayroll.findMany.mockResolvedValue([]);
    mockPrisma.truckingAttendance.findMany.mockResolvedValue([
      { employeeId: 'DRV-1', employeeName: 'Driver One', totalHours: 80 },
    ]);
    mockPrisma.truckingEmployee.findMany.mockResolvedValue([
      {
        employeeId: 'DRV-1',
        name: 'Driver One',
        basicSalary: 26000,
        currentSalary: 26000,
        allowance: 500,
        sssMonthlyContribution: 1000,
        philHealthMonthlyContribution: 500,
        pagibigMonthlyContribution: 200,
        taxMonthlyContribution: 700,
        bankAccount: null,
        gcashAccount: '09171234567',
      },
    ]);
    mockPrisma.truckingThirteenthMonthPayRecord.findMany.mockResolvedValue([]);
    mockPrisma.truckingPayroll.createMany.mockResolvedValue({ count: 1 });

    const response = await POST(
      new NextRequest('http://localhost/api/trucking/payroll/generate', {
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(mockPrisma.truckingPayroll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periodStart: '2026-03-16',
          periodEnd: '2026-03-31',
          deletedAt: null,
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.count).toBe(1);
    expect(mockPrisma.truckingPayroll.createMany).toHaveBeenCalled();
  });
});
