import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/customers/[id]/additional-info/add/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    customer: {
      findUnique: vi.fn(),
    },
    additionalCustomerInfo: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', async () => {
  const { mockLogger } = await import('@/core/testing/test-helpers');
  return { logger: mockLogger };
});

describe('Customer Additional Info Add API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a new additional info entry when none exists', async () => {
    mockPrisma.customer.findUnique.mockResolvedValueOnce({ id: 1 });
    mockPrisma.additionalCustomerInfo.findFirst.mockResolvedValueOnce(null);
    mockPrisma.additionalCustomerInfo.create.mockResolvedValueOnce({
      id: 10,
      customerId: 1,
      type: 'address',
      value: '123 Main St',
    });

    const response = await POST(
      new NextRequest(getTestApiUrl('/api/customers/1/additional-info/add'), {
        method: 'POST',
        body: JSON.stringify({ type: 'address', value: '123 Main St' }),
      }),
      { params: { id: '1' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.alreadyExists).toBe(false);
    expect(payload.data.info.value).toBe('123 Main St');
    expect(mockPrisma.additionalCustomerInfo.create).toHaveBeenCalled();
  });

  it('returns alreadyExists when duplicate found', async () => {
    mockPrisma.customer.findUnique.mockResolvedValueOnce({ id: 1 });
    mockPrisma.additionalCustomerInfo.findFirst.mockResolvedValueOnce({
      id: 11,
      customerId: 1,
      type: 'phone',
      value: '+639171234567',
    });

    const response = await POST(
      new NextRequest(getTestApiUrl('/api/customers/1/additional-info/add'), {
        method: 'POST',
        body: JSON.stringify({ type: 'phone', value: '+639171234567' }),
      }),
      { params: { id: '1' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.alreadyExists).toBe(true);
    expect(mockPrisma.additionalCustomerInfo.create).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid customer id', async () => {
    const response = await POST(
      new NextRequest(getTestApiUrl('/api/customers/abc/additional-info/add'), {
        method: 'POST',
        body: JSON.stringify({ type: 'address', value: '123 Main St' }),
      }),
      { params: { id: 'abc' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid customer ID');
  });

  it('returns 400 when payload validation fails', async () => {
    const response = await POST(
      new NextRequest(getTestApiUrl('/api/customers/1/additional-info/add'), {
        method: 'POST',
        body: JSON.stringify({ type: 'invalid', value: '' }),
      }),
      { params: { id: '1' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Validation failed');
  });

  it('returns 404 when customer does not exist', async () => {
    mockPrisma.customer.findUnique.mockResolvedValueOnce(null);

    const response = await POST(
      new NextRequest(getTestApiUrl('/api/customers/1/additional-info/add'), {
        method: 'POST',
        body: JSON.stringify({ type: 'address', value: '123 Main St' }),
      }),
      { params: { id: '1' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('Customer not found');
  });

  it('returns 500 when creation fails', async () => {
    mockPrisma.customer.findUnique.mockResolvedValueOnce({ id: 1 });
    mockPrisma.additionalCustomerInfo.findFirst.mockResolvedValueOnce(null);
    mockPrisma.additionalCustomerInfo.create.mockRejectedValueOnce(
      new Error('Database error')
    );

    const response = await POST(
      new NextRequest(getTestApiUrl('/api/customers/1/additional-info/add'), {
        method: 'POST',
        body: JSON.stringify({ type: 'address', value: '123 Main St' }),
      }),
      { params: { id: '1' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('An unexpected error occurred');
    expect(payload.details).toBe('Database error');
  });
});
