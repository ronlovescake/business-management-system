import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mockLogger } from '@/core/testing/test-helpers';

const mockGetDatabaseUrl = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseEmployee: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  generalMerchandiseAttendance: {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  generalMerchandiseExpense: {
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  generalMerchandisePayroll: {
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  generalMerchandiseLeaveRequest: {
    groupBy: vi.fn(),
  },
  generalMerchandiseCashAdvanceRecord: {
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  generalMerchandiseThirteenthMonthPayRecord: {
    aggregate: vi.fn(),
    groupBy: vi.fn(),
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
  formatValidationErrors: vi.fn(() => ({ employeeId: 'required' })),
}));

vi.mock('@/lib/env', () => ({
  getDatabaseUrl: mockGetDatabaseUrl,
}));

import { GET, POST } from '@/app/api/general-merchandise/employees/route';
import { GET as GET_DASHBOARD } from '@/app/api/general-merchandise/employees/dashboard/route';

describe('General merchandise employees API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDatabaseUrl.mockReturnValue(
      'postgresql://user:pass@localhost:5432/testdb'
    );
  });

  it('applies GM employee filters and search conditions on GET', async () => {
    mockPrisma.generalMerchandiseEmployee.findMany.mockResolvedValue([]);

    await GET(
      new NextRequest(
        'http://localhost/api/general-merchandise/employees?department=Operations&status=active&search=Gamma'
      )
    );

    expect(mockPrisma.generalMerchandiseEmployee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          department: 'Operations',
          status: 'active',
          OR: [
            { name: { contains: 'Gamma', mode: 'insensitive' } },
            { firstName: { contains: 'Gamma', mode: 'insensitive' } },
            { lastName: { contains: 'Gamma', mode: 'insensitive' } },
            { employeeId: { contains: 'Gamma', mode: 'insensitive' } },
            { department: { contains: 'Gamma', mode: 'insensitive' } },
            { contact: { contains: 'Gamma', mode: 'insensitive' } },
            { email: { contains: 'Gamma', mode: 'insensitive' } },
          ],
        }),
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('returns 503 when the GM employee database is not configured', async () => {
    mockGetDatabaseUrl.mockReturnValueOnce(
      'postgresql://username:password@localhost:5432/testdb'
    );

    const response = await POST(
      new NextRequest('http://localhost/api/general-merchandise/employees', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Database not configured');
  });

  it('creates a GM employee and falls back currentSalary to basicSalary', async () => {
    mockPrisma.generalMerchandiseEmployee.create.mockResolvedValue({
      id: 'gm-emp-1',
      employeeId: 'GM-001',
      currentSalary: 25000,
      basicSalary: 25000,
      name: 'Gamma Worker',
    });

    const response = await POST(
      new NextRequest('http://localhost/api/general-merchandise/employees', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'GM-001',
          name: 'Gamma Worker',
          firstName: 'Gamma',
          lastName: 'Worker',
          department: 'Operations',
          position: 'Picker',
          jobTitle: 'Picker',
          status: 'active',
          hireDate: '2026-03-01',
          contact: '09170000001',
          basicSalary: 25000,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockPrisma.generalMerchandiseEmployee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 'GM-001',
        phone: '09170000001',
        contact: '09170000001',
        currentSalary: 25000,
        finalPayPending: false,
      }),
    });
  });

  it('returns GM employee dashboard metrics with normalized range ordering', async () => {
    mockPrisma.generalMerchandiseAttendance.count.mockResolvedValue(4);
    mockPrisma.generalMerchandiseAttendance.groupBy.mockResolvedValue([
      { status: 'present', _count: { _all: 3 } },
      { status: 'late', _count: { _all: 1 } },
    ]);
    mockPrisma.generalMerchandiseAttendance.findMany.mockResolvedValue([
      { employeeId: 'GM-001' },
      { employeeId: 'GM-002' },
    ]);
    mockPrisma.generalMerchandiseExpense.aggregate.mockResolvedValue({
      _sum: { amount: 1500 },
    });
    mockPrisma.generalMerchandiseExpense.groupBy.mockResolvedValue([
      { category: 'Fuel', _sum: { amount: 500 } },
      { category: 'Supplies', _sum: { amount: 1000 } },
    ]);
    mockPrisma.generalMerchandisePayroll.aggregate
      .mockResolvedValueOnce({
        _sum: {
          grossPay: 10000,
          netPay: 8200,
          totalDeductions: 1800,
          cashAdvance: 500,
        },
        _count: { _all: 2 },
      })
      .mockResolvedValueOnce({
        _sum: { thirteenthMonthPay: 900 },
        _count: { _all: 1 },
      })
      .mockResolvedValueOnce({
        _sum: { thirteenthMonthPay: 600 },
      });
    mockPrisma.generalMerchandisePayroll.groupBy.mockResolvedValue([
      { status: 'paid', _count: { _all: 2 } },
    ]);
    mockPrisma.generalMerchandiseLeaveRequest.groupBy.mockResolvedValue([
      { status: 'approved', _count: { _all: 1 } },
    ]);
    mockPrisma.generalMerchandiseCashAdvanceRecord.aggregate.mockResolvedValue({
      _sum: { amount: 700, remainingBalance: 250 },
      _count: { _all: 2 },
    });
    mockPrisma.generalMerchandiseCashAdvanceRecord.groupBy.mockResolvedValue([
      { status: 'approved', _count: { _all: 2 } },
    ]);
    mockPrisma.generalMerchandiseThirteenthMonthPayRecord.aggregate
      .mockResolvedValueOnce({
        _sum: { thirteenthMonthPay: 900 },
        _count: { _all: 1 },
      })
      .mockResolvedValueOnce({
        _sum: { thirteenthMonthPay: 600 },
      });
    mockPrisma.generalMerchandiseThirteenthMonthPayRecord.groupBy.mockResolvedValue(
      [{ status: 'paid', _count: { _all: 1 } }]
    );
    mockPrisma.generalMerchandiseEmployee.count.mockResolvedValue(12);

    const response = await GET_DASHBOARD(
      new NextRequest(
        'http://localhost/api/general-merchandise/employees/dashboard?from=2026-03-31&to=2026-03-01'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.range).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    expect(body.attendance).toEqual(
      expect.objectContaining({
        totalRecords: 4,
        uniqueEmployees: 2,
        statusCounts: { present: 3, late: 1 },
      })
    );
    expect(body.expenses.categories).toEqual([
      { category: 'Supplies', amount: 1000 },
      { category: 'Fuel', amount: 500 },
    ]);
    expect(body.payroll.totalNet).toBe(8200);
    expect(body.cashAdvance.remainingBalance).toBe(250);
    expect(body.thirteenthMonth.totalPaid).toBe(600);
    expect(body.employees.totalRecords).toBe(12);
  });
});
