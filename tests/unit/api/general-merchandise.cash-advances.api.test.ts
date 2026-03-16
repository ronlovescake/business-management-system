import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseCashAdvanceRecord: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  DELETE,
  GET,
  POST,
} from '@/app/api/general-merchandise/cash-advances/route';

describe('General Merchandise Cash Advances API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns GM cash advances through the shared route factory service', async () => {
    mockPrisma.generalMerchandiseCashAdvanceRecord.findMany.mockResolvedValue([
      {
        id: 'gm-ca-1',
        employeeId: 'gm-1',
        employeeName: 'GM One',
        amount: new Prisma.Decimal(900),
        termsMonths: 3,
        monthlyPayment: new Prisma.Decimal(300),
        settledAmount: new Prisma.Decimal(0),
        remainingBalance: new Prisma.Decimal(900),
        purpose: 'Inventory float',
        notes: null,
        requestDate: new Date('2025-02-01'),
        status: 'approved',
        approvedBy: 'manager',
        approvedDate: new Date('2025-02-02'),
        rejectedBy: null,
        rejectedDate: null,
        rejectionReason: null,
        deductionCycle: 'FIRST_HALF',
        nextDeductionDate: new Date('2025-02-15'),
        lastDeductedDate: null,
        createdAt: new Date('2025-02-01'),
        updatedAt: new Date('2025-02-02'),
      },
    ]);

    const request = new NextRequest(
      'http://localhost/api/general-merchandise/cash-advances'
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].employeeName).toBe('GM One');
    expect(
      mockPrisma.generalMerchandiseCashAdvanceRecord.findMany
    ).toHaveBeenCalledWith({
      orderBy: { requestDate: 'desc' },
    });
  });

  it('creates a GM cash advance record', async () => {
    mockPrisma.generalMerchandiseCashAdvanceRecord.create.mockResolvedValue({
      id: 'gm-ca-2',
      employeeId: 'gm-2',
      employeeName: 'GM Two',
      amount: new Prisma.Decimal(1200),
      termsMonths: null,
      monthlyPayment: null,
      settledAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(1200),
      purpose: null,
      notes: null,
      requestDate: new Date('2025-02-03'),
      status: 'pending',
      approvedBy: null,
      approvedDate: null,
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: null,
      nextDeductionDate: null,
      lastDeductedDate: null,
      createdAt: new Date('2025-02-03'),
      updatedAt: new Date('2025-02-03'),
    });

    const request = new NextRequest(
      'http://localhost/api/general-merchandise/cash-advances',
      {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'gm-2',
          employeeName: 'GM Two',
          amount: 1200,
        }),
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('gm-ca-2');
    expect(
      mockPrisma.generalMerchandiseCashAdvanceRecord.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 'gm-2',
        amount: 1200,
      }),
    });
  });

  it('requires an ID for GM cash advance deletion', async () => {
    const request = new NextRequest(
      'http://localhost/api/general-merchandise/cash-advances'
    );

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Cash advance ID is required');
    expect(
      mockPrisma.generalMerchandiseCashAdvanceRecord.delete
    ).not.toHaveBeenCalled();
  });
});
