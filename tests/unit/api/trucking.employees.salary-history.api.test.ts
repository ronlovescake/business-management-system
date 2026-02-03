import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildSalaryHistoryRequest,
  buildSalaryHistoryRouteParams,
  ensureTestDatabaseUrl,
} from './helpers/salaryHistoryTestUtils';
import { mockLogger } from '@/core/testing/test-helpers';

const { mockPrisma, salaryHistoryDelegate } = vi.hoisted(() => {
  const salaryHistoryDelegate = {
    findMany: vi.fn(),
    create: vi.fn(),
  };

  return {
    mockPrisma: {
      truckingEmployee: {
        findFirst: vi.fn(),
      },
      truckingSalaryHistory: salaryHistoryDelegate,
    },
    salaryHistoryDelegate,
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import {
  GET,
  POST,
} from '@/app/api/trucking/employees/[id]/salary-history/route';

const TRUCKING_API_BASE = '/api/trucking/employees';

describe('Trucking employees salary history API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureTestDatabaseUrl();
  });

  describe('GET /api/trucking/employees/[id]/salary-history', () => {
    it('returns salary history for a numeric identifier', async () => {
      const employee = { id: 42, employeeId: 'TRK042', name: 'Driver One' };
      const salaryHistory = [
        {
          id: 'trk-rec-1',
          employeeId: 'TRK042',
          employeeName: 'Driver One',
          effectiveDate: '2024-01-01',
          basicSalary: 1000,
          allowance: 200,
          totalSalary: 1200,
          reason: 'Route bonus',
          notes: null,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          deletedAt: null,
          createdBy: 'admin',
        },
      ];

      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.findMany.mockResolvedValue(salaryHistory);

      const response = await GET(
        buildSalaryHistoryRequest(TRUCKING_API_BASE, 'GET', { id: '42' }),
        buildSalaryHistoryRouteParams('42')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: salaryHistory,
        message: 'Salary history fetched',
      });
      expect(mockPrisma.truckingEmployee.findFirst).toHaveBeenCalledWith({
        where: { id: 42, deletedAt: null },
        select: { id: true, employeeId: true, name: true },
      });
      expect(salaryHistoryDelegate.findMany).toHaveBeenCalledWith({
        where: { employeeId: 'TRK042', deletedAt: null },
        orderBy: { effectiveDate: 'desc' },
      });
    });

    it('resolves employees by employeeId string identifier', async () => {
      const employee = { id: 99, employeeId: 'TRK-EXT', name: 'Driver Two' };
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.findMany.mockResolvedValue([]);

      const response = await GET(
        buildSalaryHistoryRequest(TRUCKING_API_BASE, 'GET', {
          id: 'TRK-EXT',
        }),
        buildSalaryHistoryRouteParams('TRK-EXT')
      );
      await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.truckingEmployee.findFirst).toHaveBeenCalledWith({
        where: { employeeId: 'TRK-EXT', deletedAt: null },
        select: { id: true, employeeId: true, name: true },
      });
    });

    it('returns 404 when employee lookup fails', async () => {
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(null);

      const response = await GET(
        buildSalaryHistoryRequest(TRUCKING_API_BASE, 'GET', { id: '7' }),
        buildSalaryHistoryRouteParams('7')
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        success: false,
        error: 'Employee not found',
        details: 'The requested employee does not exist or has been deleted',
      });
      expect(salaryHistoryDelegate.findMany).not.toHaveBeenCalled();
    });

    it('logs and returns 500 when salary history query fails', async () => {
      const employee = { id: 1, employeeId: 'TRK1', name: 'Driver One' };
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.findMany.mockRejectedValue(
        new Error('Database unavailable')
      );

      const response = await GET(
        buildSalaryHistoryRequest(TRUCKING_API_BASE, 'GET', { id: '1' }),
        buildSalaryHistoryRouteParams('1')
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to fetch salary history',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[Trucking] Error fetching salary history',
        { error: expect.any(Error) }
      );
    });
  });

  describe('POST /api/trucking/employees/[id]/salary-history', () => {
    it('creates a salary record with computed totals', async () => {
      const employee = { id: 5, employeeId: 'TRK005', name: 'New Driver' };
      const payload = {
        effectiveDate: '2024-02-01',
        basicSalary: 2000,
        allowance: 250,
        reason: 'Mileage bonus',
        notes: 'Excellent safety record',
      };
      const createdRecord = {
        ...payload,
        id: 'trk-rec-123',
        employeeId: 'TRK005',
        employeeName: 'New Driver',
        totalSalary: 2250,
        createdAt: '2024-02-02T00:00:00.000Z',
        updatedAt: '2024-02-02T00:00:00.000Z',
        deletedAt: null,
        createdBy: 'admin',
      };

      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.create.mockResolvedValue(createdRecord);

      const response = await POST(
        buildSalaryHistoryRequest(TRUCKING_API_BASE, 'POST', {
          id: 'TRK005',
          body: payload,
        }),
        buildSalaryHistoryRouteParams('TRK005')
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual({
        success: true,
        data: createdRecord,
        message: 'Salary record created',
      });
      expect(salaryHistoryDelegate.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'TRK005',
          employeeName: 'New Driver',
          effectiveDate: '2024-02-01',
          basicSalary: 2000,
          allowance: 250,
          totalSalary: 2250,
          reason: 'Mileage bonus',
          notes: 'Excellent safety record',
        },
      });
    });

    it('defaults allowance to zero when omitted', async () => {
      const employee = { id: 3, employeeId: 'TRK003', name: null };
      const payload = {
        effectiveDate: '2024-03-01',
        basicSalary: 1800,
      };

      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.create.mockResolvedValue({ id: 'trk-rec-zero' });

      await POST(
        buildSalaryHistoryRequest(TRUCKING_API_BASE, 'POST', {
          id: '3',
          body: payload,
        }),
        buildSalaryHistoryRouteParams('3')
      );

      expect(salaryHistoryDelegate.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'TRK003',
          employeeName: 'Unknown Employee',
          effectiveDate: '2024-03-01',
          basicSalary: 1800,
          allowance: 0,
          totalSalary: 1800,
          reason: null,
          notes: null,
        },
      });
    });

    it('returns 400 when required fields are missing', async () => {
      const employee = { id: 5, employeeId: 'TRK005', name: 'Missing Fields' };
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(employee);

      const response = await POST(
        buildSalaryHistoryRequest(TRUCKING_API_BASE, 'POST', {
          id: 'TRK005',
          body: { allowance: 100 },
        }),
        buildSalaryHistoryRouteParams('TRK005')
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        error: 'Validation failed',
        validationErrors: {
          effectiveDate: 'Effective date is required',
          basicSalary: 'Basic salary is required',
        },
      });
      expect(salaryHistoryDelegate.create).not.toHaveBeenCalled();
    });

    it('returns 404 when employee lookup fails', async () => {
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(null);

      const response = await POST(
        buildSalaryHistoryRequest(TRUCKING_API_BASE, 'POST', {
          id: '999',
          body: { effectiveDate: '2024-01-01', basicSalary: 1000 },
        }),
        buildSalaryHistoryRouteParams('999')
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        success: false,
        error: 'Employee not found',
        details: 'The requested employee does not exist or has been deleted',
      });
      expect(salaryHistoryDelegate.create).not.toHaveBeenCalled();
    });

    it('logs and returns 500 when creation fails', async () => {
      const employee = { id: 6, employeeId: 'TRK006', name: 'Failure Case' };
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.create.mockRejectedValue(
        new Error('Insert failed')
      );

      const response = await POST(
        buildSalaryHistoryRequest(TRUCKING_API_BASE, 'POST', {
          id: 'TRK006',
          body: { effectiveDate: '2024-04-01', basicSalary: 1500 },
        }),
        buildSalaryHistoryRouteParams('TRK006')
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to create salary record',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[Trucking] Error creating salary record',
        { error: expect.any(Error) }
      );
    });
  });
});
