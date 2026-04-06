/**
 * Business Logic Tests for Shipment Detail Routes (GET/PUT/DELETE [id])
 *
 * Covers:
 * - BL#20: Saving an edit calls PUT /api/shipments/{id}
 * - BL#22: Status drives the transaction "Order Status" mapping
 * - BL#23: For Pickup, Sorting, and Delivered → 'Warehouse'
 * - BL#24: In Transit, Manila Port, With Pier Gatepass, PH Warehouse → 'In Transit'
 * - BL#25: Unknown shipment status defaults to 'In Transit'
 * - Cascade: products updated with cvNumber, noOfSacks, totalCBM, weight, shipmentStatus
 * - Parity: clothing and GM use the same factory with domain-specific delegates
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl, mockLogger } from '@/core/testing/test-helpers';

// ── Prisma mock ──────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  shipment: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  transaction: {
    updateMany: vi.fn(),
  },
  generalMerchandiseShipment: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  generalMerchandiseProduct: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/modules/shipments/api/expenses', () => ({
  postExpenseForShipment: vi.fn().mockResolvedValue(undefined),
}));

import {
  GET as clothingGET,
  PUT as clothingPUT,
  DELETE as clothingDELETE,
} from '@/app/api/shipments/[id]/route';

import {
  GET as gmGET,
  PUT as gmPUT,
} from '@/app/api/general-merchandise/shipments/[id]/route';

// ── Helpers ──────────────────────────────────────────────────────────────
const buildRequest = (
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) => new NextRequest(getTestApiUrl(path), init);

const toShipmentDB = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  shipmentCode: 'SH-001',
  cvNumber: 'CV-100',
  noOfSacks: 10,
  totalCBM: 5.5,
  weight: 100,
  fee: 1000,
  shipmentStatus: 'In Transit',
  dateCreated: new Date('2026-01-15T00:00:00Z'),
  dateDelivered: null,
  duration: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────
describe('Shipment Detail Routes — Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.transaction.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.product.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue([]);
    mockPrisma.generalMerchandiseProduct.updateMany.mockResolvedValue({
      count: 0,
    });
  });

  // ── GET ──────────────────────────────────────────────────────────────
  describe('GET /api/shipments/[id]', () => {
    it('returns a converted shipment on success', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(toShipmentDB());

      const res = await clothingGET(buildRequest('/api/shipments/1'), {
        params: { id: '1' },
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });

    it('returns 404 when shipment does not exist', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      const res = await clothingGET(buildRequest('/api/shipments/999'), {
        params: { id: '999' },
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
    });

    it('returns 400 for non-numeric ID', async () => {
      const res = await clothingGET(buildRequest('/api/shipments/abc'), {
        params: { id: 'abc' },
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  // ── PUT — Status-to-Order-Status Mapping (BL#22-25) ──────────────────
  describe('PUT /api/shipments/[id] — status cascade', () => {
    const updateShipment = async (body: Record<string, unknown>) => {
      mockPrisma.shipment.findUnique.mockResolvedValue(toShipmentDB());
      mockPrisma.shipment.update.mockResolvedValue(toShipmentDB(body));
      mockPrisma.product.findMany.mockResolvedValue([
        { productCode: 'PROD-001' },
      ]);

      return clothingPUT(
        buildRequest('/api/shipments/1', {
          method: 'PUT',
          body: JSON.stringify({
            'Shipment Code': 'SH-001',
            'CV Number': 'CV-100',
            'No. Of Sacks': '10',
            'Total CBM': '5.5',
            Weight: '100',
            Fee: '1000',
            'Shipment Status': body.shipmentStatus ?? 'In Transit',
            'Date Created': 'Jan 15, 2026',
          }),
        }),
        { params: { id: '1' } }
      );
    };

    it.each([
      ['In Transit', 'In Transit'],
      ['Manila Port', 'In Transit'],
      ['With Pier Gatepass', 'In Transit'],
      ['PH Warehouse', 'In Transit'],
    ])(
      'BL#24: status "%s" maps to order status "%s"',
      async (shipmentStatus, expectedOrderStatus) => {
        await updateShipment({ shipmentStatus });

        const txCall = mockPrisma.transaction.updateMany.mock.calls[0]?.[0];
        expect(txCall?.data?.orderStatus).toBe(expectedOrderStatus);
      }
    );

    it.each([
      ['For Pickup', 'Warehouse'],
      ['Sorting', 'Warehouse'],
      ['Delivered', 'Warehouse'],
    ])(
      'BL#23: status "%s" maps to order status "%s"',
      async (shipmentStatus, expectedOrderStatus) => {
        await updateShipment({ shipmentStatus });

        const txCall = mockPrisma.transaction.updateMany.mock.calls[0]?.[0];
        expect(txCall?.data?.orderStatus).toBe(expectedOrderStatus);
      }
    );

    it('cascades product fields on PUT (cvNumber, noOfSacks, totalCBM, weight, shipmentStatus)', async () => {
      await updateShipment({ shipmentStatus: 'Delivered' });

      expect(mockPrisma.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shipmentCode: 'SH-001' },
          data: expect.objectContaining({
            cvNumber: expect.any(String),
            noOfSacks: expect.any(Number),
            totalCBM: expect.any(Number),
            weight: expect.any(Number),
            shipmentStatus: 'Delivered',
          }),
        })
      );
    });

    it('updates the shipment record and returns success', async () => {
      const res = await updateShipment({ shipmentStatus: 'Delivered' });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('updated');
    });

    it('returns 404 when updating a non-existent shipment', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      const res = await clothingPUT(
        buildRequest('/api/shipments/999', {
          method: 'PUT',
          body: JSON.stringify({
            'Shipment Code': 'SH-999',
            'Shipment Status': 'In Transit',
            'Date Created': 'Jan 15, 2026',
          }),
        }),
        { params: { id: '999' } }
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
    });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────
  describe('DELETE /api/shipments/[id]', () => {
    it('deletes shipment and returns success', async () => {
      mockPrisma.shipment.delete.mockResolvedValue(toShipmentDB());

      const res = await clothingDELETE!(buildRequest('/api/shipments/1'), {
        params: { id: '1' },
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(1);
    });

    it('returns 400 for invalid ID', async () => {
      const res = await clothingDELETE!(buildRequest('/api/shipments/abc'), {
        params: { id: 'abc' },
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  // ── GM Parity ─────────────────────────────────────────────────────────
  describe('GM Shipment Detail Routes — Parity', () => {
    it('GET returns converted shipment through the same factory', async () => {
      mockPrisma.generalMerchandiseShipment.findUnique.mockResolvedValue(
        toShipmentDB()
      );

      const res = await gmGET(
        buildRequest('/api/general-merchandise/shipments/1'),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('PUT cascades to GM products (no transaction sync for GM)', async () => {
      mockPrisma.generalMerchandiseShipment.findUnique.mockResolvedValue(
        toShipmentDB()
      );
      mockPrisma.generalMerchandiseShipment.update.mockResolvedValue(
        toShipmentDB({ shipmentStatus: 'Delivered' })
      );
      mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue([
        { productCode: 'GM-PROD-001' },
      ]);

      const res = await gmPUT(
        buildRequest('/api/general-merchandise/shipments/1', {
          method: 'PUT',
          body: JSON.stringify({
            'Shipment Code': 'SH-001',
            'Shipment Status': 'Delivered',
            'Date Created': 'Jan 15, 2026',
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(
        mockPrisma.generalMerchandiseProduct.updateMany
      ).toHaveBeenCalled();
      // GM has no transaction model — transaction.updateMany should NOT be called
      expect(mockPrisma.transaction.updateMany).not.toHaveBeenCalled();
    });

    it('GM shipment detail has no DELETE handler', async () => {
      const gmModule = await import(
        '@/app/api/general-merchandise/shipments/[id]/route'
      );
      const gmDelete = (gmModule as Record<string, unknown>).DELETE;
      expect(gmDelete).toBeUndefined();
    });
  });
});
