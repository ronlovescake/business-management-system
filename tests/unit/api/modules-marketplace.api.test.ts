/**
 * Modules — Marketplace API (Business Rule Tests)
 *
 * Rules from docs/business-logic/platform/module-marketplace-and-module-operations.md:
 *   #23 — Marketplace listing only exposes published: true modules
 *   #24 — Search spans name, description, keywords; category filter supported
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- hoisted mocks ----

const { mockPrisma } = vi.hoisted(() => {
  const findMany = vi.fn();
  return {
    mockPrisma: {
      moduleMarketplace: {
        findMany,
      },
    },
  };
});

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Modules — Marketplace API (Business Rules)', () => {
  // -----------------------------------------------------------------------
  // Rule #23: Marketplace listing only exposes published: true modules
  // -----------------------------------------------------------------------

  describe('Rule #23: Only published modules are listed', () => {
    it('passes published: true in prisma where clause', async () => {
      mockPrisma.moduleMarketplace.findMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/marketplace/modules/route');
      const req = new NextRequest('http://localhost/api/marketplace/modules');
      await GET(req);

      const call = mockPrisma.moduleMarketplace.findMany.mock.calls[0][0];
      expect(call.where.published).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Rule #24: Search spans name, description, keywords; category filter
  // -----------------------------------------------------------------------

  describe('Rule #24: Search and category filtering', () => {
    it('applies search filter across name, description, and keywords', async () => {
      mockPrisma.moduleMarketplace.findMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/marketplace/modules/route');
      const req = new NextRequest(
        'http://localhost/api/marketplace/modules?search=dashboard'
      );
      await GET(req);

      const call = mockPrisma.moduleMarketplace.findMany.mock.calls[0][0];
      const orConditions = call.where.AND[0].OR;

      expect(orConditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: { contains: 'dashboard', mode: 'insensitive' },
          }),
          expect.objectContaining({
            description: { contains: 'dashboard', mode: 'insensitive' },
          }),
          expect.objectContaining({
            keywords: { has: 'dashboard' },
          }),
        ])
      );
    });

    it('applies category filter via keywords has', async () => {
      mockPrisma.moduleMarketplace.findMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/marketplace/modules/route');
      const req = new NextRequest(
        'http://localhost/api/marketplace/modules?category=analytics'
      );
      await GET(req);

      const call = mockPrisma.moduleMarketplace.findMany.mock.calls[0][0];
      expect(call.where.keywords).toEqual({ has: 'analytics' });
    });

    it('supports sort parameter', async () => {
      mockPrisma.moduleMarketplace.findMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/marketplace/modules/route');
      const req = new NextRequest(
        'http://localhost/api/marketplace/modules?sort=rating'
      );
      await GET(req);

      const call = mockPrisma.moduleMarketplace.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ rating: 'desc' });
    });

    it('defaults to sort by downloads', async () => {
      mockPrisma.moduleMarketplace.findMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/marketplace/modules/route');
      const req = new NextRequest('http://localhost/api/marketplace/modules');
      await GET(req);

      const call = mockPrisma.moduleMarketplace.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ downloads: 'desc' });
    });
  });
});
