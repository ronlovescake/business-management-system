import type { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/customers/import/route';
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    customer: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    additionalCustomerInfo: {
      deleteMany: vi.fn(),
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

describe('POST /api/customers/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockPrisma.customer).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.additionalCustomerInfo).forEach((fn) =>
      fn.mockReset()
    );
  });

  it('imports customers and returns stats', async () => {
    const csvContent = [
      'Customer Name,Phone Number,Address,Customer Status,Shopee Username 1,Additional Address 1,Additional Phone 1',
      'Alice,123,Main St,Active,shop_a,Annex,555-0000',
      'Bob,456,Second St,Inactive,, ,777-8888',
    ].join('\n');

    const mockFile = new File([csvContent], 'customers.csv', {
      type: 'text/csv',
    });

    const formData = new FormData();
    formData.append('file', mockFile);

    mockPrisma.customer.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 2,
        phoneNumber: '999',
        address: 'Old Address',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
        deletedAt: null,
      });

    mockPrisma.customer.create.mockResolvedValue({ id: 10 });
    mockPrisma.customer.update.mockResolvedValue({ id: 2 });
    mockPrisma.additionalCustomerInfo.deleteMany.mockResolvedValue({
      count: 0,
    });
    mockPrisma.additionalCustomerInfo.create.mockResolvedValue({ id: 1 });

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/customers/import'),
    });
    request.formData.mockResolvedValue(formData);

    const response = await POST(request as NextRequest);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.stats.totalRows).toBe(2);
    expect(payload.data.stats.customersCreated).toBe(1);
    expect(payload.data.stats.customersUpdated).toBe(1);
    expect(payload.data.stats.additionalInfoCreated).toBe(4);
    expect(mockPrisma.customer.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.customer.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.additionalCustomerInfo.create).toHaveBeenCalledTimes(4);
    expect(mockPrisma.additionalCustomerInfo.deleteMany).toHaveBeenCalledTimes(
      1
    );
  });

  it('returns 400 when file is missing', async () => {
    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/customers/import'),
    });
    const formData = new FormData();
    request.formData.mockResolvedValue(formData);

    const response = await POST(request as NextRequest);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('No file provided');
  });

  it('records row errors when prisma fails', async () => {
    const csvContent = [
      'Customer Name,Phone Number,Address,Customer Status',
      'Alice,123,Main St,Active',
    ].join('\n');

    const mockFile = new File([csvContent], 'customers.csv', {
      type: 'text/csv',
    });

    const formData = new FormData();
    formData.append('file', mockFile);

    mockPrisma.customer.findFirst.mockRejectedValueOnce(
      new Error('Database offline')
    );

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/customers/import'),
    });
    request.formData.mockResolvedValue(formData);

    const response = await POST(request as NextRequest);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.stats.errors).toHaveLength(1);
    expect(payload.data.stats.errors[0].error).toBe('Database offline');
  });
});
