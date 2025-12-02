import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      payroll: {
        findMany: vi.fn(),
        createMany: vi.fn(),
      },
      attendance: {
        findMany: vi.fn(),
      },
      employee: {
        findMany: vi.fn(),
      },
      thirteenthMonthPayRecord: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

import { POST } from '@/app/api/payroll/generate/route';

const createMockRequest = (): NextRequest => {
  const url = 'https://test.local/api/payroll/generate';
  return {
    method: 'POST',
    url,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nextUrl: new URL(url) as any,
  } as NextRequest;
};

describe('Payroll Generation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock current date to Oct 22, 2025 for consistent pay period calculation
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-22T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockAttendance = [
    {
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      totalHours: 72, // 9 days * 8 hours
    },
    {
      employeeId: 'EMP-002',
      employeeName: 'Jane Smith',
      totalHours: 80, // 10 days * 8 hours
    },
  ];

  const mockEmployees = [
    {
      employeeId: 'EMP-001',
      name: 'John Doe',
      basicSalary: 26000,
      currentSalary: 26000,
      allowance: 0,
      sssMonthlyContribution: 1125.0,
      philHealthMonthlyContribution: 500.0,
      pagibigMonthlyContribution: 200.0,
      taxMonthlyContribution: 1500.0,
      bankAccount: '1234567890',
      gcashAccount: null,
    },
    {
      employeeId: 'EMP-002',
      name: 'Jane Smith',
      basicSalary: 30000,
      currentSalary: 30000,
      allowance: 1000,
      sssMonthlyContribution: 1350.0,
      philHealthMonthlyContribution: 600.0,
      pagibigMonthlyContribution: 200.0,
      taxMonthlyContribution: 2000.0,
      bankAccount: null,
      gcashAccount: '09171234567',
    },
  ];

  describe('POST /api/payroll/generate', () => {
    it('should generate payroll successfully for current period', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([]);
      mockPrisma.attendance.findMany.mockResolvedValue(mockAttendance);
      mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue([]);
      mockPrisma.payroll.createMany.mockResolvedValue({ count: 2 });

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.count).toBe(2);
      expect(data.message).toContain(
        'Successfully generated payroll for 2 employees'
      );
      expect(data.data.period).toEqual({
        start: '2025-10-16',
        end: '2025-10-31',
        label: '2025-10-16 to 2025-10-31',
      });

      expect(mockPrisma.payroll.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            employeeId: 'EMP-001',
            employeeName: 'John Doe',
            periodStart: '2025-10-16',
            periodEnd: '2025-10-31',
            thirteenthMonth: 0, // No 13th month record
          }),
          expect.objectContaining({
            employeeId: 'EMP-002',
            employeeName: 'Jane Smith',
            periodStart: '2025-10-16',
            periodEnd: '2025-10-31',
            thirteenthMonth: 0, // No 13th month record
          }),
        ]),
      });
    });

    it('should exclude paid 13th month pay from generated payroll', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([]);
      mockPrisma.attendance.findMany.mockResolvedValue(mockAttendance);
      mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);

      // Mock 13th month records - one paid, one pending
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue([
        {
          employeeId: 'EMP-001',
          recordId: '13th-001',
          status: 'paid', // Already paid - should NOT be included
          thirteenthMonthPay: 21666.67,
        },
        {
          employeeId: 'EMP-002',
          recordId: '13th-002',
          status: 'pending', // Not yet paid - SHOULD be included
          thirteenthMonthPay: 25000.0,
        },
      ]);

      mockPrisma.payroll.createMany.mockResolvedValue({ count: 2 });

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);

      const createManyCall = mockPrisma.payroll.createMany.mock.calls[0][0];
      const payrollRecords = createManyCall.data;

      // EMP-001 should have 0 thirteenthMonth (already paid)
      const emp001Record = payrollRecords.find(
        (r: { employeeId: string }) => r.employeeId === 'EMP-001'
      );
      expect(emp001Record.thirteenthMonth).toBe(0);

      // EMP-002 should have 25000 thirteenthMonth (pending)
      const emp002Record = payrollRecords.find(
        (r: { employeeId: string }) => r.employeeId === 'EMP-002'
      );
      expect(emp002Record.thirteenthMonth).toBe(25000.0);
    });

    it('should include pending 13th month pay in generated payroll', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([]);
      mockPrisma.attendance.findMany.mockResolvedValue([mockAttendance[0]]);
      mockPrisma.employee.findMany.mockResolvedValue([mockEmployees[0]]);

      // Mock pending 13th month record
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue([
        {
          employeeId: 'EMP-001',
          recordId: '13th-001',
          status: 'pending',
          thirteenthMonthPay: 21666.67,
        },
      ]);

      mockPrisma.payroll.createMany.mockResolvedValue({ count: 1 });

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);

      const createManyCall = mockPrisma.payroll.createMany.mock.calls[0][0];
      const payrollRecords = createManyCall.data;

      expect(payrollRecords[0].thirteenthMonth).toBe(21666.67);
      expect(payrollRecords[0].grossPay).toBeGreaterThan(13000); // Basic salary half + 13th month
    });

    it('should query 13th month records for correct year', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([]);
      mockPrisma.attendance.findMany.mockResolvedValue(mockAttendance);
      mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue([]);
      mockPrisma.payroll.createMany.mockResolvedValue({ count: 2 });

      await POST(createMockRequest());

      // Should query for year 2025 (from period end date)
      expect(mockPrisma.thirteenthMonthPayRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            year: 2025,
            employeeId: { in: ['EMP-001', 'EMP-002'] },
          }),
        })
      );
    });

    it('should return error when payroll already exists for period', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([
        {
          id: 'existing-payroll-id-1',
          deletedAt: null,
          employeeId: 'EMP-001',
          employeeName: 'John Doe',
        },
        {
          id: 'existing-payroll-id-2',
          deletedAt: null,
          employeeId: 'EMP-002',
          employeeName: 'Jane Smith',
        },
      ]);

      mockPrisma.attendance.findMany.mockResolvedValue(mockAttendance);

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Payroll already exists');
      expect(data.details).toContain('Payroll already exists for period');
      expect(data.meta?.period?.label).toBe('2025-10-16 to 2025-10-31');

      expect(mockPrisma.attendance.findMany).toHaveBeenCalled();
      expect(mockPrisma.payroll.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
    });

    it('should return error when no attendance records found', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([]);
      mockPrisma.attendance.findMany.mockResolvedValue([]);

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('No attendance records found');
      expect(data.details).toContain('No attendance records found');
      expect(data.meta?.period).toBeDefined();

      expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.payroll.createMany).not.toHaveBeenCalled();
    });

    it('should handle employees with null 13th month records', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([]);
      mockPrisma.attendance.findMany.mockResolvedValue(mockAttendance);
      mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);

      // Mock with one employee having 13th month, other doesn't
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue([
        {
          employeeId: 'EMP-001',
          recordId: '13th-001',
          status: 'pending',
          thirteenthMonthPay: 21666.67,
        },
        // EMP-002 has no 13th month record
      ]);

      mockPrisma.payroll.createMany.mockResolvedValue({ count: 2 });

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);

      const createManyCall = mockPrisma.payroll.createMany.mock.calls[0][0];
      const payrollRecords = createManyCall.data;

      // EMP-001 should have 13th month
      const emp001Record = payrollRecords.find(
        (r: { employeeId: string }) => r.employeeId === 'EMP-001'
      );
      expect(emp001Record.thirteenthMonth).toBe(21666.67);

      // EMP-002 should have 0 (no record exists)
      const emp002Record = payrollRecords.find(
        (r: { employeeId: string }) => r.employeeId === 'EMP-002'
      );
      expect(emp002Record.thirteenthMonth).toBe(0);
    });

    it('should calculate overtime pay correctly', async () => {
      mockPrisma.payroll.findMany.mockResolvedValue([]);

      // Employee worked 10 separate days with total 134 hours (4 hours overtime)
      // Stay-in employees have a 13-hour standard workday per policy
      const attendanceRecords = Array.from({ length: 10 }, (_, index) => ({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        totalHours: index === 9 ? 17 : 13,
      }));

      mockPrisma.attendance.findMany.mockResolvedValue(attendanceRecords);
      mockPrisma.employee.findMany.mockResolvedValue([mockEmployees[0]]);
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue([]);
      mockPrisma.payroll.createMany.mockResolvedValue({ count: 1 });

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);

      const createManyCall = mockPrisma.payroll.createMany.mock.calls[0][0];
      const payrollRecord = createManyCall.data[0];

      // daysWorked = 10, standardHours = 10 * 13 = 130
      // totalHours = (9 * 13) + 17 = 117 + 17 = 134
      // overtimeHours = 134 - 130 = 4
      // Hourly rate = 26000 / 26 / 8 = 125
      // OT pay = 4 hours * 125 * 1.25 = 625
      expect(payrollRecord.overtime).toBeCloseTo(625, 2);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.payroll.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to generate payroll');
      expect(data.details).toBe('Database connection failed');
    });

    it('should use correct pay period for first half of month (Oct 16-31)', async () => {
      // Already mocked to Oct 22 in beforeEach
      mockPrisma.payroll.findMany.mockResolvedValue([]);
      mockPrisma.attendance.findMany.mockResolvedValue(mockAttendance);
      mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue([]);
      mockPrisma.payroll.createMany.mockResolvedValue({ count: 2 });

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.period.start).toBe('2025-10-16');
      expect(data.data.period.end).toBe('2025-10-31');
    });

    it('should use correct pay period for second half of month (Oct 1-15)', async () => {
      // Change date to Oct 10 (first half)
      vi.setSystemTime(new Date('2025-10-10T08:00:00.000Z'));

      mockPrisma.payroll.findMany.mockResolvedValue([]);
      mockPrisma.attendance.findMany.mockResolvedValue(mockAttendance);
      mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue([]);
      mockPrisma.payroll.createMany.mockResolvedValue({ count: 2 });

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.period.start).toBe('2025-10-01');
      expect(data.data.period.end).toBe('2025-10-15');
    });
  });
});
