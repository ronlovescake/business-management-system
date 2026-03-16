import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseThirteenthMonthPayRecord: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: {
    name: vi.fn((value: unknown) => String(value ?? '')),
    number: vi.fn((value: unknown) => Number(value)),
  },
}));

import {
  GET,
  PATCH,
} from '@/app/api/general-merchandise/thirteenth-month-pay/route';
import { PATCH as PATCH_STATUS } from '@/app/api/general-merchandise/thirteenth-month-pay/[recordId]/status/route';

describe('General Merchandise Thirteenth Month Pay API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters GM records by employee, year, and status', async () => {
    mockPrisma.generalMerchandiseThirteenthMonthPayRecord.findMany.mockResolvedValue(
      []
    );

    const request = new NextRequest(
      'http://localhost/api/general-merchandise/thirteenth-month-pay?employeeId=gm-1&year=2025&status=approved'
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(
      mockPrisma.generalMerchandiseThirteenthMonthPayRecord.findMany
    ).toHaveBeenCalledWith({
      where: {
        employeeId: 'gm-1',
        year: 2025,
        status: 'approved',
      },
      orderBy: [{ employeeName: 'asc' }, { year: 'desc' }],
    });
  });

  it('creates a new GM record when the recordId does not exist', async () => {
    mockPrisma.generalMerchandiseThirteenthMonthPayRecord.findFirst.mockResolvedValue(
      null
    );
    mockPrisma.generalMerchandiseThirteenthMonthPayRecord.create.mockResolvedValue(
      {
        id: 'gm-13-1',
        recordId: 'record-1',
        employeeId: 'gm-1',
        employeeName: 'GM One',
        year: 2025,
        status: 'pending',
      }
    );

    const request = new NextRequest(
      'http://localhost/api/general-merchandise/thirteenth-month-pay',
      {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'record-1',
          employeeId: 'gm-1',
          employeeName: 'GM One',
          year: 2025,
          status: 'pending',
        }),
      }
    );

    const response = await PATCH(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recordId).toBe('record-1');
    expect(
      mockPrisma.generalMerchandiseThirteenthMonthPayRecord.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recordId: 'record-1',
        employeeId: 'gm-1',
      }),
    });
  });

  it('updates GM record status by recordId', async () => {
    mockPrisma.generalMerchandiseThirteenthMonthPayRecord.findFirst.mockResolvedValue(
      {
        id: 'gm-13-2',
        recordId: 'record-2',
        approvedDate: null,
        paidDate: null,
      }
    );
    mockPrisma.generalMerchandiseThirteenthMonthPayRecord.update.mockResolvedValue(
      {
        id: 'gm-13-2',
        recordId: 'record-2',
        status: 'approved',
      }
    );

    const request = new NextRequest(
      'http://localhost/api/general-merchandise/thirteenth-month-pay/record-2/status',
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      }
    );

    const response = await PATCH_STATUS(request, {
      params: { recordId: 'record-2' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('approved');
    expect(
      mockPrisma.generalMerchandiseThirteenthMonthPayRecord.update
    ).toHaveBeenCalledWith({
      where: { id: 'gm-13-2' },
      data: expect.objectContaining({
        status: 'approved',
        approvedDate: expect.any(String),
      }),
    });
  });
});
