import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductDTO } from '@/modules/products/api/dto';

process.env.ACCOUNTING_CUTOVER_DATE = '2026-01-17';

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseProduct: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  generalMerchandiseInventoryTransitBuildEntry: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  generalMerchandiseAccountingJournalLine: {
    upsert: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

function buildDto(overrides: Partial<ProductDTO> = {}): ProductDTO {
  const base: ProductDTO = {
    'Shipment Code': 'GM-001',
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
    Product: 'Test GM Product',
    'Product Code': 'GM-TP-001',
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

describe('generalMerchandiseProductService accounting automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => unknown | Promise<unknown>) =>
        fn(mockPrisma)
    );
  });

  it('does not auto-post transit build-up when creating a PAID product', async () => {
    const { generalMerchandiseProductService } = await import('../service');

    mockPrisma.generalMerchandiseProduct.create.mockResolvedValue({
      id: 123,
      productCode: 'GM-TP-001',
      quantity: 1,
      postingDate: '2026-01-18',
      orderDate: null,
    });

    await generalMerchandiseProductService.createSingle(
      buildDto({ Payment: 'Paid', 'Grand Total': 123, COGS: 999 })
    );

    expect(
      mockPrisma.generalMerchandiseInventoryTransitBuildEntry.create
    ).not.toHaveBeenCalled();
  });

  it('does not auto-post transit build-up when creating an UNPAID product', async () => {
    const { generalMerchandiseProductService } = await import('../service');

    mockPrisma.generalMerchandiseProduct.create.mockResolvedValue({
      id: 456,
      productCode: 'GM-TP-002',
      quantity: 1,
      postingDate: '2026-01-18',
      orderDate: null,
    });

    await generalMerchandiseProductService.createSingle(
      buildDto({
        Payment: 'Unpaid',
        'Product Code': 'GM-TP-002',
        'Grand Total': 250,
        COGS: 999,
      })
    );

    expect(
      mockPrisma.generalMerchandiseInventoryTransitBuildEntry.create
    ).not.toHaveBeenCalled();
  });

  it('posts a supplier settlement when payment changes Unpaid → Paid', async () => {
    const { generalMerchandiseProductService } = await import('../service');

    mockPrisma.generalMerchandiseProduct.findFirst.mockResolvedValue({
      id: 789,
      productCode: 'GM-TP-003',
      shipmentCode: 'GM-001',
      payment: 'Unpaid',
      deletedAt: null,
    });

    mockPrisma.generalMerchandiseProduct.update.mockResolvedValue({ id: 789 });

    mockPrisma.generalMerchandiseInventoryTransitBuildEntry.findMany.mockResolvedValue(
      [
        {
          amount: 155.5,
        },
      ]
    );

    mockPrisma.generalMerchandiseAccountingJournalLine.upsert.mockResolvedValue(
      {
        id: 'jl-1',
      }
    );

    await generalMerchandiseProductService.bulkUpdate([
      buildDto({
        Payment: 'Paid',
        'Product Code': 'GM-TP-003',
        COGS: 155.5,
      }),
    ]);

    expect(
      mockPrisma.generalMerchandiseAccountingJournalLine.upsert
    ).toHaveBeenCalledTimes(2);

    type UpsertArg = {
      create: { account: string; debit: number; credit: number };
    };

    const calls = mockPrisma.generalMerchandiseAccountingJournalLine.upsert.mock
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
