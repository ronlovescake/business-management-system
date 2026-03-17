import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockPrisma, mockSyncPayrollDeductions } = vi.hoisted(() => {
  return {
    mockPrisma: {
      generalMerchandisePayroll: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      generalMerchandiseExpense: {
        upsert: vi.fn(),
      },
      generalMerchandiseEmployee: {
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

vi.mock('@/lib/payroll/deductionsGeneralMerchandise', () => ({
  syncPayrollDeductionsGeneralMerchandise: mockSyncPayrollDeductions,
}));

import {
  GET,
  POST,
  PUT,
  DELETE,
} from '@/app/api/general-merchandise/payroll/route';

describe('General merchandise payroll API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback({
        generalMerchandisePayroll: mockPrisma.generalMerchandisePayroll,
      })
    );
  });

  const mockPayrolls = [
    {
      id: 'gm-payroll-1',
      employeeId: 'GM-001',
      employeeName: 'Gamma Worker',
      payPeriod: '2026-03-01 to 2026-03-15',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-15',
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
      approvedBy: null,
      approvedDate: null,
      paidDate: null,
      deletedAt: null,
    },
    {
      id: 'gm-payroll-2',
      employeeId: 'GM-002',
      employeeName: 'Delta Worker',
      payPeriod: '2026-03-01 to 2026-03-15',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-15',
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
      status: 'approved',
      bankGcash: '09171234567',
      unpaidDays: 0,
      dailyRate: 1154,
      deduction: 0,
      notes: null,
      approvedBy: 'Manager',
      approvedDate: '2026-03-16',
      paidDate: null,
      deletedAt: null,
    },
    {
      id: 'gm-payroll-3',
      employeeId: 'GM-003',
      employeeName: 'Paid Worker',
      payPeriod: '2026-03-01 to 2026-03-15',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-15',
      basicSalary: 10000,
      allowance: 0,
      overtime: 0,
      bonuses: 0,
      thirteenthMonth: 0,
      grossPay: 10000,
      sss: 800,
      philHealth: 400,
      pagIbig: 200,
      tax: 900,
      loans: 0,
      cashAdvance: 0,
      lwop: 0,
      absentsLates: 0,
      totalDeductions: 2300,
      netPay: 7700,
      status: 'paid',
      bankGcash: '09170000003',
      unpaidDays: 0,
      dailyRate: 769,
      deduction: 0,
      notes: null,
      approvedBy: 'Manager',
      approvedDate: '2026-03-16',
      paidDate: '2026-03-17',
      deletedAt: null,
    },
  ];

  const createMockRequest = (
    url: string = getTestApiUrl('/api/general-merchandise/payroll'),
    options: { method?: string; body?: unknown; headers?: HeadersInit } = {}
  ): NextRequest =>
    new NextRequest(url, {
      method: options.method || 'GET',
      headers: options.headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });

  it('fetches GM payrolls and syncs pending plus approved records', async () => {
    mockPrisma.generalMerchandisePayroll.findMany.mockResolvedValue(
      mockPayrolls
    );
    mockSyncPayrollDeductions.mockImplementation((payrolls) =>
      Promise.resolve(payrolls)
    );

    const response = await GET(createMockRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(3);
    expect(mockSyncPayrollDeductions).toHaveBeenCalledWith([
      mockPayrolls[0],
      mockPayrolls[1],
    ]);
  });

  it('creates a single GM payroll record', async () => {
    const newPayroll = {
      employeeId: 'GM-004',
      employeeName: 'New Worker',
      payPeriod: '2026-03-01 to 2026-03-15',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-15',
      basicSalary: 12000,
      grossPay: 12000,
      totalDeductions: 2500,
      netPay: 9500,
      bankGcash: '09181234567',
      status: 'pending',
    };

    mockPrisma.generalMerchandiseEmployee.findMany.mockResolvedValue([
      { employeeId: 'GM-004' },
    ]);
    mockPrisma.generalMerchandisePayroll.create.mockResolvedValue({
      id: 'gm-payroll-4',
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
      unpaidDays: 0,
      dailyRate: 0,
      deduction: 0,
      notes: null,
      approvedBy: null,
      approvedDate: null,
      paidDate: null,
      deletedAt: null,
      ...newPayroll,
    });

    const response = await POST(
      createMockRequest(undefined, { method: 'POST', body: newPayroll })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe('gm-payroll-4');
  });

  it('rejects GM payroll imports when employees are missing', async () => {
    mockPrisma.generalMerchandiseEmployee.findMany.mockResolvedValue([
      { employeeId: 'GM-004' },
    ]);

    const response = await POST(
      createMockRequest(undefined, {
        method: 'POST',
        body: [
          {
            employeeId: 'GM-004',
            employeeName: 'Known Worker',
            payPeriod: '2026-03-01 to 2026-03-15',
            periodStart: '2026-03-01',
            periodEnd: '2026-03-15',
            basicSalary: 10000,
            grossPay: 10000,
            totalDeductions: 0,
            netPay: 10000,
            bankGcash: '1',
          },
          {
            employeeId: 'GM-005',
            employeeName: 'Missing Worker',
            payPeriod: '2026-03-01 to 2026-03-15',
            periodStart: '2026-03-01',
            periodEnd: '2026-03-15',
            basicSalary: 10000,
            grossPay: 10000,
            totalDeductions: 0,
            netPay: 10000,
            bankGcash: '1',
          },
        ],
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Referenced employees not found');
  });

  it('syncs GM payroll to expenses when status changes to paid', async () => {
    mockPrisma.generalMerchandisePayroll.findUnique.mockResolvedValue(
      mockPayrolls[0]
    );
    mockPrisma.generalMerchandisePayroll.update.mockResolvedValue({
      ...mockPayrolls[0],
      status: 'paid',
      paidDate: '2026-03-17',
    });
    mockSyncPayrollDeductions.mockResolvedValue([
      {
        ...mockPayrolls[0],
        status: 'paid',
        paidDate: '2026-03-17',
      },
    ]);
    mockPrisma.generalMerchandiseExpense.upsert.mockResolvedValue({ id: 1 });

    const response = await PUT(
      createMockRequest(undefined, {
        method: 'PUT',
        headers: { 'x-user-name': 'GM Manager' },
        body: { id: 'gm-payroll-1', status: 'paid', paidDate: '2026-03-17' },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockPrisma.generalMerchandiseExpense.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          category: 'Payroll',
          employeeName: 'GM Manager',
          sourceType: 'PAYROLL',
          sourceId: 'gm-payroll-1',
        }),
      })
    );
  });

  it('soft deletes GM payroll records by default', async () => {
    mockPrisma.generalMerchandisePayroll.update.mockResolvedValue({
      id: 'gm-payroll-1',
    });

    const response = await DELETE(
      createMockRequest(
        getTestApiUrl('/api/general-merchandise/payroll', {
          id: 'gm-payroll-1',
        }),
        { method: 'DELETE' }
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockPrisma.generalMerchandisePayroll.update).toHaveBeenCalledWith({
      where: { id: 'gm-payroll-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
