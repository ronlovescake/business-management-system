import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    generalMerchandisePayroll: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    generalMerchandiseAttendance: {
      findMany: vi.fn(),
    },
    generalMerchandiseEmployee: {
      findMany: vi.fn(),
    },
    generalMerchandiseThirteenthMonthPayRecord: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

import { POST } from '@/app/api/general-merchandise/payroll/generate/route';

const createMockRequest = (body?: unknown): NextRequest =>
  new NextRequest(
    'https://test.local/api/general-merchandise/payroll/generate',
    {
      method: 'POST',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }
  );

describe('General merchandise payroll generation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const attendance = [
    { employeeId: 'GM-001', employeeName: 'Gamma Worker', totalHours: 72 },
    { employeeId: 'GM-002', employeeName: 'Delta Worker', totalHours: 80 },
  ];

  const employees = [
    {
      employeeId: 'GM-001',
      name: 'Gamma Worker',
      basicSalary: 26000,
      currentSalary: 26000,
      allowance: 0,
      sssMonthlyContribution: 1125,
      philHealthMonthlyContribution: 500,
      pagibigMonthlyContribution: 200,
      taxMonthlyContribution: 1500,
      bankAccount: '1234567890',
      gcashAccount: null,
    },
    {
      employeeId: 'GM-002',
      name: 'Delta Worker',
      basicSalary: 30000,
      currentSalary: 30000,
      allowance: 1000,
      sssMonthlyContribution: 1350,
      philHealthMonthlyContribution: 600,
      pagibigMonthlyContribution: 200,
      taxMonthlyContribution: 2000,
      bankAccount: null,
      gcashAccount: '09171234567',
    },
  ];

  it('generates GM payroll successfully for the current period', async () => {
    mockPrisma.generalMerchandisePayroll.findMany.mockResolvedValue([]);
    mockPrisma.generalMerchandiseAttendance.findMany.mockResolvedValue(
      attendance
    );
    mockPrisma.generalMerchandiseEmployee.findMany.mockResolvedValue(employees);
    mockPrisma.generalMerchandiseThirteenthMonthPayRecord.findMany.mockResolvedValue(
      []
    );
    mockPrisma.generalMerchandisePayroll.createMany.mockResolvedValue({
      count: 2,
    });

    const response = await POST(createMockRequest());
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.count).toBe(2);
    expect(data.data.period).toEqual({
      start: '2026-03-16',
      end: '2026-03-31',
      label: '2026-03-16 to 2026-03-31',
    });
  });

  it('returns conflict when active payroll already exists for the period', async () => {
    mockPrisma.generalMerchandisePayroll.findMany.mockResolvedValue([
      {
        id: 'gm-payroll-1',
        deletedAt: null,
        employeeId: 'GM-001',
        employeeName: 'Gamma Worker',
      },
      {
        id: 'gm-payroll-2',
        deletedAt: null,
        employeeId: 'GM-002',
        employeeName: 'Delta Worker',
      },
    ]);
    mockPrisma.generalMerchandiseAttendance.findMany.mockResolvedValue(
      attendance
    );

    const response = await POST(createMockRequest());
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Payroll already exists for this period');
  });

  it('uses requested GM period overrides and validates dates', async () => {
    const badResponse = await POST(
      createMockRequest({ periodStart: 'bad-date', periodEnd: '2026-03-31' })
    );
    const badData = await badResponse.json();

    expect(badResponse.status).toBe(400);
    expect(badData.validationErrors.period).toBeDefined();
  });
});
