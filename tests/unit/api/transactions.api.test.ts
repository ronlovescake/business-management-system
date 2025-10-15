import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/transactions/route';
import { prisma } from '@/lib/db';

vi.mock('@/lib/db', () => {
  const priceFindMany = vi.fn();
  const transactionCreateMany = vi.fn();

  return {
    prisma: {
      price: {
        findMany: priceFindMany,
      },
      transaction: {
        createMany: transactionCreateMany,
        findMany: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

type PrismaMock = {
  price: {
    findMany: ReturnType<typeof vi.fn>;
  };
  transaction: {
    createMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

const prismaMock = prisma as unknown as PrismaMock;

describe('POST /api/transactions', () => {
  beforeEach(() => {
    prismaMock.price.findMany.mockResolvedValue([
      {
        productCode: 'SKU-1',
        lowerLimit: 100,
        upperLimit: 1000,
        currentPrice: 25000,
      },
    ]);

    prismaMock.transaction.createMany.mockResolvedValue({ count: 1 });
  });

  it('calculates unit price and line total before inserting', async () => {
    const payload = [
      {
        'Order Date': 'Jan 15, 2025',
        Customers: 'Acme Corp',
        'Product Code': 'SKU-1',
        Quantity: '5',
        Discount: '10',
        Adjustment: '0',
        'Shipment Code': 'SHIP-001',
      },
    ];

    const request = new NextRequest('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const body = (await response.json()) as { count: number };

    expect(body.count).toBe(1);

    expect(prismaMock.transaction.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          productCode: 'SKU-1',
          quantity: 5,
          unitPrice: 240,
          lineTotal: 1200,
        }),
      ]),
    });
  });
});
