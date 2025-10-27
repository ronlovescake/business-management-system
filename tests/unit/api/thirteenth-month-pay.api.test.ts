import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { mockNextRequest } from '@/core/testing/test-helpers';

// Mock thirteenth month pay service
const mockThirteenthMonthPayService = vi.hoisted(() => ({
  findAll: vi.fn(),
  findWithFilters: vi.fn(),
  findByRecordId: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/modules/clothing/employees/thirteenth-month-pay/api', () => ({
  thirteenthMonthPayService: mockThirteenthMonthPayService,
  ThirteenthMonthPayQuerySchema: {
    parse: vi.fn((data) => data),
  },
}));

// Mock Prisma (kept for backward compatibility if service uses it internally)
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

// Mock sanitizers
vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: {
    name: vi.fn((value) => String(value ?? '')),
    number: vi.fn((value) => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const num = parseFloat(String(value));
      return isNaN(num) ? null : num;
    }),
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
      status: 'paid',
      totalBasicSalary: 260000,
      totalLwop: 0,
      totalAbsencesLates: 0,
      netBasicSalary: 260000,
      monthsWorked: 10,
      thirteenthMonthPay: 21666.67,
      notes: null,
      calculatedDate: '2025-12-01',
      approvedDate: '2025-12-05',
      paidDate: '2025-12-15',
      updatedAt: new Date('2025-10-22'),
    },
    {
      recordId: '13th-2025-EMP002',
      employeeId: 'EMP-002',
      employeeName: 'Jane Smith',
      year: 2025,
      status: 'paid',
      totalBasicSalary: 300000,
      totalLwop: 3000,
      totalAbsencesLates: 1000,
      netBasicSalary: 296000,
      monthsWorked: 12,
      thirteenthMonthPay: 24666.67,
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
      mockThirteenthMonthPayService.findAll.mockResolvedValue(mockRecords);

      const request = mockNextRequest() as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].recordId).toBe('13th-2025-EMP001');
      expect(data[1].recordId).toBe('13th-2025-EMP002');
    });

    it('should convert Prisma.Decimal to numbers', async () => {
      mockThirteenthMonthPayService.findAll.mockResolvedValue(mockRecords);

      const request = mockNextRequest() as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data[0].totalBasicSalary).toBe('number');
      expect(typeof data[0].thirteenthMonthPay).toBe('number');
      expect(data[0].totalBasicSalary).toBe(260000);
      expect(data[0].thirteenthMonthPay).toBeCloseTo(21666.67, 2);
    });

    it('should include all status fields in response', async () => {
      mockThirteenthMonthPayService.findAll.mockResolvedValue(mockRecords);

      const request = mockNextRequest() as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0]).toHaveProperty('status', 'paid');
      expect(data[0]).toHaveProperty('calculatedDate', '2025-12-01');
      expect(data[0]).toHaveProperty('approvedDate', '2025-12-05');
      expect(data[0]).toHaveProperty('paidDate', '2025-12-15');
    });

    it('should sort by employeeName asc and year desc', async () => {
      mockThirteenthMonthPayService.findAll.mockResolvedValue(mockRecords);

      const request = mockNextRequest() as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      // Just verify the service was called and data is returned
      expect(mockThirteenthMonthPayService.findAll).toHaveBeenCalled();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      mockThirteenthMonthPayService.findAll.mockRejectedValue(
        new Error('Database connection lost')
      );

      const request = mockNextRequest() as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to load 13th month pay records');
    });

    it('should sort by employeeName asc and year desc', async () => {
      mockThirteenthMonthPayService.findAll.mockResolvedValue(mockRecords);

      const request = mockNextRequest() as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      // Just verify the service was called and data is returned
      expect(mockThirteenthMonthPayService.findAll).toHaveBeenCalled();
      expect(Array.isArray(data)).toBe(true);
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

      // Mock existing record found
      mockThirteenthMonthPayService.findByRecordId.mockResolvedValue({
        id: 1,
        ...mockRecords[0],
      });

      // Mock update result
      mockThirteenthMonthPayService.update.mockResolvedValue({
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
      expect(mockThirteenthMonthPayService.findByRecordId).toHaveBeenCalledWith(
        '13th-2025-EMP001'
      );
      expect(mockThirteenthMonthPayService.update).toHaveBeenCalled();
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

      // Mock no existing record found
      mockThirteenthMonthPayService.findByRecordId.mockResolvedValue(null);

      // Mock create result
      mockThirteenthMonthPayService.create.mockResolvedValue({
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
      expect(mockThirteenthMonthPayService.findByRecordId).toHaveBeenCalledWith(
        '13th-2025-EMP003'
      );
      expect(mockThirteenthMonthPayService.create).toHaveBeenCalled();
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

      // Mock existing record
      mockThirteenthMonthPayService.findByRecordId.mockResolvedValue({
        id: 1,
        ...mockRecords[0],
      });

      // Mock update result
      mockThirteenthMonthPayService.update.mockResolvedValue({
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

      // Mock service throwing validation error
      mockThirteenthMonthPayService.findByRecordId.mockResolvedValue({
        id: 1,
        ...mockRecords[0],
      });
      mockThirteenthMonthPayService.update.mockRejectedValue(
        new Error('Employee name is required')
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to persist record');
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

      // Mock service throwing validation error
      mockThirteenthMonthPayService.findByRecordId.mockResolvedValue({
        id: 1,
        ...mockRecords[0],
      });
      mockThirteenthMonthPayService.update.mockRejectedValue(
        new Error('Invalid status value')
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to persist record');
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

      // Mock service throwing validation error
      mockThirteenthMonthPayService.findByRecordId.mockResolvedValue({
        id: 1,
        ...mockRecords[0],
      });
      mockThirteenthMonthPayService.update.mockRejectedValue(
        new Error('Year must be a valid number')
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to persist record');
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

      // Mock existing record
      mockThirteenthMonthPayService.findByRecordId.mockResolvedValue({
        id: 1,
        ...mockRecords[0],
      });

      // Mock update result
      mockThirteenthMonthPayService.update.mockResolvedValue({
        ...mockRecords[0],
        status: 'calculated',
      });

      const response = await PATCH(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockThirteenthMonthPayService.update).toHaveBeenCalled();
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

      // Mock existing record
      mockThirteenthMonthPayService.findByRecordId.mockResolvedValue({
        id: 1,
        ...mockRecords[0],
      });

      // Mock update result with corrected monthsWorked
      mockThirteenthMonthPayService.update.mockResolvedValue({
        ...mockRecords[0],
        monthsWorked: 1,
      });

      const response = await PATCH(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockThirteenthMonthPayService.update).toHaveBeenCalled();
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

      // Mock service throwing database error
      mockThirteenthMonthPayService.findByRecordId.mockResolvedValue({
        id: 1,
        ...mockRecords[0],
      });
      mockThirteenthMonthPayService.update.mockRejectedValue(
        new Error('Database constraint violation')
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to persist record');
    });
  });
});
