import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductDTO } from '../dto';

process.env.ACCOUNTING_CUTOVER_DATE = '2026-01-17';

const mockPrisma = vi.hoisted(() => ({
  product: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  inventoryMovement: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  clothingInventoryTransitBuildEntry: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  clothingAccountingJournalLine: {
    upsert: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

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
    'Base Price': 0,
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => unknown | Promise<unknown>) =>
        fn(mockPrisma)
    );
    mockPrisma.$executeRaw.mockResolvedValue(1);
  });

  it('posts a transit build-up entry when creating a PAID product', async () => {
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
    mockPrisma.clothingInventoryTransitBuildEntry.create.mockResolvedValue({
      id: 'tb-1',
    });

    await productService.createSingle(
      buildDto({ Payment: 'Paid', 'Grand Total': 123, COGS: 999 })
    );

    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.create
    ).toHaveBeenCalledTimes(1);

    const call =
      mockPrisma.clothingInventoryTransitBuildEntry.create.mock.calls[0][0];
    expect(call.data.debitAccount).toBe('Inventory in Transit');
    expect(call.data.creditAccount).toBe('Cash');
    expect(call.data.amount).toBe(123);
    expect(call.data.shipmentCode).toBe('KPC-001');
    expect(call.data.idempotencyKey).toBe('PRODUCT_TRANSIT_BUILD:123');
  });

  it('posts a transit build-up entry when creating an UNPAID product', async () => {
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
    mockPrisma.clothingInventoryTransitBuildEntry.create.mockResolvedValue({
      id: 'tb-2',
    });

    await productService.createSingle(
      buildDto({
        Payment: 'Unpaid',
        'Product Code': 'TP-002',
        'Grand Total': 250,
        COGS: 999,
      })
    );

    const call =
      mockPrisma.clothingInventoryTransitBuildEntry.create.mock.calls[0][0];
    expect(call.data.creditAccount).toBe('Supplier Payable');
    expect(call.data.amount).toBe(250);
    expect(call.data.idempotencyKey).toBe('PRODUCT_TRANSIT_BUILD:456');
  });

  it('posts a supplier settlement when payment changes Unpaid → Paid', async () => {
    const { productService } = await import('../service');

    mockPrisma.product.findFirst.mockResolvedValue({
      id: 789,
      productCode: 'TP-003',
      shipmentCode: 'KPC-001',
      payment: 'Unpaid',
      deletedAt: null,
      unitPrice: 0,
      quantity: 1,
      alibabaShippingCost: 0,
      exchangeRates: 1,
    });

    mockPrisma.product.update.mockResolvedValue({ id: 789 });
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue({
      id: 'existing',
    });

    mockPrisma.clothingInventoryTransitBuildEntry.findUnique.mockResolvedValue({
      amount: 155.5,
      creditAccount: 'Supplier Payable',
    });

    mockPrisma.clothingAccountingJournalLine.upsert.mockResolvedValue({
      id: 'jl-1',
    });

    await productService.bulkUpdate([
      buildDto({
        Payment: 'Paid',
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
    const creditCall = calls.find(([arg]) => arg.create.account === 'Cash');

    expect(debitCall).toBeTruthy();
    expect(creditCall).toBeTruthy();

    expect(debitCall?.[0].create.debit).toBe(155.5);
    expect(creditCall?.[0].create.credit).toBe(155.5);
  });
});
