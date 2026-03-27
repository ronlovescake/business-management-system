import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  truckingInvoice: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  truckingPaymentAllocation: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: {
    number: vi.fn((value: unknown) => Number(value ?? 0)),
  },
}));

import { DELETE, GET, PATCH, POST } from '@/app/api/trucking/invoices/route';

describe('Trucking invoices API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters trucking invoices by customer and status', async () => {
    mockPrisma.truckingInvoice.findMany.mockResolvedValue([{ id: 'inv-1' }]);

    const response = await GET(
      new NextRequest(
        'http://localhost/api/trucking/invoices?customerId=12&status=sent'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0].id).toBe('inv-1');
    expect(mockPrisma.truckingInvoice.findMany).toHaveBeenCalledWith({
      where: {
        customerId: 12,
        status: 'SENT',
      },
      include: { allocations: true },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
    });
  });

  it('creates a trucking invoice', async () => {
    mockPrisma.truckingInvoice.create.mockResolvedValue({ id: 'inv-2' });

    const response = await POST(
      new NextRequest('http://localhost/api/trucking/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 12,
          cutoffStart: '2026-03-01',
          cutoffEnd: '2026-03-15',
          invoiceDate: '2026-03-16',
          totalAmount: 1500,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe('inv-2');
  });

  it('requires an id for invoice patches', async () => {
    const response = await PATCH(
      new NextRequest('http://localhost/api/trucking/invoices', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'paid' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('id is required');
  });

  it('deletes invoice allocations before deleting the trucking invoice', async () => {
    mockPrisma.truckingPaymentAllocation.deleteMany.mockResolvedValue({
      count: 1,
    });
    mockPrisma.truckingInvoice.delete.mockResolvedValue({ id: 'inv-3' });

    const response = await DELETE(
      new NextRequest('http://localhost/api/trucking/invoices?id=inv-3', {
        method: 'DELETE',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(
      mockPrisma.truckingPaymentAllocation.deleteMany
    ).toHaveBeenCalledWith({
      where: { invoiceId: 'inv-3' },
    });
    expect(mockPrisma.truckingInvoice.delete).toHaveBeenCalledWith({
      where: { id: 'inv-3' },
    });
  });
});
