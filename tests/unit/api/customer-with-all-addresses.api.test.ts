import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/customers/with-all-addresses/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    customer: {
      findMany: vi.fn(),
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

type AdditionalInfoRecord = {
  value: string | null;
};

type CustomerRecord = {
  id: number;
  customerName: string | null;
  businessName: string | null;
  phoneNumber: string | null;
  address: string | null;
  deletedAt: Date | null;
  additionalCustomerInfo: AdditionalInfoRecord[];
};

const buildCustomer = (
  overrides: Partial<CustomerRecord> = {}
): CustomerRecord => ({
  id: 1,
  customerName: 'Alice Example',
  businessName: 'Alice Trading',
  phoneNumber: '+639171234567',
  address: '123 Main St',
  deletedAt: null,
  additionalCustomerInfo: [],
  ...overrides,
});

describe('GET /api/customers/with-all-addresses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns customers with sanitized additional addresses and stats', async () => {
    mockPrisma.customer.findMany.mockResolvedValueOnce([
      buildCustomer({
        additionalCustomerInfo: [
          { value: ' Annex 1 ' },
          { value: '<script>alert(1)</script>' },
        ],
      }),
      buildCustomer({ id: 2, additionalCustomerInfo: [] }),
    ]);

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/with-all-addresses'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.data.customers)).toBe(true);
    expect(payload.data.customers).toHaveLength(2);
    expect(payload.data.customers[0].additionalAddresses).toEqual([
      'Annex 1',
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    ]);
    expect(payload.data.stats.totalCustomers).toBe(2);
    expect(payload.data.stats.withAdditionalAddresses).toBe(1);
    expect(payload.data.stats.maxAdditionalAddresses).toBe(2);
  });

  it('returns 500 when prisma query fails', async () => {
    mockPrisma.customer.findMany.mockRejectedValueOnce(
      new Error('Database offline')
    );

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/with-all-addresses'))
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('An unexpected error occurred');
    expect(payload.details).toBe('Database offline');
  });
});
