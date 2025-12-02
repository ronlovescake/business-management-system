import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, PUT } from '@/app/api/transactions/[id]/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    transaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
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

type RouteContext = {
  params: {
    id: string;
  };
};

const buildContext = (id: string): RouteContext => ({
  params: { id },
});

describe('/api/transactions/[id] DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.transaction.findUnique.mockReset();
    mockPrisma.transaction.update.mockReset();
  });

  it('soft deletes a transaction', async () => {
    mockPrisma.transaction.findUnique.mockResolvedValueOnce({
      id: 1,
      deletedAt: null,
      customers: 'Acme',
      productCode: 'SKU-1',
    });
    mockPrisma.transaction.update.mockResolvedValueOnce({ id: 1 });

    const request = new NextRequest(getTestApiUrl('/api/transactions/1'), {
      method: 'DELETE',
    });

    const response = await DELETE(request, buildContext('1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(1);
  });

  it('returns 400 for invalid id', async () => {
    const request = new NextRequest(getTestApiUrl('/api/transactions/abc'), {
      method: 'DELETE',
    });

    const response = await DELETE(request, buildContext('abc'));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Invalid transaction ID');
  });

  it('returns 404 when transaction missing', async () => {
    mockPrisma.transaction.findUnique.mockResolvedValueOnce(null);

    const request = new NextRequest(getTestApiUrl('/api/transactions/123'), {
      method: 'DELETE',
    });

    const response = await DELETE(request, buildContext('123'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Transaction not found');
  });

  it('returns 400 when already deleted', async () => {
    mockPrisma.transaction.findUnique.mockResolvedValueOnce({
      id: 1,
      deletedAt: new Date(),
      customers: 'Acme',
      productCode: 'SKU-1',
    });

    const request = new NextRequest(getTestApiUrl('/api/transactions/1'), {
      method: 'DELETE',
    });

    const response = await DELETE(request, buildContext('1'));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Transaction already deleted');
  });

  it('returns 500 when delete fails', async () => {
    mockPrisma.transaction.findUnique.mockResolvedValueOnce({
      id: 1,
      deletedAt: null,
      customers: 'Acme',
      productCode: 'SKU-1',
    });
    mockPrisma.transaction.update.mockRejectedValueOnce(
      new Error('Database offline')
    );

    const request = new NextRequest(getTestApiUrl('/api/transactions/1'), {
      method: 'DELETE',
    });

    const response = await DELETE(request, buildContext('1'));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('An unexpected error occurred');
    expect(payload.details).toBe('Database offline');
  });
});

describe('/api/transactions/[id] PUT?action=restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.transaction.findUnique.mockReset();
    mockPrisma.transaction.update.mockReset();
  });

  it('restores a deleted transaction', async () => {
    mockPrisma.transaction.findUnique.mockResolvedValueOnce({
      id: 99,
      deletedAt: new Date(),
      customers: 'Beta',
      productCode: 'SKU-9',
    });
    mockPrisma.transaction.update.mockResolvedValueOnce({ id: 99 });

    const request = new NextRequest(
      getTestApiUrl('/api/transactions/99', { action: 'restore' }),
      { method: 'PUT' }
    );

    const response = await PUT(request, buildContext('99'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(99);
  });

  it('rejects missing restore action', async () => {
    const request = new NextRequest(getTestApiUrl('/api/transactions/1'), {
      method: 'PUT',
    });

    const response = await PUT(request, buildContext('1'));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('Invalid action');
  });

  it('returns 400 when transaction is not deleted', async () => {
    mockPrisma.transaction.findUnique.mockResolvedValueOnce({
      id: 22,
      deletedAt: null,
      customers: 'Acme',
      productCode: 'SKU-3',
    });

    const request = new NextRequest(
      getTestApiUrl('/api/transactions/22', { action: 'restore' }),
      { method: 'PUT' }
    );

    const response = await PUT(request, buildContext('22'));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Transaction is not deleted');
  });

  it('returns 500 when restore fails', async () => {
    mockPrisma.transaction.findUnique.mockResolvedValueOnce({
      id: 77,
      deletedAt: new Date(),
      customers: 'Delta',
      productCode: 'SKU-7',
    });
    mockPrisma.transaction.update.mockRejectedValueOnce(
      new Error('Database offline')
    );

    const request = new NextRequest(
      getTestApiUrl('/api/transactions/77', { action: 'restore' }),
      { method: 'PUT' }
    );

    const response = await PUT(request, buildContext('77'));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('An unexpected error occurred');
    expect(payload.details).toBe('Database offline');
  });
});
