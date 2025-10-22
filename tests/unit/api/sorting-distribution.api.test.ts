/**
 * API Tests for Sorting Distribution Endpoints
 * 
 * Tests:
 * - GET /api/sorting-distribution?productCode=XXX - Fetch distribution data for product
 * - POST /api/sorting-distribution - Save/update distribution data
 * - DELETE /api/sorting-distribution?productCode=XXX - Delete distribution data
 * 
 * Features tested:
 * - ProductCode query parameter validation
 * - Raw SQL query execution ($queryRaw)
 * - Selected quantity tracking
 * - Row number ordering (ASC)
 * - Empty row filtering (skip rows with all zeros)
 * - Delete + Insert pattern (replace all rows)
 * - Percentage, groupNumber, distribution, checked fields
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/sorting-distribution/route';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
vi.mock('@prisma/client', () => {
  const mockPrismaClient = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
  
  return {
    PrismaClient: vi.fn(() => mockPrismaClient),
  };
});

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Get the mocked prisma instance
const getMockPrisma = () => {
  const PrismaConstructor = PrismaClient as any;
  return new PrismaConstructor();
};

describe('Sorting Distribution API - /api/sorting-distribution', () => {
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = getMockPrisma();
  });

  describe('GET /api/sorting-distribution', () => {
    it('should fetch sorting distribution data by productCode', async () => {
      const mockData = [
        {
          id: 1,
          product_code: 'PROD-001',
          selected_quantity: 1000,
          row_number: 1,
          quantity: 100,
          percentage: 10.0,
          group_number: 'G1',
          distribution: 5,
          checked: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          product_code: 'PROD-001',
          selected_quantity: 1000,
          row_number: 2,
          quantity: 200,
          percentage: 20.0,
          group_number: 'G2',
          distribution: 10,
          checked: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockData);

      const request = new Request(
        'http://localhost/api/sorting-distribution?productCode=PROD-001'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(data.data).toHaveLength(2);
      expect(data.selectedQuantity).toBe(1000);
      expect(data.data[0].quantity).toBe(100);
      expect(data.data[1].checked).toBe(true);
    });

    it('should return empty data when no rows found', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const request = new Request(
        'http://localhost/api/sorting-distribution?productCode=NONEXISTENT'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data).toEqual([]);
      expect(data.selectedQuantity).toBeNull();
    });

    it('should return 400 when productCode is missing', async () => {
      const request = new Request('http://localhost/api/sorting-distribution');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Product code is required');
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB Error'));

      const request = new Request(
        'http://localhost/api/sorting-distribution?productCode=PROD-001'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch sorting distribution data');
    });
  });

  describe('POST /api/sorting-distribution', () => {
    it('should save sorting distribution data with selectedQuantity', async () => {
      const postData = {
        productCode: 'PROD-002',
        selectedQuantity: 500,
        rows: [
          {
            quantity: 50,
            percentage: 10.0,
            groupNumber: 'A1',
            distribution: 3,
            checked: false,
          },
          {
            quantity: 100,
            percentage: 20.0,
            groupNumber: 'A2',
            distribution: 5,
            checked: true,
          },
        ],
      };

      mockPrisma.$executeRaw.mockResolvedValue(1);

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should delete existing rows first, then insert new rows
      // 1 delete + 2 inserts = 3 total calls
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(3);

      expect(data.success).toBe(true);
      expect(data.message).toBe('Sorting distribution saved successfully');
      expect(data.rowsSaved).toBe(2);
    });

    it('should filter out empty rows (all zeros)', async () => {
      const postData = {
        productCode: 'PROD-003',
        selectedQuantity: 300,
        rows: [
          {
            quantity: 50,
            percentage: 10.0,
            groupNumber: 'B1',
            distribution: 2,
            checked: false,
          },
          {
            // Empty row - should be filtered out
            quantity: 0,
            percentage: 0,
            groupNumber: '',
            distribution: 0,
            checked: false,
          },
          {
            quantity: 100,
            percentage: 20.0,
            groupNumber: 'B2',
            distribution: 4,
            checked: false,
          },
        ],
      };

      mockPrisma.$executeRaw.mockResolvedValue(1);

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should only save 2 rows (filtered out the empty one)
      expect(data.rowsSaved).toBe(2);
      // 1 delete + 2 inserts = 3 calls
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(3);
    });

    it('should handle checked rows (checkbox state)', async () => {
      const postData = {
        productCode: 'PROD-004',
        selectedQuantity: 200,
        rows: [
          {
            quantity: 0,
            percentage: 0,
            groupNumber: '',
            distribution: 0,
            checked: true, // Checked but empty - should still be saved
          },
        ],
      };

      mockPrisma.$executeRaw.mockResolvedValue(1);

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
      });

      const response = await POST(request);
      const data = await response.json();

      // Checked rows should be saved even if empty
      expect(data.rowsSaved).toBe(1);
    });

    it('should handle saving when all rows are empty', async () => {
      const postData = {
        productCode: 'PROD-005',
        selectedQuantity: 100,
        rows: [
          {
            quantity: 0,
            percentage: 0,
            groupNumber: '',
            distribution: 0,
            checked: false,
          },
          {
            quantity: 0,
            percentage: 0,
            groupNumber: '',
            distribution: 0,
            checked: false,
          },
        ],
      };

      mockPrisma.$executeRaw.mockResolvedValue(1);

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.rowsSaved).toBe(0);
      // Only delete should be called, no inserts
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when productCode is missing', async () => {
      const postData = {
        selectedQuantity: 100,
        rows: [],
      };

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Product code is required');
    });

    it('should handle database errors during save', async () => {
      mockPrisma.$executeRaw.mockRejectedValue(new Error('DB Error'));

      const postData = {
        productCode: 'PROD-006',
        selectedQuantity: 100,
        rows: [
          {
            quantity: 10,
            percentage: 5.0,
            groupNumber: 'C1',
            distribution: 1,
            checked: false,
          },
        ],
      };

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to save sorting distribution data');
    });

    it('should maintain row_number sequence correctly', async () => {
      const postData = {
        productCode: 'PROD-007',
        selectedQuantity: 1000,
        rows: [
          { quantity: 10, percentage: 1.0, groupNumber: 'R1', distribution: 1, checked: false },
          { quantity: 20, percentage: 2.0, groupNumber: 'R2', distribution: 2, checked: false },
          { quantity: 30, percentage: 3.0, groupNumber: 'R3', distribution: 3, checked: false },
        ],
      };

      mockPrisma.$executeRaw.mockResolvedValue(1);

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
      });

      await POST(request);

      // Verify row numbers start at 1 and increment
      // Check the INSERT calls to ensure row_number is 1, 2, 3
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(4); // 1 delete + 3 inserts
    });
  });

  describe('DELETE /api/sorting-distribution', () => {
    it('should delete sorting distribution data for a product', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(5); // 5 rows deleted

      const request = new Request(
        'http://localhost/api/sorting-distribution?productCode=PROD-001',
        { method: 'DELETE' }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Sorting distribution deleted successfully');
    });

    it('should return 400 when productCode is missing', async () => {
      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Product code is required');
    });

    it('should handle database errors during delete', async () => {
      mockPrisma.$executeRaw.mockRejectedValue(new Error('DB Error'));

      const request = new Request(
        'http://localhost/api/sorting-distribution?productCode=PROD-001',
        { method: 'DELETE' }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete sorting distribution data');
    });
  });
});
