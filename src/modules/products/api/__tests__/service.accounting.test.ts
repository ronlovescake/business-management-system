import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { mapFromDTO, type ProductDTO } from '../dto';

process.env.ACCOUNTING_CUTOVER_DATE = '2026-01-17';

const mockPrisma = vi.hoisted(() => ({
  product: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  inventoryMovement: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  clothingInventoryTransitBuildEntry: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  clothingInventoryReclassEntry: {
    findMany: vi.fn(),
  },
  clothingAccountingJournalLine: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  clothingSupplierCreditApplication: { findUnique: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));
const mockTransactionClient = mockPrisma as unknown as Prisma.TransactionClient;
const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/auth/session', () => auth);

// Expense posting is disabled by default in the service; still stub the module
// to keep the test focused.
vi.mock('@/modules/clothing/ledger/api/service', () => ({
  expenseService: {
    upsertBySource: vi.fn(),
  },
}));

function buildDto(overrides: Partial<ProductDTO> = {}): ProductDTO {
  const base: ProductDTO = {
    'Shipment Code': 'KPC-001',
    'CV Number': null,
    'No. Of Sacks': 0,
    'Total CBM': 0,
    Weight: 0,
    'Shipment Status': null,
    'Posting Date': '2026-01-18',
    'Order Date': null,
    Payment: 'Paid',
    'Payment Method': null,
    'Payment Card Id': null,
    Product: 'Test Product',
    'Product Code': 'TP-001',
    'Age Range': null,
    Unit: 'Pieces',
    'Unit Price': 0,
    Quantity: 1,
    'Alibaba Shipping Cost': 0,
    'Exchange Rates': 1,
    PHP: 0,
    'Sub Total (PHP)': 0,
    'Transaction Fee': 0,
    'Grand Total': 123,
    "Forwarder's Fee": 0,
    Lalamove: 0,
    'Packaging Cost': 0,
    'Suggested Price': 0,
    'Actual Price': 0,
    'Landed Unit Cost': 0,
    COGS: 999,
    'Projected Sales': 0,
    'Projected Profit': 0,
    'Projected Profit (%)': 0,
    'Total Markup': 0,
    'Link To Post': null,
    'Bulk Quantity': 0,
    'Bulk Weight': 0,
    'Weight Per Piece': 0,
  };

  return { ...base, ...overrides };
}

describe('productService accounting automation', () => {
  it('blocks direct/import cost changes after inventory events but permits unchanged costs', async () => {
    const { assertProductAccountingIdentityChange } = await import(
      '../service'
    );
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue({ id: 10 });
    const existing = {
      id: 123,
      productCode: 'TP-001',
      shipmentCode: 'KPC-001',
      landedUnitCost: 100,
      quantity: 10,
      cogs: 1000,
    };
    await expect(
      assertProductAccountingIdentityChange(mockTransactionClient, existing, {
        productCode: 'TP-001',
        shipmentCode: 'KPC-001',
        landedUnitCost: 120,
        cogs: 1200,
      })
    ).rejects.toThrow('dated cost correction');
    await expect(
      assertProductAccountingIdentityChange(mockTransactionClient, existing, {
        productCode: 'TP-001',
        shipmentCode: 'KPC-001',
        landedUnitCost: 100,
        cogs: 1000,
      })
    ).resolves.toBeUndefined();
  });
  it('blocks identity changes and deletion when only supplier settlement lines remain', async () => {
    const {
      assertProductAccountingIdentityChange,
      ProductShipmentAccountingConflictError,
    } = await import('../service');
    mockPrisma.clothingAccountingJournalLine.findMany.mockResolvedValue([
      { id: 'settled' },
    ]);
    const existing = {
      id: 123,
      productCode: 'TP-001',
      shipmentCode: 'KPC-001',
    };
    await expect(
      assertProductAccountingIdentityChange(
        mockTransactionClient,
        existing,
        null
      )
    ).rejects.toBeInstanceOf(ProductShipmentAccountingConflictError);
    await expect(
      assertProductAccountingIdentityChange(mockTransactionClient, existing, {
        productCode: 'RENAMED',
        shipmentCode: 'KPC-001',
      })
    ).rejects.toBeInstanceOf(ProductShipmentAccountingConflictError);
  });

  it('rejects a payment retry when deleted journal lines retain the settlement keys', async () => {
    const { postSupplierSettlementForProductPaymentChange } = await import(
      '../service'
    );
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      { amount: 100 },
    ]);
    mockPrisma.clothingAccountingJournalLine.upsert.mockResolvedValue({
      id: 'deleted-settlement',
      deletedAt: new Date(),
    });
    await expect(
      postSupplierSettlementForProductPaymentChange(
        {
          productId: 123,
          prevPayment: 'Paid',
          nextPayment: 'Paid',
          productCode: 'TP-001',
          shipmentCode: 'KPC-001',
          paymentMethod: 'BANK',
        },
        mockTransactionClient
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => unknown | Promise<unknown>) =>
        fn(mockPrisma)
    );
    mockPrisma.$executeRaw.mockResolvedValue(1);
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );
    mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([]);
    mockPrisma.clothingAccountingJournalLine.findMany.mockResolvedValue([]);
    mockPrisma.clothingAccountingJournalLine.upsert.mockResolvedValue({
      id: 'settlement',
      deletedAt: null,
    });
    auth.getCurrentUser.mockResolvedValue({ id: 'test-admin', role: 'ADMIN' });
  });

  it('does not auto-post transit build-up when creating a PAID product', async () => {
    const { productService } = await import('../service');

    mockPrisma.product.create.mockResolvedValue({
      id: 123,
      productCode: 'TP-001',
      quantity: 1,
      postingDate: '2026-01-18',
      orderDate: null,
    });

    mockPrisma.inventoryMovement.findFirst.mockResolvedValue({
      id: 'existing',
    });
    await productService.createSingle(
      buildDto({ Payment: 'Paid', 'Grand Total': 123, COGS: 999 })
    );

    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.create
    ).not.toHaveBeenCalled();
  });

  it('does not auto-post transit build-up when creating an UNPAID product', async () => {
    const { productService } = await import('../service');

    mockPrisma.product.create.mockResolvedValue({
      id: 456,
      productCode: 'TP-002',
      quantity: 1,
      postingDate: '2026-01-18',
      orderDate: null,
    });

    mockPrisma.inventoryMovement.findFirst.mockResolvedValue({
      id: 'existing',
    });
    await productService.createSingle(
      buildDto({
        Payment: 'Unpaid',
        'Product Code': 'TP-002',
        'Grand Total': 250,
        COGS: 999,
      })
    );

    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.create
    ).not.toHaveBeenCalled();
  });

  it('replays the identical credit-funded creation without creating a second product', async () => {
    const { productService } = await import('../service');
    const payload = buildDto({
      'Supplier Reference': 'Supplier A',
      'Supplier Credit Id': 'credit-42',
      'Supplier Credit Amount': 100,
      'Supplier Credit Request Id': 'same-request',
    });
    const targetProduct = {
      ...mapFromDTO(payload),
      id: 456,
      paymentCardId: null,
    };
    mockPrisma.clothingSupplierCreditApplication.findUnique.mockResolvedValue({
      creditId: 'credit-42',
      amount: 100,
      targetProduct,
    });
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue({
      id: 'existing',
    });
    const result = await productService.createSingle(payload);
    expect(result.id).toBe(456);
    expect(mockPrisma.product.create).not.toHaveBeenCalled();
  });

  it.each([
    { Quantity: 2 },
    { 'Shipment Code': 'KPC-OTHER' },
    { 'Supplier Reference': 'Supplier B' },
    { 'Payment Method': 'BANK' },
    { 'Payment Card Id': 'different-card' },
  ])(
    'rejects a changed purchase behind the same credit request ID: %j',
    async (changes) => {
      const { productService } = await import('../service');
      const payload = buildDto({
        'Supplier Reference': 'Supplier A',
        'Supplier Credit Id': 'credit-42',
        'Supplier Credit Amount': 100,
        'Supplier Credit Request Id': 'same-request',
      });
      mockPrisma.clothingSupplierCreditApplication.findUnique.mockResolvedValue(
        {
          creditId: 'credit-42',
          amount: 100,
          targetProduct: {
            ...mapFromDTO(payload),
            id: 456,
            paymentCardId: null,
          },
        }
      );
      await expect(
        productService.createSingle({ ...payload, ...changes })
      ).rejects.toMatchObject({ status: 409 });
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    }
  );

  it('posts a supplier settlement when payment changes Unpaid → Paid', async () => {
    const { productService } = await import('../service');

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 789,
        productCode: 'TP-003',
        shipmentCode: 'KPC-001',
        payment: 'Unpaid',
        deletedAt: null,
        unitPrice: 0,
        quantity: 1,
        landedUnitCost: 0,
        cogs: 155.5,
        alibabaShippingCost: 0,
        exchangeRates: 1,
      },
    ]);

    mockPrisma.product.update.mockResolvedValue({ id: 789 });
    mockPrisma.product.findUnique.mockResolvedValue({ paymentMethod: 'BANK' });
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue({
      id: 'existing',
    });

    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      {
        amount: 155.5,
      },
    ]);

    mockPrisma.clothingAccountingJournalLine.upsert.mockResolvedValue({
      id: 'jl-1',
    });

    await productService.bulkUpdate([
      buildDto({
        Payment: 'Paid',
        'Payment Method': 'BANK',
        'Product Code': 'TP-003',
        COGS: 155.5,
      }),
    ]);

    expect(
      mockPrisma.clothingAccountingJournalLine.upsert
    ).toHaveBeenCalledTimes(2);

    type UpsertArg = {
      create: { account: string; debit: number; credit: number };
    };

    const calls = mockPrisma.clothingAccountingJournalLine.upsert.mock
      .calls as Array<[UpsertArg]>;

    const debitCall = calls.find(
      ([arg]) => arg.create.account === 'Supplier Payable'
    );
    const creditCall = calls.find(([arg]) => arg.create.account === 'Bank');

    expect(debitCall).toBeTruthy();
    expect(creditCall).toBeTruthy();

    expect(debitCall?.[0].create.debit).toBe(155.5);
    expect(creditCall?.[0].create.credit).toBe(155.5);
    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.findMany.mock.calls[0]?.[0]
    ).toMatchObject({
      where: {
        idempotencyKey: { startsWith: 'PRODUCT_TRANSIT_BUILD:789:' },
      },
    });
  });

  it.each(['bulkUpdate', 'bulkImport'] as const)(
    '%s rejects an unsupported settlement method inside the product transaction',
    async (method) => {
      const { productService, ProductSupplierSettlementError } = await import(
        '../service'
      );
      mockPrisma.product.findUnique.mockResolvedValue({
        landedUnitCost: 0,
        cogs: 999,
        quantity: 1,
        id: 789,
        productCode: 'TP-003',
        shipmentCode: 'KPC-001',
        payment: 'Unpaid',
        deletedAt: null,
      });
      mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
        { amount: 100 },
      ]);

      await expect(
        productService[method]([
          buildDto({
            id: 789,
            'Product Code': 'TP-003',
            'Payment Method': null,
          }),
        ])
      ).rejects.toBeInstanceOf(ProductSupplierSettlementError);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(
        mockPrisma.clothingAccountingJournalLine.upsert
      ).not.toHaveBeenCalled();
    }
  );

  it('reconciles a Paid retry without changing existing journal dates or amounts', async () => {
    const { productService } = await import('../service');
    mockPrisma.product.findUnique.mockResolvedValue({
      landedUnitCost: 0,
      cogs: 999,
      quantity: 1,
      id: 789,
      productCode: 'TP-003',
      shipmentCode: 'KPC-001',
      payment: 'Paid',
      deletedAt: null,
    });
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      { amount: 100 },
    ]);

    await productService.bulkUpdate([
      buildDto({ id: 789, 'Product Code': 'TP-003', 'Payment Method': 'BANK' }),
    ]);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(
      mockPrisma.clothingAccountingJournalLine.upsert
    ).toHaveBeenCalledTimes(2);
    for (const [args] of mockPrisma.clothingAccountingJournalLine.upsert.mock
      .calls) {
      expect(args.update).toEqual({});
    }
  });

  it('rejects an operational USER posting a supplier settlement', async () => {
    const { productService } = await import('../service');
    auth.getCurrentUser.mockResolvedValue({ id: 'test-user', role: 'USER' });
    mockPrisma.product.findUnique.mockResolvedValue({
      landedUnitCost: 0,
      cogs: 999,
      quantity: 1,
      id: 789,
      productCode: 'TP-003',
      shipmentCode: 'KPC-001',
      payment: 'Unpaid',
      deletedAt: null,
    });
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      { amount: 100 },
    ]);
    await expect(
      productService.bulkUpdate([
        buildDto({
          id: 789,
          'Product Code': 'TP-003',
          'Payment Method': 'BANK',
        }),
      ])
    ).rejects.toMatchObject({ status: 403 });
    expect(
      mockPrisma.clothingAccountingJournalLine.upsert
    ).not.toHaveBeenCalled();
  });

  it('allows a harmless USER edit after settlement without reposting it', async () => {
    const { productService } = await import('../service');
    auth.getCurrentUser.mockResolvedValue({ id: 'test-user', role: 'USER' });
    mockPrisma.product.findUnique.mockResolvedValue({
      landedUnitCost: 0,
      cogs: 999,
      quantity: 1,
      id: 789,
      productCode: 'TP-003',
      shipmentCode: 'KPC-001',
      payment: 'Paid',
      deletedAt: null,
    });
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      { amount: 100 },
    ]);
    mockPrisma.clothingAccountingJournalLine.findMany.mockResolvedValue([
      {
        sourceLineKey: 'SUPPLIER_SETTLEMENT:debit',
        account: 'Supplier Payable',
        debit: 100,
        credit: 0,
      },
      {
        sourceLineKey: 'SUPPLIER_SETTLEMENT:credit',
        account: 'Bank',
        debit: 0,
        credit: 100,
      },
    ]);
    await productService.bulkUpdate([
      buildDto({ id: 789, 'Product Code': 'TP-003', 'Payment Method': 'BANK' }),
    ]);
    expect(
      mockPrisma.clothingAccountingJournalLine.upsert
    ).not.toHaveBeenCalled();
  });

  it('updates a renamed product by ID without creating another product', async () => {
    const { productService } = await import('../service');
    mockPrisma.product.findUnique.mockResolvedValue({
      landedUnitCost: 0,
      cogs: 999,
      quantity: 1,
      id: 789,
      productCode: 'S-101826',
      shipmentCode: 'SHIP-OLD',
      payment: 'Unpaid',
      deletedAt: null,
    });
    mockPrisma.product.update.mockResolvedValue({ id: 789 });

    await productService.bulkUpdate([
      buildDto({
        id: 789,
        Product: 'Short Sleeves',
        'Product Code': 'SS-101826',
      }),
    ]);

    expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
      where: { id: 789 },
    });
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 789 },
        data: expect.objectContaining({ productCode: 'SS-101826' }),
      })
    );
    expect(mockPrisma.product.create).not.toHaveBeenCalled();
  });

  it('rejects a code-only update when multiple products share the code', async () => {
    const { productService } = await import('../service');
    mockPrisma.product.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    await expect(productService.bulkUpdate([buildDto()])).rejects.toThrow(
      'ambiguous'
    );
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
    expect(mockPrisma.product.create).not.toHaveBeenCalled();
  });

  it.each(['bulkUpdate', 'bulkImport'] as const)(
    '%s blocks product renames after accounting has been posted',
    async (method) => {
      const { productService, ProductShipmentAccountingConflictError } =
        await import('../service');
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 789,
        productCode: 'TP-003',
        shipmentCode: 'KPC-001',
        payment: 'Paid',
        deletedAt: null,
      });
      mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([
        { id: 'reclass-1' },
      ]);

      await expect(
        productService[method]([
          buildDto({ id: 789, 'Product Code': 'RENAMED' }),
        ])
      ).rejects.toBeInstanceOf(ProductShipmentAccountingConflictError);
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    }
  );

  it('blocks imported shipment reassignment after transit build-up', async () => {
    const { productService, ProductShipmentAccountingConflictError } =
      await import('../service');
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 789,
      productCode: 'TP-003',
      shipmentCode: 'KPC-001',
      payment: 'Paid',
      deletedAt: null,
    });
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      { id: 'transit-1' },
    ]);

    await expect(
      productService.bulkImport([
        buildDto({ id: 789, 'Shipment Code': 'KPC-002' }),
      ])
    ).rejects.toBeInstanceOf(ProductShipmentAccountingConflictError);
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
  });

  it('blocks shipment reassignment while active transit accounting entries exist', async () => {
    const { productService, ProductShipmentAccountingConflictError } =
      await import('../service');
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 789,
      productCode: 'TP-003',
      shipmentCode: 'KPC-001',
      payment: 'Paid',
      deletedAt: null,
    });
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      { id: 'transit-1' },
    ]);

    await expect(
      productService.bulkUpdate([
        buildDto({ id: 789, 'Shipment Code': 'KPC-002' }),
      ])
    ).rejects.toBeInstanceOf(ProductShipmentAccountingConflictError);
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
  });

  it('blocks shipment reassignment for legacy reclass entries linked by product code', async () => {
    const { productService, ProductShipmentAccountingConflictError } =
      await import('../service');
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 789,
      productCode: 'TP-003',
      shipmentCode: 'KPC-001',
      payment: 'Paid',
      deletedAt: null,
    });
    mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([
      { id: 'legacy-reclass-1' },
    ]);

    await expect(
      productService.bulkUpdate([
        buildDto({ id: 789, 'Shipment Code': 'KPC-002' }),
      ])
    ).rejects.toBeInstanceOf(ProductShipmentAccountingConflictError);
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
  });
});
