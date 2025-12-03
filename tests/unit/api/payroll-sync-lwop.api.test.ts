import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      payroll: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      leaveRequest: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

import { POST, GET } from '@/app/api/payroll/sync-lwop/route';

const createRequest = (path: string, method: 'GET' | 'POST'): NextRequest =>
  new NextRequest(`https://test.local${path}`, { method });

const basePayrollRecord = {
  id: 'payroll-1',
  employeeId: 'EMP-001',
  employeeName: 'John Doe',
  payPeriod: '2025-10-01 to 2025-10-15',
  periodStart: '2025-10-01',
  periodEnd: '2025-10-15',
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

describe('Payroll Sync LWOP API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/payroll/sync-lwop', () => {
    it('returns validation error when no filters provided', async () => {
      const response = await POST(
        createRequest('/api/payroll/sync-lwop', 'POST')
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.validationErrors?.payrollId).toBeDefined();
      expect(mockPrisma.payroll.findMany).not.toHaveBeenCalled();
    });

    it('returns not found when payroll records missing', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([]);

      const response = await POST(
        createRequest(
          '/api/payroll/sync-lwop?payPeriod=2025-10-01+to+2025-10-15',
          'POST'
        )
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.error).toBe('No payroll records found');
      expect(payload.meta.filters.payPeriod).toBe('2025-10-01 to 2025-10-15');
      expect(mockPrisma.leaveRequest.findMany).not.toHaveBeenCalled();
    });

    it('updates LWOP values when unpaid leave overlaps period', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([
        {
          ...basePayrollRecord,
          lwop: 0,
        },
      ]);

      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 1,
          employeeId: 'EMP-001',
          employeeName: 'John Doe',
          startDate: '2025-10-05',
          endDate: '2025-10-06',
          numberOfDays: 2,
          paymentStatus: 'unpaid',
          status: 'approved',
        },
      ]);

      mockPrisma.payroll.update.mockResolvedValue({});

      const response = await POST(
        createRequest('/api/payroll/sync-lwop?employeeId=EMP-001', 'POST')
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data.synced).toBe(1);
      expect(mockPrisma.payroll.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payroll-1' },
          data: expect.objectContaining({
            lwop: 2000, // 2 days * 1000 daily rate
            unpaidDays: 2,
          }),
        })
      );
    });
  });

  describe('GET /api/payroll/sync-lwop', () => {
    it('requires payroll or employee filter', async () => {
      const response = await GET(
        createRequest('/api/payroll/sync-lwop', 'GET')
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.validationErrors?.payrollId).toBeDefined();
      expect(mockPrisma.payroll.findMany).not.toHaveBeenCalled();
    });

    it('returns not found when no payroll records match filter', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([]);

      const response = await GET(
        createRequest('/api/payroll/sync-lwop?payrollId=payroll-unknown', 'GET')
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.error).toBe('No payroll records found');
      expect(payload.meta.filters.payrollId).toBe('payroll-unknown');
    });

    it('returns LWOP preview data', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([
        {
          ...basePayrollRecord,
          lwop: 0,
          unpaidDays: 0,
        },
      ]);

      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 1,
          employeeId: 'EMP-001',
          employeeName: 'John Doe',
          leaveType: 'Sick Leave',
          startDate: '2025-10-03',
          endDate: '2025-10-04',
          numberOfDays: 2,
        },
      ]);

      const response = await GET(
        createRequest('/api/payroll/sync-lwop?payrollId=payroll-1', 'GET')
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data[0]).toMatchObject({
        payrollId: 'payroll-1',
        calculatedUnpaidDays: 2,
        leaveBreakdown: [
          expect.objectContaining({
            leaveType: 'Sick Leave',
            daysInThisPeriod: 2,
          }),
        ],
      });
    });
  });
});
