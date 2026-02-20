import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma, mockSyncPayrollDeductions } = vi.hoisted(() => {
  return {
    mockPrisma: {
      payroll: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      expense: {
        upsert: vi.fn(),
      },
      employee: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    mockSyncPayrollDeductions: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/payroll/deductions', () => ({
  syncPayrollDeductions: mockSyncPayrollDeductions,
}));

import { GET, POST, PUT, DELETE } from '@/app/api/payroll/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

describe('Payroll API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (
        input:
          | ((tx: { payroll: typeof mockPrisma.payroll }) => unknown)
          | Promise<unknown>[]
      ) => {
        // Array form: resolve all promises and return results
        if (Array.isArray(input)) {
          return Promise.all(input);
        }
        // Interactive form: pass mock prisma as transaction client
        return input({
          payroll: mockPrisma.payroll,
        });
      }
    );
  });

  const mockPayrolls = [
    {
      id: 'payroll-1',
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      payPeriod: '2025-10-16 to 2025-10-31',
      periodStart: '2025-10-16',
      periodEnd: '2025-10-31',
      basicSalary: 13000,
      allowance: 0,
      overtime: 0,
      bonuses: 0,
      thirteenthMonth: 0,
      grossPay: 13000,
      sss: 1125,
      philHealth: 500,
      pagIbig: 200,
      tax: 1500,
      loans: 0,
      cashAdvance: 0,
      lwop: 0,
      absentsLates: 0,
      totalDeductions: 3325,
      netPay: 9675,
      status: 'pending',
      bankGcash: '1234567890',
      unpaidDays: 0,
      dailyRate: 1000,
      deduction: 0,
      notes: null,
      createdAt: new Date('2025-10-22'),
      updatedAt: new Date('2025-10-22'),
      deletedAt: null,
    },
    {
      id: 'payroll-2',
      employeeId: 'EMP-002',
      employeeName: 'Jane Smith',
      payPeriod: '2025-10-16 to 2025-10-31',
      periodStart: '2025-10-16',
      periodEnd: '2025-10-31',
      basicSalary: 15000,
      allowance: 1000,
      overtime: 500,
      bonuses: 0,
      thirteenthMonth: 0,
      grossPay: 16500,
      sss: 1350,
      philHealth: 600,
      pagIbig: 200,
      tax: 2000,
      loans: 500,
      cashAdvance: 1000,
      lwop: 0,
      absentsLates: 0,
      totalDeductions: 5650,
      netPay: 10850,
      status: 'paid',
      bankGcash: '09171234567',
      unpaidDays: 0,
      dailyRate: 1154,
      deduction: 0,
      notes: null,
      createdAt: new Date('2025-10-22'),
      updatedAt: new Date('2025-10-22'),
      deletedAt: null,
    },
  ];

  const createMockRequest = (
    url: string = getTestApiUrl('/api/payroll'),
    options: { method?: string; body?: unknown; headers?: HeadersInit } = {}
  ): NextRequest =>
    new NextRequest(url, {
      method: options.method || 'GET',
      headers: options.headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });

  describe('GET /api/payroll', () => {
    it('should fetch all payrolls and sync deductions for pending/approved only', async () => {
      const request = createMockRequest();

      mockPrisma.payroll.findMany.mockResolvedValue(mockPayrolls);
      mockSyncPayrollDeductions.mockImplementation((payrolls) =>
        Promise.resolve(payrolls)
      );

      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(Array.isArray(payload.data)).toBe(true);
      expect(payload.data).toHaveLength(2);

      // Verify only pending payroll was synced (not paid)
      expect(mockSyncPayrollDeductions).toHaveBeenCalledWith([mockPayrolls[0]]);
      expect(mockSyncPayrollDeductions).toHaveBeenCalledTimes(1);
    });

    it('should filter by employeeId when provided', async () => {
      const request = createMockRequest(
        getTestApiUrl('/api/payroll', { employeeId: 'EMP-001' })
      );

      mockPrisma.payroll.findMany.mockResolvedValue([mockPayrolls[0]]);
      mockSyncPayrollDeductions.mockImplementation((payrolls) =>
        Promise.resolve(payrolls)
      );

      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data).toHaveLength(1);
      expect(payload.data[0].employeeId).toBe('EMP-001');

      expect(mockPrisma.payroll.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'EMP-001',
          }),
        })
      );
    });

    it('should sort payrolls by periodStart desc and employeeName asc', async () => {
      const unsortedPayrolls = [
        { ...mockPayrolls[1], periodStart: '2025-10-01' },
        { ...mockPayrolls[0], periodStart: '2025-10-16' },
      ];

      const request = createMockRequest();
      mockPrisma.payroll.findMany.mockResolvedValue(unsortedPayrolls);
      mockSyncPayrollDeductions.mockImplementation((payrolls) =>
        Promise.resolve(payrolls)
      );

      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      // Should be sorted by date descending (Oct 16 before Oct 01)
      expect(payload.data[0].periodStart).toBe('2025-10-16');
      expect(payload.data[1].periodStart).toBe('2025-10-01');
    });

    it('should not sync paid payrolls', async () => {
      const allPaidPayrolls = mockPayrolls.map((p) => ({
        ...p,
        status: 'paid',
      }));

      const request = createMockRequest();
      mockPrisma.payroll.findMany.mockResolvedValue(allPaidPayrolls);
      mockSyncPayrollDeductions.mockImplementation((payrolls) =>
        Promise.resolve(payrolls)
      );

      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data).toHaveLength(2);

      // Should not sync any payrolls (all are paid)
      expect(mockSyncPayrollDeductions).not.toHaveBeenCalled();
    });

    it('should not sync approved payrolls', async () => {
      const approvedPayroll = { ...mockPayrolls[0], status: 'approved' };
      const request = createMockRequest();

      mockPrisma.payroll.findMany.mockResolvedValue([approvedPayroll]);
      mockSyncPayrollDeductions.mockImplementation((payrolls) =>
        Promise.resolve(payrolls)
      );

      const response = await GET(request);
      await response.json();

      expect(mockSyncPayrollDeductions).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const request = createMockRequest();
      mockPrisma.payroll.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload.error).toBe('An unexpected error occurred');
      expect(payload.details).toBe('Database connection failed');
    });
  });

  describe('POST /api/payroll', () => {
    it('should create a single payroll record', async () => {
      const newPayroll = {
        employeeId: 'EMP-003',
        employeeName: 'Bob Johnson',
        payPeriod: '2025-10-16 to 2025-10-31',
        periodStart: '2025-10-16',
        periodEnd: '2025-10-31',
        basicSalary: 12000,
        allowance: 500,
        overtime: 0,
        bonuses: 0,
        thirteenthMonth: 0,
        grossPay: 12500,
        sss: 1000,
        philHealth: 450,
        pagIbig: 200,
        tax: 1200,
        loans: 0,
        cashAdvance: 0,
        lwop: 0,
        absentsLates: 0,
        totalDeductions: 2850,
        netPay: 9650,
        status: 'pending',
        bankGcash: '09181234567',
      };

      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'POST',
        body: newPayroll,
      });

      // Mock employee existence check
      mockPrisma.employee.findMany.mockResolvedValue([
        {
          employeeId: 'EMP-003',
          employeeName: 'Bob Johnson',
        },
      ] as Array<{ employeeId: string; employeeName: string }>);

      mockPrisma.payroll.create.mockResolvedValue({
        id: 'payroll-3',
        ...newPayroll,
        unpaidDays: 0,
        dailyRate: 0,
        deduction: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(payload.data.id).toBe('payroll-3');
      expect(payload.data.employeeId).toBe('EMP-003');
      expect(payload.data.employeeName).toBe('Bob Johnson');
    });

    it('should handle bulk payroll creation', async () => {
      const bulkPayrolls = [
        {
          employeeId: 'EMP-004',
          employeeName: 'Alice Brown',
          payPeriod: '2025-10-16 to 2025-10-31',
          periodStart: '2025-10-16',
          periodEnd: '2025-10-31',
          basicSalary: 11000,
          grossPay: 11000,
          totalDeductions: 2500,
          netPay: 8500,
        },
        {
          employeeId: 'EMP-005',
          employeeName: 'Charlie Davis',
          payPeriod: '2025-10-16 to 2025-10-31',
          periodStart: '2025-10-16',
          periodEnd: '2025-10-31',
          basicSalary: 14000,
          grossPay: 14000,
          totalDeductions: 3000,
          netPay: 11000,
        },
      ];

      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'POST',
        body: bulkPayrolls,
      });

      // Mock employee existence check for bulk
      mockPrisma.employee.findMany.mockResolvedValue([
        { employeeId: 'EMP-004' },
        { employeeId: 'EMP-005' },
      ] as Array<{ employeeId: string }>);

      mockPrisma.payroll.create
        .mockResolvedValueOnce({
          id: 'payroll-4',
          ...bulkPayrolls[0],
          allowance: 0,
          overtime: 0,
          bonuses: 0,
          thirteenthMonth: 0,
          sss: 0,
          philHealth: 0,
          pagIbig: 0,
          tax: 0,
          loans: 0,
          cashAdvance: 0,
          lwop: 0,
          absentsLates: 0,
          status: 'pending',
          bankGcash: '',
          unpaidDays: 0,
          dailyRate: 0,
          deduction: 0,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        })
        .mockResolvedValueOnce({
          id: 'payroll-5',
          ...bulkPayrolls[1],
          allowance: 0,
          overtime: 0,
          bonuses: 0,
          thirteenthMonth: 0,
          sss: 0,
          philHealth: 0,
          pagIbig: 0,
          tax: 0,
          loans: 0,
          cashAdvance: 0,
          lwop: 0,
          absentsLates: 0,
          status: 'pending',
          bankGcash: '',
          unpaidDays: 0,
          dailyRate: 0,
          deduction: 0,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(payload.data.count).toBe(2);
      expect(payload.data.records).toHaveLength(2);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should convert string numbers to actual numbers', async () => {
      const payrollWithStrings = {
        employeeId: 'EMP-006',
        employeeName: 'Test Employee',
        payPeriod: '2025-10-16 to 2025-10-31',
        periodStart: '2025-10-16',
        periodEnd: '2025-10-31',
        basicSalary: '12000', // String
        grossPay: '12000',
        totalDeductions: '2500',
        netPay: '9500',
      };

      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'POST',
        body: payrollWithStrings,
      });

      // Mock employee existence check
      mockPrisma.employee.findMany.mockResolvedValue([
        {
          employeeId: 'EMP-006',
          employeeName: 'Test Employee',
        },
      ] as Array<{ employeeId: string; employeeName: string }>);

      mockPrisma.payroll.create.mockResolvedValue({
        id: 'payroll-6',
        employeeId: 'EMP-006',
        employeeName: 'Test Employee',
        payPeriod: '2025-10-16 to 2025-10-31',
        periodStart: '2025-10-16',
        periodEnd: '2025-10-31',
        basicSalary: 12000, // Number
        allowance: 0,
        overtime: 0,
        bonuses: 0,
        thirteenthMonth: 0,
        grossPay: 12000,
        sss: 0,
        philHealth: 0,
        pagIbig: 0,
        tax: 0,
        loans: 0,
        cashAdvance: 0,
        lwop: 0,
        absentsLates: 0,
        totalDeductions: 2500,
        netPay: 9500,
        status: 'pending',
        bankGcash: '',
        unpaidDays: 0,
        dailyRate: 0,
        deduction: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(mockPrisma.payroll.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            basicSalary: 12000, // Should be converted to number
            grossPay: 12000,
            totalDeductions: 2500,
            netPay: 9500,
          }),
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      const validPayroll = {
        employeeId: 'EMP-007',
        employeeName: 'Test',
        payPeriod: '2025-10-16 to 2025-10-31',
        periodStart: '2025-10-16',
        periodEnd: '2025-10-31',
        basicSalary: 10000,
        grossPay: 10000,
        totalDeductions: 2000,
        netPay: 8000,
      };

      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'POST',
        body: validPayroll,
      });

      // Mock employee check succeeds
      mockPrisma.employee.findMany.mockResolvedValue([
        {
          employeeId: 'EMP-007',
        },
      ] as Array<{ employeeId: string }>);

      // But create fails
      mockPrisma.payroll.create.mockRejectedValue(
        new Error('Database constraint violation')
      );

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload.error).toBe('Failed to process payroll request');
    });
  });

  describe('PUT /api/payroll', () => {
    it('should update a payroll record', async () => {
      const updateData = {
        id: 'payroll-1',
        status: 'approved',
        notes: 'Approved by manager',
      };

      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'PUT',
        body: updateData,
      });

      mockPrisma.payroll.findUnique.mockResolvedValue(mockPayrolls[0]);
      mockPrisma.payroll.update.mockResolvedValue({
        ...mockPayrolls[0],
        status: 'approved',
        notes: 'Approved by manager',
      });

      const response = await PUT(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data.status).toBe('approved');
      expect(payload.data.notes).toBe('Approved by manager');
    });

    it('should sync deductions when status changes to paid', async () => {
      const updateData = {
        id: 'payroll-1',
        status: 'paid',
      };

      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'PUT',
        body: updateData,
      });

      const pendingPayroll = { ...mockPayrolls[0], status: 'pending' };
      const paidPayroll = { ...mockPayrolls[0], status: 'paid' };

      mockPrisma.payroll.findUnique.mockResolvedValue(pendingPayroll);
      mockPrisma.payroll.update.mockResolvedValue(paidPayroll);
      mockSyncPayrollDeductions.mockResolvedValue([
        { ...paidPayroll, cashAdvance: 1000 },
      ]);

      const response = await PUT(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(mockSyncPayrollDeductions).toHaveBeenCalledWith([paidPayroll]);
      expect(payload.data.status).toBe('paid');
    });

    it('should not sync deductions when status changes to approved', async () => {
      const updateData = {
        id: 'payroll-1',
        status: 'approved',
      };

      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'PUT',
        body: updateData,
      });

      mockPrisma.payroll.findUnique.mockResolvedValue(mockPayrolls[0]);
      mockPrisma.payroll.update.mockResolvedValue({
        ...mockPayrolls[0],
        status: 'approved',
      });

      const response = await PUT(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(mockSyncPayrollDeductions).not.toHaveBeenCalled();
    });

    it('should not sync when status is already paid', async () => {
      const updateData = {
        id: 'payroll-2',
        notes: 'Payment confirmed',
      };

      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'PUT',
        body: updateData,
      });

      mockPrisma.payroll.findUnique.mockResolvedValue(mockPayrolls[1]); // Already paid
      mockPrisma.payroll.update.mockResolvedValue({
        ...mockPayrolls[1],
        notes: 'Payment confirmed',
      });

      const response = await PUT(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(mockSyncPayrollDeductions).not.toHaveBeenCalled();
    });

    it('should return 404 when payroll not found', async () => {
      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'PUT',
        body: { id: 'non-existent', status: 'approved' },
      });

      mockPrisma.payroll.findUnique.mockResolvedValue(null);

      const response = await PUT(request);
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.error).toBe('Payroll record not found');
    });

    it('should convert string numbers to actual numbers', async () => {
      const updateData = {
        id: 'payroll-1',
        overtime: '1500', // String
        grossPay: '14500',
        netPay: '10175',
      };

      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'PUT',
        body: updateData,
      });

      mockPrisma.payroll.findUnique.mockResolvedValue(mockPayrolls[0]);
      mockPrisma.payroll.update.mockResolvedValue({
        ...mockPayrolls[0],
        overtime: 1500,
        grossPay: 14500,
        netPay: 10175,
      });

      const response = await PUT(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(mockPrisma.payroll.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            overtime: 1500, // Should be number
            grossPay: 14500,
            netPay: 10175,
          }),
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'PUT',
        body: { id: 'payroll-1', status: 'approved' },
      });

      mockPrisma.payroll.findUnique.mockResolvedValue(mockPayrolls[0]);
      mockPrisma.payroll.update.mockRejectedValue(
        new Error('Database update failed')
      );

      const response = await PUT(request);
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload.error).toBe('Failed to process payroll request');
    });
  });

  describe('DELETE /api/payroll', () => {
    it('should soft delete a payroll record', async () => {
      const request = createMockRequest(
        getTestApiUrl('/api/payroll', { id: 'payroll-1' }),
        { method: 'DELETE' }
      );

      mockPrisma.payroll.update.mockResolvedValue({
        ...mockPayrolls[0],
        deletedAt: new Date(),
      });

      const response = await DELETE(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data.success).toBe(true);

      expect(mockPrisma.payroll.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payroll-1' },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should return error when ID is missing', async () => {
      const request = createMockRequest(getTestApiUrl('/api/payroll'), {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error).toBe('Payroll ID is required');
    });

    it('should handle database errors gracefully', async () => {
      const request = createMockRequest(
        getTestApiUrl('/api/payroll', { id: 'payroll-1' }),
        { method: 'DELETE' }
      );

      mockPrisma.payroll.update.mockRejectedValue(
        new Error('Database delete failed')
      );

      const response = await DELETE(request);
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload.error).toBe('Failed to process payroll request');
    });
  });
});
