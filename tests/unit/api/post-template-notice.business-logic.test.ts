/**
 * Business Logic Tests for Post Template Notice Routes (GET/PUT)
 *
 * Covers:
 * - BL#1-3: GET loads the singleton notice (creates default if missing)
 * - BL#4-7: introParagraphs management and sanitization
 * - BL#8-11: bulletPoints management and sanitization
 * - BL#12-15: PUT upserts the singleton notice with validation
 * - Validation: at least 1 intro paragraph required, at least 1 bullet required
 * - Sanitization: empty and whitespace-only entries are filtered, strings trimmed
 * - Parity: clothing and GM use the same factory + service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl, mockLogger } from '@/core/testing/test-helpers';

// ── Prisma mock ──────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  postTemplateNotice: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  generalMerchandisePostTemplateNotice: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

import {
  GET as clothingGET,
  PUT as clothingPUT,
} from '@/app/api/post-template-notice/route';

import {
  GET as gmGET,
  PUT as gmPUT,
} from '@/app/api/general-merchandise/post-template-notice/route';

// ── Helpers ──────────────────────────────────────────────────────────────
const buildRequest = (
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) => new NextRequest(getTestApiUrl(path), init);

const NOTICE_SLUG = 'post-template-notice';

const mockNoticeRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'uuid-1',
  slug: NOTICE_SLUG,
  introParagraphs: ['Dear Customer,', 'Please find your order details below.'],
  bulletPoints: ['Item: Widget', 'Qty: 10'],
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────
describe('Post Template Notice Routes — Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET ──────────────────────────────────────────────────────────────
  describe('GET /api/post-template-notice', () => {
    it('BL#1: loads the existing singleton notice', async () => {
      const record = mockNoticeRecord();
      mockPrisma.postTemplateNotice.findUnique.mockResolvedValue(record);

      const res = await clothingGET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.introParagraphs).toEqual(record.introParagraphs);
      expect(json.data.bulletPoints).toEqual(record.bulletPoints);
    });

    it('BL#2: provides id from slug field', async () => {
      const record = mockNoticeRecord();
      mockPrisma.postTemplateNotice.findUnique.mockResolvedValue(record);

      const res = await clothingGET();
      const json = await res.json();

      expect(json.data.id).toBe(NOTICE_SLUG);
    });

    it('BL#3: creates default notice when none exists', async () => {
      mockPrisma.postTemplateNotice.findUnique.mockResolvedValue(null);
      mockPrisma.postTemplateNotice.create.mockResolvedValue(
        mockNoticeRecord()
      );

      const res = await clothingGET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockPrisma.postTemplateNotice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: NOTICE_SLUG,
          }),
        })
      );
    });

    it('default notice contains populated introParagraphs and bulletPoints', async () => {
      mockPrisma.postTemplateNotice.findUnique.mockResolvedValue(null);
      mockPrisma.postTemplateNotice.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'new-uuid',
          slug: data.slug as string,
          introParagraphs: data.introParagraphs,
          bulletPoints: data.bulletPoints,
        })
      );

      const res = await clothingGET();
      const json = await res.json();

      expect(json.data.introParagraphs.length).toBeGreaterThan(0);
      expect(json.data.bulletPoints.length).toBeGreaterThan(0);
    });

    it('returns 500 on service error', async () => {
      mockPrisma.postTemplateNotice.findUnique.mockRejectedValue(
        new Error('DB error')
      );

      const res = await clothingGET();
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to load post template notice');
    });
  });

  // ── PUT — Upsert Notice (BL#12-15) ─────────────────────────────────
  describe('PUT /api/post-template-notice', () => {
    it('BL#12: upserts the singleton notice', async () => {
      const updated = mockNoticeRecord({
        introParagraphs: ['Updated intro'],
        bulletPoints: ['Updated bullet'],
      });
      mockPrisma.postTemplateNotice.upsert.mockResolvedValue(updated);

      const res = await clothingPUT(
        buildRequest('/api/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: ['Updated intro'],
            bulletPoints: ['Updated bullet'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockPrisma.postTemplateNotice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: NOTICE_SLUG },
          update: expect.objectContaining({
            introParagraphs: ['Updated intro'],
            bulletPoints: ['Updated bullet'],
          }),
          create: expect.objectContaining({
            slug: NOTICE_SLUG,
            introParagraphs: ['Updated intro'],
            bulletPoints: ['Updated bullet'],
          }),
        })
      );
    });

    it('BL#4: requires at least one intro paragraph', async () => {
      const res = await clothingPUT(
        buildRequest('/api/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: [],
            bulletPoints: ['Valid bullet'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('At least one intro paragraph is required');
    });

    it('BL#8: requires at least one bullet point', async () => {
      const res = await clothingPUT(
        buildRequest('/api/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: ['Valid intro'],
            bulletPoints: [],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('At least one bullet point is required');
    });

    it('BL#5: rejects when all intro paragraphs are empty/whitespace', async () => {
      const res = await clothingPUT(
        buildRequest('/api/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: ['', '   ', ''],
            bulletPoints: ['Valid'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('At least one intro paragraph is required');
    });

    it('BL#9: rejects when all bullet points are empty/whitespace', async () => {
      const res = await clothingPUT(
        buildRequest('/api/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: ['Valid intro'],
            bulletPoints: ['', '   '],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('At least one bullet point is required');
    });

    it('BL#6: sanitizes introParagraphs — trims and filters empty', async () => {
      mockPrisma.postTemplateNotice.upsert.mockResolvedValue(
        mockNoticeRecord()
      );

      await clothingPUT(
        buildRequest('/api/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: ['  Keep this  ', '', '  Also keep  ', '   '],
            bulletPoints: ['Bullet'],
          }),
        })
      );

      const call = mockPrisma.postTemplateNotice.upsert.mock.calls[0][0];
      expect(call.update.introParagraphs).toEqual(['Keep this', 'Also keep']);
    });

    it('BL#10: sanitizes bulletPoints — trims and filters empty', async () => {
      mockPrisma.postTemplateNotice.upsert.mockResolvedValue(
        mockNoticeRecord()
      );

      await clothingPUT(
        buildRequest('/api/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: ['Intro'],
            bulletPoints: ['  Item A  ', '', '  Item B  ', '   '],
          }),
        })
      );

      const call = mockPrisma.postTemplateNotice.upsert.mock.calls[0][0];
      expect(call.update.bulletPoints).toEqual(['Item A', 'Item B']);
    });

    it('BL#7: treats non-array introParagraphs as empty', async () => {
      const res = await clothingPUT(
        buildRequest('/api/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: 'not-an-array',
            bulletPoints: ['Valid'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('At least one intro paragraph is required');
    });

    it('BL#11: treats non-array bulletPoints as empty', async () => {
      const res = await clothingPUT(
        buildRequest('/api/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: ['Valid'],
            bulletPoints: 'not-an-array',
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('At least one bullet point is required');
    });

    it('handles non-string entries in arrays gracefully', async () => {
      const res = await clothingPUT(
        buildRequest('/api/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: [123, null, undefined, 'Valid'],
            bulletPoints: [true, 'Also valid'],
          }),
        })
      );

      // Non-strings should be sanitized to empty and filtered, leaving valid ones
      expect(res.status).toBe(200);
    });

    it('returns 500 on service error during upsert', async () => {
      mockPrisma.postTemplateNotice.upsert.mockRejectedValue(
        new Error('DB error')
      );

      const res = await clothingPUT(
        buildRequest('/api/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: ['Valid'],
            bulletPoints: ['Valid'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to update post template notice');
    });
  });

  // ── GM Parity ─────────────────────────────────────────────────────────
  describe('GM Post Template Notice — Parity', () => {
    it('GM GET loads the notice via GM model', async () => {
      mockPrisma.generalMerchandisePostTemplateNotice.findUnique.mockResolvedValue(
        mockNoticeRecord()
      );

      const res = await gmGET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(
        mockPrisma.generalMerchandisePostTemplateNotice.findUnique
      ).toHaveBeenCalled();
    });

    it('GM GET creates default via GM model when not found', async () => {
      mockPrisma.generalMerchandisePostTemplateNotice.findUnique.mockResolvedValue(
        null
      );
      mockPrisma.generalMerchandisePostTemplateNotice.create.mockResolvedValue(
        mockNoticeRecord()
      );

      const res = await gmGET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(
        mockPrisma.generalMerchandisePostTemplateNotice.create
      ).toHaveBeenCalled();
    });

    it('GM PUT upserts via GM model', async () => {
      mockPrisma.generalMerchandisePostTemplateNotice.upsert.mockResolvedValue(
        mockNoticeRecord()
      );

      const res = await gmPUT(
        buildRequest('/api/general-merchandise/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: ['GM intro'],
            bulletPoints: ['GM bullet'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(
        mockPrisma.generalMerchandisePostTemplateNotice.upsert
      ).toHaveBeenCalled();
    });

    it('GM applies same validation rules', async () => {
      const res = await gmPUT(
        buildRequest('/api/general-merchandise/post-template-notice', {
          method: 'PUT',
          body: JSON.stringify({
            introParagraphs: [],
            bulletPoints: ['bullet'],
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('At least one intro paragraph is required');
    });
  });
});
