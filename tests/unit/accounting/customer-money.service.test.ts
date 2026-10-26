import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  approveOrderCancellation,
  buildCancellationJournalAmounts,
  getOrderCancellationPreview,
  payApprovedCancellationRefund,
} from '@/lib/accounting/customer-money';
import { NextRequest } from 'next/server';
import { POST as postCancellation } from '@/app/api/transactions/[id]/cancellation/route';
import { POST as postPayout } from '@/app/api/customers/[id]/refunds/payout/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';
import { getRefundObligations } from '@/lib/accounting/refund-obligations';

const auth = vi.hoisted(() => ({
  user: { id: 'admin-1', role: 'ADMIN' } as { id: string; role: string } | null,
}));

vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: async () => auth.user,
  requireAuth: async () => {
    if (!auth.user) {
      throw new Error('Unauthorized');
    }
    return auth.user;
  },
}));

const client = vi.hoisted(() => ({
  clothingFinancialRequest: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  transaction: { findUnique: vi.fn(), update: vi.fn() },
  transactionPayment: { findMany: vi.fn(), create: vi.fn() },
  transactionRefund: { findMany: vi.fn(), create: vi.fn() },
  clothingOrderCancellation: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  clothingRefundPayout: { create: vi.fn() },
  clothingAccountingJournalLine: { createMany: vi.fn() },
  transactionStatusChange: { create: vi.fn() },
  inventoryMovement: { findFirst: vi.fn(), updateMany: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    ...client,
    $transaction: async (operation: (transaction: unknown) => unknown) =>
      operation(client),
  },
}));

describe('approved clothing cancellation service', () => {
  const requestId = '123e4567-e89b-42d3-a456-426614174000';
  const admin = { id: 'admin-1', role: 'ADMIN' };
  const decision = {
    kind: 'CANCELLED' as const,
    mode: 'RETAIN_DEPOSIT' as const,
    reason: 'Customer canceled after review',
    originalDeposit: { amount: 100, rate: 10 as const },
  };
  const order = {
    id: 1,
    quantity: 1,
    unitPrice: 1000,
    adjustment: 400,
    orderStatus: 'Prepared',
    deletedAt: null,
    statusChanges: [],
    cancellation: null,
    initialDepositAmount: null,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    auth.user = admin;
    client.clothingFinancialRequest.findUnique.mockResolvedValue(null);
    client.transaction.findUnique.mockResolvedValue(order);
    client.transactionPayment.findMany.mockResolvedValue([
      { amount: 400, paymentDate: '2026-01-01' },
    ]);
    client.transactionRefund.findMany.mockResolvedValue([]);
    client.inventoryMovement.findFirst.mockResolvedValue(null);
    client.clothingOrderCancellation.findUnique.mockResolvedValue({
      id: requestId,
      transactionId: 1,
      transaction: { id: 1, customerId: 1 },
      decisionDate: '2026-01-01',
      reason: decision.reason,
      pendingAmount: new Prisma.Decimal(300),
    });
    client.clothingOrderCancellation.updateMany.mockResolvedValue({ count: 1 });
    client.transactionRefund.create.mockResolvedValue({ id: 5 });
  });

  it('saves a pending obligation and confirmed deposit without creating a cash payout', async () => {
    await expect(
      approveOrderCancellation(requestId, 1, decision, admin)
    ).resolves.toMatchObject({
      retainedAmount: 100,
      pendingAmount: 300,
      approvedRefundAmount: 300,
    });
    expect(client.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderStatus: 'Cancelled',
          lineTotal: 0,
          initialDepositAmount: 100,
        }),
      })
    );
    expect(client.transactionRefund.create).not.toHaveBeenCalled();
    expect(client.transactionPayment.create).not.toHaveBeenCalled();
  });

  it('previews actual receipts and flags unexplained legacy adjustments', async () => {
    client.transactionPayment.findMany.mockResolvedValue([{ amount: 300 }]);
    await expect(getOrderCancellationPreview(1)).resolves.toMatchObject({
      collectedAmount: 300,
      reviewRequired: true,
      initialDepositAmount: null,
    });
  });

  it('releases deposits and reverses recognized installments without moving Cash at approval', async () => {
    client.transactionPayment.findMany.mockResolvedValue([
      { amount: 100, paymentDate: '2026-01-01', isReservation: true },
      { amount: 300, paymentDate: '2026-01-02', isReservation: false },
    ]);
    await approveOrderCancellation(requestId, 1, decision, admin);
    const lines =
      client.clothingAccountingJournalLine.createMany.mock.calls[0]?.[0].data;
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account: 'Customer Deposits',
          debit: 100,
          credit: 0,
        }),
        expect.objectContaining({
          account: 'Sales Returns',
          debit: 300,
          credit: 0,
        }),
        expect.objectContaining({
          account: 'Forfeited Deposits',
          debit: 0,
          credit: 100,
        }),
        expect.objectContaining({
          account: 'Refunds Payable',
          debit: 0,
          credit: 300,
        }),
      ])
    );
    expect(
      lines.some((line: { account: string }) => line.account === 'Cash')
    ).toBe(false);
  });

  it('keeps unpaid debt cancellation distinct from the cash refund liability', () => {
    expect(
      buildCancellationJournalAmounts({
        collectedAmount: 400,
        priorRefundAmount: 0,
        openDepositLiability: 0,
        receivableCreditAmount: 600,
        retainedAmount: 100,
        approvedRefundAmount: 300,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ account: 'Sales Returns', debit: 1000 }),
        expect.objectContaining({
          account: 'Accounts Receivable',
          credit: 600,
        }),
        expect.objectContaining({ account: 'Refunds Payable', credit: 300 }),
      ])
    );
  });

  it('prevents ordinary staff from making a paid-order decision', async () => {
    await expect(
      approveOrderCancellation(requestId, 1, decision, {
        id: 'staff-1',
        role: 'STAFF',
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(client.clothingOrderCancellation.create).not.toHaveBeenCalled();
  });

  it('blocks unexplained legacy paid amounts instead of pretending they are new receipts', async () => {
    client.transactionPayment.findMany.mockResolvedValue([]);
    await expect(
      approveOrderCancellation(requestId, 1, decision, admin)
    ).rejects.toThrow('legacy paid amount');
    expect(client.clothingOrderCancellation.create).not.toHaveBeenCalled();
  });

  it('does not erase shipped stock movements or imply a physical return', async () => {
    client.inventoryMovement.findFirst.mockResolvedValue({ id: 20 });
    await approveOrderCancellation(requestId, 1, decision, admin);
    expect(client.inventoryMovement.updateMany).not.toHaveBeenCalled();
  });

  it('preserves a previously confirmed twenty-percent deposit', async () => {
    client.transaction.findUnique.mockResolvedValue({
      ...order,
      initialDepositAmount: new Prisma.Decimal(200),
    });
    await expect(
      approveOrderCancellation(
        requestId,
        1,
        { ...decision, originalDeposit: undefined },
        admin
      )
    ).resolves.toMatchObject({ retainedAmount: 200, pendingAmount: 200 });
  });

  it('does not replace a closed order decision', async () => {
    client.transaction.findUnique.mockResolvedValue({
      ...order,
      orderStatus: 'Cancelled',
    });
    await expect(
      approveOrderCancellation(requestId, 1, decision, admin)
    ).rejects.toThrow('already closed');
    expect(client.clothingOrderCancellation.create).not.toHaveBeenCalled();
  });

  const payout = {
    cancellationId: requestId,
    amount: 100,
    paymentDate: '2026-01-02',
    method: 'Cash' as const,
  };

  it('records only the actual partial payout and leaves the remainder pending', async () => {
    await expect(
      payApprovedCancellationRefund(requestId, 1, payout, admin)
    ).resolves.toMatchObject({ refundId: 5, amount: 100, pendingAmount: 200 });
    expect(client.clothingOrderCancellation.updateMany).toHaveBeenCalledWith({
      where: { id: requestId, pendingAmount: { gte: new Prisma.Decimal(100) } },
      data: { pendingAmount: { decrement: new Prisma.Decimal(100) } },
    });
    expect(client.transactionRefund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 100,
          refundDate: '2026-01-02',
        }),
      })
    );
    expect(client.inventoryMovement.updateMany).not.toHaveBeenCalled();
  });

  it('writes no cash refund when a concurrent payout has exhausted the obligation', async () => {
    client.clothingOrderCancellation.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      payApprovedCancellationRefund(requestId, 1, payout, admin)
    ).rejects.toThrow('exceeds the refund still owed');
    expect(client.transactionRefund.create).not.toHaveBeenCalled();
  });

  it('cannot pay another customer obligation', async () => {
    await expect(
      payApprovedCancellationRefund(requestId, 2, payout, admin)
    ).rejects.toMatchObject({ status: 404 });
    expect(client.transactionRefund.create).not.toHaveBeenCalled();
  });

  it('cannot backdate a payout before approval', async () => {
    await expect(
      payApprovedCancellationRefund(
        requestId,
        1,
        { ...payout, paymentDate: '2025-12-31' },
        admin
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(client.transactionRefund.create).not.toHaveBeenCalled();
  });

  it('returns the original payout after an uncertain response without writing it twice', async () => {
    const result = await payApprovedCancellationRefund(
      requestId,
      1,
      payout,
      admin
    );
    const request =
      client.clothingFinancialRequest.create.mock.calls[0]?.[0].data;
    client.clothingFinancialRequest.findUnique.mockResolvedValue({
      ...request,
      result,
    });
    await expect(
      payApprovedCancellationRefund(requestId, 1, payout, admin)
    ).resolves.toEqual(result);
    expect(client.transactionRefund.create).toHaveBeenCalledTimes(1);
    expect(client.clothingOrderCancellation.updateMany).toHaveBeenCalledTimes(
      1
    );
  });

  it('rejects a reused key with changed payout details', async () => {
    const result = await payApprovedCancellationRefund(
      requestId,
      1,
      payout,
      admin
    );
    const request =
      client.clothingFinancialRequest.create.mock.calls[0]?.[0].data;
    client.clothingFinancialRequest.findUnique.mockResolvedValue({
      ...request,
      result,
    });
    await expect(
      payApprovedCancellationRefund(
        requestId,
        1,
        { ...payout, amount: 101 },
        admin
      )
    ).rejects.toThrow('different details');
    expect(client.transactionRefund.create).toHaveBeenCalledTimes(1);
  });

  const request = (
    path: string,
    body: unknown,
    key: string | null = requestId
  ) =>
    new NextRequest(getTestApiUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      body: JSON.stringify(body),
    });

  it('rejects anonymous cancellation requests at the route boundary', async () => {
    auth.user = null;
    expect(
      (
        await postCancellation(
          request('/api/transactions/1/cancellation', decision),
          { params: { id: '1' } }
        )
      ).status
    ).toBe(401);
    expect(client.clothingOrderCancellation.create).not.toHaveBeenCalled();
  });

  it('rejects ordinary users making paid-order decisions at the route boundary', async () => {
    auth.user = { id: 'user-1', role: 'USER' };
    expect(
      (
        await postCancellation(
          request('/api/transactions/1/cancellation', decision),
          { params: { id: '1' } }
        )
      ).status
    ).toBe(403);
    expect(client.clothingOrderCancellation.create).not.toHaveBeenCalled();
  });

  it('requires a valid request key before executing a payout', async () => {
    expect(
      (
        await postPayout(
          request('/api/customers/1/refunds/payout', payout, null),
          { params: { id: '1' } }
        )
      ).status
    ).toBe(400);
    expect(client.transactionRefund.create).not.toHaveBeenCalled();
  });

  it("rebuilds historical pending from dated payouts rather than today's mutable pending field", async () => {
    client.clothingOrderCancellation.findMany.mockResolvedValue([
      {
        id: requestId,
        transactionId: 1,
        transaction: {
          id: 1,
          customerId: 1,
          customers: 'Customer',
          productCode: 'SKU',
        },
        kind: 'CANCELLED',
        decisionDate: '2026-01-01',
        reason: decision.reason,
        createdBy: admin.id,
        approvedRefundAmount: new Prisma.Decimal(300),
        retainedAmount: new Prisma.Decimal(100),
        pendingAmount: new Prisma.Decimal(0),
        payouts: [
          {
            id: 'payout',
            refundId: 5,
            paymentDate: '2026-01-02',
            amount: new Prisma.Decimal(100),
            method: 'Cash',
            createdBy: 'user-1',
          },
        ],
      },
    ]);
    await expect(getRefundObligations('2026-01-03')).resolves.toMatchObject({
      pendingAmount: 200,
      transactionCount: 1,
      oldestAgeDays: 2,
      paidApprovedRefundAmount: 100,
      retainedDepositAmount: 100,
      paidRefundTrends: [{ month: '2026-01', amount: 100 }],
    });
    expect(client.clothingOrderCancellation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { decisionDate: { lte: '2026-01-03' } },
        include: expect.objectContaining({
          payouts: expect.objectContaining({
            where: { paymentDate: { lte: '2026-01-03' } },
          }),
        }),
      })
    );
  });

  it('does not hide an earlier obligation when a report period starts later', async () => {
    client.clothingOrderCancellation.findMany.mockResolvedValue([
      {
        id: requestId,
        transactionId: 1,
        transaction: { id: 1, customerId: 1, customers: 'Customer' },
        kind: 'CANCELLED',
        decisionDate: '2026-01-01',
        reason: decision.reason,
        createdBy: admin.id,
        approvedRefundAmount: new Prisma.Decimal(300),
        retainedAmount: new Prisma.Decimal(100),
        payouts: [],
      },
    ]);
    await expect(
      getRefundObligations('2026-02-02', '2026-02-01')
    ).resolves.toMatchObject({
      pendingAmount: 300,
      transactionCount: 1,
      paidApprovedRefundAmount: 0,
      retainedDepositAmount: 0,
    });
  });

  it('keeps the completed approval and actual payout history after pending reaches zero', async () => {
    client.clothingOrderCancellation.findMany.mockResolvedValue([
      {
        id: requestId,
        transactionId: 1,
        transaction: { id: 1, customerId: 1, customers: 'Customer' },
        kind: 'CANCELLED',
        decisionDate: '2026-01-01',
        reason: decision.reason,
        createdBy: admin.id,
        approvedRefundAmount: new Prisma.Decimal(300),
        retainedAmount: new Prisma.Decimal(100),
        payouts: [
          {
            id: 'payout',
            refundId: 5,
            amount: new Prisma.Decimal(300),
            paymentDate: '2026-01-02',
            method: 'Cash',
            createdBy: 'user-1',
          },
        ],
      },
    ]);
    await expect(getRefundObligations('2026-01-03')).resolves.toMatchObject({
      pendingAmount: 0,
      transactionCount: 0,
      items: [],
      history: [
        expect.objectContaining({
          pendingAmount: 0,
          payouts: [expect.objectContaining({ refundId: 5, amount: 300 })],
        }),
      ],
    });
  });
});
