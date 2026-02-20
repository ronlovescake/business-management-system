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
 * - Selected quantity tracking
 * - Row number ordering (ASC)
 * - Empty row filtering (skip rows with all zeros unless checked)
 * - Delete + Insert pattern (replace all rows inside transaction)
 * - Percentage, groupNumber, distribution, checked fields
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { mockLogger } from '@/core/testing/test-helpers';

type MockFn<Args extends unknown[] = unknown[], Return = unknown> = Mock<
  Args,
  Return
>;

type TransactionClientMock = {
  $executeRawUnsafe: MockFn<[string, string?], Promise<unknown>>;
  sortingDistribution: {
    createMany: MockFn<[unknown], Promise<unknown>>;
  };
};

type PrismaMock = {
  sortingDistribution: {
    findMany: MockFn<[unknown], Promise<unknown[]>>;
    createMany: MockFn<[unknown], Promise<unknown>>;
    updateMany: MockFn<[unknown], Promise<unknown>>;
  };
  __tx: TransactionClientMock;
  $transaction: MockFn<
    [(client: TransactionClientMock) => Promise<unknown>],
    Promise<unknown>
  >;
};

const { prismaMock } = vi.hoisted(() => {
  const transactionClient: TransactionClientMock = {
    $executeRawUnsafe: vi.fn<[string, string?], Promise<unknown>>(),
    sortingDistribution: {
      createMany: vi.fn<[unknown], Promise<unknown>>(),
    },
  };

  const mock: PrismaMock = {
    sortingDistribution: {
      findMany: vi.fn<[unknown], Promise<unknown[]>>(),
      createMany: vi.fn<[unknown], Promise<unknown>>(),
      updateMany: vi.fn<[unknown], Promise<unknown>>(),
    },
    __tx: transactionClient,
    $transaction: vi.fn<
      [(client: TransactionClientMock) => Promise<unknown>],
      Promise<unknown>
    >(),
  };

  mock.$transaction.mockImplementation(async (cb) => cb(transactionClient));

  return { prismaMock: mock };
});

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { GET, POST, DELETE } from '@/app/api/sorting-distribution/route';
const prisma = prismaMock;

describe('Sorting Distribution API - /api/sorting-distribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma.__tx));
  });

  describe('GET /api/sorting-distribution', () => {
    it('should fetch sorting distribution data by productCode', async () => {
      const mockData = [
        {
          id: 1,
          productCode: 'PROD-001',
          selectedQuantity: 1000,
          rowNumber: 0,
          quantity: 100,
          percentage: 10.0,
          groupNumber: 'G1',
          distribution: 5,
          checked: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          productCode: 'PROD-001',
          selectedQuantity: 1000,
          rowNumber: 1,
          quantity: 200,
          percentage: 20.0,
          groupNumber: 'G2',
          distribution: 10,
          checked: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.sortingDistribution.findMany.mockResolvedValue(mockData);

      const request = new Request(
        'http://localhost/api/sorting-distribution?productCode=PROD-001'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(prisma.sortingDistribution.findMany).toHaveBeenCalledWith({
        where: {
          productCode: 'PROD-001',
          deletedAt: null,
        },
        orderBy: {
          rowNumber: 'asc',
        },
      });
      expect(data.data).toHaveLength(2);
      expect(data.selectedQuantity).toBe(1000);
      expect(data.data[0].quantity).toBe(100);
      expect(data.data[1].checked).toBe(true);
    });

    it('should return empty data when no rows found', async () => {
      prisma.sortingDistribution.findMany.mockResolvedValue([]);

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
      prisma.sortingDistribution.findMany.mockRejectedValue(
        new Error('DB Error')
      );

      const request = new Request(
        'http://localhost/api/sorting-distribution?productCode=PROD-001'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to load distribution data');
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

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.__tx.$executeRawUnsafe).toHaveBeenCalledWith(
        `DELETE FROM sorting_distributions WHERE "productCode" = $1`,
        'PROD-002'
      );
      expect(prisma.__tx.sortingDistribution.createMany).toHaveBeenCalledWith({
        data: [
          {
            productCode: 'PROD-002',
            selectedQuantity: 500,
            rowNumber: 0,
            quantity: 50,
            percentage: 10,
            groupNumber: 'A1',
            distribution: 3,
            checked: false,
          },
          {
            productCode: 'PROD-002',
            selectedQuantity: 500,
            rowNumber: 1,
            quantity: 100,
            percentage: 20,
            groupNumber: 'A2',
            distribution: 5,
            checked: true,
          },
        ],
      });
      expect(data.success).toBe(true);
      expect(data.savedCount).toBe(2);
      expect(data.message).toBe('Saved 2 distribution rows');
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

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.savedCount).toBe(2);
      expect(prisma.__tx.sortingDistribution.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ quantity: 50 }),
          expect.objectContaining({ quantity: 100 }),
        ]),
      });
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
            checked: true,
          },
        ],
      };

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.savedCount).toBe(1);
      expect(prisma.__tx.sortingDistribution.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            checked: true,
            quantity: 0,
          }),
        ],
      });
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

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.savedCount).toBe(0);
      expect(prisma.__tx.$executeRawUnsafe).toHaveBeenCalledTimes(1);
      expect(prisma.__tx.sortingDistribution.createMany).not.toHaveBeenCalled();
    });

    it('should return 400 when productCode is missing', async () => {
      const postData = {
        selectedQuantity: 100,
        rows: [],
      };

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Product code and rows are required');
    });

    it('should handle database errors during save', async () => {
      prisma.$transaction.mockImplementationOnce(async () => {
        throw new Error('DB Error');
      });

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
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to save distribution data');
    });

    it('should maintain rowNumber sequence correctly', async () => {
      const postData = {
        productCode: 'PROD-007',
        selectedQuantity: 1000,
        rows: [
          {
            quantity: 10,
            percentage: 1.0,
            groupNumber: 'R1',
            distribution: 1,
            checked: false,
          },
          {
            quantity: 20,
            percentage: 2.0,
            groupNumber: 'R2',
            distribution: 2,
            checked: false,
          },
          {
            quantity: 30,
            percentage: 3.0,
            groupNumber: 'R3',
            distribution: 3,
            checked: false,
          },
        ],
      };

      const request = new Request('http://localhost/api/sorting-distribution', {
        method: 'POST',
        body: JSON.stringify(postData),
        headers: {
          'content-type': 'application/json',
        },
      });

      await POST(request);

      const createManyCalls = prisma.__tx.sortingDistribution.createMany.mock
        .calls as Array<
        [
          {
            data: Array<{ rowNumber: number }>;
          },
        ]
      >;
      const createdRows = createManyCalls[0][0].data;

      expect(createdRows.map((row) => row.rowNumber)).toEqual([0, 1, 2]);
    });
  });

  describe('DELETE /api/sorting-distribution', () => {
    it('should delete sorting distribution data for a product', async () => {
      prisma.sortingDistribution.updateMany.mockResolvedValue({ count: 5 });

      const request = new Request(
        'http://localhost/api/sorting-distribution?productCode=PROD-001',
        { method: 'DELETE' }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(prisma.sortingDistribution.updateMany).toHaveBeenCalledWith({
        where: {
          productCode: 'PROD-001',
          deletedAt: null,
        },
        data: {
          deletedAt: expect.any(Date),
        },
      });
      expect(data.success).toBe(true);
      expect(data.deletedCount).toBe(5);
      expect(data.message).toBe('Deleted 5 distribution rows');
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
      prisma.sortingDistribution.updateMany.mockRejectedValue(
        new Error('DB Error')
      );

      const request = new Request(
        'http://localhost/api/sorting-distribution?productCode=PROD-001',
        { method: 'DELETE' }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete distribution data');
    });
  });
});
