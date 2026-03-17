import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl, mockLogger } from '@/core/testing/test-helpers';

const { mockProductService, mockPrisma, mockSettlement } = vi.hoisted(() => ({
  mockProductService: {
    findActive: vi.fn(),
    createSingle: vi.fn(),
    bulkImport: vi.fn(),
    bulkUpdate: vi.fn(),
    softDeleteAll: vi.fn(),
  },
  mockPrisma: {
    generalMerchandiseProduct: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  mockSettlement: vi.fn(),
}));

vi.mock('@/modules/general-merchandise/products/api/service', () => ({
  generalMerchandiseProductService: mockProductService,
  postGmSupplierSettlementForProductPaymentChange: mockSettlement,
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
} from '@/app/api/general-merchandise/products/route';
import {
  GET as GET_BY_ID,
  PUT as PUT_BY_ID,
  DELETE as DELETE_BY_ID,
} from '@/app/api/general-merchandise/products/[id]/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (path: string, init?: NextRequestInit) =>
  new NextRequest(getTestApiUrl(path), init);

const sampleProduct = {
  id: 1,
  'Shipment Code': 'GM-SHIP-1',
  'CV Number': 'CV-1',
  'No. Of Sacks': 1,
  'Total CBM': 1,
  Weight: 1,
  'Shipment Status': 'In Transit',
  'Posting Date': '2024-01-01',
  'Order Date': '2024-01-02',
  Payment: 'Paid',
  Product: 'Widget',
  'Product Code': 'GM-PRD-1',
  Unit: 'pcs',
  'Unit Price': 10,
  Quantity: 1,
  'Alibaba Shipping Cost': 1,
  'Exchange Rates': 1,
  PHP: 1,
  'Sub Total (PHP)': 1,
  'Transaction Fee': 0,
  'Grand Total': 2,
  "Forwarder's Fee": 0,
  Lalamove: 0,
  'Packaging Cost': 0,
  'Suggested Price': 12,
  'Actual Price': 10,
  'Landed Unit Cost': 8,
  COGS: 7,
  'Projected Sales': 20,
  'Projected Profit': 5,
  'Projected Profit (%)': 0.2,
  'Total Markup': 2,
  'Bulk Quantity': 0,
  'Bulk Weight': 0,
  'Weight Per Piece': 0,
};

describe('GM products API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
  });

  it('returns GM products on GET', async () => {
    mockProductService.findActive.mockResolvedValue([sampleProduct]);

    const response = await GET(
      buildRequest('/api/general-merchandise/products')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data[0]['Product Code']).toBe('GM-PRD-1');
  });

  it('creates a single GM product on POST', async () => {
    mockProductService.createSingle.mockResolvedValue(sampleProduct);

    const response = await POST(
      buildRequest('/api/general-merchandise/products', {
        method: 'POST',
        body: JSON.stringify([sampleProduct]),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.product.id).toBe(1);
  });

  it('bulk updates GM products on PUT', async () => {
    mockProductService.bulkUpdate.mockResolvedValue({
      created: 0,
      updated: 1,
      restored: 0,
      notifications: 0,
    });

    const response = await PUT(
      buildRequest('/api/general-merchandise/products', {
        method: 'PUT',
        body: JSON.stringify([sampleProduct]),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.updated).toBe(1);
  });

  it('protects GM product mass deletion on DELETE', async () => {
    const response = await DELETE(
      buildRequest('/api/general-merchandise/products', { method: 'DELETE' })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Mass deletion protection');
  });

  it('fetches a GM product by id', async () => {
    mockPrisma.generalMerchandiseProduct.findUnique.mockResolvedValue({
      id: 1,
    });

    const response = await GET_BY_ID(
      buildRequest('/api/general-merchandise/products/1'),
      { params: { id: '1' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe(1);
  });

  it('updates a GM product by id and posts settlement changes', async () => {
    mockPrisma.generalMerchandiseProduct.findUnique.mockResolvedValue({
      payment: 'Pending',
      productCode: 'GM-PRD-1',
      shipmentCode: 'GM-SHIP-1',
    });
    mockPrisma.generalMerchandiseProduct.update.mockResolvedValue({
      id: 1,
      payment: 'Paid',
      productCode: 'GM-PRD-1',
      shipmentCode: 'GM-SHIP-1',
    });

    const response = await PUT_BY_ID(
      buildRequest('/api/general-merchandise/products/1', {
        method: 'PUT',
        body: JSON.stringify({
          'Shipment Code': 'GM-SHIP-1',
          'Product Code': 'GM-PRD-1',
          Payment: 'Paid',
        }),
      }),
      { params: { id: '1' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Product updated successfully');
    expect(mockSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 1, prevPayment: 'Pending' })
    );
  });

  it('deletes a GM product by id', async () => {
    mockPrisma.generalMerchandiseProduct.delete.mockResolvedValue({ id: 1 });

    const response = await DELETE_BY_ID(
      buildRequest('/api/general-merchandise/products/1', { method: 'DELETE' }),
      { params: { id: '1' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Product deleted successfully');
  });
});
