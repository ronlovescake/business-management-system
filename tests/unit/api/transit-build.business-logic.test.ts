/**
 * Business Logic Tests for Transit Build Routes (GET/POST/PATCH/DELETE)
 *
 * Covers:
 * - BL#43: Creating a shipment can generate a Transit Build journal entry
 * - BL#44: The entry records debit (Inventory-in-Transit) and credit (Accounts Payable) lines
 * - BL#45: The journal amount comes from the shipment's product cost fields
 * - BL#46: Duplicate transit-build entries are prevented (idempotency)
 * - Split-mode: distributes across up to 4 credit accounts with cents-precision validation
 * - Accounting cutover: posting date must be on or after 2026-01-01
 * - PATCH: update individual entry fields
 * - DELETE: soft-delete transit build entries
 * - GM pre-check: GM route checks table existence before proceeding
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
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  generalMerchandiseShipment: {
    findUnique: vi.fn(),
  },
  generalMerchandiseProduct: {
    findMany: vi.fn(),
  },
  generalMerchandiseInventoryTransitBuildEntry: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

import {
  GET as clothingGET,
  POST as clothingPOST,
  PATCH as clothingPATCH,
  DELETE as clothingDELETE,
} from '@/app/api/shipments/[id]/transit-build/route';

import {
  GET as gmGET,
  POST as gmPOST,
} from '@/app/api/general-merchandise/shipments/[id]/transit-build/route';

// ── Helpers ──────────────────────────────────────────────────────────────
const buildRequest = (
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) => new NextRequest(getTestApiUrl(path), init);

const mockShipment = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  shipmentCode: 'SH-001',
  ...overrides,
});

const mockProducts = (cogs: number = 5000) => [
  {
    cogs,
    grandTotal: 0,
    forwardersFee: 0,
    lalamove: 0,
    packagingCost: 0,
  },
];

const mockBuildEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'entry-uuid-1',
  postingDate: new Date('2026-02-01T00:00:00Z'),
  amount: 5000,
  debitAccount: 'Inventory in Transit',
  creditAccount: 'Cash',
  idempotencyKey: 'SHIPMENT_TRANSIT_BUILD:SH-001:Cash',
  notes: null,
  deletedAt: null,
  shipmentId: 1,
  shipmentCode: 'SH-001',
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────
describe('Transit Build Routes — Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.shipment.findUnique.mockResolvedValue(mockShipment());
    mockPrisma.product.findMany.mockResolvedValue(mockProducts());
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );
    mockPrisma.$queryRaw.mockResolvedValue([
      { regclass: 'general_merchandise.inventory_transit_build_entries' },
    ]);
  });

  // ── GET ──────────────────────────────────────────────────────────────
  describe('GET /api/shipments/[id]/transit-build', () => {
    it('returns transit build entries with expected total', async () => {
      const entry = mockBuildEntry();
      mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
        entry,
      ]);

      const res = await clothingGET(
        buildRequest('/api/shipments/1/transit-build'),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.shipmentCode).toBe('SH-001');
      expect(json.data.entries).toHaveLength(1);
      expect(json.data.expectedTotalAmount).toBe(5000);
    });

    it('returns 404 when shipment does not exist', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      const res = await clothingGET(
        buildRequest('/api/shipments/999/transit-build'),
        { params: { id: '999' } }
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
    });

    it('rejects shipment without shipment code', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(
        mockShipment({ shipmentCode: null })
      );

      const res = await clothingGET(
        buildRequest('/api/shipments/1/transit-build'),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  // ── POST (single mode) — BL#43-46 ──────────────────────────────────
  describe('POST /api/shipments/[id]/transit-build — single mode', () => {
    it('BL#43-44: creates transit entry with debit Inventory-in-Transit and credit account', async () => {
      const created = mockBuildEntry();
      mockPrisma.clothingInventoryTransitBuildEntry.create.mockResolvedValue(
        created
      );

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2026-02-01',
            creditAccount: 'Cash',
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.entries[0].debitAccount).toBe('Inventory in Transit');
      expect(json.data.entries[0].creditAccount).toBe('Cash');
    });

    it('BL#45: amount is derived from product cost fields', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          cogs: 3000,
          grandTotal: 0,
          forwardersFee: 0,
          lalamove: 0,
          packagingCost: 0,
        },
        {
          cogs: 2000,
          grandTotal: 0,
          forwardersFee: 0,
          lalamove: 0,
          packagingCost: 0,
        },
      ]);
      mockPrisma.clothingInventoryTransitBuildEntry.create.mockResolvedValue(
        mockBuildEntry({ amount: 5000 })
      );

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2026-02-01',
            creditAccount: 'Cash',
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(json.data.expectedTotalAmount).toBe(5000);
    });

    it('BL#46: duplicate entry returns existing entry with wasDuplicate flag', async () => {
      const prismaError = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      mockPrisma.clothingInventoryTransitBuildEntry.create.mockRejectedValue(
        prismaError
      );
      mockPrisma.clothingInventoryTransitBuildEntry.findUnique.mockResolvedValue(
        mockBuildEntry()
      );

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2026-02-01',
            creditAccount: 'Cash',
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.wasDuplicate).toBe(true);
      expect(json.data.entries[0].wasDuplicate).toBe(true);
    });

    it('rejects invalid credit account', async () => {
      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2026-02-01',
            creditAccount: 'Invalid Account',
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('rejects posting date before accounting cutover', async () => {
      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2025-12-31',
            creditAccount: 'Cash',
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('cutover');
    });

    it('rejects when no products linked to shipment', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2026-02-01',
            creditAccount: 'Cash',
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  // ── POST (split mode) — Distribution across credit accounts ─────────
  describe('POST /api/shipments/[id]/transit-build — split mode', () => {
    it('creates multiple entries when split amounts sum to product total', async () => {
      mockPrisma.product.findMany.mockResolvedValue(mockProducts(10000));
      mockPrisma.$transaction.mockResolvedValue([
        mockBuildEntry({
          id: 'split-1',
          amount: 4000,
          creditAccount: 'Cash',
          idempotencyKey: 'SHIPMENT_TRANSIT_BUILD:SH-001:SPLIT:PAID',
        }),
        mockBuildEntry({
          id: 'split-2',
          amount: 6000,
          creditAccount: 'Accounts Payable',
          idempotencyKey:
            'SHIPMENT_TRANSIT_BUILD:SH-001:SPLIT:SUPPLIER_PAYABLE',
        }),
      ]);

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2026-02-01',
            paidAccount: 'Cash',
            paidAmount: 4000,
            supplierEstimate: 6000,
            forwarderEstimate: 0,
            courierEstimate: 0,
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.entries).toHaveLength(2);
      expect(json.data.totalAmount).toBe(10000);
    });

    it('rejects when split amounts do not match total (cents precision)', async () => {
      mockPrisma.product.findMany.mockResolvedValue(mockProducts(10000));

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2026-02-01',
            paidAccount: 'Cash',
            paidAmount: 4000,
            supplierEstimate: 5999.99,
            forwarderEstimate: 0,
            courierEstimate: 0,
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('do not match');
    });

    it('rejects invalid paid account in split mode', async () => {
      mockPrisma.product.findMany.mockResolvedValue(mockProducts(10000));

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2026-02-01',
            paidAccount: 'Accounts Payable',
            paidAmount: 10000,
            supplierEstimate: 0,
            forwarderEstimate: 0,
            courierEstimate: 0,
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('rejects negative split amounts', async () => {
      mockPrisma.product.findMany.mockResolvedValue(mockProducts(10000));

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2026-02-01',
            paidAccount: 'Cash',
            paidAmount: -1000,
            supplierEstimate: 11000,
            forwarderEstimate: 0,
            courierEstimate: 0,
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('prevents mixing single-entry mode with split mode', async () => {
      mockPrisma.product.findMany.mockResolvedValue(mockProducts(5000));
      mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
        { idempotencyKey: 'SHIPMENT_TRANSIT_BUILD:SH-001:Cash' },
      ]);

      const res = await clothingPOST(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2026-02-01',
            paidAccount: 'Cash',
            paidAmount: 5000,
            supplierEstimate: 0,
            forwarderEstimate: 0,
            courierEstimate: 0,
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('already exists');
    });
  });

  // ── PATCH ─────────────────────────────────────────────────────────────
  describe('PATCH /api/shipments/[id]/transit-build', () => {
    it('updates a specific transit build entry', async () => {
      const existing = mockBuildEntry();
      mockPrisma.clothingInventoryTransitBuildEntry.findFirst.mockResolvedValue(
        existing
      );
      mockPrisma.clothingInventoryTransitBuildEntry.update.mockResolvedValue({
        ...existing,
        amount: 6000,
        postingDate: new Date('2026-03-01T00:00:00Z'),
      });

      const res = await clothingPATCH(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'PATCH',
          body: JSON.stringify({
            entryId: 'entry-uuid-1',
            amount: 6000,
            postingDate: '2026-03-01',
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.entry.amount).toBe(6000);
    });

    it('rejects missing entryId', async () => {
      const res = await clothingPATCH(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'PATCH',
          body: JSON.stringify({ amount: 6000 }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('returns 404 when entry does not exist', async () => {
      mockPrisma.clothingInventoryTransitBuildEntry.findFirst.mockResolvedValue(
        null
      );

      const res = await clothingPATCH(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'PATCH',
          body: JSON.stringify({ entryId: 'nonexistent' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
    });

    it('rejects update with no changes', async () => {
      const existing = mockBuildEntry();
      mockPrisma.clothingInventoryTransitBuildEntry.findFirst.mockResolvedValue(
        existing
      );

      const res = await clothingPATCH(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'PATCH',
          body: JSON.stringify({ entryId: 'entry-uuid-1' }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('No updates');
    });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────
  describe('DELETE /api/shipments/[id]/transit-build', () => {
    it('soft-deletes a transit build entry', async () => {
      const existing = mockBuildEntry();
      mockPrisma.clothingInventoryTransitBuildEntry.findFirst.mockResolvedValue(
        existing
      );
      mockPrisma.clothingInventoryTransitBuildEntry.update.mockResolvedValue({
        ...existing,
        deletedAt: new Date(),
      });

      const res = await clothingDELETE(
        buildRequest('/api/shipments/1/transit-build?entryId=entry-uuid-1', {
          method: 'DELETE',
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.entryId).toBe('entry-uuid-1');
    });

    it('rejects missing entryId', async () => {
      const res = await clothingDELETE(
        buildRequest('/api/shipments/1/transit-build', {
          method: 'DELETE',
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('returns 404 when entry not found', async () => {
      mockPrisma.clothingInventoryTransitBuildEntry.findFirst.mockResolvedValue(
        null
      );

      const res = await clothingDELETE(
        buildRequest('/api/shipments/1/transit-build?entryId=nonexistent', {
          method: 'DELETE',
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
    });
  });

  // ── GM Pre-check ──────────────────────────────────────────────────────
  describe('GM Transit Build — Pre-check', () => {
    it('returns 400 when GM transit build table does not exist', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ regclass: null }]);

      const res = await gmGET(
        buildRequest('/api/general-merchandise/shipments/1/transit-build'),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('not available');
    });

    it('proceeds normally when GM transit build table exists', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { regclass: 'general_merchandise.inventory_transit_build_entries' },
      ]);
      mockPrisma.generalMerchandiseShipment.findUnique.mockResolvedValue(
        mockShipment()
      );
      mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue(
        mockProducts()
      );
      mockPrisma.generalMerchandiseInventoryTransitBuildEntry.findMany.mockResolvedValue(
        []
      );

      const res = await gmGET(
        buildRequest('/api/general-merchandise/shipments/1/transit-build'),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('GM POST also checks table existence', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ regclass: null }]);

      const res = await gmPOST(
        buildRequest('/api/general-merchandise/shipments/1/transit-build', {
          method: 'POST',
          body: JSON.stringify({
            postingDate: '2026-02-01',
            creditAccount: 'Cash',
          }),
        }),
        { params: { id: '1' } }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('not available');
    });
  });
});
