import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.ACCOUNTING_CUTOVER_DATE = '2026-01-17';

type TransitBuildEntry = {
  idempotencyKey: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
};

const mockPrisma = vi.hoisted(() => {
  const clothingCreateMany = vi.fn();
  const clothingUpdateMany = vi.fn();
  return {
    product: {
      findMany: vi.fn(),
    },
    clothingInventoryReclassEntry: { findFirst: vi.fn() },
    clothingAccountingOpeningBalance: { findFirst: vi.fn() },
    clothingAccountingJournalLine: { count: vi.fn(), findFirst: vi.fn() },
    clothingInventoryTransitBuildEntry: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      createMany: clothingCreateMany,
      updateMany: clothingUpdateMany,
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/modules/clothing/ledger/api/service', () => ({
  expenseService: {
    upsertBySource: vi.fn(),
  },
}));

describe('productService manual transit build-up (by shipment code)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(
      async (operation: (client: typeof mockPrisma) => Promise<unknown>) =>
        operation(mockPrisma)
    );
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );
    mockPrisma.clothingInventoryTransitBuildEntry.createMany.mockResolvedValue({
      count: 0,
    });
    mockPrisma.clothingInventoryTransitBuildEntry.updateMany.mockResolvedValue({
      count: 0,
    });
    mockPrisma.clothingInventoryReclassEntry.findFirst.mockResolvedValue(null);
    mockPrisma.clothingAccountingOpeningBalance.findFirst.mockResolvedValue(
      null
    );
    mockPrisma.clothingAccountingJournalLine.findFirst.mockResolvedValue(null);
    mockPrisma.clothingInventoryTransitBuildEntry.findFirst.mockResolvedValue(
      null
    );
    mockPrisma.clothingAccountingJournalLine.count.mockResolvedValue(0);
  });

  it('funds a pre-cutover paid purchase from Opening Equity without posting logistics or another payment', async () => {
    vi.resetModules();
    const { productService } = await import('../service');
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 290,
        productCode: 'PSO-101226',
        product: 'Premium Shortsleeves Onesie',
        payment: 'Paid',
        paymentMethod: 'CASH',
        postingDate: '2026-01-18',
        orderDate: '2025-09-01',
        grandTotal: 30636.64,
        forwardersFee: 1530,
        lalamove: 950,
      },
    ]);
    const input = {
      shipmentCode: 'KPC-OPENING',
      fundingSource: 'OPENING_BALANCE' as const,
      openingBalanceConfirmed: true,
    };

    await productService.postManualTransitBuildUpByShipmentCode(input);

    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.createMany
    ).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          idempotencyKey: 'PRODUCT_TRANSIT_BUILD:290:GRAND_TOTAL',
          postingDate: new Date('2026-01-17T00:00:00.000Z'),
          debitAccount: 'Inventory in Transit',
          creditAccount: 'Opening Equity',
          amount: 30636.64,
          notes: expect.stringContaining('Funding: Opening Balance'),
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('posts Grand Total to Inventory in Transit, but Forwarder/Lalamove to Landed Cost Clearing (Paid)', async () => {
    vi.resetModules();
    const { productService } = await import('../service');

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        productCode: 'TP-001',
        product: 'Test Product',
        payment: 'Paid',
        paymentMethod: 'CASH',
        postingDate: '2026-01-18',
        orderDate: null,
        grandTotal: 100,
        forwardersFee: 10,
        lalamove: 5,
      },
    ]);

    mockPrisma.clothingInventoryTransitBuildEntry.createMany.mockResolvedValue({
      count: 1,
    });

    await productService.postManualTransitBuildUpByShipmentCode({
      shipmentCode: 'KPC-001',
    });

    const createManyCalls = mockPrisma.clothingInventoryTransitBuildEntry
      .createMany.mock.calls as Array<[{ data: TransitBuildEntry[] }]>;

    expect(createManyCalls).toHaveLength(1);

    const data = createManyCalls[0]?.[0]?.data ?? [];
    // With ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS = false, only Grand Total is created
    expect(data).toHaveLength(1);

    const grandTotal = data.find((row) =>
      row.idempotencyKey.endsWith(':GRAND_TOTAL')
    );

    expect(grandTotal).toMatchObject({
      debitAccount: 'Inventory in Transit',
      creditAccount: 'Cash',
      amount: 100,
    });
  });

  it('credits supplier payable vs forwarder/courier payables when Unpaid', async () => {
    vi.resetModules();
    const { productService } = await import('../service');

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 2,
        productCode: 'TP-002',
        product: 'Test Product 2',
        payment: 'Unpaid',
        paymentMethod: 'BANK',
        postingDate: '2026-01-18',
        orderDate: null,
        grandTotal: 200,
        forwardersFee: 20,
        lalamove: 8,
      },
    ]);

    mockPrisma.clothingInventoryTransitBuildEntry.createMany.mockResolvedValue({
      count: 1,
    });

    await productService.postManualTransitBuildUpByShipmentCode({
      shipmentCode: 'KPC-002',
    });

    const createManyCalls = mockPrisma.clothingInventoryTransitBuildEntry
      .createMany.mock.calls as Array<[{ data: TransitBuildEntry[] }]>;

    const data = createManyCalls[0]?.[0]?.data ?? [];

    const grandTotal = data.find((row) =>
      row.idempotencyKey.endsWith(':GRAND_TOTAL')
    );

    // With ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS = false, only Grand Total is created
    expect(data).toHaveLength(1);

    expect(grandTotal).toMatchObject({
      debitAccount: 'Inventory in Transit',
      creditAccount: 'Supplier Payable',
      amount: 200,
    });
  });

  it('credits the selected account for a Paid product', async () => {
    vi.resetModules();
    const { productService } = await import('../service');

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 3,
        productCode: 'TP-003',
        product: 'Bank-paid Product',
        payment: 'Paid',
        paymentMethod: 'BANK',
        postingDate: '2026-01-18',
        orderDate: null,
        grandTotal: 300,
        forwardersFee: 0,
        lalamove: 0,
      },
    ]);

    await productService.postManualTransitBuildUpByShipmentCode({
      shipmentCode: 'KPC-003',
    });

    const createdEntries = mockPrisma.clothingInventoryTransitBuildEntry
      .createMany.mock.calls[0]?.[0]?.data as TransitBuildEntry[];
    expect(createdEntries[0]).toMatchObject({
      debitAccount: 'Inventory in Transit',
      creditAccount: 'Bank',
      amount: 300,
    });
  });

  it('restores a deleted posting without purging its audit record', async () => {
    const { productService } = await import('../service');
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 3,
        productCode: 'TP-003',
        payment: 'Paid',
        paymentMethod: 'BANK',
        postingDate: '2026-01-18',
        grandTotal: 300,
      },
    ]);
    mockPrisma.clothingInventoryTransitBuildEntry.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await productService.postManualTransitBuildUpByShipmentCode({
      shipmentCode: 'KPC-003',
    });

    expect(result.created).toBe(1);
    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.updateMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: { not: null },
          idempotencyKey: 'PRODUCT_TRANSIT_BUILD:3:GRAND_TOTAL',
        },
        data: expect.objectContaining({ deletedAt: null, amount: 300 }),
      })
    );
    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.deleteMany
    ).not.toHaveBeenCalled();
  });

  it('rejects product posting when a shipment-origin build is already active', async () => {
    const { productService } = await import('../service');
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      { idempotencyKey: 'SHIPMENT_TRANSIT_BUILD:KPC-003:Cash' },
    ]);

    await expect(
      productService.postManualTransitBuildUpByShipmentCode({
        shipmentCode: 'KPC-003',
      })
    ).rejects.toThrow('active transit-build');
    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.createMany
    ).not.toHaveBeenCalled();
  });

  it('does not recreate a source while its downstream reclassification is active', async () => {
    const { productService } = await import('../service');
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 3,
        productCode: 'TP-003',
        payment: 'Paid',
        paymentMethod: 'BANK',
        postingDate: '2026-01-18',
        grandTotal: 300,
      },
    ]);
    mockPrisma.clothingInventoryReclassEntry.findFirst.mockResolvedValue({
      id: 'reclass-1',
    });

    await expect(
      productService.postManualTransitBuildUpByShipmentCode({
        shipmentCode: 'KPC-003',
      })
    ).rejects.toThrow('active transit-build');
    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.createMany
    ).not.toHaveBeenCalled();
    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.updateMany
    ).not.toHaveBeenCalled();
  });

  it('does not post a Paid product with an unsupported payment method', async () => {
    vi.resetModules();
    const { productService } = await import('../service');

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 4,
        productCode: 'TP-004',
        product: 'Unsupported payment product',
        payment: 'Paid',
        paymentMethod: 'OTHER',
        postingDate: '2026-01-18',
        orderDate: null,
        grandTotal: 400,
      },
    ]);

    const result = await productService.postManualTransitBuildUpByShipmentCode({
      shipmentCode: 'KPC-004',
    });

    expect(result.skipped).toBe(1);
    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.createMany
    ).not.toHaveBeenCalled();
  });

  it.each([
    {
      supplierFulfillmentStatus: 'CREDIT_ISSUED',
      supplierCreditAppliedAmount: 0,
    },
    { supplierFulfillmentStatus: 'ACTIVE', supplierCreditAppliedAmount: 100 },
  ])(
    'never recreates credit-owned funding through the generic build command: %j',
    async (supplierState) => {
      const { productService } = await import('../service');
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 42,
          productCode: 'CREDIT-42',
          payment: 'Paid',
          paymentMethod: 'CARD',
          postingDate: '2026-10-26',
          grandTotal: 3000,
          ...supplierState,
        },
      ]);
      const result =
        await productService.postManualTransitBuildUpByShipmentCode({
          shipmentCode: 'KPC-001',
        });
      expect(result).toMatchObject({ created: 0, skipped: 1 });
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.createMany
      ).not.toHaveBeenCalled();
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.updateMany
      ).not.toHaveBeenCalled();
    }
  );

  describe('opening-balance safeguards', () => {
    const request = {
      shipmentCode: 'KPC-OPENING',
      fundingSource: 'OPENING_BALANCE' as const,
      openingBalanceConfirmed: true,
    };
    const product = {
      id: 290,
      productCode: 'PSO-101226',
      payment: 'Paid',
      paymentMethod: 'CASH',
      orderDate: '2025-09-01',
      postingDate: '2026-01-18',
      grandTotal: 30636.64,
      supplierFulfillmentStatus: 'ACTIVE',
      supplierCreditAppliedAmount: 0,
    };

    beforeEach(() => {
      mockPrisma.product.findMany.mockResolvedValue([product]);
    });

    it('requires explicit historical payment and transit confirmation', async () => {
      const { productService } = await import('../service');
      await expect(
        productService.postManualTransitBuildUpByShipmentCode({
          ...request,
          openingBalanceConfirmed: false,
        })
      ).rejects.toThrow('Confirm that the supplier was paid before cutover');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      { payment: 'Unpaid' },
      { payment: '' },
      { orderDate: null },
      { orderDate: 'not-a-date' },
      { orderDate: '2026-01-17' },
      { orderDate: '2026-02-01' },
      { grandTotal: 0 },
      { grandTotal: -1 },
      { grandTotal: Number.NaN },
      { supplierFulfillmentStatus: 'CREDIT_ISSUED' },
      { supplierCreditAppliedAmount: 100 },
    ])('rejects an ineligible purchase atomically: %j', async (changes) => {
      const { productService } = await import('../service');
      mockPrisma.product.findMany.mockResolvedValue([
        product,
        { ...product, id: 291, ...changes },
      ]);
      await expect(
        productService.postManualTransitBuildUpByShipmentCode(request)
      ).rejects.toThrow('Opening transit requires every linked product');
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.createMany
      ).not.toHaveBeenCalled();
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.updateMany
      ).not.toHaveBeenCalled();
    });

    it.each(['opening', 'manual'])(
      'blocks existing standalone %s transit funding',
      async (source) => {
        const { productService } = await import('../service');
        const model =
          source === 'opening'
            ? mockPrisma.clothingAccountingOpeningBalance
            : mockPrisma.clothingAccountingJournalLine;
        model.findFirst.mockResolvedValue({ id: 'existing-transit' });
        await expect(
          productService.postManualTransitBuildUpByShipmentCode(request)
        ).rejects.toMatchObject({ status: 409 });
        expect(
          mockPrisma.clothingInventoryTransitBuildEntry.createMany
        ).not.toHaveBeenCalled();
      }
    );

    it('uses the database-configured cutover rather than the product date or environment fallback', async () => {
      const { productService } = await import('../service');
      mockPrisma.$queryRaw.mockResolvedValue([
        { cutoverDate: new Date('2026-10-12T00:00:00.000Z') },
      ]);
      await productService.postManualTransitBuildUpByShipmentCode(request);
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.createMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              postingDate: new Date('2026-10-12T00:00:00.000Z'),
              creditAccount: 'Opening Equity',
              amount: 30636.64,
            }),
          ],
        })
      );
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' }
      );
    });

    it('does not need to invent a historical paying account', async () => {
      const { productService } = await import('../service');
      mockPrisma.product.findMany.mockResolvedValue([
        { ...product, paymentMethod: null },
      ]);
      await productService.postManualTransitBuildUpByShipmentCode(request);
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.createMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ creditAccount: 'Opening Equity' })],
        })
      );
    });

    it('reuses an existing opening-funded product key without another entry', async () => {
      const { productService } = await import('../service');
      mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
        {
          idempotencyKey: 'PRODUCT_TRANSIT_BUILD:290:GRAND_TOTAL',
          creditAccount: 'Opening Equity',
        },
      ]);
      await expect(
        productService.postManualTransitBuildUpByShipmentCode(request)
      ).resolves.toEqual({ created: 0, skipped: 1, products: 1 });
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.createMany
      ).not.toHaveBeenCalled();
    });

    it('does not convert an existing payment-funded key into opening equity', async () => {
      const { productService } = await import('../service');
      mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
        {
          idempotencyKey: 'PRODUCT_TRANSIT_BUILD:290:GRAND_TOTAL',
          creditAccount: 'Cash',
        },
      ]);
      await expect(
        productService.postManualTransitBuildUpByShipmentCode(request)
      ).rejects.toMatchObject({ status: 409 });
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.updateMany
      ).not.toHaveBeenCalled();
    });

    it('does not overwrite a deleted funding source', async () => {
      const { productService } = await import('../service');
      mockPrisma.clothingInventoryTransitBuildEntry.findFirst.mockResolvedValue(
        {
          id: 'deleted-source',
        }
      );
      await expect(
        productService.postManualTransitBuildUpByShipmentCode(request)
      ).rejects.toThrow(
        'Deleted transit funding already owns these posting keys'
      );
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.updateMany
      ).not.toHaveBeenCalled();
    });

    it('does not restore deleted opening funding as a new Cash purchase', async () => {
      const { productService } = await import('../service');
      mockPrisma.clothingInventoryTransitBuildEntry.findFirst.mockResolvedValue(
        { id: 'deleted-opening' }
      );
      await expect(
        productService.postManualTransitBuildUpByShipmentCode({
          shipmentCode: request.shipmentCode,
        })
      ).rejects.toThrow(
        'Deleted opening funding cannot be restored as a purchase payment'
      );
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.findFirst
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ creditAccount: 'Opening Equity' }),
        })
      );
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.updateMany
      ).not.toHaveBeenCalled();
      expect(
        mockPrisma.clothingInventoryTransitBuildEntry.createMany
      ).not.toHaveBeenCalled();
    });

    it.each(['reclass', 'settlement'])(
      'retains the downstream %s guard',
      async (dependency) => {
        const { productService } = await import('../service');
        if (dependency === 'reclass') {
          mockPrisma.clothingInventoryReclassEntry.findFirst.mockResolvedValue({
            id: 'reclass-1',
          });
        } else {
          mockPrisma.clothingAccountingJournalLine.count.mockResolvedValue(1);
        }
        await expect(
          productService.postManualTransitBuildUpByShipmentCode(request)
        ).rejects.toThrow('active transit-build');
        expect(
          mockPrisma.clothingInventoryTransitBuildEntry.createMany
        ).not.toHaveBeenCalled();
      }
    );
  });
});
