import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { mockLogger } from '@/core/testing/test-helpers';

const mockThirteenthMonthPayService = vi.hoisted(() => ({
  findAll: vi.fn(),
  findWithFilters: vi.fn(),
  findByRecordId: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  updateStatusByRecordId: vi.fn(),
}));

vi.mock('@/modules/trucking/employees/thirteenth-month-pay/api', () => ({
  thirteenthMonthPayService: mockThirteenthMonthPayService,
  ThirteenthMonthPayQuerySchema: {
    parse: vi.fn((data) => data),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: {
    name: vi.fn((value) => String(value ?? '')),
    number: vi.fn((value) => {
      if (value === null || value === undefined || value === '') {
        return undefined;
      }
      const parsed = Number.parseInt(String(value), 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    }),
  },
}));

import { GET, PATCH } from '@/app/api/trucking/thirteenth-month-pay/route';
import { PATCH as PATCH_STATUS } from '@/app/api/trucking/thirteenth-month-pay/[recordId]/status/route';

describe('Trucking 13th Month Pay API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRecords = [
    {
      recordId: 'truck-13th-2025-EMP001',
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      year: 2025,
      status: 'approved',
      totalBasicSalary: 260000,
      totalLwop: 0,
      totalAbsencesLates: 0,
      netBasicSalary: 260000,
      monthsWorked: 10,
      thirteenthMonthPay: 21666.67,
      notes: null,
      calculatedDate: '2025-12-01',
      approvedDate: '2025-12-05',
      paidDate: null,
    },
  ];

  const createJsonRequest = (body: unknown) =>
    ({
      json: async () => body,
    }) as NextRequest;

  const createGetRequest = (url: string) => ({ url }) as NextRequest;

  describe('GET /api/trucking/thirteenth-month-pay', () => {
    it('returns all trucking records when no filters are provided', async () => {
      mockThirteenthMonthPayService.findAll.mockResolvedValue(mockRecords);

      const request = createGetRequest(
        'http://localhost:3000/api/trucking/thirteenth-month-pay'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockRecords);
      expect(mockThirteenthMonthPayService.findAll).toHaveBeenCalledOnce();
      expect(
        mockThirteenthMonthPayService.findWithFilters
      ).not.toHaveBeenCalled();
    });

    it('passes sanitized filters to the trucking service', async () => {
      mockThirteenthMonthPayService.findWithFilters.mockResolvedValue(
        mockRecords
      );

      const request = createGetRequest(
        'http://localhost:3000/api/trucking/thirteenth-month-pay?employeeId=EMP-001&year=2025&status=approved'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(
        mockThirteenthMonthPayService.findWithFilters
      ).toHaveBeenCalledWith({
        employeeId: 'EMP-001',
        year: 2025,
        status: 'approved',
      });
    });

    it('returns a 500 response when the trucking service throws', async () => {
      mockThirteenthMonthPayService.findAll.mockRejectedValue(
        new Error('Database error')
      );

      const request = createGetRequest(
        'http://localhost:3000/api/trucking/thirteenth-month-pay'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to load 13th month pay records');
    });
  });

  describe('PATCH /api/trucking/thirteenth-month-pay', () => {
    it('updates an existing trucking record', async () => {
      mockThirteenthMonthPayService.findByRecordId.mockResolvedValue({ id: 1 });
      mockThirteenthMonthPayService.update.mockResolvedValue({
        ...mockRecords[0],
        status: 'paid',
      });

      const response = await PATCH(
        createJsonRequest({
          id: 'truck-13th-2025-EMP001',
          employeeId: 'EMP-001',
          employee: 'John Doe',
          year: 2025,
          status: 'paid',
        })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('paid');
      expect(mockThirteenthMonthPayService.findByRecordId).toHaveBeenCalledWith(
        'truck-13th-2025-EMP001'
      );
      expect(mockThirteenthMonthPayService.update).toHaveBeenCalledOnce();
    });

    it('creates a new trucking record when none exists', async () => {
      mockThirteenthMonthPayService.findByRecordId.mockResolvedValue(null);
      mockThirteenthMonthPayService.create.mockResolvedValue(mockRecords[0]);

      const response = await PATCH(
        createJsonRequest({
          id: 'truck-13th-2025-EMP001',
          employeeId: 'EMP-001',
          employee: 'John Doe',
          year: 2025,
          status: 'approved',
        })
      );

      expect(response.status).toBe(200);
      expect(mockThirteenthMonthPayService.create).toHaveBeenCalledWith({
        recordId: 'truck-13th-2025-EMP001',
        employeeId: 'EMP-001',
        employee: 'John Doe',
        year: 2025,
        status: 'approved',
      });
    });

    it('returns 400 when record id is missing', async () => {
      const response = await PATCH(createJsonRequest({ employee: 'John Doe' }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Record ID is required');
    });
  });

  describe('PATCH /api/trucking/thirteenth-month-pay/[recordId]/status', () => {
    it('updates status for a trucking record', async () => {
      mockThirteenthMonthPayService.updateStatusByRecordId.mockResolvedValue({
        ...mockRecords[0],
        status: 'paid',
      });

      const response = await PATCH_STATUS(
        createJsonRequest({ status: 'paid' }),
        { params: { recordId: 'truck-13th-2025-EMP001' } }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('paid');
      expect(
        mockThirteenthMonthPayService.updateStatusByRecordId
      ).toHaveBeenCalledWith('truck-13th-2025-EMP001', 'paid');
    });

    it('returns 404 when the trucking record does not exist', async () => {
      mockThirteenthMonthPayService.updateStatusByRecordId.mockRejectedValue(
        new Error('record not found')
      );

      const response = await PATCH_STATUS(
        createJsonRequest({ status: 'paid' }),
        { params: { recordId: 'missing-record' } }
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Failed to update status');
    });

    it('returns 400 when status is missing', async () => {
      const response = await PATCH_STATUS(createJsonRequest({}), {
        params: { recordId: 'truck-13th-2025-EMP001' },
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Status is required');
    });
  });
});
