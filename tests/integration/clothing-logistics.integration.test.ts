import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import type * as NextAuth from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { getServerSession as getRootSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { POST, GET } from '@/app/api/accounting/shipment-logistics/route';
import { getLogisticsBalances } from '@/modules/clothing/operations/shipments/lib/logisticsCosts';
import { getTestApiUrl } from '@/core/testing/test-helpers';
import { productService } from '@/modules/products/api/service';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('next-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof NextAuth>()),
  getServerSession: vi.fn(),
}));

let failCredit = false;
let failOpeningBuild = false;
let openingReadBarrier: {
  shipmentCode: string;
  reads: number;
  ready: Promise<void>;
  release: () => void;
} | null = null;
let readBarrier: {
  prefix: string;
  reads: number;
  ready: Promise<void>;
  release: () => void;
} | null = null;
prisma.$use(async (parameters, next) => {
  if (
    failCredit &&
    parameters.model === 'ClothingAccountingJournalLine' &&
    parameters.action === 'create' &&
    parameters.args.data.sourceType === 'SHIPMENT_LOGISTICS' &&
    parameters.args.data.sourceLineKey.endsWith(':credit')
  ) {
    throw new Error('INJECTED_LOGISTICS_CREDIT_FAILURE');
  }
  const result = await next(parameters);
  if (
    failOpeningBuild &&
    parameters.model === 'ClothingInventoryTransitBuildEntry' &&
    parameters.action === 'createMany'
  ) {
    throw new Error('INJECTED_OPENING_BUILD_FAILURE');
  }
  const openingBarrier = openingReadBarrier;
  if (
    openingBarrier &&
    parameters.model === 'Product' &&
    parameters.action === 'findMany' &&
    parameters.args.where.shipmentCode?.equals === openingBarrier.shipmentCode
  ) {
    openingBarrier.reads++;
    if (openingBarrier.reads === 2) {
      openingBarrier.release();
    }
    await openingBarrier.ready;
  }
  const barrier = readBarrier;
  if (
    barrier &&
    parameters.model === 'ClothingAccountingJournalLine' &&
    parameters.action === 'findMany' &&
    parameters.args.where.sourceLineKey?.startsWith === barrier.prefix
  ) {
    barrier.reads++;
    if (barrier.reads === 2) {
      barrier.release();
    }
    await barrier.ready;
  }
  return result;
});

beforeEach(() => {
  failCredit = false;
  failOpeningBuild = false;
  openingReadBarrier = null;
  readBarrier = null;
  const session = {
    user: {
      id: 'integration-admin',
      name: 'Integration Admin',
      email: 'integration@example.test',
      role: 'ADMIN',
    },
    expires: '2099-01-01T00:00:00.000Z',
  };
  vi.mocked(getServerSession).mockResolvedValue(session);
  vi.mocked(getRootSession).mockResolvedValue(session);
});

async function fixture() {
  const shipment = await prisma.shipment.create({
    data: { shipmentCode: `LOG-${randomUUID()}`, shipmentStatus: 'In Transit' },
  });
  return {
    shipment,
    input: {
      requestId: randomUUID(),
      shipmentId: shipment.id,
      vendor: 'Forwarder',
      action: 'accrue',
      date: '2026-10-24',
      amount: 5000,
      ref: shipment.shipmentCode,
      description: 'Confirmed actual charge',
      clearingAccount: 'Landed Cost Clearing',
      payableAccount: 'Forwarder Payable',
    },
  };
}
const post = (
  input: Awaited<ReturnType<typeof fixture>>['input'],
  change: Record<string, unknown> = {}
) =>
  POST(
    new NextRequest(getTestApiUrl('/api/accounting/shipment-logistics'), {
      method: 'POST',
      body: JSON.stringify({ ...input, ...change }),
    })
  );
const linesFor = (shipmentId: number) =>
  prisma.clothingAccountingJournalLine.findMany({
    where: {
      sourceType: 'SHIPMENT_LOGISTICS',
      sourceLineKey: { startsWith: `shipment:${shipmentId}:` },
    },
  });

describe('Integration - opening-funded product transit', () => {
  async function openingFixture() {
    const cutover = await getRuntimeAccountingCutoverDate();
    const previousDay = new Date(cutover.getTime() - 86400000)
      .toISOString()
      .slice(0, 10);
    const shipmentCode = `OPENING-${randomUUID()}`;
    const shipment = await prisma.shipment.create({
      data: { shipmentCode, shipmentStatus: 'Delivered' },
    });
    const product = await prisma.product.create({
      data: {
        product: 'Opening transit integration fixture',
        productCode: shipmentCode,
        shipmentCode,
        payment: 'Paid',
        paymentMethod: 'CASH',
        orderDate: previousDay,
        postingDate: cutover.toISOString().slice(0, 10),
        quantity: 740,
        grandTotal: 30636.64,
        forwardersFee: 1530,
        lalamove: 950,
      },
    });
    const key = `PRODUCT_TRANSIT_BUILD:${product.id}:GRAND_TOTAL`;
    return {
      cutover,
      product,
      shipmentCode,
      key,
      input: {
        shipmentCode,
        fundingSource: 'OPENING_BALANCE' as const,
        openingBalanceConfirmed: true,
      },
      rows: () =>
        prisma.clothingInventoryTransitBuildEntry.findMany({
          where: { idempotencyKey: key },
        }),
      cleanup: async () => {
        failOpeningBuild = false;
        openingReadBarrier = null;
        await prisma.clothingInventoryTransitBuildEntry.deleteMany({
          where: { idempotencyKey: key },
        });
        await prisma.product.delete({ where: { id: product.id } });
        await prisma.shipment.delete({ where: { id: shipment.id } });
      },
    };
  }

  it('persists exactly one opening supplier-cost source and leaves payments and logistics untouched on retry', async () => {
    const fixture = await openingFixture();
    try {
      const before = await prisma.clothingAccountingJournalLine.count();
      const first = await productService.postManualTransitBuildUpByShipmentCode(
        fixture.input
      );
      expect(first).toMatchObject({ created: 1, products: 1 });
      const [row] = await fixture.rows();
      expect(row).toMatchObject({
        creditAccount: 'Opening Equity',
        debitAccount: 'Inventory in Transit',
        postingDate: fixture.cutover,
        amount: 30636.64,
      });
      expect(row.notes).toContain(
        'Confirmed paid before cutover and in transit at cutover'
      );
      expect(
        await productService.postManualTransitBuildUpByShipmentCode(
          fixture.input
        )
      ).toEqual({ created: 0, skipped: 1, products: 1 });
      expect(await fixture.rows()).toEqual([row]);
      expect(
        await prisma.product.findUnique({ where: { id: fixture.product.id } })
      ).toEqual(fixture.product);
      expect(await prisma.clothingAccountingJournalLine.count()).toBe(before);
    } finally {
      await fixture.cleanup();
    }
  });

  it('rolls back a newly created source after failure and allows a clean retry', async () => {
    const fixture = await openingFixture();
    try {
      failOpeningBuild = true;
      await expect(
        productService.postManualTransitBuildUpByShipmentCode(fixture.input)
      ).rejects.toThrow('INJECTED_OPENING_BUILD_FAILURE');
      expect(await fixture.rows()).toEqual([]);
      failOpeningBuild = false;
      expect(
        await productService.postManualTransitBuildUpByShipmentCode(
          fixture.input
        )
      ).toMatchObject({ created: 1 });
      expect(await fixture.rows()).toHaveLength(1);
    } finally {
      await fixture.cleanup();
    }
  });

  it('keeps one source when two opening submissions race and the loser retries', async () => {
    const fixture = await openingFixture();
    try {
      let release!: () => void;
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      openingReadBarrier = {
        shipmentCode: fixture.shipmentCode,
        reads: 0,
        ready,
        release,
      };
      const outcomes = await Promise.allSettled([
        productService.postManualTransitBuildUpByShipmentCode(fixture.input),
        productService.postManualTransitBuildUpByShipmentCode(fixture.input),
      ]);
      openingReadBarrier = null;
      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled')
      ).toHaveLength(1);
      const conflict = outcomes.find(
        (outcome) => outcome.status === 'rejected'
      );
      if (!conflict || conflict.status !== 'rejected') {
        throw new Error('Missing serializable conflict');
      }
      expect(conflict.reason).toMatchObject({ code: 'P2034' });
      expect(await fixture.rows()).toHaveLength(1);
      expect(
        await productService.postManualTransitBuildUpByShipmentCode(
          fixture.input
        )
      ).toEqual({ created: 0, skipped: 1, products: 1 });
    } finally {
      await fixture.cleanup();
    }
  });
});

describe('Integration - actual shipment logistics safeguards', () => {
  it('settles actual costs with partial payments and capitalizes once after delivery', async () => {
    const { shipment, input } = await fixture();
    expect((await post(input)).status).toBe(201);
    expect(
      (
        await post(input, {
          requestId: randomUUID(),
          action: 'pay',
          amount: 2000,
        })
      ).status
    ).toBe(201);
    expect(
      (
        await post(input, {
          requestId: randomUUID(),
          action: 'pay',
          amount: 3000.01,
        })
      ).status
    ).toBe(409);
    expect(
      (
        await post(input, {
          requestId: randomUUID(),
          action: 'pay',
          amount: 3000,
        })
      ).status
    ).toBe(201);
    expect(
      (await post(input, { requestId: randomUUID(), action: 'capitalize' }))
        .status
    ).toBe(409);
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { shipmentStatus: 'Delivered', dateDelivered: '2026-10-24' },
    });
    expect(
      (
        await post(input, {
          requestId: randomUUID(),
          action: 'capitalize',
          date: '2026-10-23',
        })
      ).status
    ).toBe(400);
    const capitalization = { requestId: randomUUID(), action: 'capitalize' };
    expect((await post(input, capitalization)).status).toBe(201);
    expect((await post(input, capitalization)).status).toBe(200);
    expect(
      (
        await post(input, {
          requestId: randomUUID(),
          action: 'capitalize',
          amount: 1,
        })
      ).status
    ).toBe(409);
    const lines = await linesFor(shipment.id);
    expect(lines).toHaveLength(8);
    expect(
      lines.reduce((total, line) => total + line.debit - line.credit, 0)
    ).toBe(0);
    expect(getLogisticsBalances(lines, 'Forwarder')).toEqual({
      actual: 5000,
      paid: 5000,
      capitalized: 5000,
      payable: 0,
      clearing: 0,
    });
  });

  it('rolls back the first journal line if the second fails and safely reuses the request key', async () => {
    const { shipment, input } = await fixture();
    failCredit = true;
    expect((await post(input)).status).toBe(500);
    failCredit = false;
    expect(await linesFor(shipment.id)).toHaveLength(0);
    expect((await post(input)).status).toBe(201);
    expect((await post(input)).status).toBe(200);
    expect((await post(input, { amount: 4999 })).status).toBe(409);
    expect(await linesFor(shipment.id)).toHaveLength(2);
  });

  it('allows only one racing payment when their combined amount exceeds the balance', async () => {
    const { shipment, input } = await fixture();
    expect((await post(input)).status).toBe(201);
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    readBarrier = {
      prefix: `shipment:${shipment.id}:`,
      reads: 0,
      ready,
      release,
    };
    const responses = await Promise.all(
      [randomUUID(), randomUUID()].map((requestId) =>
        post(input, { requestId, action: 'pay', amount: 3000 })
      )
    );
    readBarrier = null;
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      getLogisticsBalances(await linesFor(shipment.id), 'Forwarder').payable
    ).toBe(2000);
  });

  it('does not reduce already paid or capitalized cost through a downward correction', async () => {
    const { shipment, input } = await fixture();
    expect((await post(input)).status).toBe(201);
    expect(
      (
        await post(input, {
          requestId: randomUUID(),
          action: 'pay',
          amount: 4000,
        })
      ).status
    ).toBe(201);
    expect(
      (
        await post(input, {
          requestId: randomUUID(),
          action: 'adjust-down',
          amount: 1000.01,
        })
      ).status
    ).toBe(409);
    expect(
      (
        await post(input, {
          requestId: randomUUID(),
          action: 'adjust-down',
          amount: 1000,
        })
      ).status
    ).toBe(201);
    expect(
      getLogisticsBalances(await linesFor(shipment.id), 'Forwarder').payable
    ).toBe(0);
  });

  it('leaves old manual journals unchanged and exposes the review requirement', async () => {
    const { shipment, input } = await fixture();
    const legacy = await prisma.clothingAccountingJournalLine.create({
      data: {
        sourceType: 'MANUAL',
        sourceId: randomUUID(),
        sourceLineKey: 'debit',
        systemGenerated: false,
        date: new Date(input.date),
        ref: shipment.shipmentCode,
        account: 'Landed Cost Clearing',
        debit: 5000,
        credit: 0,
        description: 'Old manual charge',
      },
    });
    expect((await post(input)).status).toBe(409);
    expect(
      await prisma.clothingAccountingJournalLine.findUnique({
        where: { id: legacy.id },
      })
    ).toEqual(legacy);
    expect(await linesFor(shipment.id)).toHaveLength(0);
    const response = await GET(
      new NextRequest(
        getTestApiUrl(
          `/api/accounting/shipment-logistics?shipmentId=${shipment.id}`
        )
      )
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.requiresReview).toBe(true);
  });
});
