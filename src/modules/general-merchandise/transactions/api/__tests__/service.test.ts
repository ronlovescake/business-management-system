import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  customer: {
    findMany: vi.fn(),
  },
  generalMerchandiseProduct: {
    findMany: vi.fn(),
  },
  generalMerchandiseShipment: {
    findMany: vi.fn(),
  },
  generalMerchandisePrice: {
    findMany: vi.fn(),
  },
  generalMerchandiseTransaction: {
    createMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  generalMerchandiseInventoryMovement: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('generalMerchandiseTransactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.generalMerchandisePrice.findMany.mockResolvedValue([]);
    mockPrisma.customer.findMany.mockResolvedValue([
      { customerName: 'ACME Retail' },
    ]);
    mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue([
      { productCode: 'GM-001' },
    ]);
    mockPrisma.generalMerchandiseShipment.findMany.mockResolvedValue([
      { shipmentCode: 'GM-SHIP-001' },
    ]);
    mockPrisma.generalMerchandiseTransaction.createMany.mockResolvedValue({
      count: 1,
    });
    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([]);
    mockPrisma.generalMerchandiseInventoryMovement.findFirst.mockResolvedValue(
      null
    );
    mockPrisma.generalMerchandiseInventoryMovement.create.mockImplementation(
      async ({ notes }) => ({ id: notes === 'auto-reserve txn 7' ? 71 : 72 })
    );
    mockPrisma.generalMerchandiseInventoryMovement.updateMany.mockResolvedValue(
      { count: 0 }
    );
  });

  it('skips prepared template rows without undercounting imported GM transactions', async () => {
    vi.resetModules();
    const { generalMerchandiseTransactionService } = await import('../service');

    const summary =
      await generalMerchandiseTransactionService.importTransactions([
        {
          'Order Date': '2026-03-17',
          Customers: 'ACME Retail',
          'Product Code': '',
          Quantity: 0,
          'Unit Price': 0,
          Discount: 0,
          Adjustment: 0,
          'Line Total': 0,
          'Order Status': 'Prepared',
          Notes: null,
          'Invoice Date': null,
          'Packed Date': null,
          'Shipment Code': null,
        },
        {
          'Order Date': '2026-03-17',
          Customers: 'ACME Retail',
          'Product Code': 'GM-001',
          Quantity: 2,
          'Unit Price': 50,
          Discount: 0,
          Adjustment: 0,
          'Line Total': 100,
          'Order Status': 'Warehouse',
          Notes: 'real row',
          'Invoice Date': null,
          'Packed Date': null,
          'Shipment Code': 'GM-SHIP-001',
        },
      ]);

    expect(
      mockPrisma.generalMerchandiseTransaction.createMany
    ).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          customers: 'ACME Retail',
          productCode: 'GM-001',
          quantity: 2,
          lineTotal: 100,
        }),
      ],
    });
    expect(summary).toEqual({
      count: 1,
      withData: 1,
      empty: 1,
    });
  });

  it('returns detailed reference validation errors for missing GM dependencies', async () => {
    vi.resetModules();
    const { generalMerchandiseTransactionService } = await import('../service');
    const { TransactionReferenceError } = await import(
      '@/modules/transactions/api/service'
    );

    mockPrisma.customer.findMany.mockResolvedValue([]);
    mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue([]);
    mockPrisma.generalMerchandiseShipment.findMany.mockResolvedValue([]);

    const promise = generalMerchandiseTransactionService.importTransactions([
      {
        'Order Date': '2026-03-17',
        Customers: 'Missing Customer',
        'Product Code': 'UNKNOWN-GM',
        Quantity: 1,
        'Unit Price': 25,
        Discount: 0,
        Adjustment: 0,
        'Line Total': 25,
        'Order Status': 'Warehouse',
        Notes: null,
        'Invoice Date': null,
        'Packed Date': null,
        'Shipment Code': 'GM-MISSING-SHIP',
      },
    ]);

    await expect(promise).rejects.toBeInstanceOf(TransactionReferenceError);
    await expect(promise).rejects.toMatchObject({
      message: 'Reference validation failed',
      details: {
        missing: {
          customers: ['Missing Customer'],
          products: ['UNKNOWN-GM'],
          shipments: ['GM-MISSING-SHIP'],
        },
        counts: {
          customers: 1,
          products: 1,
          shipments: 1,
        },
        suggestion:
          'Create the missing customers/products/shipments before importing transactions.',
      },
    });

    expect(
      mockPrisma.generalMerchandiseTransaction.createMany
    ).not.toHaveBeenCalled();
  });

  it('treats prepared fully paid GM transactions as fulfilled when line totals must be recomputed', async () => {
    vi.resetModules();
    const { generalMerchandiseTransactionService } = await import('../service');

    mockPrisma.generalMerchandiseTransaction.update.mockResolvedValue({
      id: 7,
      orderDate: '2026-03-17',
      customers: 'ACME Retail',
      productCode: ' GM-001 ',
      quantity: 2,
      unitPrice: 100,
      discount: 0,
      adjustment: 200,
      lineTotal: Number.NaN,
      orderStatus: 'Prepared',
      notes: null,
      invoiceDate: null,
      packedDate: '2026-03-18',
      shipmentCode: 'GM-SHIP-001',
    });

    await generalMerchandiseTransactionService.updateTransaction({
      id: 7,
      'Order Status': 'Prepared',
      Adjustment: 200,
      'Packed Date': '2026-03-18',
    });

    expect(
      mockPrisma.generalMerchandiseInventoryMovement.create
    ).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        productCode: 'GM-001',
        quantity: 2,
        fromBucket: 'sellable',
        toBucket: 'reserved',
        postingDate: '2026-03-18',
        notes: 'auto-reserve txn 7',
      }),
      select: { id: true },
    });
    expect(
      mockPrisma.generalMerchandiseInventoryMovement.create
    ).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        productCode: 'GM-001',
        quantity: 2,
        fromBucket: 'reserved',
        toBucket: 'sold',
        postingDate: '2026-03-18',
        notes: 'auto-sale txn 7',
      }),
      select: { id: true },
    });
  });
});
