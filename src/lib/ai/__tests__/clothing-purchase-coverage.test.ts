import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  builds: vi.fn(),
  products: vi.fn(),
  journals: vi.fn(),
  openings: vi.fn(),
  reclass: vi.fn(),
  deletedQueries: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) =>
      mock.deletedQueries(strings.join(''), ...values),
    product: { findMany: mock.products },
    clothingInventoryTransitBuildEntry: { findMany: mock.builds },
    clothingInventoryReclassEntry: { findMany: mock.reclass },
    clothingAccountingJournalLine: { findMany: mock.journals },
    clothingAccountingOpeningBalance: { findMany: mock.openings },
  },
}));
import {
  readPostedTransitCash,
  readPostedReclassificationCash,
  auditClothingPurchaseCoverage,
} from '../tools/clothing-purchase-coverage';

const cutover = new Date('2026-10-12');
const asOf = new Date('2026-10-31');
const product = (id: number, overrides = {}) => ({
  id,
  product: 'Premium Onesie',
  productCode: `PSO-101226-${id}`,
  shipmentCode: 'KPC-1',
  shipmentStatus: 'In Transit',
  payment: 'Paid',
  paymentMethod: 'CASH',
  postingDate: '2026-10-15',
  orderDate: '2026-10-15',
  grandTotal: 100,
  supplierFulfillmentStatus: 'ACTIVE',
  supplierCreditAppliedAmount: 0,
  issuedSupplierCredit: null,
  supplierCreditApplication: null,
  ...overrides,
});
const build = (id: number, overrides = {}) => ({
  id: `build-${id}`,
  idempotencyKey: `PRODUCT_TRANSIT_BUILD:${id}:GRAND_TOTAL`,
  amount: 100,
  debitAccount: 'Inventory in Transit',
  creditAccount: 'Cash',
  postingDate: new Date('2026-10-15'),
  shipmentCode: 'KPC-1',
  ...overrides,
});

describe('Clothing posted purchase funding cash coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const reader of Object.values(mock)) {
      reader.mockResolvedValue([]);
    }
  });
  it('includes cash, bank and GCash but not equity, payable or card funding', async () => {
    mock.builds.mockResolvedValue(
      [
        'Cash',
        'Bank',
        'GCash',
        'Opening Equity',
        'Supplier Payable',
        'Credit Card Payable',
      ].map((creditAccount) => ({
        amount: 100,
        debitAccount: 'Inventory in Transit',
        creditAccount,
      }))
    );
    await expect(
      readPostedTransitCash(new Date('2026-10-12'), new Date('2026-10-31'))
    ).resolves.toMatchObject({
      status: 'checked',
      cashImpact: -300,
      physicalCashImpact: -100,
    });
    expect(mock.builds).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          postingDate: {
            gte: new Date('2026-10-12'),
            lte: new Date('2026-10-31'),
          },
        }),
      })
    );
  });
  it('reports an unreadable source as not checked rather than verified zero', async () => {
    mock.builds.mockRejectedValue(new Error('Unavailable'));
    await expect(
      readPostedTransitCash(new Date(), new Date())
    ).resolves.toMatchObject({ status: 'not_checked' });
  });
  it('keeps ordinary inventory reclassification noncash but includes any actual cash-equivalent source leg', async () => {
    mock.reclass.mockResolvedValue([
      {
        amount: 500,
        fromAccount: 'Inventory in Transit',
        toAccount: 'Stock on Hand',
      },
      { amount: 30, fromAccount: 'Bank', toAccount: 'Stock on Hand' },
    ]);
    await expect(
      readPostedReclassificationCash(cutover, asOf)
    ).resolves.toMatchObject({
      status: 'checked',
      cashImpact: -30,
      physicalCashImpact: 0,
    });
  });
  it('flags paid unbuilt products in transit and before shipment assignment without altering book cash', async () => {
    mock.products.mockResolvedValue([
      product(1),
      product(2, {
        shipmentCode: null,
        shipmentStatus: null,
        paymentMethod: 'GCASH',
        grandTotal: 50,
      }),
    ]);
    const result = await auditClothingPurchaseCoverage(cutover, asOf);
    expect(result.possibleUnpostedCashOutflows).toBe(150);
    expect(result.possibleUnpostedOutflowsByAccount).toMatchObject({
      Cash: 100,
      GCash: 50,
    });
    expect(result.categories.possible_unposted_paid_purchase).toEqual({
      count: 2,
      amount: 150,
    });
    expect(result.warning).toContain('not confirmed missing money');
  });
  it('does not count posted, unpaid, card, legacy or supplier-credit purchases as missing cash', async () => {
    mock.products.mockResolvedValue([
      product(1),
      product(2, { payment: 'Unpaid' }),
      product(3, { paymentMethod: 'CARD' }),
      product(4, { postingDate: '2026-01-01', orderDate: '2026-01-01' }),
      product(5, { supplierCreditAppliedAmount: 100 }),
    ]);
    mock.builds.mockImplementation(async ({ where }) =>
      where.deletedAt === null ? [build(1)] : []
    );
    const result = await auditClothingPurchaseCoverage(cutover, asOf);
    expect(result.possibleUnpostedCashOutflows).toBe(0);
    expect(result.categories.card_funded_unbuilt.count).toBe(1);
    expect(result.categories.supplier_credit_review.count).toBe(1);
    expect(result.categories.legacy_opening_review.count).toBe(1);
  });
  it('treats a payable-funded paid product without settlement as review, not confirmed missing cash', async () => {
    mock.products.mockResolvedValue([product(1)]);
    mock.builds.mockImplementation(async ({ where }) =>
      where.deletedAt === null
        ? [build(1, { creditAccount: 'Supplier Payable' })]
        : []
    );
    const result = await auditClothingPurchaseCoverage(cutover, asOf);
    expect(result.categories.supplier_settlement_review.count).toBe(1);
    expect(result.possibleUnpostedCashOutflows).toBe(0);
  });
  it('accepts a source-linked supplier settlement pair and never deducts it twice', async () => {
    mock.products.mockResolvedValue([product(1)]);
    mock.builds.mockImplementation(async ({ where }) =>
      where.deletedAt === null
        ? [build(1, { creditAccount: 'Supplier Payable' })]
        : []
    );
    mock.journals.mockImplementation(async ({ where }) =>
      where.deletedAt === null
        ? [
            {
              id: 'debit',
              sourceType: 'PRODUCT',
              sourceId: '1',
              sourceLineKey: 'SUPPLIER_SETTLEMENT:debit',
              account: 'Supplier Payable',
              debit: 100,
              credit: 0,
            },
            {
              id: 'credit',
              sourceType: 'PRODUCT',
              sourceId: '1',
              sourceLineKey: 'SUPPLIER_SETTLEMENT:credit',
              account: 'Cash',
              debit: 0,
              credit: 100,
            },
          ]
        : []
    );
    expect(
      (await auditClothingPurchaseCoverage(cutover, asOf)).totalFindings
    ).toBe(0);
  });
  it('does not infer absence when a source fails or deleted/manual history could explain funding', async () => {
    mock.products.mockResolvedValue([product(1)]);
    mock.journals.mockRejectedValue(new Error('Unavailable'));
    const incomplete = await auditClothingPurchaseCoverage(cutover, asOf);
    expect(incomplete.status).toBe('partial');
    expect(incomplete.possibleUnpostedCashOutflows).toBe(0);
    mock.journals.mockResolvedValue([]);
    mock.deletedQueries.mockResolvedValue([build(1)]);
    expect(
      (await auditClothingPurchaseCoverage(cutover, asOf)).categories
        .deleted_source_review.count
    ).toBe(1);
  });
  it('treats same-amount manual funding as unresolved rather than claiming a missing purchase', async () => {
    mock.products.mockResolvedValue([product(1)]);
    mock.journals.mockImplementation(async ({ where }) =>
      where.deletedAt === null
        ? [
            {
              id: 'manual',
              sourceType: 'MANUAL',
              account: 'Cash',
              credit: 100,
              debit: 0,
            },
          ]
        : []
    );
    expect(
      (await auditClothingPurchaseCoverage(cutover, asOf)).categories
        .manual_or_opening_review.count
    ).toBe(1);
  });
  it('reports a capped product scan and does not infer posting absence from partial coverage', async () => {
    mock.products.mockImplementation(async ({ cursor }) =>
      Array.from({ length: 500 }, (_, index) =>
        product((cursor?.id ?? 0) + index + 1)
      )
    );
    const result = await auditClothingPurchaseCoverage(cutover, asOf);
    expect(result.status).toBe('partial');
    expect(
      result.coverage.find((entry) => entry.source === 'products')
    ).toMatchObject({ status: 'partial', scannedRows: 5000 });
    expect(result.possibleUnpostedCashOutflows).toBe(0);
    expect(result.hasMoreFindings).toBe(true);
  });
  it('flags mismatched build amounts and explicitly separates opening-equity funding', async () => {
    mock.products.mockResolvedValue([product(1), product(2)]);
    mock.builds.mockImplementation(async ({ where }) =>
      where.deletedAt === null
        ? [
            build(1, { amount: 200 }),
            build(2, { creditAccount: 'Opening Equity' }),
          ]
        : []
    );
    const result = await auditClothingPurchaseCoverage(cutover, asOf);
    expect(result.categories.build_source_mismatch.count).toBe(1);
    expect(result.categories.opening_funded.count).toBe(1);
    expect(result.possibleUnpostedCashOutflows).toBe(0);
  });
  it('does not let a historical opening suppress a later purchase candidate', async () => {
    mock.products.mockResolvedValue([product(1)]);
    mock.openings.mockResolvedValue([
      {
        id: 'old-opening',
        date: new Date('2026-02-01'),
        debit: 1000,
        credit: 0,
      },
    ]);
    const result = await auditClothingPurchaseCoverage(cutover, asOf);
    expect(result.possibleUnpostedCashOutflows).toBe(100);
    expect(mock.deletedQueries).toHaveBeenCalledWith(
      expect.stringContaining('"deletedAt" IS NOT NULL'),
      asOf
    );
  });
});
