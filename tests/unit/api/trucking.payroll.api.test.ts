import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockPrisma, mockSyncTruckingPayrollDeductions } = vi.hoisted(() => ({
  mockPrisma: {
    truckingPayroll: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    truckingEmployee: {
      findMany: vi.fn(),
    },
    truckingExpense: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockSyncTruckingPayrollDeductions: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/payroll/trucking/deductions', () => ({
  syncTruckingPayrollDeductions: mockSyncTruckingPayrollDeductions,
}));

import { DELETE, GET, POST, PUT } from '@/app/api/trucking/payroll/route';

describe('Trucking payroll API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback({
        truckingPayroll: mockPrisma.truckingPayroll,
        truckingEmployee: mockPrisma.truckingEmployee,
        truckingExpense: mockPrisma.truckingExpense,
      })
    );
  });

  const basePayroll = {
    employeeId: 'DRV-001',
    employeeName: 'Driver One',
    payPeriod: '2026-03-01 to 2026-03-15',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-15',
    basicSalary: 12000,
    allowance: 0,
    overtime: 0,
    bonuses: 0,
    thirteenthMonth: 0,
    grossPay: 12000,
    sss: 0,
    philHealth: 0,
    pagIbig: 0,
    tax: 0,
    loans: 0,
    cashAdvance: 0,
    lwop: 0,
    absentsLates: 0,
    totalDeductions: 0,
    netPay: 12000,
    bankGcash: '09170000001',
    approvedBy: null,
    approvedDate: null,
    paidDate: null,
    unpaidDays: 0,
    dailyRate: 800,
    deduction: 0,
    notes: null,
    deletedAt: null,
  };

  const createMockRequest = (
    url: string = getTestApiUrl('/api/trucking/payroll'),
    options: { method?: string; body?: unknown; headers?: HeadersInit } = {}
  ): NextRequest =>
    new NextRequest(url, {
      method: options.method || 'GET',
      headers: options.headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });

  it('fetches payrolls and syncs only pending trucking records', async () => {
    const pendingPayroll = {
      id: 'truck-payroll-1',
      status: 'pending',
      ...basePayroll,
    };
    const paidPayroll = {
      id: 'truck-payroll-2',
      status: 'paid',
      ...basePayroll,
      employeeId: 'DRV-002',
      employeeName: 'Driver Two',
    };

    mockPrisma.truckingPayroll.findMany.mockResolvedValue([
      pendingPayroll,
      paidPayroll,
    ]);
    mockSyncTruckingPayrollDeductions.mockResolvedValue([
      { ...pendingPayroll, totalDeductions: 1250 },
    ]);

    const response = await GET(createMockRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(2);
    expect(mockSyncTruckingPayrollDeductions).toHaveBeenCalledWith([
      pendingPayroll,
    ]);
  });

  it('creates a paid trucking payroll and syncs the payroll expense', async () => {
    const requestBody = {
      ...basePayroll,
      status: 'paid',
      paidDate: '2026-03-16',
    };
    const createdPayroll = {
      id: 'truck-payroll-3',
      ...requestBody,
    };

    mockPrisma.truckingEmployee.findMany.mockResolvedValue([
      { employeeId: 'DRV-001' },
    ]);
    mockPrisma.truckingPayroll.create.mockResolvedValue(createdPayroll);
    mockPrisma.truckingExpense.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.truckingExpense.create.mockResolvedValue({ id: 'exp-1' });

    const response = await POST(
      createMockRequest(undefined, { method: 'POST', body: requestBody })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe('truck-payroll-3');
    expect(mockPrisma.truckingExpense.deleteMany).toHaveBeenCalledWith({
      where: {
        sourceType: 'PAYROLL',
        sourceId: 'truck-payroll-3',
        sourceLineKey: 'netPay:DRV-001',
      },
    });
    expect(mockPrisma.truckingExpense.create).toHaveBeenCalled();
  });

  it('bulk imports paid trucking payrolls and syncs their expenses', async () => {
    const paidRecord = {
      ...basePayroll,
      status: 'paid',
      paidDate: '2026-03-16',
    };
    const createdPayroll = {
      id: 'truck-payroll-4',
      ...paidRecord,
    };

    mockPrisma.truckingEmployee.findMany.mockResolvedValue([
      { employeeId: 'DRV-001' },
    ]);
    mockPrisma.truckingPayroll.create.mockResolvedValue(createdPayroll);
    mockPrisma.truckingExpense.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.truckingExpense.create.mockResolvedValue({ id: 'exp-2' });

    const response = await POST(
      createMockRequest(undefined, { method: 'POST', body: [paidRecord] })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.count).toBe(1);
    expect(payload.data.records[0].id).toBe('truck-payroll-4');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.truckingExpense.create).toHaveBeenCalledTimes(1);
  });

  it('marks a trucking payroll as paid and syncs the expense record', async () => {
    const existingPayroll = {
      id: 'truck-payroll-5',
      status: 'pending',
      ...basePayroll,
    };
    const updatedPayroll = {
      ...existingPayroll,
      status: 'paid',
      paidDate: '2026-03-16',
    };

    mockPrisma.truckingPayroll.findUnique.mockResolvedValue(existingPayroll);
    mockPrisma.truckingPayroll.update.mockResolvedValue(updatedPayroll);
    mockSyncTruckingPayrollDeductions.mockResolvedValue([updatedPayroll]);
    mockPrisma.truckingExpense.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.truckingExpense.create.mockResolvedValue({ id: 'exp-3' });

    const response = await PUT(
      createMockRequest(undefined, {
        method: 'PUT',
        body: {
          id: 'truck-payroll-5',
          status: 'paid',
          paidDate: '2026-03-16',
        },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe('truck-payroll-5');
    expect(mockSyncTruckingPayrollDeductions).toHaveBeenCalledWith([
      updatedPayroll,
    ]);
    expect(mockPrisma.truckingExpense.create).toHaveBeenCalledTimes(1);
  });

  it('soft deletes a trucking payroll record', async () => {
    mockPrisma.truckingPayroll.update.mockResolvedValue({
      id: 'truck-payroll-6',
      deletedAt: new Date('2026-03-20T00:00:00Z'),
    });

    const response = await DELETE(
      createMockRequest(
        getTestApiUrl('/api/trucking/payroll', { id: 'truck-payroll-6' }),
        {
          method: 'DELETE',
        }
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockPrisma.truckingPayroll.update).toHaveBeenCalledWith({
      where: { id: 'truck-payroll-6' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
