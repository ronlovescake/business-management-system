import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/customers/[id]/transactions/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      customer: {
        findUnique: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Customer Transactions API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns transactions for a customer', async () => {
    const transactions = [
      {
        id: 1,
        orderDate: '2024-01-01',
        customers: 'John Doe',
        productCode: 'PROD-1',
        quantity: 10,
        unitPrice: 1000,
        discount: 0,
        adjustment: 0,
        lineTotal: 10000,
        orderStatus: 'Delivered',
        notes: null,
        invoiceDate: null,
        packedDate: null,
        shipmentCode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockPrisma.customer.findUnique.mockResolvedValue({
      customerName: 'John Doe',
    });
    mockPrisma.transaction.findMany.mockResolvedValue(transactions);

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/1/transactions')),
      {
        params: { id: '1' },
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Customer transactions fetched');
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data[0].id).toBe(1);
  });

  it('returns 400 when customer ID is invalid', async () => {
    const response = await GET(
      new NextRequest(
        getTestApiUrl('/api/customers/not-a-number/transactions')
      ),
      { params: { id: 'not-a-number' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Invalid customer ID');
  });

  it('returns 404 when customer is missing', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue(null);

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/999/transactions')),
      {
        params: { id: '999' },
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Customer not found');
    expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('returns 500 when database call fails', async () => {
    mockPrisma.customer.findUnique.mockRejectedValue(
      new Error('Database unreachable')
    );

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/2/transactions')),
      {
        params: { id: '2' },
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('An unexpected error occurred');
    expect(payload.details).toBe('Database unreachable');
  });
});
