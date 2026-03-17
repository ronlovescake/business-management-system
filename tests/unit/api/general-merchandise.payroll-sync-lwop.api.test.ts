import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    generalMerchandisePayroll: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    generalMerchandiseLeaveRequest: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

import {
  POST,
  GET,
} from '@/app/api/general-merchandise/payroll/sync-lwop/route';

const createRequest = (path: string, method: 'GET' | 'POST'): NextRequest =>
  new NextRequest(`https://test.local${path}`, { method });

const basePayrollRecord = {
  id: 'gm-payroll-1',
  employeeId: 'GM-001',
  employeeName: 'Gamma Worker',
  payPeriod: '2026-03-01 to 2026-03-15',
  periodStart: '2026-03-01',
  periodEnd: '2026-03-15',
  basicSalary: 26000,
  dailyRate: 1000,
  lwop: 0,
  unpaidDays: 0,
  sss: 1000,
  philHealth: 500,
  pagIbig: 200,
  tax: 1500,
  loans: 0,
  cashAdvance: 0,
  absentsLates: 0,
  grossPay: 13000,
};

describe('General merchandise payroll sync LWOP API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns validation error when no sync filters are provided', async () => {
    const response = await POST(
      createRequest('/api/general-merchandise/payroll/sync-lwop', 'POST')
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.validationErrors?.payrollId).toBeDefined();
  });

  it('updates GM LWOP values when unpaid leave overlaps the period', async () => {
    mockPrisma.generalMerchandisePayroll.findMany.mockResolvedValue([
      { ...basePayrollRecord, lwop: 0 },
    ]);
    mockPrisma.generalMerchandiseLeaveRequest.findMany.mockResolvedValue([
      {
        id: 1,
        employeeId: 'GM-001',
        employeeName: 'Gamma Worker',
        startDate: '2026-03-05',
        endDate: '2026-03-06',
        numberOfDays: 2,
        paymentStatus: 'unpaid',
        status: 'approved',
      },
    ]);
    mockPrisma.generalMerchandisePayroll.update.mockResolvedValue({});

    const response = await POST(
      createRequest(
        '/api/general-merchandise/payroll/sync-lwop?employeeId=GM-001',
        'POST'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.synced).toBe(1);
    expect(mockPrisma.generalMerchandisePayroll.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'gm-payroll-1' },
        data: expect.objectContaining({ lwop: 2000, unpaidDays: 2 }),
      })
    );
  });

  it('returns GM LWOP preview data', async () => {
    mockPrisma.generalMerchandisePayroll.findMany.mockResolvedValue([
      { ...basePayrollRecord, lwop: 0, unpaidDays: 0 },
    ]);
    mockPrisma.generalMerchandiseLeaveRequest.findMany.mockResolvedValue([
      {
        id: 1,
        employeeId: 'GM-001',
        employeeName: 'Gamma Worker',
        leaveType: 'Sick Leave',
        startDate: '2026-03-03',
        endDate: '2026-03-04',
        numberOfDays: 2,
        paymentStatus: 'unpaid',
        status: 'approved',
      },
    ]);

    const response = await GET(
      createRequest(
        '/api/general-merchandise/payroll/sync-lwop?payrollId=gm-payroll-1',
        'GET'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data[0]).toMatchObject({
      payrollId: 'gm-payroll-1',
      calculatedUnpaidDays: 2,
    });
  });
});
