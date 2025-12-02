import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/customers/export/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

type AdditionalInfoRecord = {
  type: string;
  value: string | null;
};

type CustomerRecord = {
  id: number;
  date: Date | string | null;
  customerName: string | null;
  phoneNumber: string | null;
  address: string | null;
  facebook: string | null;
  emailAddress: string | null;
  businessName: string | null;
  taxNumber: string | null;
  businessAddress: string | null;
  businessContactNumber: string | null;
  customerStatus: string | null;
  deletedAt: Date | null;
  additionalCustomerInfo: AdditionalInfoRecord[];
};

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

const buildCustomer = (
  overrides: Partial<CustomerRecord> = {}
): CustomerRecord => ({
  id: 1,
  date: new Date('2024-01-01T00:00:00.000Z'),
  customerName: 'Alice Example',
  phoneNumber: '+639171234567',
  address: '123 Main St',
  facebook: 'fb.com/alice',
  emailAddress: 'alice@example.com',
  businessName: 'Alice Trading',
  taxNumber: '123-456-789',
  businessAddress: '456 Business Ave',
  businessContactNumber: '+639181234567',
  customerStatus: 'Active',
  deletedAt: null,
  additionalCustomerInfo: [],
  ...overrides,
});

describe('GET /api/customers/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns customers with aggregated stats', async () => {
    mockPrisma.customer.findMany.mockResolvedValueOnce([
      buildCustomer({
        additionalCustomerInfo: [
          { type: 'shopee_username', value: 'shop1' },
          { type: 'shopee_username', value: 'shop2' },
          { type: 'address', value: 'Annex' },
          { type: 'phone', value: '555-0000' },
        ],
      }),
      buildCustomer({
        id: 2,
        customerName: 'Bob Example',
        additionalCustomerInfo: [
          { type: 'alternate_name', value: 'Bobby' },
          { type: 'facebook', value: 'fb.com/bob' },
        ],
      }),
    ]);

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/export'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.customers).toHaveLength(2);
    expect(payload.data.customers[0].shopeeUsernames).toEqual([
      'shop1',
      'shop2',
    ]);
    expect(payload.data.customers[1].alternateNames).toEqual(['Bobby']);
    expect(payload.data.stats.totalCustomers).toBe(2);
    expect(payload.data.stats.withShopeeUsernames).toBe(1);
    expect(payload.data.stats.maxShopeeUsernames).toBe(2);
  });

  it('returns 500 when prisma query fails', async () => {
    mockPrisma.customer.findMany.mockRejectedValueOnce(
      new Error('Database offline')
    );

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/customers/export'))
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('An unexpected error occurred');
    expect(payload.details).toBe('Database offline');
  });
});
