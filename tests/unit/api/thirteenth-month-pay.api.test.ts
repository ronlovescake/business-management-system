import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      thirteenthMonthPayRecord: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { GET, PATCH } from '@/app/api/thirteenth-month-pay/route';

describe('13th Month Pay API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRecords = [
    {
      recordId: '13th-2025-EMP001',
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      year: 2025,
      status: 'pending',
      totalBasicSalary: new Prisma.Decimal(260000),
      totalLwop: new Prisma.Decimal(0),
      totalAbsencesLates: new Prisma.Decimal(0),
      netBasicSalary: new Prisma.Decimal(260000),
      monthsWorked: 10,
      thirteenthMonthPay: new Prisma.Decimal(21666.67),
      notes: null,
      calculatedDate: '2025-10-22',
      approvedDate: null,
      paidDate: null,
      updatedAt: new Date('2025-10-22'),
    },
    {
      recordId: '13th-2025-EMP002',
      employeeId: 'EMP-002',
      employeeName: 'Jane Smith',
      year: 2025,
      status: 'paid',
      totalBasicSalary: new Prisma.Decimal(300000),
      totalLwop: new Prisma.Decimal(3000),
      totalAbsencesLates: new Prisma.Decimal(1000),
      netBasicSalary: new Prisma.Decimal(296000),
      monthsWorked: 12,
      thirteenthMonthPay: new Prisma.Decimal(24666.67),
      notes: 'Paid in full',
      calculatedDate: '2025-12-01',
      approvedDate: '2025-12-05',
      paidDate: '2025-12-15',
      updatedAt: new Date('2025-12-15'),
    },
  ];

  const createMockRequest = (options: { body?: unknown } = {}): NextRequest => {
    return {
      json: async () => options.body,
    } as NextRequest;
  };

  describe('GET /api/thirteenth-month-pay', () => {
    it('should fetch all 13th month pay records', async () => {
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue(
        mockRecords
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].recordId).toBe('13th-2025-EMP001');
      expect(data[1].recordId).toBe('13th-2025-EMP002');
    });

    it('should convert Prisma.Decimal to numbers', async () => {
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue(
        mockRecords
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data[0].totalBasicSalary).toBe('number');
      expect(typeof data[0].thirteenthMonthPay).toBe('number');
      expect(data[0].totalBasicSalary).toBe(260000);
      expect(data[0].thirteenthMonthPay).toBeCloseTo(21666.67, 2);
    });

    it('should include all status fields in response', async () => {
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue([
        mockRecords[1],
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0]).toHaveProperty('status', 'paid');
      expect(data[0]).toHaveProperty('calculatedDate', '2025-12-01');
      expect(data[0]).toHaveProperty('approvedDate', '2025-12-05');
      expect(data[0]).toHaveProperty('paidDate', '2025-12-15');
    });

    it('should sort by employeeName asc and year desc', async () => {
      mockPrisma.thirteenthMonthPayRecord.findMany.mockResolvedValue(
        mockRecords
      );

      await GET();

      expect(mockPrisma.thirteenthMonthPayRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ employeeName: 'asc' }, { year: 'desc' }],
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.thirteenthMonthPayRecord.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to load 13th month pay statuses');
    });
  });

  describe('PATCH /api/thirteenth-month-pay', () => {
    it('should update an existing 13th month pay record', async () => {
      const updateData = {
        id: '13th-2025-EMP001',
        employeeId: 'EMP-001',
        employee: 'John Doe',
        year: 2025,
        status: 'approved',
        totalBasicSalary: 260000,
        totalLwop: 0,
        totalAbsencesLates: 0,
        netBasicSalary: 260000,
        monthsWorked: 10,
        thirteenthMonthPay: 21666.67,
        notes: 'Approved for payment',
        calculatedDate: '2025-10-22',
        approvedDate: '2025-10-23',
        paidDate: null,
      };

      const request = createMockRequest({ body: updateData });

      mockPrisma.thirteenthMonthPayRecord.upsert.mockResolvedValue({
        ...mockRecords[0],
        status: 'approved',
        notes: 'Approved for payment',
        approvedDate: '2025-10-23',
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('approved');
      expect(data.notes).toBe('Approved for payment');
      expect(data.approvedDate).toBe('2025-10-23');
    });

    it('should create a new record if it does not exist (upsert)', async () => {
      const newRecord = {
        id: '13th-2025-EMP003',
        employeeId: 'EMP-003',
        employee: 'Bob Johnson',
        year: 2025,
        status: 'calculated',
        totalBasicSalary: 240000,
        totalLwop: 1000,
        totalAbsencesLates: 500,
        netBasicSalary: 238500,
        monthsWorked: 9,
        thirteenthMonthPay: 17875,
        notes: null,
        calculatedDate: '2025-10-22',
        approvedDate: null,
        paidDate: null,
      };

      const request = createMockRequest({ body: newRecord });

      mockPrisma.thirteenthMonthPayRecord.upsert.mockResolvedValue({
        recordId: '13th-2025-EMP003',
        employeeId: 'EMP-003',
        employeeName: 'Bob Johnson',
        year: 2025,
        status: 'calculated',
        totalBasicSalary: new Prisma.Decimal(240000),
        totalLwop: new Prisma.Decimal(1000),
        totalAbsencesLates: new Prisma.Decimal(500),
        netBasicSalary: new Prisma.Decimal(238500),
        monthsWorked: 9,
        thirteenthMonthPay: new Prisma.Decimal(17875),
        notes: null,
        calculatedDate: '2025-10-22',
        approvedDate: null,
        paidDate: null,
        updatedAt: new Date('2025-10-22'),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recordId).toBe('13th-2025-EMP003');
      expect(data.status).toBe('calculated');
    });

    it('should mark record as paid and set paidDate', async () => {
      const paidUpdate = {
        id: '13th-2025-EMP001',
        employeeId: 'EMP-001',
        employee: 'John Doe',
        year: 2025,
        status: 'paid',
        totalBasicSalary: 260000,
        totalLwop: 0,
        totalAbsencesLates: 0,
        netBasicSalary: 260000,
        monthsWorked: 10,
        thirteenthMonthPay: 21666.67,
        notes: 'Paid via bank transfer',
        calculatedDate: '2025-10-22',
        approvedDate: '2025-10-23',
        paidDate: '2025-12-15',
      };

      const request = createMockRequest({ body: paidUpdate });

      mockPrisma.thirteenthMonthPayRecord.upsert.mockResolvedValue({
        ...mockRecords[0],
        status: 'paid',
        notes: 'Paid via bank transfer',
        paidDate: '2025-12-15',
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('paid');
      expect(data.paidDate).toBe('2025-12-15');
      expect(data.notes).toBe('Paid via bank transfer');
    });

    it('should return error when ID is missing', async () => {
      const request = createMockRequest({
        body: {
          employee: 'John Doe',
          year: 2025,
          status: 'pending',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Record ID is required');
    });

    it('should return error when employee name is missing', async () => {
      const request = createMockRequest({
        body: {
          id: '13th-2025-EMP001',
          year: 2025,
          status: 'pending',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Employee name is required');
    });

    it('should return error for invalid status', async () => {
      const request = createMockRequest({
        body: {
          id: '13th-2025-EMP001',
          employee: 'John Doe',
          year: 2025,
          status: 'invalid-status',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid status value');
    });

    it('should return error for invalid year', async () => {
      const request = createMockRequest({
        body: {
          id: '13th-2025-EMP001',
          employee: 'John Doe',
          year: 'not-a-year',
          status: 'pending',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Year must be a valid number');
    });

    it('should convert string numbers to Prisma.Decimal', async () => {
      const request = createMockRequest({
        body: {
          id: '13th-2025-EMP001',
          employeeId: 'EMP-001',
          employee: 'John Doe',
          year: 2025,
          status: 'calculated',
          totalBasicSalary: '260000', // String
          totalLwop: '0',
          totalAbsencesLates: '0',
          netBasicSalary: '260000',
          monthsWorked: 10,
          thirteenthMonthPay: '21666.67',
          notes: null,
          calculatedDate: '2025-10-22',
          approvedDate: null,
          paidDate: null,
        },
      });

      mockPrisma.thirteenthMonthPayRecord.upsert.mockResolvedValue({
        ...mockRecords[0],
        status: 'calculated',
      });

      const response = await PATCH(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.thirteenthMonthPayRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            totalBasicSalary: expect.any(Prisma.Decimal),
            thirteenthMonthPay: expect.any(Prisma.Decimal),
          }),
        })
      );
    });

    it('should ensure monthsWorked is at least 1', async () => {
      const request = createMockRequest({
        body: {
          id: '13th-2025-EMP001',
          employeeId: 'EMP-001',
          employee: 'John Doe',
          year: 2025,
          status: 'pending',
          totalBasicSalary: 260000,
          totalLwop: 0,
          totalAbsencesLates: 0,
          netBasicSalary: 260000,
          monthsWorked: 0, // Invalid: should be at least 1
          thirteenthMonthPay: 21666.67,
          notes: null,
          calculatedDate: '2025-10-22',
          approvedDate: null,
          paidDate: null,
        },
      });

      mockPrisma.thirteenthMonthPayRecord.upsert.mockResolvedValue({
        ...mockRecords[0],
        monthsWorked: 1,
      });

      const response = await PATCH(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.thirteenthMonthPayRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            monthsWorked: 1, // Should be corrected to 1
          }),
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      const request = createMockRequest({
        body: {
          id: '13th-2025-EMP001',
          employee: 'John Doe',
          year: 2025,
          status: 'pending',
        },
      });

      mockPrisma.thirteenthMonthPayRecord.upsert.mockRejectedValue(
        new Error('Database constraint violation')
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to persist 13th month pay status');
    });
  });
});
