import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/customers/with-shopee/route';
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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

type AdditionalInfoRecord = {
  value: string | null;
};

type CustomerRecord = {
  id: number;
  customerName: string | null;
  businessName: string | null;
  facebook: string | null;
  address: string | null;
  phoneNumber: string | null;
  deletedAt: Date | null;
  additionalCustomerInfo: AdditionalInfoRecord[];
};

const buildCustomer = (
  overrides: Partial<CustomerRecord> = {}
): CustomerRecord => ({
  id: 1,
  customerName: 'Alice Example',
  businessName: 'Alice Trading',
  facebook: 'fb.com/Alice ',
  address: '123 Main St',
  phoneNumber: '+639171234567',
  deletedAt: null,
  additionalCustomerInfo: [],
  ...overrides,
});

describe('GET /api/customers/with-shopee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns customers with sanitized Shopee usernames and stats', async () => {
    mockPrisma.customer.findMany.mockResolvedValueOnce([
      buildCustomer({
        additionalCustomerInfo: [
          { value: '  ShopOne ' },
          { value: 'shop-two' },
        ],
      }),
      buildCustomer({
        id: 2,
        customerName: 'Bob Example',
        businessName: null,
        facebook: null,
        additionalCustomerInfo: [],
      }),
    ]);

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/with-shopee'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.data.customers)).toBe(true);
    expect(payload.data.customers).toHaveLength(2);
    expect(payload.data.customers[0].shopeeUsernames).toEqual([
      'shopone',
      'shop-two',
    ]);
    expect(payload.data.stats.totalCustomers).toBe(2);
    expect(payload.data.stats.withShopeeUsernames).toBe(1);
    expect(typeof payload.data.timestamp).toBe('string');
  });

  it('returns 500 when prisma query fails', async () => {
    mockPrisma.customer.findMany.mockRejectedValueOnce(
      new Error('Database offline')
    );

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/with-shopee'))
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('An unexpected error occurred');
    expect(payload.details).toBe('Database offline');
  });
});
