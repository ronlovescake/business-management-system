import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const state = vi.hoisted(() => ({
  user: { id: 'admin', role: 'ADMIN' } as { id: string; role: string } | null,
  product: { findUnique: vi.fn(), update: vi.fn() },
  transaction: { findMany: vi.fn() },
  shipment: { findMany: vi.fn() },
  clothingInventoryReclassEntry: { findFirst: vi.fn() },
  inventoryMovement: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  clothingInventoryTransitBuildEntry: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  clothingAccountingJournalLine: { findMany: vi.fn(), createMany: vi.fn() },
  clothingSupplierCredit: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  clothingSupplierCreditApplication: { findUnique: vi.fn(), create: vi.fn() },
  clothingProductShipmentTransfer: { findUnique: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: state }));
vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: async () => state.user,
}));

import {
  applySupplierCredit,
  assertSupplierFundingWrite,
  issueSupplierCredit,
  transferSupplierProduct,
} from '../supplier-resolution';

const product = () => ({
  id: 42,
  deletedAt: null,
  productCode: 'DTTP-101626',
  product: 'Dreamgrow',
  quantity: 100,
  grandTotal: 19511.37,
  payment: 'Paid',
  paymentMethod: 'CARD',
  shipmentCode: 'KPC 23930A-239',
  postingDate: '2026-10-16',
  supplierReference: null,
  supplierFulfillmentStatus: 'ACTIVE',
});
const build = () => ({
  id: 'build',
  amount: 19511.37,
  creditAccount: 'Credit Card Payable',
  debitAccount: 'Inventory in Transit',
  postingDate: new Date('2026-10-16'),
  deletedAt: null,
});
const issue = () => ({
  productId: 42,
  supplierReference: 'Supplier A',
  reference: 'CREDIT-42',
  postingDate: '2026-10-26',
  requestId: 'issue-request',
});
const apply = () => ({
  productId: 43,
  creditId: 'credit-42',
  amount: 1000,
  supplierReference: 'Supplier A',
  postingDate: '2026-10-26',
  requestId: 'apply-request',
});

describe('supplier nonfulfillment, credit funding and shipment transfers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.user = { id: 'admin', role: 'ADMIN' };
    state.$transaction.mockImplementation(async (operation) =>
      operation(state)
    );
    state.product.findUnique.mockResolvedValue(product());
    state.transaction.findMany.mockResolvedValue([]);
    state.clothingInventoryReclassEntry.findFirst.mockResolvedValue(null);
    state.inventoryMovement.findFirst.mockResolvedValue(null);
    state.inventoryMovement.findMany.mockResolvedValue([]);
    state.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      build(),
    ]);
    state.clothingInventoryTransitBuildEntry.findFirst.mockResolvedValue(null);
    state.clothingSupplierCredit.findUnique.mockResolvedValue(null);
    state.clothingSupplierCredit.create.mockImplementation(
      async ({ data }) => ({ id: 'credit-42', ...data })
    );
    state.clothingSupplierCredit.updateMany.mockResolvedValue({ count: 1 });
    state.clothingSupplierCreditApplication.findUnique.mockResolvedValue(null);
    state.clothingSupplierCreditApplication.create.mockImplementation(
      async ({ data }) => data
    );
    state.clothingProductShipmentTransfer.findUnique.mockResolvedValue(null);
    state.clothingProductShipmentTransfer.create.mockImplementation(
      async ({ data }) => data
    );
    state.shipment.findMany.mockResolvedValue([
      { shipmentCode: 'KPC 23930A-240', shipmentStatus: 'In Transit' },
    ]);
  });

  it('issues the exact missing Grand Total and preserves the original card liability', async () => {
    const credit = await issueSupplierCredit(issue());
    expect(credit.amount.toString()).toBe('19511.37');
    const lines =
      state.clothingAccountingJournalLine.createMany.mock.calls[0][0].data;
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account: 'Supplier Credits',
          debit: 19511.37,
          credit: 0,
        }),
        expect.objectContaining({
          account: 'Inventory in Transit',
          debit: 0,
          credit: 19511.37,
        }),
      ])
    );
    expect(
      lines.some((line: { account: string }) =>
        ['Cash', 'Bank', 'Credit Card Payable'].includes(line.account)
      )
    ).toBe(false);
    expect(
      state.clothingInventoryTransitBuildEntry.updateMany
    ).not.toHaveBeenCalled();
    expect(state.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supplierFulfillmentStatus: 'CREDIT_ISSUED',
        }),
      })
    );
  });

  it('does not subtract an already recorded full shortage twice', async () => {
    state.inventoryMovement.findMany.mockResolvedValue([
      { quantity: 100, toBucket: 'supplier_short', notes: 'Missing goods' },
    ]);
    await issueSupplierCredit(issue());
    expect(state.inventoryMovement.create).not.toHaveBeenCalled();
    expect(state.inventoryMovement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementSource: 'supplier_nonfulfillment',
        }),
      })
    );
  });

  it('replays an issued credit without creating another asset', async () => {
    state.clothingSupplierCredit.findUnique.mockResolvedValue({
      id: 'credit-42',
      supplierReference: 'supplier a',
      reference: 'CREDIT-42',
      postingDate: new Date('2026-10-26'),
    });
    await issueSupplierCredit(issue());
    expect(state.clothingSupplierCredit.create).not.toHaveBeenCalled();
    expect(
      state.clothingAccountingJournalLine.createMany
    ).not.toHaveBeenCalled();
  });

  it('rejects changed details on an issuance retry', async () => {
    state.clothingSupplierCredit.findUnique.mockResolvedValue({
      id: 'credit-42',
      supplierReference: 'supplier a',
      reference: 'OTHER',
      postingDate: new Date('2026-10-26'),
    });
    await expect(issueSupplierCredit(issue())).rejects.toThrow(
      'different details'
    );
  });

  it('rejects goods already reclassified', async () => {
    state.clothingInventoryReclassEntry.findFirst.mockResolvedValue({
      id: 'received',
    });
    await expect(issueSupplierCredit(issue())).rejects.toThrow(
      'separate accounting correction'
    );
    expect(state.clothingSupplierCredit.create).not.toHaveBeenCalled();
  });

  it.each([0, NaN, Infinity])(
    'rejects an invalid whole-product quantity: %s',
    async (quantity) => {
      state.product.findUnique.mockResolvedValue({ ...product(), quantity });
      await expect(issueSupplierCredit(issue())).rejects.toMatchObject({
        status: 400,
      });
      expect(state.clothingSupplierCredit.create).not.toHaveBeenCalled();
    }
  );

  it('rejects legacy fulfillment history even without a stock movement', async () => {
    state.transaction.findMany.mockResolvedValue([
      { orderStatus: 'Cancelled', statusChanges: [{ newStatus: 'Shipped' }] },
    ]);
    await expect(issueSupplierCredit(issue())).rejects.toThrow(
      'separate accounting correction'
    );
    expect(state.clothingSupplierCredit.create).not.toHaveBeenCalled();
  });

  it('preserves unfulfilled prepaid customer reservations', async () => {
    state.transaction.findMany.mockResolvedValue([
      {
        orderStatus: 'In Transit',
        shippedAt: null,
        packedDate: null,
        statusChanges: [{ newStatus: 'In Transit' }],
      },
    ]);
    await issueSupplierCredit(issue());
    expect(state.clothingSupplierCredit.create).toHaveBeenCalledOnce();
  });

  it('rejects source valuation drift rather than inventing a balancing entry', async () => {
    state.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      { ...build(), amount: 19000 },
    ]);
    await expect(issueSupplierCredit(issue())).rejects.toThrow('differs');
  });

  it('rejects unpaid, unsettled supplier obligations', async () => {
    state.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      { ...build(), creditAccount: 'Supplier Payable' },
    ]);
    state.clothingAccountingJournalLine.findMany.mockResolvedValue([]);
    await expect(issueSupplierCredit(issue())).rejects.toThrow(
      'outstanding supplier payable'
    );
  });

  it('applies credit as funding and charges the card only for the remainder', async () => {
    state.product.findUnique.mockResolvedValue({
      ...product(),
      id: 43,
      grandTotal: 3000,
    });
    state.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([]);
    state.clothingSupplierCredit.findUnique.mockResolvedValue({
      id: 'credit-42',
      sourceProductId: 42,
      supplierReference: 'supplier a',
      currency: 'PHP',
      postingDate: new Date('2026-10-20'),
    });
    await applySupplierCredit(apply());
    const entries =
      state.clothingInventoryTransitBuildEntry.create.mock.calls.map(
        ([call]) => call.data
      );
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          creditAccount: 'Supplier Credits',
          amount: 1000,
        }),
        expect.objectContaining({
          creditAccount: 'Credit Card Payable',
          amount: 2000,
        }),
      ])
    );
    expect(entries.reduce((total, row) => total + row.amount, 0)).toBe(3000);
    expect(state.clothingSupplierCredit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'credit-42',
          availableAmount: { gte: new Prisma.Decimal(1000) },
        },
      })
    );
  });

  it.each([
    {
      gross: 1000,
      payment: 'Paid',
      method: null,
      expected: [{ creditAccount: 'Supplier Credits', amount: 1000 }],
    },
    {
      gross: 3000,
      payment: 'Unpaid',
      method: null,
      expected: [
        { creditAccount: 'Supplier Payable', amount: 2000 },
        { creditAccount: 'Supplier Credits', amount: 1000 },
      ],
    },
  ])(
    'handles full credit and unpaid remainder without fictional cash (%j)',
    async ({ gross, payment, method, expected }) => {
      state.product.findUnique.mockResolvedValue({
        ...product(),
        id: 43,
        grandTotal: gross,
        payment,
        paymentMethod: method,
      });
      state.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([]);
      state.clothingSupplierCredit.findUnique.mockResolvedValue({
        id: 'credit-42',
        sourceProductId: 42,
        supplierReference: 'supplier a',
        currency: 'PHP',
        postingDate: new Date('2026-10-20'),
      });
      await applySupplierCredit(apply());
      const entries =
        state.clothingInventoryTransitBuildEntry.create.mock.calls.map(
          ([call]) => call.data
        );
      expect(entries).toHaveLength(expected.length);
      for (const row of expected) {
        expect(entries).toContainEqual(expect.objectContaining(row));
      }
    }
  );

  it('replays application without spending credit a second time', async () => {
    state.clothingSupplierCredit.findUnique.mockResolvedValue({
      id: 'credit-42',
      currency: 'PHP',
      supplierReference: 'supplier a',
    });
    state.clothingSupplierCreditApplication.findUnique.mockResolvedValue({
      creditId: 'credit-42',
      amount: new Prisma.Decimal(1000),
      postingDate: new Date('2026-10-26'),
    });
    await applySupplierCredit(apply());
    expect(state.clothingSupplierCredit.updateMany).not.toHaveBeenCalled();
    expect(
      state.clothingInventoryTransitBuildEntry.create
    ).not.toHaveBeenCalled();
  });

  it('rejects credit from a different supplier before spending it', async () => {
    state.clothingSupplierCredit.findUnique.mockResolvedValue({
      supplierReference: 'supplier b',
      currency: 'PHP',
    });
    await expect(applySupplierCredit(apply())).rejects.toThrow('same supplier');
    expect(state.clothingSupplierCredit.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an exhausted balance using the conditional update', async () => {
    state.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([]);
    state.clothingSupplierCredit.findUnique.mockResolvedValue({
      id: 'credit-42',
      sourceProductId: 41,
      supplierReference: 'supplier a',
      currency: 'PHP',
      postingDate: new Date('2026-10-20'),
    });
    state.clothingSupplierCredit.updateMany.mockResolvedValue({ count: 0 });
    await expect(applySupplierCredit(apply())).rejects.toThrow('Insufficient');
    expect(
      state.clothingInventoryTransitBuildEntry.create
    ).not.toHaveBeenCalled();
  });

  it('does not replace a previously posted target purchase', async () => {
    state.clothingSupplierCredit.findUnique.mockResolvedValue({
      id: 'credit-42',
      sourceProductId: 41,
      supplierReference: 'supplier a',
      currency: 'PHP',
      postingDate: new Date('2026-10-20'),
    });
    await expect(applySupplierCredit(apply())).rejects.toThrow(
      'before posting'
    );
  });

  it('moves an unreclassified product source without changing amount, date, or funding', async () => {
    await transferSupplierProduct({
      productId: 42,
      shipmentCode: 'KPC 23930A-240',
      reason: 'Supplier will send next time',
      requestId: 'transfer-request',
    });
    expect(
      state.clothingInventoryTransitBuildEntry.updateMany
    ).toHaveBeenCalledWith({
      where: { id: { in: ['build'] }, deletedAt: null },
      data: { shipmentCode: 'KPC 23930A-240', shipmentId: null },
    });
    expect(state.clothingProductShipmentTransfer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromShipmentCode: 'KPC 23930A-239',
          toShipmentCode: 'KPC 23930A-240',
        }),
      })
    );
    expect(
      state.clothingAccountingJournalLine.createMany
    ).not.toHaveBeenCalled();
  });

  it.each([null, { id: 'staff', role: 'STAFF' }])(
    'requires administrator authority (%j)',
    async (user) => {
      state.user = user;
      await expect(issueSupplierCredit(issue())).rejects.toThrow();
      expect(state.$transaction).not.toHaveBeenCalled();
    }
  );

  it('locks purchase cost and deletion after funding without blocking ordinary price edits', () => {
    const existing = {
      ...product(),
      supplierCreditAppliedAmount: new Prisma.Decimal(1000),
    };
    expect(() =>
      assertSupplierFundingWrite(existing, { grandTotal: 20000 })
    ).toThrow('purchase basis');
    expect(() => assertSupplierFundingWrite(existing, null)).toThrow(
      'cannot be deleted'
    );
    expect(() =>
      assertSupplierFundingWrite(existing, { actualPrice: 500 })
    ).not.toThrow();
  });

  it('allows payment selection for an unpaid remainder but locks posted card funding', () => {
    const existing = {
      ...product(),
      paymentCardId: 'original-card',
      supplierCreditAppliedAmount: new Prisma.Decimal(1000),
    };
    expect(() =>
      assertSupplierFundingWrite(
        { ...existing, payment: 'Unpaid', paymentMethod: null },
        { payment: 'Paid', paymentMethod: 'BANK' }
      )
    ).not.toThrow();
    expect(() =>
      assertSupplierFundingWrite(existing, {
        paymentCard: { connect: { id: 'different-card' } },
      })
    ).toThrow('card must be preserved');
    expect(() =>
      assertSupplierFundingWrite(existing, { paymentCardId: null })
    ).toThrow('card must be preserved');
    expect(() =>
      assertSupplierFundingWrite(existing, { payment: 'Unpaid' })
    ).toThrow('must be preserved');
  });

  it.each(['2026-02-30', '2026-13-01', '2100-01-01'])(
    'rejects an invalid or future credit posting date: %s',
    async (postingDate) => {
      await expect(
        issueSupplierCredit({ ...issue(), postingDate })
      ).rejects.toMatchObject({ status: 400 });
      expect(state.$transaction).not.toHaveBeenCalled();
    }
  );

  it('rejects fractional-cent applications before any credit is consumed', async () => {
    await expect(
      applySupplierCredit({ ...apply(), amount: 1000.001 })
    ).rejects.toMatchObject({ status: 400 });
    expect(state.clothingSupplierCredit.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a payable settlement dated after the supplier credit', async () => {
    state.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      { ...build(), creditAccount: 'Supplier Payable' },
    ]);
    state.clothingAccountingJournalLine.findMany.mockResolvedValue([
      {
        sourceLineKey: 'SUPPLIER_SETTLEMENT:debit',
        account: 'Supplier Payable',
        debit: 19511.37,
        credit: 0,
        date: new Date('2026-10-27'),
      },
      {
        sourceLineKey: 'SUPPLIER_SETTLEMENT:credit',
        account: 'Credit Card Payable',
        debit: 0,
        credit: 19511.37,
        date: new Date('2026-10-27'),
      },
    ]);
    await expect(issueSupplierCredit(issue())).rejects.toThrow(
      'on or before the credit date'
    );
    expect(state.clothingSupplierCredit.create).not.toHaveBeenCalled();
  });

  it('validates supplier API actions and maps serialization conflicts to a retryable response', async () => {
    const { POST } = await import(
      '@/app/api/products/[id]/supplier-resolution/route'
    );
    const { NextRequest } = await import('next/server');
    const request = (body: Record<string, unknown>) =>
      new NextRequest('http://localhost/api/products/42/supplier-resolution', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      });
    const invalid = await POST(
      request({ ...issue(), action: 'ISSUE_CREDIT', amount: 100 }),
      { params: { id: '42' } }
    );
    expect(invalid.status).toBe(400);
    state.$transaction.mockRejectedValueOnce(
      Object.assign(new Error('Serialization failure'), { code: 'P2034' })
    );
    const { productId: _productId, ...input } = issue();
    const conflict = await POST(
      request({
        ...input,
        requestId: 'd9bd60cf-1b87-4c36-a04d-7f92a78a011c',
        action: 'ISSUE_CREDIT',
      }),
      { params: { id: '42' } }
    );
    expect(conflict.status).toBe(409);
  });
});
