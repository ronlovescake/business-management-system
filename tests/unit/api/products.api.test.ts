import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockProductService } = vi.hoisted(() => ({
  mockProductService: {
    findActive: vi.fn(),
    createSingle: vi.fn(),
    bulkImport: vi.fn(),
    bulkUpdate: vi.fn(),
    softDeleteAll: vi.fn(),
  },
}));

vi.mock('@/modules/products/api/service', () => ({
  productService: mockProductService,
}));

import { GET, POST, PUT, DELETE } from '@/app/api/products/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (path: string, init?: NextRequestInit) =>
  new NextRequest(getTestApiUrl(path), init);

const sampleProduct = {
  'Shipment Code': 'SHIP-1',
  'CV Number': 'CV-1',
  'No. Of Sacks': 1,
  'Total CBM': 1,
  Weight: 1,
  'Shipment Status': 'In Transit',
  'Posting Date': '2024-01-01',
  'Order Date': '2024-01-02',
  Payment: 'Paid',
  Product: 'Widget',
  'Product Code': 'PRD-1',
  'Age Range': null,
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
  'Link To Post': null,
  'Bulk Quantity': 0,
  'Bulk Weight': 0,
  'Weight Per Piece': 0,
};

describe('Products API Routes', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    Object.values(mockProductService).forEach((fn) => fn.mockReset());
  });

  describe('GET /api/products', () => {
    it('returns products successfully', async () => {
      mockProductService.findActive.mockResolvedValue([sampleProduct]);

      const response = await GET(buildRequest('/api/products'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data[0]['Product Code']).toBe('PRD-1');
    });

    it('handles service errors', async () => {
      mockProductService.findActive.mockRejectedValue(new Error('boom'));

      const response = await GET(buildRequest('/api/products'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch products');
    });
  });

  describe('POST /api/products', () => {
    it('creates a single product when array length is 1', async () => {
      mockProductService.createSingle.mockResolvedValue({
        ...sampleProduct,
        id: 1,
      });

      const request = new NextRequest(getTestApiUrl('/api/products'), {
        method: 'POST',
        body: JSON.stringify([sampleProduct]),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.product.id).toBe(1);
      expect(mockProductService.createSingle).toHaveBeenCalledTimes(1);
    });

    it('bulk imports when payload length > 1', async () => {
      mockProductService.bulkImport.mockResolvedValue({
        created: 2,
        updated: 0,
        restored: 0,
      });

      const request = new NextRequest(getTestApiUrl('/api/products'), {
        method: 'POST',
        body: JSON.stringify([sampleProduct, sampleProduct]),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.created).toBe(2);
      expect(mockProductService.bulkImport).toHaveBeenCalled();
    });

    it('returns validation error when payload empty', async () => {
      const request = new NextRequest(getTestApiUrl('/api/products'), {
        method: 'POST',
        body: JSON.stringify([]),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid data format');
    });
  });

  describe('PUT /api/products', () => {
    it('updates products successfully', async () => {
      mockProductService.bulkUpdate.mockResolvedValue({
        created: 0,
        updated: 1,
        restored: 0,
        notifications: 1,
      });

      const request = new NextRequest(getTestApiUrl('/api/products'), {
        method: 'PUT',
        body: JSON.stringify([sampleProduct]),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.updated).toBe(1);
      expect(mockProductService.bulkUpdate).toHaveBeenCalled();
    });

    it('returns bad request when validation fails for all rows', async () => {
      const invalidPayload = [{ ...sampleProduct, 'Product Code': null }];

      const request = new NextRequest(getTestApiUrl('/api/products'), {
        method: 'PUT',
        body: JSON.stringify(invalidPayload),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
    });
  });

  describe('DELETE /api/products', () => {
    it('protects against accidental deletion', async () => {
      const request = new NextRequest(getTestApiUrl('/api/products'), {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Mass deletion protection');
    });

    it('soft deletes when confirmed', async () => {
      mockProductService.softDeleteAll.mockResolvedValue({
        deleted: 3,
        alreadyDeleted: 0,
      });

      const request = new NextRequest(
        getTestApiUrl('/api/products', { confirm: 'DELETE_ALL_PRODUCTS' }),
        { method: 'DELETE' }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deleted).toBe(3);
      expect(mockProductService.softDeleteAll).toHaveBeenCalled();
    });
  });
});
