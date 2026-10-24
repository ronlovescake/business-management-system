import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  invoice: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
  },
  generalMerchandiseInvoice: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
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

import { DELETE, GET, POST, PUT } from '@/app/api/invoices/route';
import { POST as POSTGeneralMerchandise } from '@/app/api/general-merchandise/invoices/route';

describe('Invoices API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (operation: (tx: typeof mockPrisma) => Promise<unknown>) =>
        operation(mockPrisma)
    );
  });

  const createMockRequest = (
    url: string = getTestApiUrl('/api/invoices'),
    options: { method?: string; body?: unknown } = {}
  ) =>
    new NextRequest(url, {
      method: options.method || 'GET',
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });

  it('fetches invoices using the standardized success envelope', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', customerName: 'Customer One', deletedAt: null },
    ]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data[0].id).toBe('inv-1');
  });

  it('rejects invoice replacement requests with a non-array payload', async () => {
    const response = await POST(
      createMockRequest(undefined, {
        method: 'POST',
        body: { invoices: 'invalid' },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid request: invoices must be an array');
  });

  it('replaces invoices and returns the refreshed records', async () => {
    mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.invoice.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-2', customerName: 'Customer Two', deletedAt: null },
      { id: 'inv-3', customerName: 'Customer Three', deletedAt: null },
    ]);

    const response = await POST(
      createMockRequest(undefined, {
        method: 'POST',
        body: {
          invoices: [
            { customerName: 'Customer Two', tickbox: true },
            { customerName: 'Customer Three', actualWeight: '10kg' },
          ],
        },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.count).toBe(2);
    expect(payload.data.data).toHaveLength(2);
    expect(mockPrisma.invoice.updateMany).toHaveBeenCalled();
    expect(mockPrisma.invoice.createMany).toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    { customerName: '' },
    { customerName: 'Valid', tickbox: 'yes' },
  ])(
    'rejects malformed replacement rows before deleting invoices: %j',
    async (invoice) => {
      const response = await POST(
        createMockRequest(undefined, {
          method: 'POST',
          body: { invoices: [invoice] },
        })
      );
      expect(response.status).toBe(400);
      expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    }
  );

  it.each([
    [
      'clothing',
      POST,
      mockPrisma.invoice,
      mockPrisma.generalMerchandiseInvoice,
    ],
    [
      'GM',
      POSTGeneralMerchandise,
      mockPrisma.generalMerchandiseInvoice,
      mockPrisma.invoice,
    ],
  ] as const)(
    'replaces %s invoices through one isolated transaction',
    async (_domain, post, model, otherModel) => {
      model.updateMany.mockResolvedValue({ count: 1 });
      model.createMany.mockResolvedValue({ count: 1 });
      model.findMany.mockResolvedValue([
        { id: 'new', customerName: 'Customer' },
      ]);
      const response = await post(
        createMockRequest(undefined, {
          method: 'POST',
          body: { invoices: [{ customerName: 'Customer' }] },
        })
      );
      expect(response.status).toBe(200);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' }
      );
      expect(otherModel.updateMany).not.toHaveBeenCalled();
      expect(otherModel.createMany).not.toHaveBeenCalled();
    }
  );

  it('requires an ID when updating an invoice', async () => {
    const response = await PUT(
      createMockRequest(undefined, {
        method: 'PUT',
        body: { customerName: 'Missing ID' },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('ID is required');
  });

  it('soft deletes an invoice using the standardized success response', async () => {
    mockPrisma.invoice.update.mockResolvedValue({
      id: 'inv-4',
      deletedAt: new Date('2026-03-27T00:00:00Z'),
    });

    const response = await DELETE(
      createMockRequest(getTestApiUrl('/api/invoices', { id: 'inv-4' }), {
        method: 'DELETE',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-4' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
