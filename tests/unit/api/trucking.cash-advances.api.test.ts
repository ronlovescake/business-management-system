import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

const mockCashAdvanceService = vi.hoisted(() => ({
  findAll: vi.fn(),
  findWithFilters: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/modules/trucking/employees/cash-advance/api/service', () => ({
  cashAdvanceService: mockCashAdvanceService,
}));

import { GET, POST, PUT, DELETE } from '@/app/api/trucking/cash-advances/route';

describe('Trucking Cash Advances API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cash advances with ApiResponse envelope', async () => {
    mockCashAdvanceService.findAll.mockResolvedValue([
      {
        id: 'trak1',
        employeeId: 'driver-1',
        employeeName: 'Driver One',
        amount: new Prisma.Decimal(1500),
        termsMonths: 2,
        monthlyPayment: new Prisma.Decimal(750),
        settledAmount: new Prisma.Decimal(0),
        remainingBalance: new Prisma.Decimal(1500),
        purpose: 'Fuel loan',
        notes: null,
        requestDate: new Date('2025-01-10'),
        status: 'approved',
        approvedBy: 'dispatcher',
        approvedDate: new Date('2025-01-11'),
        rejectedBy: null,
        rejectedDate: null,
        rejectionReason: null,
        deductionCycle: 'FIRST_HALF',
        nextDeductionDate: new Date('2025-01-15'),
        lastDeductedDate: null,
        createdAt: new Date('2025-01-10'),
        updatedAt: new Date('2025-01-11'),
      },
    ]);

    const request = new NextRequest(
      'http://localhost/api/trucking/cash-advances'
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data?.[0].employeeName).toBe('Driver One');
    expect(mockCashAdvanceService.findAll).toHaveBeenCalledTimes(1);
  });

  it('validates query filters before calling service', async () => {
    mockCashAdvanceService.findWithFilters.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/trucking/cash-advances?employeeId=driver-9'
    );
    await GET(request);

    expect(mockCashAdvanceService.findWithFilters).toHaveBeenCalledWith({
      employeeId: 'driver-9',
    });
  });
});

describe('Trucking Cash Advances API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a cash advance and returns ApiResponse', async () => {
    const mockRecord = {
      id: 'trak1',
      employeeId: 'driver-7',
      employeeName: 'Driver Seven',
      amount: new Prisma.Decimal(2000),
      termsMonths: null,
      monthlyPayment: null,
      settledAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(2000),
      purpose: null,
      notes: null,
      requestDate: new Date('2025-02-01'),
      status: 'pending',
      approvedBy: null,
      approvedDate: null,
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: null,
      nextDeductionDate: null,
      lastDeductedDate: null,
      createdAt: new Date('2025-02-01'),
      updatedAt: new Date('2025-02-01'),
    };

    mockCashAdvanceService.create.mockResolvedValue(mockRecord);

    const request = new NextRequest(
      'http://localhost/api/trucking/cash-advances',
      {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'driver-7',
          employeeName: 'Driver Seven',
          amount: 2000,
        }),
      }
    );

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data?.employeeName).toBe('Driver Seven');
    expect(mockCashAdvanceService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'driver-7',
        amount: 2000,
      })
    );
  });
});

describe('Trucking Cash Advances API - PUT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when ID is missing', async () => {
    const request = new NextRequest(
      'http://localhost/api/trucking/cash-advances',
      {
        method: 'PUT',
        body: JSON.stringify({ amount: 500 }),
      }
    );

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Cash advance ID is required');
    expect(mockCashAdvanceService.update).not.toHaveBeenCalled();
  });
});

describe('Trucking Cash Advances API - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a cash advance ID', async () => {
    const request = new NextRequest(
      'http://localhost/api/trucking/cash-advances'
    );

    const response = await DELETE(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Cash advance ID is required');
    expect(mockCashAdvanceService.delete).not.toHaveBeenCalled();
  });

  it('deletes a cash advance successfully', async () => {
    mockCashAdvanceService.delete.mockResolvedValue(undefined);

    const request = new NextRequest(
      'http://localhost/api/trucking/cash-advances?id=trak1'
    );

    const response = await DELETE(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.id).toBe('trak1');
    expect(mockCashAdvanceService.delete).toHaveBeenCalledWith('trak1');
  });
});
