import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildSalaryHistoryRequest,
  buildSalaryHistoryRouteParams,
  ensureTestDatabaseUrl,
} from './helpers/salaryHistoryTestUtils';

const { mockPrisma, salaryHistoryDelegate, mockLogger } = vi.hoisted(() => {
  const salaryHistoryDelegate = {
    findMany: vi.fn(),
    create: vi.fn(),
  };

  return {
    mockPrisma: {
      employee: {
        findFirst: vi.fn(),
      },
      salaryHistory: salaryHistoryDelegate,
    },
    salaryHistoryDelegate,
    mockLogger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { GET, POST } from '@/app/api/employees/[id]/salary-history/route';

const EMPLOYEES_API_BASE = '/api/employees';

describe('Employees salary history API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureTestDatabaseUrl();
  });

  describe('GET /api/employees/[id]/salary-history', () => {
    it('returns salary history for a numeric identifier', async () => {
      const employee = { id: 42, employeeId: 'EMP042', name: 'Ada Lovelace' };
      const salaryHistory = [
        {
          id: 'rec-1',
          employeeId: 'EMP042',
          employeeName: 'Ada Lovelace',
          effectiveDate: '2024-01-01',
          basicSalary: 1000,
          allowance: 200,
          totalSalary: 1200,
          reason: 'Promotion',
          notes: null,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          deletedAt: null,
          createdBy: 'admin',
        },
      ];

      mockPrisma.employee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.findMany.mockResolvedValue(salaryHistory);

      const response = await GET(
        buildSalaryHistoryRequest(EMPLOYEES_API_BASE, 'GET', { id: '42' }),
        buildSalaryHistoryRouteParams('42')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: salaryHistory,
        message: 'Salary history fetched',
      });
      expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith({
        where: { id: 42, deletedAt: null },
        select: { id: true, employeeId: true, name: true },
      });
      expect(salaryHistoryDelegate.findMany).toHaveBeenCalledWith({
        where: { employeeId: 'EMP042', deletedAt: null },
        orderBy: { effectiveDate: 'desc' },
      });
    });

    it('resolves employees by employeeId string identifier', async () => {
      const employee = { id: 99, employeeId: 'EMP-EXT', name: 'Grace Hopper' };
      mockPrisma.employee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.findMany.mockResolvedValue([]);

      const response = await GET(
        buildSalaryHistoryRequest(EMPLOYEES_API_BASE, 'GET', {
          id: 'EMP-EXT',
        }),
        buildSalaryHistoryRouteParams('EMP-EXT')
      );
      await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith({
        where: { employeeId: 'EMP-EXT', deletedAt: null },
        select: { id: true, employeeId: true, name: true },
      });
    });

    it('returns 404 when employee lookup fails', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      const response = await GET(
        buildSalaryHistoryRequest(EMPLOYEES_API_BASE, 'GET', { id: '7' }),
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
      const employee = { id: 1, employeeId: 'EMP1', name: 'Test' };
      mockPrisma.employee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.findMany.mockRejectedValue(
        new Error('Database unavailable')
      );

      const response = await GET(
        buildSalaryHistoryRequest(EMPLOYEES_API_BASE, 'GET', { id: '1' }),
        buildSalaryHistoryRouteParams('1')
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to fetch salary history',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[Clothing] Error fetching salary history',
        { error: expect.any(Error) }
      );
    });
  });

  describe('POST /api/employees/[id]/salary-history', () => {
    it('creates a salary record with computed totals', async () => {
      const employee = { id: 5, employeeId: 'EMP005', name: 'Test User' };
      const payload = {
        effectiveDate: '2024-02-01',
        basicSalary: 2000,
        allowance: 250,
        reason: 'Annual raise',
        notes: 'Strong performance',
      };
      const createdRecord = {
        ...payload,
        id: 'rec-123',
        employeeId: 'EMP005',
        employeeName: 'Test User',
        totalSalary: 2250,
        createdAt: '2024-02-02T00:00:00.000Z',
        updatedAt: '2024-02-02T00:00:00.000Z',
        deletedAt: null,
        createdBy: 'admin',
      };

      mockPrisma.employee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.create.mockResolvedValue(createdRecord);

      const response = await POST(
        buildSalaryHistoryRequest(EMPLOYEES_API_BASE, 'POST', {
          id: 'EMP005',
          body: payload,
        }),
        buildSalaryHistoryRouteParams('EMP005')
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
          employeeId: 'EMP005',
          employeeName: 'Test User',
          effectiveDate: '2024-02-01',
          basicSalary: 2000,
          allowance: 250,
          totalSalary: 2250,
          reason: 'Annual raise',
          notes: 'Strong performance',
        },
      });
    });

    it('defaults allowance to zero when omitted', async () => {
      const employee = { id: 3, employeeId: 'EMP003', name: null };
      const payload = {
        effectiveDate: '2024-03-01',
        basicSalary: 1800,
      };

      mockPrisma.employee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.create.mockResolvedValue({ id: 'rec-zero' });

      await POST(
        buildSalaryHistoryRequest(EMPLOYEES_API_BASE, 'POST', {
          id: '3',
          body: payload,
        }),
        buildSalaryHistoryRouteParams('3')
      );

      expect(salaryHistoryDelegate.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'EMP003',
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
      const employee = { id: 5, employeeId: 'EMP005', name: 'Missing Fields' };
      mockPrisma.employee.findFirst.mockResolvedValue(employee);

      const response = await POST(
        buildSalaryHistoryRequest(EMPLOYEES_API_BASE, 'POST', {
          id: 'EMP005',
          body: { allowance: 100 },
        }),
        buildSalaryHistoryRouteParams('EMP005')
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
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      const response = await POST(
        buildSalaryHistoryRequest(EMPLOYEES_API_BASE, 'POST', {
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
      const employee = { id: 6, employeeId: 'EMP006', name: 'Failure Case' };
      mockPrisma.employee.findFirst.mockResolvedValue(employee);
      salaryHistoryDelegate.create.mockRejectedValue(
        new Error('Insert failed')
      );

      const response = await POST(
        buildSalaryHistoryRequest(EMPLOYEES_API_BASE, 'POST', {
          id: 'EMP006',
          body: { effectiveDate: '2024-04-01', basicSalary: 1500 },
        }),
        buildSalaryHistoryRouteParams('EMP006')
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to create salary record',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[Clothing] Error creating salary record',
        { error: expect.any(Error) }
      );
    });
  });
});
