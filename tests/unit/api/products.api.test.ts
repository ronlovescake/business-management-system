import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockProductService, mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockProductService: {
    findActive: vi.fn(),
    createSingle: vi.fn(),
    bulkImport: vi.fn(),
    bulkUpdate: vi.fn(),
    postManualTransitBuildUpByShipmentCode: vi.fn(),
    softDeleteAll: vi.fn(),
  },
}));

vi.mock('@/lib/auth/session', () => ({ getCurrentUser: mockGetCurrentUser }));

vi.mock('@/modules/products/api/service', () => ({
  productService: mockProductService,
  ProductShipmentAccountingConflictError: class extends Error {},
  ProductSupplierSettlementError: class extends Error {
    constructor(
      message: string,
      public readonly status = 400
    ) {
      super(message);
    }
  },
}));

import { GET, POST, PUT, DELETE } from '@/app/api/products/route';
import { POST as postTransitBuild } from '@/app/api/products/transit-build/route';
import {
  ProductShipmentAccountingConflictError,
  ProductSupplierSettlementError,
} from '@/modules/products/api/service';

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
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-test', role: 'ADMIN' });
    Object.values(mockProductService).forEach((fn) => fn.mockReset());
  });

  describe('POST /api/products/transit-build', () => {
    const request = (body: object) =>
      buildRequest('/api/products/transit-build', {
        method: 'POST',
        body: JSON.stringify(body),
      });

    it.each([
      { user: null, status: 401 },
      { user: { id: 'employee-test', role: 'EMPLOYEE' }, status: 403 },
    ])(
      'preserves the administrator boundary: $status',
      async ({ user, status }) => {
        mockGetCurrentUser.mockResolvedValue(user);
        const response = await postTransitBuild(
          request({
            shipmentCode: 'KPC-OPENING',
            fundingSource: 'OPENING_BALANCE',
            openingBalanceConfirmed: true,
          })
        );
        expect(response.status).toBe(status);
        expect(
          mockProductService.postManualTransitBuildUpByShipmentCode
        ).not.toHaveBeenCalled();
      }
    );

    it('forwards only explicitly confirmed opening funding to the owning service', async () => {
      mockProductService.postManualTransitBuildUpByShipmentCode.mockResolvedValue(
        { created: 1, skipped: 0, products: 1 }
      );
      const response = await postTransitBuild(
        request({
          shipmentCode: ' KPC-OPENING ',
          fundingSource: 'OPENING_BALANCE',
          openingBalanceConfirmed: true,
        })
      );
      expect(response.status).toBe(200);
      expect(
        mockProductService.postManualTransitBuildUpByShipmentCode
      ).toHaveBeenCalledWith({
        shipmentCode: 'KPC-OPENING',
        fundingSource: 'OPENING_BALANCE',
        openingBalanceConfirmed: true,
      });
    });

    it.each([undefined, false, 'true', 1])(
      'rejects opening funding without a boolean confirmation: %s',
      async (openingBalanceConfirmed) => {
        const response = await postTransitBuild(
          request({
            shipmentCode: 'KPC-OPENING',
            fundingSource: 'OPENING_BALANCE',
            openingBalanceConfirmed,
          })
        );
        expect(response.status).toBe(400);
        expect(
          mockProductService.postManualTransitBuildUpByShipmentCode
        ).not.toHaveBeenCalled();
      }
    );

    it('rejects an unsupported funding source', async () => {
      const response = await postTransitBuild(
        request({
          shipmentCode: 'KPC-OPENING',
          fundingSource: 'Cash',
        })
      );
      expect(response.status).toBe(400);
      expect(
        mockProductService.postManualTransitBuildUpByShipmentCode
      ).not.toHaveBeenCalled();
    });

    it('preserves the default purchase-funded request', async () => {
      mockProductService.postManualTransitBuildUpByShipmentCode.mockResolvedValue(
        { created: 1, skipped: 0, products: 1 }
      );
      expect(
        (await postTransitBuild(request({ shipmentCode: 'KPC-001' }))).status
      ).toBe(200);
      expect(
        mockProductService.postManualTransitBuildUpByShipmentCode
      ).toHaveBeenCalledWith({ shipmentCode: 'KPC-001' });
    });

    it('returns an existing shipment funding conflict as 409', async () => {
      mockProductService.postManualTransitBuildUpByShipmentCode.mockRejectedValue(
        new ProductShipmentAccountingConflictError('Conflicting funding')
      );
      const response = await postTransitBuild(
        request({ shipmentCode: 'KPC-OPENING' })
      );
      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe('Conflicting funding');
    });

    it('returns the service conflict instead of replacing existing opening funding', async () => {
      mockProductService.postManualTransitBuildUpByShipmentCode.mockRejectedValue(
        new ProductSupplierSettlementError('Existing transit opening', 409)
      );
      const response = await postTransitBuild(
        request({
          shipmentCode: 'KPC-OPENING',
          fundingSource: 'OPENING_BALANCE',
          openingBalanceConfirmed: true,
        })
      );
      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe('Existing transit opening');
    });
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
    it('returns 409 for an import accounting dependency conflict', async () => {
      mockProductService.bulkImport.mockRejectedValue(
        new ProductShipmentAccountingConflictError('SHIP-1')
      );
      const response = await POST(
        buildRequest('/api/products', {
          method: 'POST',
          body: JSON.stringify([sampleProduct, sampleProduct]),
        })
      );
      expect(response.status).toBe(409);
    });

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
      expect(mockProductService.createSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          PHP: 10,
          'Sub Total (PHP)': 11,
          'Transaction Fee': 0,
          'Grand Total': 11,
          'Suggested Price': 14,
          COGS: 11,
          'Projected Sales': 10,
          'Projected Profit': 0,
        })
      );
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
    it('returns original skipped indices when only part of a grid save is valid', async () => {
      mockProductService.bulkUpdate.mockResolvedValue({
        created: 0,
        updated: 1,
        restored: 0,
      });
      const response = await PUT(
        buildRequest('/api/products', {
          method: 'PUT',
          body: JSON.stringify([
            { ...sampleProduct, id: 1, 'Product Code': '' },
            { ...sampleProduct, id: 2 },
          ]),
        })
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({
        total: 1,
        skipped: 1,
        skippedDetails: [{ index: 0 }],
      });
      expect(mockProductService.bulkUpdate).toHaveBeenCalledWith([
        expect.objectContaining({ id: 2 }),
      ]);
    });

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
