import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mockLogger } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  truckingEmployee: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  truckingSchedule: {
    updateMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/lib/validations/employee.validation', () => ({
  validateEmployee: vi.fn((body) => ({ success: true, data: body })),
  formatValidationErrors: vi.fn(() => ['Validation failed']),
}));

vi.mock('@/lib/env', () => ({
  getDatabaseUrl: vi.fn(() => process.env.DATABASE_URL || ''),
}));

vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: {
    name: vi.fn((value) => String(value ?? '').trim()),
    email: vi.fn((value) =>
      String(value ?? '')
        .trim()
        .toLowerCase()
    ),
    phone: vi.fn((value) => String(value ?? '').trim()),
    date: vi.fn((value) => String(value ?? '').trim()),
    address: vi.fn((value) => String(value ?? '').trim()),
    notes: vi.fn((value) => String(value ?? '').trim()),
    number: vi.fn((value) => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const parsed = Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    }),
  },
}));

import { GET, POST } from '@/app/api/trucking/employees/route';
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from '@/app/api/trucking/employees/[id]/route';

describe('Trucking Employees API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
  });

  const buildEmployee = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    employeeId: 'TRK-0001',
    name: 'John Driver',
    firstName: 'John',
    lastName: 'Driver',
    middleName: null,
    email: 'john.driver@example.com',
    phone: '09123456789',
    contact: '09123456789',
    department: 'Operations',
    position: 'Driver',
    jobTitle: 'Driver',
    employeeType: 'full-time',
    status: 'active',
    hireDate: '2025-01-01',
    employmentEndDate: null,
    basicSalary: 25000,
    currentSalary: 25000,
    allowance: null,
    finalPayPending: false,
    finalPayEffectiveDate: null,
    finalPayNotes: null,
    deletedAt: null,
    ...overrides,
  });

  describe('GET /api/trucking/employees', () => {
    it('fetches trucking employees with the trucking soft-delete filter', async () => {
      mockPrisma.truckingEmployee.findMany.mockResolvedValue([
        buildEmployee(),
        buildEmployee({ id: 2, employeeId: 'TRK-0002', name: 'Jane Driver' }),
      ]);

      const response = await GET(
        new NextRequest('http://localhost/api/trucking/employees')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockPrisma.truckingEmployee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('applies search, status, and department filters for trucking employees', async () => {
      mockPrisma.truckingEmployee.findMany.mockResolvedValue([buildEmployee()]);

      await GET(
        new NextRequest(
          'http://localhost/api/trucking/employees?department=Operations&status=active&search=John'
        )
      );

      expect(mockPrisma.truckingEmployee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            department: 'Operations',
            status: 'active',
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('POST /api/trucking/employees', () => {
    it('creates a trucking employee with a generated TRK id when none is provided', async () => {
      mockPrisma.truckingEmployee.findMany.mockResolvedValue([]);
      mockPrisma.truckingEmployee.update.mockReset();
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(null);
      mockPrisma.truckingEmployee.findMany.mockResolvedValueOnce([]);
      mockPrisma.truckingEmployee.findMany.mockResolvedValueOnce([]);
      mockPrisma.truckingEmployee.findMany.mockResolvedValue([]);
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(null);
      mockPrisma.truckingEmployee.update.mockReset();
      mockPrisma.truckingEmployee.findMany.mockResolvedValue([]);

      mockPrisma.truckingEmployee.create.mockResolvedValue(
        buildEmployee({ employeeId: 'TRK-0001' })
      );

      const response = await POST(
        new NextRequest('http://localhost/api/trucking/employees', {
          method: 'POST',
          body: JSON.stringify({
            name: 'John Driver',
            firstName: 'John',
            lastName: 'Driver',
            department: 'Operations',
            position: 'Driver',
            jobTitle: 'Driver',
            status: 'active',
            hireDate: '2025-01-01',
            contact: '09123456789',
            phone: '09123456789',
            basicSalary: 25000,
          }),
        })
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.employeeId).toBe('TRK-0001');
      expect(mockPrisma.truckingEmployee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ employeeId: 'TRK-0001' }),
        })
      );
    });
  });

  describe('GET /api/trucking/employees/[id]', () => {
    it('fetches a trucking employee by identifier', async () => {
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(buildEmployee());

      const response = await GET_BY_ID(
        new NextRequest('http://localhost/api/trucking/employees/TRK-0001'),
        { params: { id: 'TRK-0001' } }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.employeeId).toBe('TRK-0001');
    });

    it('returns 404 when the trucking employee is missing', async () => {
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(null);

      const response = await GET_BY_ID(
        new NextRequest('http://localhost/api/trucking/employees/TRK-9999'),
        { params: { id: 'TRK-9999' } }
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Employee not found or has been deleted');
    });
  });

  describe('PUT /api/trucking/employees/[id]', () => {
    it('auto-cancels future trucking schedules when status becomes resigned', async () => {
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(
        buildEmployee({ employmentEndDate: '2025-03-15' })
      );
      mockPrisma.truckingEmployee.update.mockResolvedValue(
        buildEmployee({
          status: 'resigned',
          employmentEndDate: '2025-03-15',
        })
      );
      mockPrisma.truckingSchedule.updateMany.mockResolvedValue({ count: 3 });

      const response = await PUT(
        new NextRequest('http://localhost/api/trucking/employees/TRK-0001', {
          method: 'PUT',
          body: JSON.stringify({
            employeeId: 'TRK-0001',
            name: 'John Driver',
            firstName: 'John',
            lastName: 'Driver',
            department: 'Operations',
            position: 'Driver',
            jobTitle: 'Driver',
            status: 'resigned',
            hireDate: '2025-01-01',
            contact: '09123456789',
            phone: '09123456789',
            basicSalary: 25000,
            employmentEndDate: '2025-03-15',
          }),
        }),
        { params: { id: 'TRK-0001' } }
      );

      expect(response.status).toBe(200);
      expect(mockPrisma.truckingSchedule.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'TRK-0001',
            deletedAt: null,
            date: { gte: '2025-03-15' },
          }),
        })
      );
    });
  });

  describe('DELETE /api/trucking/employees/[id]', () => {
    it('soft deletes a trucking employee', async () => {
      mockPrisma.truckingEmployee.findFirst.mockResolvedValue(buildEmployee());
      mockPrisma.truckingEmployee.update.mockResolvedValue(
        buildEmployee({ deletedAt: new Date('2026-03-16') })
      );

      const response = await DELETE(
        new NextRequest('http://localhost/api/trucking/employees/TRK-0001', {
          method: 'DELETE',
        }),
        { params: { id: 'TRK-0001' } }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrisma.truckingEmployee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, deletedAt: null },
        })
      );
    });
  });
});
