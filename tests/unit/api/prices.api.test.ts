import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl, mockLogger } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      price: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        createMany: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn((callback) => {
        // Execute the callback with a mock transaction object
        return callback({
          price: {
            findFirst: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({ id: 1 }),
          },
        });
      }),
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { GET, POST, DELETE } from '@/app/api/prices/route';
import { PUT, DELETE as DELETE_BY_ID } from '@/app/api/prices/[id]/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (path: string, init?: NextRequestInit) =>
  new NextRequest(getTestApiUrl(path), init);

describe('Prices API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/prices', () => {
    it('should return all prices successfully', async () => {
      const mockPrices = [
        {
          id: 1,
          productCode: 'PROD-001',
          lowerLimit: 10000,
          upperLimit: 50000,
          currentPrice: 12000,
          priceAdjustment: 500,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.price.findMany.mockResolvedValue(mockPrices);

      const response = await GET(buildRequest('/api/prices'));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(Array.isArray(payload.data)).toBe(true);
      expect(payload.data.length).toBe(1);
      expect(payload.data[0]['Product Code']).toBe('PROD-001');
    });

    it('should return empty array when no prices exist', async () => {
      mockPrisma.price.findMany.mockResolvedValue([]);

      const response = await GET(buildRequest('/api/prices'));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(Array.isArray(payload.data)).toBe(true);
      expect(payload.data.length).toBe(0);
    });
  });

  describe('POST /api/prices', () => {
    it('should import multiple prices successfully', async () => {
      const priceImport = Array.from({ length: 11 }, (_, index) => ({
        'Product Code': `PROD-${String(index + 1).padStart(3, '0')}`,
        'Lower Limit': 100 + index * 10,
        'Upper Limit': 200 + index * 10,
        Prices: 150 + index,
        'Price Adjustment': 5,
      }));

      mockPrisma.price.deleteMany.mockResolvedValue({ count: 0 });

      // Mock the transaction to return the expected result
      mockPrisma.$transaction.mockResolvedValue({
        created: 1,
        updated: 0,
        restored: 0,
      });

      const request = new NextRequest(getTestApiUrl('/api/prices'), {
        method: 'POST',
        body: JSON.stringify(priceImport),
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Prices imported successfully');
      expect(payload.data.created).toBe(1);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should return 400 for non-array payload', async () => {
      const invalidPayload = {
        notAnArray: true,
      };

      const request = new NextRequest(getTestApiUrl('/api/prices'), {
        method: 'POST',
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('Invalid data format');
    });
  });

  describe('PUT /api/prices/[id]', () => {
    it('should update price successfully', async () => {
      const priceUpdate = {
        'Product Code': 'PROD-001',
        'Lower Limit': 150,
        'Upper Limit': 600,
        Prices: 200,
        'Price Adjustment': 10,
      };

      const updatedPrice = {
        id: 1,
        productCode: 'PROD-001',
        lowerLimit: 15000,
        upperLimit: 60000,
        currentPrice: 20000,
        priceAdjustment: 1000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.price.findUnique.mockResolvedValue(updatedPrice);
      mockPrisma.price.update.mockResolvedValue(updatedPrice);

      const request = new NextRequest(getTestApiUrl('/api/prices/1'), {
        method: 'PUT',
        body: JSON.stringify(priceUpdate),
      });

      const response = await PUT(request, { params: { id: '1' } });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Price updated successfully');
      expect(payload.data['Product Code']).toBe('PROD-001');
    });

    it('should return 400 for invalid price ID', async () => {
      const priceUpdate = {
        'Product Code': 'PROD-001',
        'Lower Limit': 100,
        'Upper Limit': 500,
        Prices: 120,
        'Price Adjustment': 5,
      };

      const request = new NextRequest(getTestApiUrl('/api/prices/invalid'), {
        method: 'PUT',
        body: JSON.stringify(priceUpdate),
      });

      const response = await PUT(request, { params: { id: 'invalid' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid price ID');
      expect(mockPrisma.price.findUnique).not.toHaveBeenCalled();
    });

    it('should return 404 when price is not found', async () => {
      mockPrisma.price.findUnique.mockResolvedValue(null);
      const priceUpdate = {
        'Product Code': 'PROD-999',
        'Lower Limit': 100,
        'Upper Limit': 200,
        Prices: 150,
        'Price Adjustment': 10,
      };

      const request = new NextRequest(getTestApiUrl('/api/prices/999'), {
        method: 'PUT',
        body: JSON.stringify(priceUpdate),
      });

      const response = await PUT(request, { params: { id: '999' } });
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Price not found');
      expect(mockPrisma.price.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/prices/[id]', () => {
    it('should delete price successfully', async () => {
      const mockPrice = {
        id: 1,
        productCode: 'PROD-001',
        lowerLimit: 10000,
        upperLimit: 50000,
        currentPrice: 12000,
        priceAdjustment: 500,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.price.findUnique.mockResolvedValue(mockPrice);
      mockPrisma.price.delete.mockResolvedValue(mockPrice);

      const request = new NextRequest(getTestApiUrl('/api/prices/1'));
      const response = await DELETE_BY_ID(request, { params: { id: '1' } });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Price deleted successfully');
      expect(payload.data.id).toBe(1);
    });

    it('should return 400 for invalid price ID', async () => {
      const request = new NextRequest(getTestApiUrl('/api/prices/invalid'));
      const response = await DELETE_BY_ID(request, {
        params: { id: 'invalid' },
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid price ID');
      expect(mockPrisma.price.findUnique).not.toHaveBeenCalled();
    });

    it('should return 404 when deleting non-existent price', async () => {
      mockPrisma.price.findUnique.mockResolvedValue(null);

      const request = new NextRequest(getTestApiUrl('/api/prices/123'));
      const response = await DELETE_BY_ID(request, { params: { id: '123' } });
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Price not found');
      expect(mockPrisma.price.delete).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/prices', () => {
    it('should delete all prices successfully with confirmation', async () => {
      mockPrisma.price.count.mockResolvedValue(0);
      mockPrisma.price.updateMany.mockResolvedValue({ count: 15 });

      const request = new NextRequest(
        getTestApiUrl('/api/prices', { confirm: 'DELETE_ALL_PRICES' }),
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Prices soft deleted');
      expect(payload.data.deleted).toBe(15);
    });

    it('should return 400 without confirmation parameter', async () => {
      const request = new NextRequest(getTestApiUrl('/api/prices'), {
        method: 'DELETE',
      });
      const response = await DELETE(request);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Mass deletion protection');
    });
  });
});
