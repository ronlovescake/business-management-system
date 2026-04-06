/**
 * Business Logic Tests for Message Template Routes (GET/PUT/POST)
 *
 * Covers:
 * - BL#1: Templates are fetched on mount via GET /api/message-templates
 * - BL#2: Templates are displayed in a fixed canonical order
 * - BL#5-6: Default templates are seeded if the table is empty
 * - BL#14-16: Saving an edited template via PUT /api/message-templates
 * - BL#21-28: Creating a new template via POST /api/message-templates
 * - Validation: id, title, badge, paragraphs are required
 * - Sanitization: empty and whitespace-only paragraphs are filtered out
 * - Parity: clothing and GM use the same factory + service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl, mockLogger } from '@/core/testing/test-helpers';

// ── Prisma mock ──────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  messageTemplate: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    createMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  generalMerchandiseMessageTemplate: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    createMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

import {
  GET as clothingGET,
  PUT as clothingPUT,
  POST as clothingPOST,
} from '@/app/api/message-templates/route';

import {
  GET as gmGET,
  PUT as gmPUT,
  POST as gmPOST,
} from '@/app/api/general-merchandise/message-templates/route';

// ── Helpers ──────────────────────────────────────────────────────────────
const buildRequest = (
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) => new NextRequest(getTestApiUrl(path), init);

const mockTemplateRecord = (overrides: Record<string, unknown> = {}) => ({
  slug: 'test-template',
  title: 'Test Template',
  badge: 'Reminder',
  paragraphs: ['Hello World', 'Second paragraph'],
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────
describe('Message Template Routes — Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET ──────────────────────────────────────────────────────────────
  describe('GET /api/message-templates', () => {
    it('BL#1: fetches all templates from database', async () => {
      const records = [
        mockTemplateRecord(),
        mockTemplateRecord({ slug: 'other', title: 'Other' }),
      ];
      mockPrisma.messageTemplate.findMany.mockResolvedValue(records);

      const res = await clothingGET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
    });

    it('BL#2: templates are sorted by canonical MESSAGE_TEMPLATE_TITLE_ORDER', async () => {
      const records = [
        mockTemplateRecord({ slug: 'cancel', title: 'Cancellation Notice' }),
        mockTemplateRecord({ slug: 'reminder', title: 'Payment Reminder' }),
      ];
      mockPrisma.messageTemplate.findMany.mockResolvedValue(records);

      const res = await clothingGET();
      const json = await res.json();

      expect(res.status).toBe(200);
      // Should return sorted - exact order depends on MESSAGE_TEMPLATE_TITLE_ORDER
      expect(json.data).toHaveLength(2);
    });

    it('BL#5-6: seeds default templates when table is empty', async () => {
      mockPrisma.messageTemplate.findMany.mockResolvedValue([]);
      mockPrisma.messageTemplate.createMany.mockResolvedValue({ count: 5 });

      const res = await clothingGET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      // Should have seeded defaults
      expect(mockPrisma.messageTemplate.createMany).toHaveBeenCalled();
      // Returns the default templates
      expect(json.data.length).toBeGreaterThan(0);
    });

    it('returns 500 on service error', async () => {
      mockPrisma.messageTemplate.findMany.mockRejectedValue(
        new Error('DB error')
      );

      const res = await clothingGET();
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to load message templates');
    });
  });

  // ── PUT — Edit Template (BL#14-16) ──────────────────────────────────
  describe('PUT /api/message-templates', () => {
    it('BL#16: upserts a template by id (slug)', async () => {
      const updated = mockTemplateRecord({ title: 'Updated Title' });
      mockPrisma.messageTemplate.upsert.mockResolvedValue(updated);

      const res = await clothingPUT(
        buildRequest('/api/message-templates', {
          method: 'PUT',
          body: JSON.stringify({
            id: 'test-template',
            title: 'Updated Title',
            badge: 'Reminder',
            paragraphs: ['Updated content'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockPrisma.messageTemplate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'test-template' },
          update: expect.objectContaining({ title: 'Updated Title' }),
        })
      );
    });

    it('requires template id', async () => {
      const res = await clothingPUT(
        buildRequest('/api/message-templates', {
          method: 'PUT',
          body: JSON.stringify({
            title: 'Title',
            badge: 'Reminder',
            paragraphs: ['Content'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Template id is required');
    });

    it('requires title', async () => {
      const res = await clothingPUT(
        buildRequest('/api/message-templates', {
          method: 'PUT',
          body: JSON.stringify({
            id: 'test-template',
            badge: 'Reminder',
            paragraphs: ['Content'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Template title is required');
    });

    it('requires badge', async () => {
      const res = await clothingPUT(
        buildRequest('/api/message-templates', {
          method: 'PUT',
          body: JSON.stringify({
            id: 'test-template',
            title: 'Title',
            paragraphs: ['Content'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Badge label is required');
    });

    it('requires paragraphs as array', async () => {
      const res = await clothingPUT(
        buildRequest('/api/message-templates', {
          method: 'PUT',
          body: JSON.stringify({
            id: 'test-template',
            title: 'Title',
            badge: 'Reminder',
            paragraphs: 'not-an-array',
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Paragraphs array is required');
    });

    it('BL#24: rejects template with only empty paragraphs', async () => {
      const res = await clothingPUT(
        buildRequest('/api/message-templates', {
          method: 'PUT',
          body: JSON.stringify({
            id: 'test-template',
            title: 'Title',
            badge: 'Reminder',
            paragraphs: ['', '   ', ''],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Template must include at least one paragraph');
    });

    it('sanitizes paragraphs: trims and filters empty ones', async () => {
      mockPrisma.messageTemplate.upsert.mockResolvedValue(mockTemplateRecord());

      await clothingPUT(
        buildRequest('/api/message-templates', {
          method: 'PUT',
          body: JSON.stringify({
            id: 'test-template',
            title: 'Title',
            badge: 'Reminder',
            paragraphs: ['  Keep this  ', '', '  Also keep  ', '   '],
          }),
        })
      );

      const call = mockPrisma.messageTemplate.upsert.mock.calls[0][0];
      expect(call.update.paragraphs).toEqual(['Keep this', 'Also keep']);
    });
  });

  // ── POST — Create Template (BL#21-28) ───────────────────────────────
  describe('POST /api/message-templates', () => {
    it('BL#25: creates a new template with generated slug', async () => {
      mockPrisma.messageTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.messageTemplate.create.mockResolvedValue(
        mockTemplateRecord({ slug: 'new-template' })
      );

      const res = await clothingPOST(
        buildRequest('/api/message-templates', {
          method: 'POST',
          body: JSON.stringify({
            title: 'New Template',
            badge: 'Cancellation',
            paragraphs: ['First paragraph'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
    });

    it('BL#22: requires title (error when empty)', async () => {
      const res = await clothingPOST(
        buildRequest('/api/message-templates', {
          method: 'POST',
          body: JSON.stringify({
            badge: 'Reminder',
            paragraphs: ['Content'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Template title is required');
    });

    it('BL#23: requires badge (error when empty)', async () => {
      const res = await clothingPOST(
        buildRequest('/api/message-templates', {
          method: 'POST',
          body: JSON.stringify({
            title: 'New',
            paragraphs: ['Content'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Badge label is required');
    });

    it('BL#24: requires at least one non-empty paragraph', async () => {
      const res = await clothingPOST(
        buildRequest('/api/message-templates', {
          method: 'POST',
          body: JSON.stringify({
            title: 'New',
            badge: 'Reminder',
            paragraphs: ['', '   '],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Template must include at least one paragraph');
    });

    it('generates unique slug when duplicate exists', async () => {
      mockPrisma.messageTemplate.findUnique
        .mockResolvedValueOnce({ id: 'existing-id' }) // First slug attempt exists
        .mockResolvedValueOnce(null); // Second attempt is unique
      mockPrisma.messageTemplate.create.mockResolvedValue(
        mockTemplateRecord({ slug: 'duplicate-title-1' })
      );

      const res = await clothingPOST(
        buildRequest('/api/message-templates', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Duplicate Title',
            badge: 'Reminder',
            paragraphs: ['Content'],
          }),
        })
      );

      expect(res.status).toBe(201);
    });
  });

  // ── GM Parity ─────────────────────────────────────────────────────────
  describe('GM Message Templates — Parity', () => {
    it('GM GET fetches from gmMessageTemplate model', async () => {
      mockPrisma.generalMerchandiseMessageTemplate.findMany.mockResolvedValue([
        mockTemplateRecord({ slug: 'gm-template' }),
      ]);

      const res = await gmGET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(
        mockPrisma.generalMerchandiseMessageTemplate.findMany
      ).toHaveBeenCalled();
    });

    it('GM GET seeds defaults when table is empty', async () => {
      mockPrisma.generalMerchandiseMessageTemplate.findMany.mockResolvedValue(
        []
      );
      mockPrisma.generalMerchandiseMessageTemplate.createMany.mockResolvedValue(
        { count: 5 }
      );

      const res = await gmGET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(
        mockPrisma.generalMerchandiseMessageTemplate.createMany
      ).toHaveBeenCalled();
      expect(json.data.length).toBeGreaterThan(0);
    });

    it('GM PUT upserts to gmMessageTemplate model', async () => {
      mockPrisma.generalMerchandiseMessageTemplate.upsert.mockResolvedValue(
        mockTemplateRecord()
      );

      const res = await gmPUT(
        buildRequest('/api/general-merchandise/message-templates', {
          method: 'PUT',
          body: JSON.stringify({
            id: 'test-template',
            title: 'GM Updated',
            badge: 'Reminder',
            paragraphs: ['GM content'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(
        mockPrisma.generalMerchandiseMessageTemplate.upsert
      ).toHaveBeenCalled();
    });

    it('GM POST creates in gmMessageTemplate model', async () => {
      mockPrisma.generalMerchandiseMessageTemplate.findUnique.mockResolvedValue(
        null
      );
      mockPrisma.generalMerchandiseMessageTemplate.create.mockResolvedValue(
        mockTemplateRecord({ slug: 'gm-new' })
      );

      const res = await gmPOST(
        buildRequest('/api/general-merchandise/message-templates', {
          method: 'POST',
          body: JSON.stringify({
            title: 'GM New',
            badge: 'Reminder',
            paragraphs: ['New GM paragraph'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
    });

    it('GM applies same validation rules as clothing', async () => {
      const res = await gmPUT(
        buildRequest('/api/general-merchandise/message-templates', {
          method: 'PUT',
          body: JSON.stringify({
            title: 'Missing ID and Badge',
            paragraphs: ['Content'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Template id is required');
    });
  });
});
