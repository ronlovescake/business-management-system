import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl, mockLogger } from '@/core/testing/test-helpers';

const { mockCustomerService, mockPrisma } = vi.hoisted(() => ({
  mockCustomerService: {
    findActive: vi.fn(),
    bulkSync: vi.fn(),
    create: vi.fn(),
    softDeleteAll: vi.fn(),
  },
  mockPrisma: {
    generalMerchandiseCustomer: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/modules/general-merchandise/customers/api/service', () => ({
  generalMerchandiseCustomerService: mockCustomerService,
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import {
  GET,
  POST,
  PUT,
  DELETE,
} from '@/app/api/general-merchandise/customers/route';
import {
  GET as GET_BY_ID,
  PUT as PUT_BY_ID,
  DELETE as DELETE_BY_ID,
} from '@/app/api/general-merchandise/customers/[id]/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (path: string, init?: NextRequestInit) =>
  new NextRequest(getTestApiUrl(path), init);

const sampleCustomer = {
  id: 1,
  Date: '2024-01-01',
  'Customer Name': 'GM Customer',
  'Phone Number': '09170000000',
  Address: '123 GM Street',
  Facebook: '',
  'Email Address': 'gm@example.com',
  'Business Name': 'GM Biz',
  'Tax Number': 'TIN-001',
  'Business Address': '123 GM Street',
  'Business Contact Number': '09170000001',
  'Customer Status': 'Active',
};

describe('GM customers API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL =
      'postgresql://testuser:testpass@localhost:5432/testdb';
  });

  it('returns GM customers on GET', async () => {
    mockCustomerService.findActive.mockResolvedValue([sampleCustomer]);

    const response = await GET(
      buildRequest('/api/general-merchandise/customers')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data[0]['Customer Name']).toBe('GM Customer');
  });

  it('creates a GM customer on POST', async () => {
    mockCustomerService.create.mockResolvedValue(sampleCustomer);

    const response = await POST(
      buildRequest('/api/general-merchandise/customers', {
        method: 'POST',
        body: JSON.stringify(sampleCustomer),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(1);
  });

  it('bulk syncs GM customers on PUT', async () => {
    mockCustomerService.bulkSync.mockResolvedValue({ created: 1, updated: 0 });

    const response = await PUT(
      buildRequest('/api/general-merchandise/customers', {
        method: 'PUT',
        body: JSON.stringify([sampleCustomer]),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.created).toBe(1);
  });

  it('soft deletes all GM customers on DELETE when confirmed', async () => {
    mockCustomerService.softDeleteAll.mockResolvedValue({
      deleted: 2,
      alreadyDeleted: 0,
    });

    const response = await DELETE(
      buildRequest('/api/general-merchandise/customers', {
        method: 'DELETE',
      })
    );
    const unconfirmed = await response.json();

    expect(response.status).toBe(400);
    expect(unconfirmed.success).toBe(false);

    const confirmedResponse = await DELETE(
      buildRequest(
        '/api/general-merchandise/customers?confirm=DELETE_ALL_CUSTOMERS',
        {
          method: 'DELETE',
        }
      )
    );
    const confirmed = await confirmedResponse.json();

    expect(confirmedResponse.status).toBe(200);
    expect(confirmed.data.deleted).toBe(2);
  });

  it('fetches a GM customer by id', async () => {
    mockPrisma.generalMerchandiseCustomer.findUnique.mockResolvedValue({
      id: 1,
      date: '2024-01-01',
      customerName: 'GM Customer',
      phoneNumber: '09170000000',
      address: '123 GM Street',
      facebook: '',
      emailAddress: 'gm@example.com',
      businessName: 'GM Biz',
      taxNumber: 'TIN-001',
      businessAddress: '123 GM Street',
      businessContactNumber: '09170000001',
      customerStatus: 'Active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await GET_BY_ID(
      buildRequest('/api/general-merchandise/customers/1'),
      { params: { id: '1' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data['Customer Name']).toBe('GM Customer');
  });

  it('updates a GM customer by id', async () => {
    mockPrisma.generalMerchandiseCustomer.findUnique.mockResolvedValue({
      id: 1,
      customerName: 'GM Customer',
    });
    mockPrisma.generalMerchandiseCustomer.update.mockResolvedValue({
      id: 1,
      date: '2024-01-01',
      customerName: 'GM Customer Updated',
      phoneNumber: '09170000000',
      address: '123 GM Street',
      facebook: '',
      emailAddress: 'gm@example.com',
      businessName: 'GM Biz',
      taxNumber: 'TIN-001',
      businessAddress: '123 GM Street',
      businessContactNumber: '09170000001',
      customerStatus: 'Active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await PUT_BY_ID(
      buildRequest('/api/general-merchandise/customers/1', {
        method: 'PUT',
        body: JSON.stringify({ 'Customer Name': 'GM Customer Updated' }),
      }),
      { params: { id: '1' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data['Customer Name']).toBe('GM Customer Updated');
  });

  it('deletes a GM customer by id', async () => {
    mockPrisma.generalMerchandiseCustomer.findUnique.mockResolvedValue({
      id: 1,
      customerName: 'GM Customer',
    });
    mockPrisma.generalMerchandiseCustomer.delete.mockResolvedValue({ id: 1 });

    const response = await DELETE_BY_ID(
      buildRequest('/api/general-merchandise/customers/1', {
        method: 'DELETE',
      }),
      { params: { id: '1' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(1);
  });
});
