import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    customer: { findUnique: vi.fn() },
    generalMerchandiseCustomer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    generalMerchandiseTransaction: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/logger', async () => {
  const { mockLogger } = await import('@/core/testing/test-helpers');
  return { logger: mockLogger };
});

import { GET } from '@/app/api/general-merchandise/customers/[id]/orders/route';
import { ensureGeneralMerchandiseCustomerForClothingId } from '@/modules/general-merchandise/customers/api/service';

describe('General merchandise canonical customer identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.customer.findUnique.mockReset();
    mockPrisma.generalMerchandiseCustomer.findUnique.mockReset();
    mockPrisma.generalMerchandiseCustomer.findMany.mockReset();
    mockPrisma.generalMerchandiseCustomer.create.mockReset();
    mockPrisma.generalMerchandiseTransaction.findMany.mockReset();
  });

  it('creates a GM extension linked to the Clothing customer identity', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 17,
      date: '2024-01-01',
      customerName: 'Hannah Cantomayor',
      phoneNumber: '09170000000',
      address: 'Main Street',
      facebook: '',
      emailAddress: 'hannah@example.com',
      businessName: 'HL Bernales',
      taxNumber: '',
      businessAddress: '',
      businessContactNumber: '',
      customerStatus: 'Active',
      deletedAt: null,
    });
    mockPrisma.generalMerchandiseCustomer.findUnique.mockResolvedValue(null);
    mockPrisma.generalMerchandiseCustomer.findMany.mockResolvedValue([]);
    mockPrisma.generalMerchandiseCustomer.create.mockResolvedValue({ id: 42 });

    const customer = await ensureGeneralMerchandiseCustomerForClothingId(17);

    expect(customer?.id).toBe(42);
    expect(mockPrisma.generalMerchandiseCustomer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerName: 'Hannah Cantomayor',
        clothingCustomer: { connect: { id: 17 } },
      }),
    });
  });

  it('loads only GM orders using the linked GM extension ID', async () => {
    mockPrisma.generalMerchandiseCustomer.findUnique.mockResolvedValue({
      id: 42,
      deletedAt: null,
    });
    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([]);

    const response = await GET(
      new NextRequest(
        getTestApiUrl('/api/general-merchandise/customers/17/orders')
      ),
      { params: { id: '17' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(
      mockPrisma.generalMerchandiseCustomer.findUnique
    ).toHaveBeenCalledWith({ where: { clothingCustomerId: 17 } });
    expect(
      mockPrisma.generalMerchandiseTransaction.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 42, deletedAt: null },
      })
    );
  });

  it('does not read Clothing transactions for GM order history', async () => {
    mockPrisma.generalMerchandiseCustomer.findUnique.mockResolvedValue(null);

    const response = await GET(
      new NextRequest(
        getTestApiUrl('/api/general-merchandise/customers/17/orders')
      ),
      { params: { id: '17' } }
    );

    expect(response.status).toBe(200);
    expect(
      mockPrisma.generalMerchandiseTransaction.findMany
    ).not.toHaveBeenCalled();
  });
});
