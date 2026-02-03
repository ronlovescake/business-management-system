import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE } from '@/app/api/item-weights/route';
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      itemWeight: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', async () => {
  const { mockLogger } = await import('@/core/testing/test-helpers');
  return { logger: mockLogger };
});

const createRequest = (options: Parameters<typeof mockNextRequest>[0]) =>
  mockNextRequest(options) as NextRequest;

const mockItemWeight = {
  id: 'weight-1',
  itemName: 'Sample Item',
  bulkQuantity: new Prisma.Decimal(10),
  bulkWeight: new Prisma.Decimal(100),
  approxWeightPerPiece: new Prisma.Decimal(10),
  createdAt: new Date('2024-01-01T00:00:00Z'),
  deletedAt: null,
};

describe('Item Weights API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/item-weights', () => {
    it('returns paginated item weights with metadata', async () => {
      mockPrisma.itemWeight.findMany.mockResolvedValue([mockItemWeight]);
      mockPrisma.itemWeight.count.mockResolvedValue(1);

      const request = createRequest({
        url: getTestApiUrl('/api/item-weights'),
        searchParams: { search: 'sample', limit: '5', offset: '10' },
      });

      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data.data).toHaveLength(1);
      expect(payload.data.total).toBe(1);
      expect(payload.data.limit).toBe(5);
      expect(payload.data.offset).toBe(10);
      expect(mockPrisma.itemWeight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
          take: 5,
          skip: 10,
          select: expect.any(Object),
        })
      );
    });

    it('returns validation error for invalid limit', async () => {
      const request = createRequest({
        url: getTestApiUrl('/api/item-weights'),
        searchParams: { limit: 'invalid' },
      });

      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(422);
      expect(payload.success).toBe(false);
      expect(payload.validationErrors).toBeDefined();
    });
  });

  describe('POST /api/item-weights', () => {
    it('creates an item weight when payload is valid', async () => {
      mockPrisma.itemWeight.create.mockResolvedValue(mockItemWeight);

      const request = createRequest({
        method: 'POST',
        url: getTestApiUrl('/api/item-weights'),
        body: {
          itemName: 'Sample Item',
          bulkQuantity: 10,
          bulkWeight: 100,
        },
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(payload.data.itemName).toBe('Sample Item');
      expect(mockPrisma.itemWeight.create).toHaveBeenCalled();
    });

    it('rejects invalid bulk quantity with validation error', async () => {
      const request = createRequest({
        method: 'POST',
        url: getTestApiUrl('/api/item-weights'),
        body: {
          itemName: 'Sample Item',
          bulkQuantity: 0,
          bulkWeight: 100,
        },
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(422);
      expect(payload.error).toBe('Validation failed');
      expect(payload.validationErrors).toBeDefined();
      expect(mockPrisma.itemWeight.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/item-weights', () => {
    it('updates an item weight and recalculates approx weight per piece', async () => {
      const updated = {
        ...mockItemWeight,
        bulkQuantity: new Prisma.Decimal(5),
        bulkWeight: new Prisma.Decimal(50),
        approxWeightPerPiece: new Prisma.Decimal(10),
      };

      mockPrisma.itemWeight.findUnique.mockResolvedValue(mockItemWeight);
      mockPrisma.itemWeight.update.mockResolvedValue(updated);

      const request = createRequest({
        method: 'PUT',
        url: getTestApiUrl('/api/item-weights'),
        body: {
          id: mockItemWeight.id,
          bulkQuantity: 5,
          bulkWeight: 50,
        },
      });

      const response = await PUT(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data.approxWeightPerPiece).toBe('10.00');
      expect(mockPrisma.itemWeight.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockItemWeight.id },
        })
      );
    });

    it('returns not found when ID does not exist', async () => {
      mockPrisma.itemWeight.findUnique.mockResolvedValue(null);

      const request = createRequest({
        method: 'PUT',
        url: getTestApiUrl('/api/item-weights'),
        body: { id: 'missing-id', bulkQuantity: 5 },
      });

      const response = await PUT(request);
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.error).toBe('Item weight not found');
    });
  });

  describe('DELETE /api/item-weights', () => {
    it('soft deletes an item weight', async () => {
      mockPrisma.itemWeight.update.mockResolvedValue(mockItemWeight);

      const request = createRequest({
        method: 'DELETE',
        url: getTestApiUrl('/api/item-weights', { id: mockItemWeight.id }),
      });

      const response = await DELETE(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(mockPrisma.itemWeight.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: expect.any(Date) },
        })
      );
    });

    it('returns bad request when id is missing', async () => {
      const request = createRequest({
        method: 'DELETE',
        url: getTestApiUrl('/api/item-weights'),
      });

      const response = await DELETE(request);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error).toBe('Item weight ID is required');
    });
  });
});
