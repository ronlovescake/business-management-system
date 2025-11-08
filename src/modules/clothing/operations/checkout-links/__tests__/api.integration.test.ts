import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { CheckoutLink } from '@prisma/client';
import { GET, POST } from '@/app/api/checkout-links/route';
import { prisma } from '@/lib/db';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  checkoutLink: {
    findMany: vi.fn(),
    count: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('CheckoutLinks API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/checkout-links', () => {
    it('should return all records with pagination metadata', async () => {
      const mockData: CheckoutLink[] = [
        {
          id: 'chk-1',
          weight: '5kg',
          width: '10in',
          length: '15in',
          height: '8in',
          checkoutLinks: 'https://example.com/checkout-1',
          productPortals: 'https://portal.example.com/1',
          productNames: 'Sample Product',
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          updatedAt: new Date('2025-01-02T00:00:00.000Z'),
          deletedAt: null,
        },
      ];

      vi.mocked(prisma.checkoutLink.findMany).mockResolvedValue(mockData);
      vi.mocked(prisma.checkoutLink.count).mockResolvedValue(1);

      const request = new NextRequest(
        getTestApiUrl('/api/checkout-links', {
          search: 'sample',
          limit: '10',
          offset: '0',
        })
      );

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.checkoutLink.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: expect.any(Array),
        },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.checkoutLink.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: expect.any(Array),
        },
      });
      expect(body.total).toBe(1);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data[0]).toMatchObject({
        id: 'chk-1',
        weight: '5kg',
        width: '10in',
        length: '15in',
        height: '8in',
        checkoutLinks: 'https://example.com/checkout-1',
        productPortals: 'https://portal.example.com/1',
        productNames: 'Sample Product',
      });
    });
  });

  describe('POST /api/checkout-links', () => {
    it('should create multiple checkout links successfully', async () => {
      vi.mocked(prisma.checkoutLink.createMany).mockResolvedValue({ count: 2 });

      const payload = {
        items: [
          {
            weight: '5kg',
            width: '10in',
            length: '15in',
            height: '8in',
            checkoutLinks: 'https://example.com/checkout-1',
            productPortals: 'https://portal.example.com/1',
            productNames: 'Sample Product 1',
          },
          {
            weight: '6kg',
            width: '12in',
            length: '18in',
            height: '9in',
            checkoutLinks: 'https://example.com/checkout-2',
            productPortals: 'https://portal.example.com/2',
            productNames: 'Sample Product 2',
          },
        ],
      };

      const request = new NextRequest(getTestApiUrl('/api/checkout-links'), {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.checkoutLink.createMany).toHaveBeenCalledWith({
        data: payload.items,
        skipDuplicates: true,
      });
      expect(body).toEqual({
        success: true,
        count: 2,
        message: 'Successfully imported 2 checkout links',
      });
    });

    it('should reject invalid payloads with validation errors', async () => {
      const request = new NextRequest(getTestApiUrl('/api/checkout-links'), {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toHaveProperty('error', 'Validation failed');
      expect(prisma.checkoutLink.createMany).not.toHaveBeenCalled();
    });
  });
});
