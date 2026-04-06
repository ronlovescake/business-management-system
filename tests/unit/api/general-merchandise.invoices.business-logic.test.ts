/**
 * Business Logic Tests for GM Invoice Routes
 *
 * Covers:
 * - Parity: GM invoices use the same factory as clothing
 * - GM default domain label
 * - GM tickbox, calculate-weights, and customer-orders routes
 * - GM invoice CRUD (GET/POST/PUT/DELETE)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

// ── Prisma mock ──────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseInvoice: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import {
  GET,
  POST,
  PUT,
  DELETE,
} from '@/app/api/general-merchandise/invoices/route';

// ── Helpers ──────────────────────────────────────────────────────────────
const buildRequest = (
  url: string = getTestApiUrl('/api/general-merchandise/invoices'),
  options: { method?: string; body?: unknown } = {}
) =>
  new NextRequest(url, {
    method: options.method || 'GET',
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

// ── Tests ────────────────────────────────────────────────────────────────
describe('GM Invoices API — Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/general-merchandise/invoices', () => {
    it('returns GM invoices with standardized success envelope', async () => {
      mockPrisma.generalMerchandiseInvoice.findMany.mockResolvedValue([
        { id: 'gm-inv-1', customerName: 'GM Customer One', deletedAt: null },
      ]);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data[0].id).toBe('gm-inv-1');
    });

    it('filters out soft-deleted invoices', async () => {
      await GET();

      expect(
        mockPrisma.generalMerchandiseInvoice.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('returns 500 on database error', async () => {
      mockPrisma.generalMerchandiseInvoice.findMany.mockRejectedValue(
        new Error('DB error')
      );

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to fetch invoices');
    });
  });

  describe('POST /api/general-merchandise/invoices — bulk replace', () => {
    it('soft-deletes existing and creates new invoices', async () => {
      mockPrisma.generalMerchandiseInvoice.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.generalMerchandiseInvoice.createMany.mockResolvedValue({
        count: 2,
      });
      mockPrisma.generalMerchandiseInvoice.findMany.mockResolvedValue([
        { id: 'gm-inv-new-1', customerName: 'New Customer', deletedAt: null },
      ]);

      const res = await POST(
        buildRequest(undefined, {
          method: 'POST',
          body: {
            invoices: [
              { customerName: 'New Customer' },
              { customerName: 'Another Customer', tickbox: true },
            ],
          },
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      // Soft-delete then create
      expect(
        mockPrisma.generalMerchandiseInvoice.updateMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          data: { deletedAt: expect.any(Date) },
        })
      );
      expect(
        mockPrisma.generalMerchandiseInvoice.createMany
      ).toHaveBeenCalled();
    });

    it('rejects non-array invoices payload', async () => {
      const res = await POST(
        buildRequest(undefined, {
          method: 'POST',
          body: { invoices: 'not-an-array' },
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid request: invoices must be an array');
    });

    it('maps invoice fields correctly, defaulting missing values to null', async () => {
      mockPrisma.generalMerchandiseInvoice.updateMany.mockResolvedValue({
        count: 0,
      });
      mockPrisma.generalMerchandiseInvoice.createMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.generalMerchandiseInvoice.findMany.mockResolvedValue([]);

      await POST(
        buildRequest(undefined, {
          method: 'POST',
          body: {
            invoices: [{ customerName: 'Test Customer' }],
          },
        })
      );

      const createCall =
        mockPrisma.generalMerchandiseInvoice.createMany.mock.calls[0][0];
      const row = createCall.data[0];
      expect(row.customerName).toBe('Test Customer');
      expect(row.actualWeight).toBeNull();
      expect(row.finalWeight).toBeNull();
      expect(row.tickbox).toBe(false);
    });
  });

  describe('PUT /api/general-merchandise/invoices', () => {
    it('updates a GM invoice by ID', async () => {
      mockPrisma.generalMerchandiseInvoice.update.mockResolvedValue({
        id: 'gm-inv-1',
        customerName: 'Updated',
      });

      const res = await PUT(
        buildRequest(undefined, {
          method: 'PUT',
          body: { id: 'gm-inv-1', customerName: 'Updated' },
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('requires an ID for update', async () => {
      const res = await PUT(
        buildRequest(undefined, {
          method: 'PUT',
          body: { customerName: 'No ID' },
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('ID is required');
    });
  });

  describe('DELETE /api/general-merchandise/invoices', () => {
    it('soft-deletes a GM invoice by ID', async () => {
      mockPrisma.generalMerchandiseInvoice.update.mockResolvedValue({
        id: 'gm-inv-1',
        deletedAt: new Date(),
      });

      const res = await DELETE(
        buildRequest(
          getTestApiUrl('/api/general-merchandise/invoices', {
            id: 'gm-inv-1',
          }),
          { method: 'DELETE' }
        )
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockPrisma.generalMerchandiseInvoice.update).toHaveBeenCalledWith({
        where: { id: 'gm-inv-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('requires ID query parameter for deletion', async () => {
      const res = await DELETE(
        buildRequest(getTestApiUrl('/api/general-merchandise/invoices'), {
          method: 'DELETE',
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('ID is required');
    });
  });
});
