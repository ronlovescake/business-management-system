/**
 * Invoice Settings API — Business-Rule-Mapped Tests
 *
 * Rules Covered (operations-settings.md Section F):
 *  F-37  messageTemplate must include {DRIVE_FILES} placeholder (doc rule; code enforces non-empty)
 *  F-38  messageTemplate must include {SHOPEE_LINK} placeholder (doc rule; code enforces non-empty)
 *  F-39  paymentChannelsUrl is required (non-empty string)
 *  F-40  GET /api/invoice-settings returns current settings with defaults
 *  F-41  PUT /api/invoice-settings updates and persists settings
 *        POST /api/invoice-settings resets to default
 */

import type { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockInvoiceSettings = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: { invoiceSettings: mockInvoiceSettings },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
type InvoiceSettingsRouteModule = typeof import('@/app/api/invoice-settings/route');

const importRoute = () =>
  import('@/app/api/invoice-settings/route') as Promise<InvoiceSettingsRouteModule>;

function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as unknown as NextRequest;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Invoice Settings API', () => {
  // =========================================================================
  // GET — Default Creation (Rule F-40)
  // =========================================================================
  describe('GET /api/invoice-settings', () => {
    it('Rule F-40: returns existing settings', async () => {
      vi.resetModules();
      const existing = {
        id: 'is-1',
        messageTemplate: 'Hello {DRIVE_FILES} {SHOPEE_LINK}',
        paymentChannelsUrl: 'https://example.com',
        createdAt: new Date(),
      };
      mockInvoiceSettings.findFirst.mockResolvedValue(existing);

      const { GET } = await importRoute();
      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.messageTemplate).toBe(existing.messageTemplate);
    });

    it('Rule F-40: creates default when no settings exist', async () => {
      vi.resetModules();
      mockInvoiceSettings.findFirst.mockResolvedValue(null);
      mockInvoiceSettings.create.mockResolvedValue({
        id: 'default-1',
        messageTemplate: 'default-template',
        paymentChannelsUrl: 'default-url',
      });

      const { GET } = await importRoute();
      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockInvoiceSettings.create).toHaveBeenCalledTimes(1);
    });

    it('Rule F-40: default template contains {DRIVE_FILES} placeholder', async () => {
      vi.resetModules();
      mockInvoiceSettings.findFirst.mockResolvedValue(null);
      mockInvoiceSettings.create.mockImplementation(({ data }: { data: Record<string, string> }) => ({
        id: 'default-1',
        ...data,
      }));

      const { GET } = await importRoute();
      await GET();

      const createCall = mockInvoiceSettings.create.mock.calls[0][0];
      expect(createCall.data.messageTemplate).toContain('{DRIVE_FILES}');
    });

    it('Rule F-40: default template contains {SHOPEE_LINK} placeholder', async () => {
      vi.resetModules();
      mockInvoiceSettings.findFirst.mockResolvedValue(null);
      mockInvoiceSettings.create.mockImplementation(({ data }: { data: Record<string, string> }) => ({
        id: 'default-1',
        ...data,
      }));

      const { GET } = await importRoute();
      await GET();

      const createCall = mockInvoiceSettings.create.mock.calls[0][0];
      expect(createCall.data.messageTemplate).toContain('{SHOPEE_LINK}');
    });
  });

  // =========================================================================
  // PUT — Validation (Rules F-37..F-39, F-41)
  // =========================================================================
  describe('PUT /api/invoice-settings', () => {
    it('Rule F-39: rejects missing messageTemplate', async () => {
      vi.resetModules();
      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({ paymentChannelsUrl: 'https://example.com' })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/message template/i);
    });

    it('Rule F-39: rejects empty messageTemplate', async () => {
      vi.resetModules();
      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({ messageTemplate: '', paymentChannelsUrl: 'url' })
      );
      expect(res.status).toBe(400);
    });

    it('Rule F-39: rejects missing paymentChannelsUrl', async () => {
      vi.resetModules();
      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({ messageTemplate: 'Hello {DRIVE_FILES}' })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/payment channels/i);
    });

    it('Rule F-39: rejects empty string paymentChannelsUrl', async () => {
      vi.resetModules();
      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({ messageTemplate: 'Hello', paymentChannelsUrl: '' })
      );
      expect(res.status).toBe(400);
    });

    it('Rule F-41: updates existing settings', async () => {
      vi.resetModules();
      const existing = {
        id: 'is-1',
        messageTemplate: 'old',
        paymentChannelsUrl: 'old-url',
      };
      mockInvoiceSettings.findFirst.mockResolvedValue(existing);
      mockInvoiceSettings.update.mockResolvedValue({
        ...existing,
        messageTemplate: 'new template',
        paymentChannelsUrl: 'new-url',
      });

      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({
          messageTemplate: 'new template',
          paymentChannelsUrl: 'new-url',
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockInvoiceSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'is-1' },
          data: {
            messageTemplate: 'new template',
            paymentChannelsUrl: 'new-url',
          },
        })
      );
    });

    it('Rule F-41: trims whitespace from template and URL', async () => {
      vi.resetModules();
      mockInvoiceSettings.findFirst.mockResolvedValue({
        id: 'is-1',
        messageTemplate: 'old',
        paymentChannelsUrl: 'old',
      });
      mockInvoiceSettings.update.mockImplementation(
        ({ data }: { data: Record<string, string> }) => ({
          id: 'is-1',
          ...data,
        })
      );

      const { PUT } = await importRoute();
      await PUT(
        makeRequest({
          messageTemplate: '  padded template  ',
          paymentChannelsUrl: '  padded-url  ',
        })
      );

      const updateCall = mockInvoiceSettings.update.mock.calls[0][0];
      expect(updateCall.data.messageTemplate).toBe('padded template');
      expect(updateCall.data.paymentChannelsUrl).toBe('padded-url');
    });

    it('Rule F-41: creates new when no existing settings', async () => {
      vi.resetModules();
      mockInvoiceSettings.findFirst.mockResolvedValue(null);
      mockInvoiceSettings.create.mockResolvedValue({
        id: 'new-1',
        messageTemplate: 'tpl',
        paymentChannelsUrl: 'url',
      });

      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({ messageTemplate: 'tpl', paymentChannelsUrl: 'url' })
      );

      expect(res.status).toBe(200);
      expect(mockInvoiceSettings.create).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // POST — Reset to Default
  // =========================================================================
  describe('POST /api/invoice-settings (reset)', () => {
    it('deletes all and recreates default', async () => {
      vi.resetModules();
      mockInvoiceSettings.deleteMany.mockResolvedValue({ count: 1 });
      mockInvoiceSettings.create.mockImplementation(
        ({ data }: { data: Record<string, string> }) => ({
          id: 'reset-1',
          ...data,
        })
      );

      const { POST } = await importRoute();
      const res = await POST();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toMatch(/reset/i);
      expect(mockInvoiceSettings.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockInvoiceSettings.create).toHaveBeenCalledTimes(1);
    });
  });
});
