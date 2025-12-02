import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/customers/[id]/additional-info/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      customer: {
        findUnique: vi.fn(),
      },
      additionalCustomerInfo: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        createMany: vi.fn(),
      },
      $transaction: vi.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations)
      ),
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
    debug: vi.fn(),
  },
}));

type AdditionalInfoRecord = {
  id: number;
  customerId: number;
  type: string;
  value: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const buildInfoRecord = (
  overrides: Partial<AdditionalInfoRecord> = {}
): AdditionalInfoRecord => ({
  id: 1,
  customerId: 1,
  type: 'address',
  value: '123 Main St',
  deletedAt: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('Customer Additional Info API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (operations: Promise<unknown>[]) => Promise.all(operations)
    );
  });

  it('returns grouped additional info for a valid customer', async () => {
    mockPrisma.customer.findUnique.mockResolvedValueOnce({ id: 1 });
    mockPrisma.additionalCustomerInfo.findMany.mockResolvedValueOnce([
      buildInfoRecord({ type: 'address', id: 1, value: '123 Main St' }),
      buildInfoRecord({ type: 'phone', id: 2, value: '+639171234567' }),
      buildInfoRecord({ type: 'facebook', id: 3, value: 'fb.com/example' }),
    ]);

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/1/additional-info')),
      { params: { id: '1' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.addresses).toHaveLength(1);
    expect(payload.data.phones).toHaveLength(1);
    expect(payload.data.facebookAccounts).toHaveLength(1);
  });

  it('returns 400 for invalid customer id on GET', async () => {
    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/abc/additional-info')),
      { params: { id: 'abc' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Invalid customer ID');
  });

  it('returns 404 when customer is not found on GET', async () => {
    mockPrisma.customer.findUnique.mockResolvedValueOnce(null);

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/999/additional-info')),
      { params: { id: '999' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Customer not found');
    expect(mockPrisma.additionalCustomerInfo.findMany).not.toHaveBeenCalled();
  });

  it('returns 500 when additional info lookup fails', async () => {
    mockPrisma.customer.findUnique.mockResolvedValueOnce({ id: 1 });
    mockPrisma.additionalCustomerInfo.findMany.mockRejectedValueOnce(
      new Error('Database error')
    );

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/1/additional-info')),
      { params: { id: '1' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('An unexpected error occurred');
    expect(payload.details).toBe('Database error');
  });

  it('saves additional info and returns grouped payload on POST', async () => {
    mockPrisma.customer.findUnique.mockResolvedValueOnce({ id: 1 });
    mockPrisma.additionalCustomerInfo.updateMany.mockResolvedValueOnce({
      count: 2,
    });
    mockPrisma.additionalCustomerInfo.createMany.mockResolvedValueOnce({
      count: 3,
    });
    mockPrisma.additionalCustomerInfo.findMany.mockResolvedValueOnce([
      buildInfoRecord({ type: 'address', id: 10, value: 'New Address' }),
    ]);

    const response = await POST(
      new NextRequest(getTestApiUrl('/api/customers/1/additional-info'), {
        method: 'POST',
        body: JSON.stringify({
          addresses: [{ id: 'tmp-1', value: 'New Address' }],
          phones: [{ id: 'tmp-2', value: '+639171234567' }],
        }),
      }),
      { params: { id: '1' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Additional customer info saved successfully');
    expect(mockPrisma.additionalCustomerInfo.updateMany).toHaveBeenCalled();
    expect(mockPrisma.additionalCustomerInfo.createMany).toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('returns 400 when payload fails validation', async () => {
    const response = await POST(
      new NextRequest(getTestApiUrl('/api/customers/1/additional-info'), {
        method: 'POST',
        body: JSON.stringify({ phones: [{ id: '1', value: '' }] }),
      }),
      { params: { id: '1' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Validation failed');
    expect(payload.validationErrors).toBeDefined();
  });

  it('returns 404 when saving info for a missing customer', async () => {
    mockPrisma.customer.findUnique.mockResolvedValueOnce(null);

    const response = await POST(
      new NextRequest(getTestApiUrl('/api/customers/999/additional-info'), {
        method: 'POST',
        body: JSON.stringify({ addresses: [{ id: '1', value: 'Addr' }] }),
      }),
      { params: { id: '999' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Customer not found');
    expect(mockPrisma.additionalCustomerInfo.updateMany).not.toHaveBeenCalled();
  });

  it('returns 500 when transaction fails during save', async () => {
    mockPrisma.customer.findUnique.mockResolvedValueOnce({ id: 1 });
    mockPrisma.additionalCustomerInfo.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('Write failed'));

    const response = await POST(
      new NextRequest(getTestApiUrl('/api/customers/1/additional-info'), {
        method: 'POST',
        body: JSON.stringify({
          addresses: [{ id: 'tmp-1', value: 'Some Address' }],
        }),
      }),
      { params: { id: '1' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('An unexpected error occurred');
    expect(payload.details).toBe('Write failed');
  });
});
