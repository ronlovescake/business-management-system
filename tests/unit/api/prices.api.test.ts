import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      price: {
        findMany: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

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

import { GET, POST, DELETE } from '@/app/api/prices/route';
import { PUT, DELETE as DELETE_BY_ID } from '@/app/api/prices/[id]/route';

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

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0]['Product Code']).toBe('PROD-001');
    });

    it('should return empty array when no prices exist', async () => {
      mockPrisma.price.findMany.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });

  describe('POST /api/prices', () => {
    it('should import multiple prices successfully', async () => {
      const priceImport = [
        {
          'Product Code': 'PROD-001',
          'Lower Limit': 100,
          'Upper Limit': 500,
          Prices: 120,
          'Price Adjustment': 5,
        },
      ];

      mockPrisma.price.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.price.createMany.mockResolvedValue({ count: 1 });

      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify(priceImport),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.count).toBe(1);
    });

    it('should return 400 for non-array payload', async () => {
      const invalidPayload = {
        notAnArray: true,
      };

      const request = new NextRequest('http://localhost:3000/api/prices', {
        method: 'POST',
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid data format');
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

      mockPrisma.price.update.mockResolvedValue(updatedPrice);

      const request = new NextRequest('http://localhost:3000/api/prices/1', {
        method: 'PUT',
        body: JSON.stringify(priceUpdate),
      });

      const response = await PUT(request, { params: { id: '1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Price updated successfully');
    });

    it('should return 400 for invalid price ID', async () => {
      const priceUpdate = {
        'Product Code': 'PROD-001',
        'Lower Limit': 100,
        'Upper Limit': 500,
        Prices: 120,
        'Price Adjustment': 5,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/prices/invalid',
        {
          method: 'PUT',
          body: JSON.stringify(priceUpdate),
        }
      );

      const response = await PUT(request, { params: { id: 'invalid' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid price ID');
    });
  });

  describe('DELETE /api/prices/[id]', () => {
    it('should delete price successfully', async () => {
      mockPrisma.price.delete.mockResolvedValue({
        id: 1,
        productCode: 'PROD-001',
        lowerLimit: 10000,
        upperLimit: 50000,
        currentPrice: 12000,
        priceAdjustment: 500,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/prices/1');
      const response = await DELETE_BY_ID(request, { params: { id: '1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Price deleted successfully');
    });

    it('should return 400 for invalid price ID', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/prices/invalid'
      );
      const response = await DELETE_BY_ID(request, { params: { id: 'invalid' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid price ID');
    });
  });

  describe('DELETE /api/prices', () => {
    it('should delete all prices successfully', async () => {
      mockPrisma.price.deleteMany.mockResolvedValue({ count: 15 });

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.count).toBe(15);
    });
  });
});
