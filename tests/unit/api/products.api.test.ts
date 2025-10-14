import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      product: {
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
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
  },
}));

import { GET, POST, PUT, DELETE } from '@/app/api/products/route';

describe('Products API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/products', () => {
    it('should return all products successfully', async () => {
      const mockProducts = [
        {
          id: 1,
          shipmentCode: 'SHIP-001',
          productCode: 'PROD-001',
          unitPrice: 100.0,
          quantity: 50,
          cvNumber: null,
          noOfSacks: 0,
          totalCBM: 0,
          weight: 0,
          shipmentStatus: null,
          postingDate: null,
          orderDate: null,
          payment: null,
          product: null,
          ageRange: null,
          unit: null,
          alibabaShippingCost: 0,
          exchangeRates: 0,
          php: 0,
          subTotalPHP: 0,
          transactionFee: 0,
          grandTotal: 0,
          forwardersFee: 0,
          lalamove: 0,
          packagingCost: 0,
          suggestedPrice: 0,
          actualPrice: 0,
          basePrice: 0,
          cogs: 0,
          projectedSales: 0,
          projectedProfit: 0,
          projectedProfitPercent: 0,
          totalMarkup: 0,
        },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
    });

    it('should return empty array when no products exist', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });

  describe('POST /api/products', () => {
    it('should create a single product successfully', async () => {
      const singleProduct = [
        {
          'Shipment Code': 'SHIP-002',
          'Product Code': 'PROD-002',
          'Unit Price': 50.0,
          Quantity: 100,
        },
      ];

      const createdProduct = {
        id: 2,
        shipmentCode: 'SHIP-002',
        productCode: 'PROD-002',
        unitPrice: 50.0,
        quantity: 100,
        cvNumber: null,
        noOfSacks: 0,
        totalCBM: 0,
        weight: 0,
        shipmentStatus: null,
        postingDate: null,
        orderDate: null,
        payment: null,
        product: null,
        ageRange: null,
        unit: null,
        alibabaShippingCost: 0,
        exchangeRates: 0,
        php: 0,
        subTotalPHP: 0,
        transactionFee: 0,
        grandTotal: 0,
        forwardersFee: 0,
        lalamove: 0,
        packagingCost: 0,
        suggestedPrice: 0,
        actualPrice: 0,
        basePrice: 0,
        cogs: 0,
        projectedSales: 0,
        projectedProfit: 0,
        projectedProfitPercent: 0,
        totalMarkup: 0,
      };

      mockPrisma.product.create.mockResolvedValue(createdProduct);

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify(singleProduct),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Product added successfully');
    });

    it('should handle bulk import', async () => {
      const bulkProducts = [
        {
          'Shipment Code': 'SHIP-001',
          'Product Code': 'PROD-001',
        },
        {
          'Shipment Code': 'SHIP-002',
          'Product Code': 'PROD-002',
        },
      ];

      mockPrisma.product.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.product.createMany.mockResolvedValue({ count: 2 });

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify(bulkProducts),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Products imported successfully');
      expect(data.count).toBe(2);
    });

    it('should return 400 for non-array payload', async () => {
      const invalidPayload = {
        notAnArray: true,
      };

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Expected an array of products');
    });
  });

  describe('PUT /api/products', () => {
    it('should replace all products', async () => {
      const bulkProducts = [
        {
          'Shipment Code': 'SHIP-003',
          'Product Code': 'PROD-003',
        },
      ];

      mockPrisma.product.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.product.createMany.mockResolvedValue({ count: 1 });

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'PUT',
        body: JSON.stringify(bulkProducts),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Products updated successfully');
    });
  });

  describe('DELETE /api/products', () => {
    it('should delete all products successfully', async () => {
      mockPrisma.product.deleteMany.mockResolvedValue({ count: 25 });

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.count).toBe(25);
    });
  });
});
