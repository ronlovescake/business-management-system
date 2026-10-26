import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type * as NextAuth from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { getServerSession as getRootSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { POST as collect } from '@/app/api/customers/[id]/payments/route';
import { POST as collectBulk } from '@/app/api/transactions/payments/bulk/route';
import {
  approveOrderCancellation,
  payApprovedCancellationRefund,
} from '@/lib/accounting/customer-money';
import { getRefundObligations } from '@/lib/accounting/refund-obligations';
import { GET as journalReport } from '@/app/api/accounting/journal/route';
import { GET as ledgerReport } from '@/app/api/accounting/ledger/route';
import { GET as profitReport } from '@/app/api/accounting/profit-loss/route';
import { GET as profitDetailsReport } from '@/app/api/accounting/profit-loss/details/route';
import { GET as balanceReport } from '@/app/api/accounting/balance-sheet/route';
import {
  recordDatedCostCorrection,
  confirmZeroCostMovement,
} from '@/lib/accounting/inventory-valuation';
import { buildCogsAndInventoryEntries } from '@/lib/accounting/inventory-cogs';
import { createClothingAccountingFixture } from './clothing-accounting-fixture';
import { buildTableQueryOptions } from '@/app/api/backup/backupRouteUtils';
import { getCurrentDateISO } from '@/utils/date';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('next-auth', async (original) => ({
  ...(await original<typeof NextAuth>()),
  getServerSession: vi.fn(),
}));

const actor = { id: 'integration-money-admin', role: 'ADMIN' };
const orderIds: number[] = [];
const customerIds: number[] = [];
const requestIds: string[] = [];
const productIds: number[] = [];
const shipmentIds: number[] = [];
let failPayout = false;
let failDecision = false;
let barrier: {
  orderId: number;
  cancellationId?: string;
  reads: number;
  ready: Promise<void>;
  release: () => void;
  connections: number;
} | null = null;

prisma.$use(async (parameters, next) => {
  if (
    failPayout &&
    parameters.model === 'ClothingRefundPayout' &&
    parameters.action === 'create'
  ) {
    throw new Error('INJECTED_CUSTOMER_PAYOUT_FAILURE');
  }
  if (
    failDecision &&
    parameters.model === 'ClothingAccountingJournalLine' &&
    parameters.action === 'createMany'
  ) {
    throw new Error('INJECTED_CUSTOMER_DECISION_FAILURE');
  }
  const result = await next(parameters);
  const current = barrier;
  if (
    current &&
    ['findUnique', 'findFirst'].includes(parameters.action) &&
    ((parameters.model === 'Transaction' &&
      parameters.args.where.id === current.orderId &&
      parameters.args.select?.initialDepositAmount) ||
      (parameters.model === 'ClothingOrderCancellation' &&
        parameters.args.where.id === current.cancellationId))
  ) {
    if (++current.reads === 2) {
      const observer = new PrismaClient();
      try {
        const rows = await observer.$queryRaw<
          Array<{ connections: bigint }>
        >`SELECT COUNT(DISTINCT pid) AS connections FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid() AND xact_start IS NOT NULL AND backend_type = 'client backend'`;
        current.connections = Number(rows[0].connections);
      } finally {
        await observer.$disconnect();
        current.release();
      }
    }
    await current.ready;
  }
  return result;
});

function key() {
  const id = randomUUID();
  requestIds.push(id);
  return id;
}
function request(body: unknown, id: string) {
  return new NextRequest('http://127.0.0.1:65529/api/customers/1/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id },
    body: JSON.stringify(body),
  });
}
async function order(gross = 100) {
  const customer = await prisma.customer.create({
    data: {
      customerName: `Money-${randomUUID()}`,
      date: getCurrentDateISO(),
      phoneNumber: '',
      address: '',
      facebook: '',
      emailAddress: '',
      businessName: '',
      taxNumber: '',
      businessAddress: '',
      businessContactNumber: '',
      customerStatus: 'Active',
    },
  });
  customerIds.push(customer.id);
  const row = await prisma.transaction.create({
    data: {
      customerId: customer.id,
      customers: customer.customerName,
      quantity: 1,
      unitPrice: gross,
      adjustment: 0,
      lineTotal: gross,
      orderStatus: 'Invoiced',
      orderDate: '2026-10-20',
    },
  });
  orderIds.push(row.id);
  return { row, customer };
}
function payment(
  transactionId: number,
  amount: number,
  extra: Record<string, unknown> = {}
) {
  return {
    transactionId,
    amount,
    paymentDate: '2026-10-24',
    method: 'Cash',
    ...extra,
  };
}

beforeEach(() => {
  failPayout = false;
  failDecision = false;
  barrier = null;
  const session = {
    user: {
      ...actor,
      name: 'Integration Money Admin',
      email: 'money@example.test',
    },
    expires: '2099-01-01T00:00:00Z',
  };
  vi.mocked(getServerSession).mockResolvedValue(session);
  vi.mocked(getRootSession).mockResolvedValue(session);
});

afterEach(async () => {
  failPayout = false;
  failDecision = false;
  barrier?.release();
  barrier = null;
  const cleanup = new PrismaClient();
  try {
    await cleanup.clothingRefundPayout.deleteMany({
      where: { cancellation: { transactionId: { in: orderIds } } },
    });
    await cleanup.clothingOrderCancellation.deleteMany({
      where: { transactionId: { in: orderIds } },
    });
    await cleanup.transactionRefund.deleteMany({
      where: { transactionId: { in: orderIds } },
    });
    await cleanup.transactionPayment.deleteMany({
      where: { transactionId: { in: orderIds } },
    });
    await cleanup.transactionStatusChange.deleteMany({
      where: { transactionId: { in: orderIds } },
    });
    await cleanup.inventoryMovement.deleteMany({
      where: {
        OR: [
          { sourceTransactionId: { in: orderIds } },
          { productId: { in: productIds } },
        ],
      },
    });
    await cleanup.clothingAccountingJournalLine.deleteMany({
      where: { sourceId: { in: requestIds } },
    });
    await cleanup.clothingFinancialRequest.deleteMany({
      where: { id: { in: requestIds } },
    });
    await cleanup.transaction.deleteMany({ where: { id: { in: orderIds } } });
    await cleanup.generalMerchandiseCustomer.deleteMany({
      where: { clothingCustomerId: { in: customerIds } },
    });
    await cleanup.customer.deleteMany({ where: { id: { in: customerIds } } });
    await cleanup.productCodeAlias.deleteMany({
      where: { productId: { in: productIds } },
    });
    await cleanup.product.deleteMany({ where: { id: { in: productIds } } });
    await cleanup.shipment.deleteMany({ where: { id: { in: shipmentIds } } });
  } finally {
    orderIds.length = 0;
    customerIds.length = 0;
    requestIds.length = 0;
    productIds.length = 0;
    shipmentIds.length = 0;
    await cleanup.$disconnect();
  }
});

describe('Integration - Clothing customer money lifecycle', () => {
  it('allows only one of two 60 collections against 100 using two live transaction connections', async () => {
    const fixture = await order();
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const concurrent = {
      orderId: fixture.row.id,
      reads: 0,
      ready,
      release,
      connections: 0,
    };
    barrier = concurrent;
    const body = payment(fixture.row.id, 60);
    const context = { params: { id: String(fixture.customer.id) } };
    const responses = await Promise.all([
      collect(request(body, key()), context),
      collect(request(body, key()), context),
    ]);
    barrier = null;
    expect(concurrent.connections).toBeGreaterThanOrEqual(2);
    expect(
      responses.filter((response) => response.status === 201)
    ).toHaveLength(1);
    expect(
      responses.filter((response) => response.status === 400)
    ).toHaveLength(1);
    expect(
      await prisma.transactionPayment.count({
        where: { transactionId: fixture.row.id },
      })
    ).toBe(1);
    expect(
      await prisma.transaction.findUniqueOrThrow({
        where: { id: fixture.row.id },
      })
    ).toMatchObject({ adjustment: 60, lineTotal: 40 });
  });

  it.each([10, 20] as const)(
    'persists exact original %s-percent agreement and actor/date in the actual direct write',
    async (rate) => {
      const fixture = await order(1000);
      const id = key();
      const response = await collect(
        request(
          payment(fixture.row.id, rate * 10, {
            isReservation: true,
            originalDepositRate: rate,
          }),
          id
        ),
        { params: { id: String(fixture.customer.id) } }
      );
      expect(response.status).toBe(201);
      const saved = await prisma.transaction.findUniqueOrThrow({
        where: { id: fixture.row.id },
      });
      expect(saved.initialDepositAmount?.toNumber()).toBe(rate * 10);
      expect(saved.initialDepositRate?.toNumber()).toBe(rate);
      expect(saved.depositConfirmedAt).toBeInstanceOf(Date);
      expect(saved.depositConfirmedBy).toBe('Integration Money Admin');
      expect(
        await prisma.transactionPayment.findFirst({
          where: { transactionId: fixture.row.id },
        })
      ).toMatchObject({ financialRequestId: id, isReservation: true });
    }
  );

  it('replays a direct collection exactly once and rejects changed details under its UUID', async () => {
    const fixture = await order();
    const id = key();
    const body = payment(fixture.row.id, 40);
    const context = { params: { id: String(fixture.customer.id) } };
    const first = await collect(request(body, id), context);
    const retry = await collect(request(body, id), context);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect((await retry.json()).data.id).toBe((await first.json()).data.id);
    expect(
      (await collect(request({ ...body, amount: 41 }, id), context)).status
    ).toBe(409);
    expect(
      await prisma.transactionPayment.count({
        where: { transactionId: fixture.row.id },
      })
    ).toBe(1);
  });

  it('validates the complete bulk batch before writing any receipt or deposit agreement', async () => {
    const first = await order(1000);
    const second = await order(100);
    const id = key();
    const response = await collectBulk(
      request(
        {
          payments: [
            payment(first.row.id, 200, {
              isReservation: true,
              originalDepositRate: 20,
            }),
            payment(second.row.id, 101),
          ],
        },
        id
      )
    );
    expect(response.status).toBe(400);
    expect(
      await prisma.transactionPayment.count({
        where: { transactionId: { in: [first.row.id, second.row.id] } },
      })
    ).toBe(0);
    expect(
      (
        await prisma.transaction.findUniqueOrThrow({
          where: { id: first.row.id },
        })
      ).initialDepositAmount
    ).toBeNull();
    expect(
      await prisma.clothingFinancialRequest.findUnique({ where: { id } })
    ).toBeNull();
  });

  it('persists a bulk 20-percent agreement and keeps it unchanged after a direct installment', async () => {
    const fixture = await order(1000);
    const id = key();
    const deposit = await collectBulk(
      request(
        {
          payments: [
            payment(fixture.row.id, 200, {
              isReservation: true,
              originalDepositRate: 20,
            }),
          ],
        },
        id
      )
    );
    expect(deposit.status).toBe(200);
    const before = await prisma.transaction.findUniqueOrThrow({
      where: { id: fixture.row.id },
    });
    expect(before.initialDepositAmount?.toNumber()).toBe(200);
    expect(before.initialDepositRate?.toNumber()).toBe(20);
    expect(before.depositConfirmedAt).toBeInstanceOf(Date);
    expect(before.depositConfirmedBy).toBe('Integration Money Admin');
    expect(
      (
        await collect(request(payment(fixture.row.id, 300), key()), {
          params: { id: String(fixture.customer.id) },
        })
      ).status
    ).toBe(201);
    const after = await prisma.transaction.findUniqueOrThrow({
      where: { id: fixture.row.id },
    });
    expect(after.initialDepositAmount).toEqual(before.initialDepositAmount);
    expect(after.initialDepositRate).toEqual(before.initialDepositRate);
    expect(after.depositConfirmedAt).toEqual(before.depositConfirmedAt);
    expect(after.depositConfirmedBy).toEqual(before.depositConfirmedBy);
  });

  async function paidCancellation() {
    const fixture = await order(1000);
    const context = { params: { id: String(fixture.customer.id) } };
    expect(
      (
        await collect(
          request(
            payment(fixture.row.id, 100, {
              isReservation: true,
              originalDepositRate: 10,
            }),
            key()
          ),
          context
        )
      ).status
    ).toBe(201);
    expect(
      (await collect(request(payment(fixture.row.id, 300), key()), context))
        .status
    ).toBe(201);
    const approval = await approveOrderCancellation(
      key(),
      fixture.row.id,
      {
        kind: 'CANCELLED',
        mode: 'RETAIN_DEPOSIT',
        reason: 'Customer approved cancellation',
      },
      actor
    );
    expect(approval).toMatchObject({
      collectedAmount: 400,
      retainedAmount: 100,
      approvedRefundAmount: 300,
      pendingAmount: 300,
    });
    return { ...fixture, approval };
  }

  it('preserves real receipts on approval and permits only one concurrent 200 payout against 300', async () => {
    const fixture = await paidCancellation();
    expect(
      await prisma.transactionPayment.count({
        where: { transactionId: fixture.row.id },
      })
    ).toBe(2);
    expect(
      await prisma.transactionRefund.count({
        where: { transactionId: fixture.row.id },
      })
    ).toBe(0);
    expect(
      await prisma.clothingAccountingJournalLine.count({
        where: { sourceId: fixture.approval.id, account: 'Cash' },
      })
    ).toBe(0);
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const concurrent = {
      orderId: 0,
      cancellationId: fixture.approval.id,
      reads: 0,
      ready,
      release,
      connections: 0,
    };
    barrier = concurrent;
    const details = {
      cancellationId: fixture.approval.id,
      amount: 200,
      paymentDate: getCurrentDateISO(),
      method: 'Cash' as const,
    };
    const firstKey = key();
    const secondKey = key();
    const results = await Promise.allSettled([
      payApprovedCancellationRefund(
        firstKey,
        fixture.customer.id,
        details,
        actor
      ),
      payApprovedCancellationRefund(
        secondKey,
        fixture.customer.id,
        details,
        actor
      ),
    ]);
    barrier = null;
    expect(concurrent.connections).toBeGreaterThanOrEqual(2);
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1);
    expect(
      (
        await prisma.clothingOrderCancellation.findUniqueOrThrow({
          where: { id: fixture.approval.id },
        })
      ).pendingAmount.toNumber()
    ).toBe(100);
    expect(
      await prisma.clothingRefundPayout.count({
        where: { cancellationId: fixture.approval.id },
      })
    ).toBe(1);
    expect(
      (
        await prisma.transactionRefund.aggregate({
          where: { transactionId: fixture.row.id },
          _sum: { amount: true },
        })
      )._sum.amount
    ).toBe(200);
    const savedKey = results[0].status === 'fulfilled' ? firstKey : secondKey;
    await payApprovedCancellationRefund(
      savedKey,
      fixture.customer.id,
      details,
      actor
    );
    await expect(
      payApprovedCancellationRefund(
        savedKey,
        fixture.customer.id,
        { ...details, amount: 201 },
        actor
      )
    ).rejects.toThrow('different details');
    expect(
      await prisma.transactionRefund.count({
        where: { transactionId: fixture.row.id },
      })
    ).toBe(1);
    await payApprovedCancellationRefund(
      key(),
      fixture.customer.id,
      { ...details, amount: 100 },
      actor
    );
    expect(
      (
        await prisma.clothingOrderCancellation.findUniqueOrThrow({
          where: { id: fixture.approval.id },
        })
      ).pendingAmount.toNumber()
    ).toBe(0);
    expect(
      await prisma.inventoryMovement.count({
        where: { sourceTransactionId: fixture.row.id, fromBucket: 'sold' },
      })
    ).toBe(0);
  });

  it('rolls back pending, refund, payout and request together if the final payout write fails', async () => {
    const fixture = await paidCancellation();
    const id = key();
    failPayout = true;
    try {
      await expect(
        payApprovedCancellationRefund(
          id,
          fixture.customer.id,
          {
            cancellationId: fixture.approval.id,
            amount: 100,
            paymentDate: getCurrentDateISO(),
            method: 'Cash',
          },
          actor
        )
      ).rejects.toThrow('INJECTED_CUSTOMER_PAYOUT_FAILURE');
    } finally {
      failPayout = false;
    }
    expect(
      (
        await prisma.clothingOrderCancellation.findUniqueOrThrow({
          where: { id: fixture.approval.id },
        })
      ).pendingAmount.toNumber()
    ).toBe(300);
    expect(
      await prisma.transactionRefund.count({
        where: { transactionId: fixture.row.id },
      })
    ).toBe(0);
    expect(
      await prisma.clothingRefundPayout.count({
        where: { cancellationId: fixture.approval.id },
      })
    ).toBe(0);
    expect(
      await prisma.clothingFinancialRequest.findUnique({ where: { id } })
    ).toBeNull();
  });

  it('rolls back the complete approval if its journal cannot be written', async () => {
    const fixture = await order(1000);
    const context = { params: { id: String(fixture.customer.id) } };
    expect(
      (
        await collect(
          request(
            payment(fixture.row.id, 100, {
              isReservation: true,
              originalDepositRate: 10,
            }),
            key()
          ),
          context
        )
      ).status
    ).toBe(201);
    const before = await prisma.transaction.findUniqueOrThrow({
      where: { id: fixture.row.id },
    });
    const id = key();
    failDecision = true;
    try {
      await expect(
        approveOrderCancellation(
          id,
          fixture.row.id,
          {
            kind: 'CANCELLED',
            mode: 'RETAIN_DEPOSIT',
            reason: 'Customer approved cancellation',
          },
          actor
        )
      ).rejects.toThrow('INJECTED_CUSTOMER_DECISION_FAILURE');
    } finally {
      failDecision = false;
    }
    expect(
      await prisma.transaction.findUniqueOrThrow({
        where: { id: fixture.row.id },
      })
    ).toEqual(before);
    expect(
      await prisma.clothingOrderCancellation.count({
        where: { transactionId: fixture.row.id },
      })
    ).toBe(0);
    expect(
      await prisma.clothingFinancialRequest.findUnique({ where: { id } })
    ).toBeNull();
  });

  it('enforces pending/conservation checks and restrictive event foreign keys in PostgreSQL', async () => {
    const fixture = await paidCancellation();
    await expect(
      prisma.clothingOrderCancellation.update({
        where: { id: fixture.approval.id },
        data: { pendingAmount: -1 },
      })
    ).rejects.toThrow();
    await expect(
      prisma.clothingOrderCancellation.update({
        where: { id: fixture.approval.id },
        data: { retainedAmount: 101 },
      })
    ).rejects.toThrow();
    const raw = new PrismaClient();
    try {
      await expect(
        raw.clothingFinancialRequest.delete({
          where: { id: fixture.approval.id },
        })
      ).rejects.toThrow();
    } finally {
      await raw.$disconnect();
    }
    expect(
      (
        await prisma.clothingOrderCancellation.findUniqueOrThrow({
          where: { id: fixture.approval.id },
        })
      ).pendingAmount.toNumber()
    ).toBe(300);
  });

  it('reconciles dated deposits, installments, A/R, noncash approval and actual partial payout across all five reports', async () => {
    type Posting = { account: string; debit: number; credit: number };
    type Profit = {
      rows: Array<{ type: string; amount: number }>;
      stats: { revenueTotal: number; expenseTotal: number; netProfit: number };
    };
    type Balance = {
      rows: Array<{ account: string; amount: number }>;
      stats: { balance: number };
    };
    async function reports(asOf: string) {
      const suffix = `?from=2026-01-17&to=${asOf}`;
      async function read<Result>(
        handler: typeof journalReport,
        path: string
      ): Promise<Result> {
        const response = await handler(
          new NextRequest(`http://127.0.0.1:65529/api/accounting/${path}`)
        );
        expect(response.status).toBe(200);
        return (await response.json()).data as Result;
      }
      const journal = await read<{ entries: Posting[] }>(
        journalReport,
        `journal${suffix}`
      );
      const ledger = await read<{
        entries: Posting[];
        closingBalances: Record<string, number>;
      }>(ledgerReport, `ledger${suffix}`);
      const profit = await read<Profit>(profitReport, `profit-loss${suffix}`);
      const details = await read<{ rows: Profit['rows'] }>(
        profitDetailsReport,
        `profit-loss/details${suffix}`
      );
      const balance = await read<Balance>(
        balanceReport,
        `balance-sheet?asOf=${asOf}`
      );
      return { journal, ledger, profit, details, balance };
    }
    const net = (rows: Posting[], account: string) =>
      rows
        .filter((row) => row.account === account)
        .reduce((sum, row) => sum + row.debit - row.credit, 0);
    const balanceAmount = (report: Balance, account: string) =>
      report.rows
        .filter((row) => row.account === account)
        .reduce((sum, row) => sum + row.amount, 0);
    const baseline = new Map<string, Awaited<ReturnType<typeof reports>>>();
    for (const date of ['2026-10-24', '2026-10-25', getCurrentDateISO()]) {
      baseline.set(date, await reports(date));
    }
    const fixture = await order(1000);
    const context = { params: { id: String(fixture.customer.id) } };
    expect(
      (
        await collect(
          request(
            payment(fixture.row.id, 100, {
              method: 'CARD',
              isReservation: true,
              originalDepositRate: 10,
            }),
            key()
          ),
          context
        )
      ).status
    ).toBe(201);
    expect(
      (
        await collect(
          request(payment(fixture.row.id, 300, { method: 'CARD' }), key()),
          context
        )
      ).status
    ).toBe(201);
    await prisma.transaction.update({
      where: { id: fixture.row.id },
      data: {
        orderStatus: 'Accounts Receivable',
        shippedAt: new Date('2026-10-25T04:00:00Z'),
      },
    });
    await prisma.transactionStatusChange.create({
      data: {
        transactionId: fixture.row.id,
        previousStatus: 'Invoiced',
        newStatus: 'Accounts Receivable',
        changedAt: new Date('2026-10-25T04:00:00Z'),
      },
    });
    const approval = await approveOrderCancellation(
      key(),
      fixture.row.id,
      {
        kind: 'CANCELLED',
        mode: 'RETAIN_DEPOSIT',
        reason: 'Customer approved cancellation',
      },
      actor
    );
    expect(approval).toMatchObject({
      receivableCreditAmount: 600,
      retainedAmount: 100,
      approvedRefundAmount: 300,
    });
    for (const [date, expectedRevenue] of [
      ['2026-10-24', 300],
      ['2026-10-25', 1000],
      [getCurrentDateISO(), 100],
    ] as const) {
      const current = await reports(date);
      const before = baseline.get(date)!;
      const revenue =
        current.profit.stats.revenueTotal - before.profit.stats.revenueTotal;
      expect(revenue).toBeCloseTo(expectedRevenue, 2);
      expect(
        current.details.rows
          .filter((row) => row.type === 'Revenue')
          .reduce((sum, row) => sum + row.amount, 0) -
          before.details.rows
            .filter((row) => row.type === 'Revenue')
            .reduce((sum, row) => sum + row.amount, 0)
      ).toBeCloseTo(expectedRevenue, 2);
      for (const account of [
        'Cash',
        'Card Collections Clearing',
        'Customer Deposits',
        'Refunds Payable',
        'Accounts Receivable',
        'Sales Revenue',
        'Sales Returns',
        'Forfeited Deposits',
      ]) {
        expect(
          net(current.journal.entries, account) -
            net(before.journal.entries, account)
        ).toBeCloseTo(
          net(current.ledger.entries, account) -
            net(before.ledger.entries, account),
          2
        );
      }
      expect(
        balanceAmount(current.balance, 'Cash') -
          balanceAmount(before.balance, 'Cash')
      ).toBeCloseTo(0, 2);
      expect(
        balanceAmount(current.balance, 'Card Collections Clearing') -
          balanceAmount(before.balance, 'Card Collections Clearing')
      ).toBeCloseTo(400, 2);
      expect(
        current.balance.stats.balance - before.balance.stats.balance
      ).toBeCloseTo(0, 2);
    }
    const beforePayout = await reports(getCurrentDateISO());
    await payApprovedCancellationRefund(
      key(),
      fixture.customer.id,
      {
        cancellationId: approval.id,
        amount: 100,
        paymentDate: getCurrentDateISO(),
        method: 'Cash',
      },
      actor
    );
    const afterPayout = await reports(getCurrentDateISO());
    expect(afterPayout.profit.stats.netProfit).toBeCloseTo(
      beforePayout.profit.stats.netProfit,
      2
    );
    expect(
      balanceAmount(afterPayout.balance, 'Cash') -
        balanceAmount(beforePayout.balance, 'Cash')
    ).toBeCloseTo(-100, 2);
    expect(
      balanceAmount(afterPayout.balance, 'Refunds Payable') -
        balanceAmount(beforePayout.balance, 'Refunds Payable')
    ).toBeCloseTo(100, 2);
    expect(
      net(afterPayout.journal.entries, 'Cash') -
        net(beforePayout.journal.entries, 'Cash')
    ).toBeCloseTo(-100, 2);
    expect(
      net(afterPayout.ledger.entries, 'Refunds Payable') -
        net(beforePayout.ledger.entries, 'Refunds Payable')
    ).toBeCloseTo(100, 2);
    const obligations = await getRefundObligations();
    expect(
      obligations.history.find((decision) => decision.id === approval.id)
    ).toMatchObject({ pendingAmount: 200, paidAmount: 100 });
    expect(
      (await getRefundObligations('2026-10-25')).history.some(
        (decision) => decision.id === approval.id
      )
    ).toBe(false);
  });

  it('posts one dated sold/unsold cost allocation, preserves old snapshots and restores corrected carrying cost on return', async () => {
    const fixture = await createClothingAccountingFixture();
    productIds.push(fixture.product.id);
    shipmentIds.push(fixture.shipment.id);
    await prisma.product.update({
      where: { id: fixture.product.id },
      data: { landedUnitCost: 10, cogs: 100 },
    });
    await prisma.inventoryMovement.updateMany({
      where: { productId: fixture.product.id },
      data: { postingDate: '2026-10-20', unitCost: 10 },
    });
    const customerOrder = await order();
    await prisma.transaction.update({
      where: { id: customerOrder.row.id },
      data: {
        productCode: fixture.product.productCode,
        packedDate: '2026-10-20',
      },
    });
    const sale = await prisma.inventoryMovement.create({
      data: {
        productId: fixture.product.id,
        productCode: fixture.shipmentCode,
        quantity: 4,
        unitCost: 10,
        fromBucket: 'sellable',
        toBucket: 'sold',
        postingDate: '2026-10-20',
        sourceTransactionId: customerOrder.row.id,
        movementSource: 'transaction',
        movementType: 'sale',
      },
    });
    const capitalizedKey = key();
    const capitalization = await prisma.clothingAccountingJournalLine.create({
      data: {
        date: new Date('2026-10-25T01:00:00Z'),
        ref: fixture.shipmentCode,
        account: 'Stock on Hand',
        debit: 20,
        credit: 0,
        sourceType: 'MANUAL',
        sourceId: capitalizedKey,
        sourceLineKey: 'debit',
        systemGenerated: false,
      },
    });
    await prisma.clothingAccountingJournalLine.create({
      data: {
        date: capitalization.date,
        ref: capitalization.ref,
        account: 'Landed Cost Clearing',
        debit: 0,
        credit: 20,
        sourceType: 'MANUAL',
        sourceId: capitalizedKey,
        sourceLineKey: 'credit',
        systemGenerated: false,
      },
    });
    const details = {
      productId: fixture.product.id,
      expectedUnitCost: 10,
      newUnitCost: 12,
      date: '2026-10-25',
      capitalizationLineId: capitalization.id,
      reason: 'Confirmed freight delta already capitalized',
    };
    const firstKey = key();
    const secondKey = key();
    const results = await Promise.allSettled([
      recordDatedCostCorrection(firstKey, details, actor),
      recordDatedCostCorrection(secondKey, details, actor),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    const result = results.find((item) => item.status === 'fulfilled');
    expect(result?.status === 'fulfilled' ? result.value : null).toMatchObject({
      totalDelta: 20,
      soldDelta: 8,
      stockDelta: 12,
    });
    expect(
      (
        await prisma.inventoryMovement.findUniqueOrThrow({
          where: { id: sale.id },
        })
      ).unitCost
    ).toBe(10);
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: fixture.product.id },
        })
      ).landedUnitCost
    ).toBe(12);
    const recorded = await prisma.clothingAccountingJournalLine.findMany({
      where: { sourceId: { in: [firstKey, secondKey] } },
    });
    expect(recorded).toHaveLength(2);
    expect(recorded.find((line) => line.account === 'COGS')?.debit).toBe(8);
    expect(
      recorded.some(
        (line) =>
          line.account === 'Landed Cost Clearing' || line.account === 'Cash'
      )
    ).toBe(false);
    const historical = await buildCogsAndInventoryEntries({
      from: new Date('2026-01-17'),
      to: new Date('2026-10-24T15:59:59Z'),
    });
    expect(
      historical.entries
        .filter(
          (entry) =>
            entry.account === 'COGS' && entry.ref.includes(fixture.shipmentCode)
        )
        .reduce((sum, entry) => sum + entry.debit - entry.credit, 0)
    ).toBe(40);
    await prisma.inventoryMovement.create({
      data: {
        productId: fixture.product.id,
        productCode: fixture.shipmentCode,
        quantity: 1,
        unitCost: 10,
        fromBucket: 'sold',
        toBucket: 'sellable',
        postingDate: '2026-10-26',
        sourceTransactionId: customerOrder.row.id,
        movementSource: 'customer_refund',
        movementType: 'return',
      },
    });
    const returned = await buildCogsAndInventoryEntries({
      from: new Date('2026-10-25T16:00:00Z'),
      to: new Date('2026-10-26T15:59:59Z'),
    });
    expect(
      returned.entries
        .filter(
          (entry) =>
            entry.account === 'COGS' && entry.ref.includes(fixture.shipmentCode)
        )
        .reduce((sum, entry) => sum + entry.debit - entry.credit, 0)
    ).toBe(-12);
  });

  it('records a real administrator zero-cost confirmation without changing movement history', async () => {
    const fixture = await createClothingAccountingFixture();
    productIds.push(fixture.product.id);
    shipmentIds.push(fixture.shipment.id);
    await prisma.product.update({
      where: { id: fixture.product.id },
      data: { landedUnitCost: 0, cogs: 0 },
    });
    const movement = await prisma.inventoryMovement.create({
      data: {
        productId: fixture.product.id,
        productCode: fixture.shipmentCode,
        quantity: 3,
        unitCost: null,
        fromBucket: 'sellable',
        toBucket: 'sold',
        postingDate: '2026-10-20',
      },
    });
    const period = {
      from: new Date('2026-01-17'),
      to: new Date(`${getCurrentDateISO()}T15:59:59Z`),
    };
    expect(
      (await buildCogsAndInventoryEntries(period)).valuationIssues.some(
        (issue) => issue.movementId === movement.id
      )
    ).toBe(true);
    const id = key();
    const details = {
      movementId: movement.id,
      reason: 'Supplier provided these goods genuinely free',
    };
    await confirmZeroCostMovement(id, details, actor);
    await confirmZeroCostMovement(id, details, actor);
    expect(
      (await buildCogsAndInventoryEntries(period)).valuationIssues.some(
        (issue) => issue.movementId === movement.id
      )
    ).toBe(false);
    expect(
      (
        await buildCogsAndInventoryEntries({
          ...period,
          to: new Date('2026-10-25T15:59:59Z'),
        })
      ).valuationIssues.some((issue) => issue.movementId === movement.id)
    ).toBe(true);
    expect(
      await prisma.inventoryMovement.findUniqueOrThrow({
        where: { id: movement.id },
      })
    ).toEqual(movement);
    expect(await prisma.clothingFinancialRequest.count({ where: { id } })).toBe(
      1
    );
  });

  it('executes selective lifecycle backup filters without orphaned deleted-order events', async () => {
    const active = await paidCancellation();
    const excluded = await paidCancellation();
    const activePayoutId = key();
    const excludedPayoutId = key();
    await payApprovedCancellationRefund(
      activePayoutId,
      active.customer.id,
      {
        cancellationId: active.approval.id,
        amount: 100,
        paymentDate: getCurrentDateISO(),
        method: 'Cash',
      },
      actor
    );
    await payApprovedCancellationRefund(
      excludedPayoutId,
      excluded.customer.id,
      {
        cancellationId: excluded.approval.id,
        amount: 100,
        paymentDate: getCurrentDateISO(),
        method: 'Cash',
      },
      actor
    );
    await prisma.transaction.update({
      where: { id: excluded.row.id },
      data: { deletedAt: new Date() },
    });
    const options = {
      strategy: 'full' as const,
      differentialSince: null,
      includeSoftDeleted: false,
    };
    const requests = await prisma.clothingFinancialRequest.findMany({
      where: buildTableQueryOptions(null, {
        ...options,
        model: 'clothingFinancialRequest',
      }).where,
    });
    const approvals = await prisma.clothingOrderCancellation.findMany({
      where: buildTableQueryOptions(null, {
        ...options,
        model: 'clothingOrderCancellation',
      }).where,
    });
    const payouts = await prisma.clothingRefundPayout.findMany({
      where: buildTableQueryOptions(null, {
        ...options,
        model: 'clothingRefundPayout',
      }).where,
    });
    const receipts = await prisma.transactionPayment.findMany({
      where: buildTableQueryOptions(null, {
        ...options,
        model: 'transactionPayment',
      }).where,
    });
    expect(requests.map((row) => row.id)).toEqual(
      expect.arrayContaining([active.approval.id, activePayoutId])
    );
    expect(
      requests.some(
        (row) => row.id === excluded.approval.id || row.id === excludedPayoutId
      )
    ).toBe(false);
    expect(approvals.some((row) => row.id === active.approval.id)).toBe(true);
    expect(approvals.some((row) => row.id === excluded.approval.id)).toBe(
      false
    );
    expect(payouts.some((row) => row.id === activePayoutId)).toBe(true);
    expect(payouts.some((row) => row.id === excludedPayoutId)).toBe(false);
    expect(receipts.some((row) => row.transactionId === active.row.id)).toBe(
      true
    );
    expect(receipts.some((row) => row.transactionId === excluded.row.id)).toBe(
      false
    );
  });
});
