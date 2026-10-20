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
    findMany: vi.fn(),
  },
  generalMerchandiseExpense: {
    findMany: vi.fn(),
  },
  generalMerchandisePayroll: {
    findMany: vi.fn(),
  },
  generalMerchandiseLeaveRequest: {
    findMany: vi.fn(),
  },
  generalMerchandiseCashAdvanceRecord: {
    findMany: vi.fn(),
  },
  generalMerchandiseThirteenthMonthPayRecord: {
    findMany: vi.fn(),
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
    const attendanceRow = (
      employeeId: string,
      date: string,
      status: string
    ) => ({
      employeeId,
      employeeName: employeeId,
      department: 'Operations',
      date,
      status,
      totalHours: 8,
    });
    mockPrisma.generalMerchandiseAttendance.findMany.mockResolvedValue([
      attendanceRow('GM-001', '2026-03-02', 'present'),
      attendanceRow('GM-001', '2026-03-03', 'present'),
      attendanceRow('GM-002', '2026-03-02', 'present'),
      attendanceRow('GM-002', '2026-03-03', 'late'),
    ]);
    mockPrisma.generalMerchandisePayroll.findMany.mockResolvedValue([
      {
        employeeId: 'GM-001',
        employeeName: 'GM-001',
        periodStart: '2026-03-01',
        status: 'paid',
        basicSalary: 5000,
        allowance: 0,
        overtime: 0,
        bonuses: 0,
        grossPay: 5000,
        sss: 0,
        philHealth: 0,
        pagIbig: 0,
        tax: 0,
        loans: 0,
        lwop: 0,
        absentsLates: 0,
        cashAdvance: 500,
        totalDeductions: 900,
        netPay: 4100,
      },
    ]);
    mockPrisma.generalMerchandiseLeaveRequest.findMany.mockResolvedValue([
      {
        id: 1,
        employeeName: 'GM-002',
        leaveType: 'Sick',
        startDate: '2026-03-10',
        endDate: '2026-03-10',
        numberOfDays: 1,
        status: 'approved',
      },
    ]);
    const cashAdvance = {
      id: 'gm-ca-1',
      employeeId: 'GM-001',
      employeeName: 'GM-001',
      amount: 700,
      remainingBalance: 250,
      monthlyPayment: 100,
      status: 'approved',
    };
    mockPrisma.generalMerchandiseCashAdvanceRecord.findMany
      .mockResolvedValueOnce([cashAdvance])
      .mockResolvedValueOnce([cashAdvance]);
    mockPrisma.generalMerchandiseThirteenthMonthPayRecord.findMany.mockResolvedValue(
      [
        { thirteenthMonthPay: 600, status: 'paid' },
        { thirteenthMonthPay: 300, status: 'calculated' },
      ]
    );
    mockPrisma.generalMerchandiseEmployee.findMany.mockResolvedValue([
      {
        employeeId: 'GM-001',
        name: 'GM-001',
        department: 'Operations',
        position: 'Picker',
        status: 'active',
        employmentStatus: 'Regular',
        hireDate: '2026-03-15',
        employmentEndDate: null,
      },
    ]);

    const response = await GET_DASHBOARD(
      new NextRequest(
        'http://localhost/api/general-merchandise/employees/dashboard?from=2026-03-31&to=2026-03-01'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(
      mockPrisma.generalMerchandiseLeaveRequest.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    );
    expect(body.range).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    expect(body.attendance).toEqual(
      expect.objectContaining({
        totalRecords: 4,
        uniqueEmployees: 2,
        statusCounts: { present: 3, late: 1 },
      })
    );
    expect(body).not.toHaveProperty('expenses');
    expect(
      mockPrisma.generalMerchandiseExpense.findMany
    ).not.toHaveBeenCalled();
    expect(body.payroll.totalNet).toBe(4100);
    expect(body.leaves.totalRequests).toBe(1);
    expect(body.cashAdvance.outstandingBalance).toBe(250);
    expect(body.thirteenthMonth).toMatchObject({
      totalAccrued: 900,
      totalPaid: 600,
    });
    expect(body.team).toMatchObject({ headcount: 1, newHires: 1 });
  });
});
