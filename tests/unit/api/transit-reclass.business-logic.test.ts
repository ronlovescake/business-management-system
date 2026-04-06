/**
 * Business Logic Tests for Transit Reclass Routes (POST)
 *
 * Covers:
 * - BL#47: The TransitReclass modal moves inventory from in-transit to warehouse
 * - BL#48: Reclass entries are only valid for shipments that have a Transit Build entry
 * - Delivered-only: shipment must be in "Delivered" status
 * - Reclass validates totals match to cents precision
 * - Idempotency: duplicate reclass entries per product are skipped
 * - Parity: clothing and GM use the same factory
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl, mockLogger } from '@/core/testing/test-helpers';

// ── Prisma mock ──────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  shipment: {
    findUnique: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
  },
  clothingInventoryTransitBuildEntry: {
    findMany: vi.fn(),
  },
  clothingInventoryReclassEntry: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  generalMerchandiseShipment: {
    findUnique: vi.fn(),
  },
  generalMerchandiseProduct: {
    findMany: vi.fn(),
  },
  generalMerchandiseInventoryTransitBuildEntry: {
    findMany: vi.fn(),
  },
  generalMerchandiseInventoryReclassEntry: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

import { POST as clothingPOST } from '@/app/api/shipments/[id]/transit-reclass/route';
import { POST as gmPOST } from '@/app/api/general-merchandise/shipments/[id]/transit-reclass/route';

// ── Helpers ──────────────────────────────────────────────────────────────
const buildRequest = (
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) => new NextRequest(getTestApiUrl(path), init);

const mockShipment = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  shipmentCode: 'SH-001',
  shipmentStatus: 'Delivered',
  ...overrides,
});

const mockProducts = (cogs: number = 5000) => [
  {
    productCode: 'PROD-001',
    cogs,
    grandTotal: 0,
    forwardersFee: 0,
    lalamove: 0,
    packagingCost: 0,
  },
];

const mockBuildEntries = (amount: number = 5000) => [
  {
    id: 'build-1',
    idempotencyKey: 'SHIPMENT_TRANSIT_BUILD:SH-001:Cash',
    amount,
  },
];

// ── Tests ────────────────────────────────────────────────────────────────
describe('Transit Reclass Routes — Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.shipment.findUnique.mockResolvedValue(mockShipment());
    mockPrisma.product.findMany.mockResolvedValue(mockProducts());
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      mockBuildEntries()
    );
    mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([]);
    mockPrisma.clothingInventoryReclassEntry.createMany.mockResolvedValue({
      count: 1,
    });
  });

  // ── Successful Reclass ──────────────────────────────────────────────
  describe('POST /api/shipments/[id]/transit-reclass — success', () => {
    it('BL#47: creates reclass entries from Inventory-in-Transit to Stock-on-Hand', async () => {
      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.createdCount).toBe(1);
      expect(json.data.shipmentCode).toBe('SH-001');

      // Verify createMany was called with correct from/to accounts
      const createCall =
        mockPrisma.clothingInventoryReclassEntry.createMany.mock.calls[0]?.[0];
      expect(createCall.data[0].fromAccount).toBe('Inventory in Transit');
      expect(createCall.data[0].toAccount).toBe('Stock on Hand');
    });

    it('includes idempotency key with product code', async () => {
      await clothingPOST(
        buildRequest('/api/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );

      const createCall =
        mockPrisma.clothingInventoryReclassEntry.createMany.mock.calls[0]?.[0];
      expect(createCall.data[0].idempotencyKey).toBe(
        'SHIPMENT_TRANSIT_RECLASS:SH-001:PROD-001'
      );
    });
  });

  // ── Delivered-only validation ────────────────────────────────────────
  describe('POST /api/shipments/[id]/transit-reclass — status validation', () => {
    it('rejects shipments not in "Delivered" status', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(
        mockShipment({ shipmentStatus: 'In Transit' })
      );

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Delivered');
    });
  });

  // ── BL#48: Transit Build Entry Required ──────────────────────────────
  describe('POST /api/shipments/[id]/transit-reclass — transit build required', () => {
    it('BL#48: rejects when no transit build entries exist', async () => {
      mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
        []
      );

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('No transit build-up entries');
    });
  });

  // ── Total mismatch validation (cents precision) ───────────────────────
  describe('POST /api/shipments/[id]/transit-reclass — total validation', () => {
    it('rejects when build total differs from product valuation (cents precision)', async () => {
      mockPrisma.product.findMany.mockResolvedValue(mockProducts(5000));
      mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
        mockBuildEntries(4999.99)
      );

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('does not match');
    });

    it('accepts exact match to the cent', async () => {
      mockPrisma.product.findMany.mockResolvedValue(mockProducts(5000.5));
      mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
        mockBuildEntries(5000.5)
      );

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  // ── Idempotency: skip already-reclassed products ─────────────────────
  describe('POST /api/shipments/[id]/transit-reclass — idempotency', () => {
    it('skips already reclassed products', async () => {
      mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([
        { productCode: 'PROD-001' },
      ]);

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.createdCount).toBe(0);
      expect(json.data.skippedCount).toBe(1);
      expect(json.message).toContain('already exist');
    });

    it('creates entries only for products not yet reclassed', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          productCode: 'PROD-001',
          cogs: 2500,
          grandTotal: 0,
          forwardersFee: 0,
          lalamove: 0,
          packagingCost: 0,
        },
        {
          productCode: 'PROD-002',
          cogs: 2500,
          grandTotal: 0,
          forwardersFee: 0,
          lalamove: 0,
          packagingCost: 0,
        },
      ]);
      mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([
        { productCode: 'PROD-001' },
      ]);

      await clothingPOST(
        buildRequest('/api/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );

      const createCall =
        mockPrisma.clothingInventoryReclassEntry.createMany.mock.calls[0]?.[0];
      expect(createCall.data).toHaveLength(1);
      expect(createCall.data[0].productCode).toBe('PROD-002');
    });
  });

  // ── Posting date validation ──────────────────────────────────────────
  describe('POST /api/shipments/[id]/transit-reclass — date validation', () => {
    it('rejects posting date before accounting cutover (2026-01-01)', async () => {
      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2025-12-31' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('cutover');
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────
  describe('POST /api/shipments/[id]/transit-reclass — edge cases', () => {
    it('returns 404 for non-existent shipment', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      const res = await clothingPOST(
        buildRequest('/api/shipments/999/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '999' } }
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
    });

    it('rejects shipment without shipment code', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(
        mockShipment({ shipmentCode: null, shipmentStatus: 'Delivered' })
      );

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('rejects when no products linked to shipment code', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  // ── GM Parity ─────────────────────────────────────────────────────────
  describe('GM Transit Reclass — Parity', () => {
    beforeEach(() => {
      mockPrisma.generalMerchandiseShipment.findUnique.mockResolvedValue(
        mockShipment()
      );
      mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue(
        mockProducts()
      );
      mockPrisma.generalMerchandiseInventoryTransitBuildEntry.findMany.mockResolvedValue(
        mockBuildEntries()
      );
      mockPrisma.generalMerchandiseInventoryReclassEntry.findMany.mockResolvedValue(
        []
      );
      mockPrisma.generalMerchandiseInventoryReclassEntry.createMany.mockResolvedValue(
        {
          count: 1,
        }
      );
    });

    it('GM transit reclass uses same validation rules', async () => {
      const res = await gmPOST(
        buildRequest('/api/general-merchandise/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.createdCount).toBe(1);
    });

    it('GM rejects non-Delivered shipments too', async () => {
      mockPrisma.generalMerchandiseShipment.findUnique.mockResolvedValue(
        mockShipment({ shipmentStatus: 'In Transit' })
      );

      const res = await gmPOST(
        buildRequest('/api/general-merchandise/shipments/1/transit-reclass', {
          method: 'POST',
          body: JSON.stringify({ postingDate: '2026-02-15' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('Delivered');
    });
  });
});
