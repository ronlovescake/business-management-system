import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import type * as NextAuth from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { getServerSession as getRootSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {
  applySupplierCredit,
  issueSupplierCredit,
  transferSupplierProduct,
} from '@/modules/products/api/supplier-resolution';
import { productService } from '@/modules/products/api/service';
import { mapToDTO } from '@/modules/products/api/dto';
import { POST as reclass } from '@/app/api/shipments/[id]/transit-reclass/route';
import { createClothingAccountingFixture } from './clothing-accounting-fixture';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('next-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof NextAuth>()),
  getServerSession: vi.fn(),
}));

const productCodes = new Set<string>();
const shipmentIds = new Set<number>();
let failApplication = false;
let readBarrier: {
  creditId: string;
  reads: number;
  ready: Promise<void>;
  release: () => void;
} | null = null;

prisma.$use(async (parameters, next) => {
  if (
    failApplication &&
    parameters.model === 'ClothingSupplierCreditApplication' &&
    parameters.action === 'create'
  ) {
    throw new Error('INJECTED_SUPPLIER_APPLICATION_FAILURE');
  }
  const result = await next(parameters);
  const barrier = readBarrier;
  if (
    barrier &&
    parameters.model === 'ClothingSupplierCredit' &&
    parameters.action === 'findUnique' &&
    parameters.args.where.id === barrier.creditId
  ) {
    if (++barrier.reads === 2) {
      barrier.release();
    }
    await barrier.ready;
  }
  return result;
});

beforeEach(() => {
  failApplication = false;
  readBarrier = null;
  const session = {
    user: {
      id: 'integration-admin',
      role: 'ADMIN',
      name: 'Integration Admin',
      email: 'integration@example.test',
    },
    expires: '2099-01-01T00:00:00.000Z',
  };
  vi.mocked(getServerSession).mockResolvedValue(session);
  vi.mocked(getRootSession).mockResolvedValue(session);
});

afterEach(async () => {
  failApplication = false;
  readBarrier?.release();
  readBarrier = null;
  const cleanup = new PrismaClient();
  try {
    const products = await cleanup.product.findMany({
      where: { productCode: { in: Array.from(productCodes) } },
      select: { id: true },
    });
    const ids = products.map((product) => product.id);
    await cleanup.clothingSupplierCreditApplication.deleteMany({
      where: { targetProductId: { in: ids } },
    });
    await cleanup.clothingSupplierCredit.deleteMany({
      where: { sourceProductId: { in: ids } },
    });
    await cleanup.clothingProductShipmentTransfer.deleteMany({
      where: { productId: { in: ids } },
    });
    await cleanup.clothingAccountingJournalLine.deleteMany({
      where: { sourceType: 'PRODUCT', sourceId: { in: ids.map(String) } },
    });
    if (ids.length) {
      await cleanup.clothingInventoryTransitBuildEntry.deleteMany({
        where: {
          OR: ids.map((id) => ({
            idempotencyKey: { startsWith: `PRODUCT_TRANSIT_BUILD:${id}:` },
          })),
        },
      });
    }
    await cleanup.clothingInventoryReclassEntry.deleteMany({
      where: { productId: { in: ids } },
    });
    await cleanup.inventoryMovement.deleteMany({
      where: { productId: { in: ids } },
    });
    await cleanup.productCodeAlias.deleteMany({
      where: { productId: { in: ids } },
    });
    await cleanup.product.deleteMany({ where: { id: { in: ids } } });
    await cleanup.shipment.deleteMany({
      where: { id: { in: Array.from(shipmentIds) } },
    });
  } finally {
    productCodes.clear();
    shipmentIds.clear();
    await cleanup.$disconnect();
  }
});

async function fixture(amount = 19511.37) {
  const result = await createClothingAccountingFixture();
  productCodes.add(result.product.productCode!);
  shipmentIds.add(result.shipment.id);
  const product = await prisma.product.update({
    where: { id: result.product.id },
    data: {
      grandTotal: amount,
      cogs: amount,
      unitPrice: amount / result.product.quantity,
      payment: 'Paid',
      paymentMethod: 'CARD',
    },
  });
  return { ...result, product };
}

function issue(productId: number) {
  return issueSupplierCredit({
    productId,
    supplierReference: 'Supplier A',
    reference: `CREDIT-${productId}`,
    postingDate: '2026-10-26',
    requestId: randomUUID(),
  });
}

function apply(creditId: string, productId: number, amount = 1000) {
  return applySupplierCredit({
    productId,
    creditId,
    amount,
    supplierReference: 'Supplier A',
    postingDate: '2026-10-26',
    requestId: randomUUID(),
  });
}

describe('Integration - clothing supplier credits', () => {
  it('preserves the original liability and accounts for partial use without a cash refund', async () => {
    const source = await fixture();
    const credit = await issue(source.product.id);
    expect((await issue(source.product.id)).id).toBe(credit.id);
    const target = await fixture(3000);
    const application = await apply(credit.id, target.product.id);
    expect((await apply(credit.id, target.product.id)).id).toBe(application.id);
    const updatedCredit = await prisma.clothingSupplierCredit.findUniqueOrThrow(
      { where: { id: credit.id } }
    );
    expect(updatedCredit.amount.toString()).toBe('19511.37');
    expect(updatedCredit.availableAmount.toString()).toBe('18511.37');
    const ids = [source.product.id, target.product.id];
    const builds = await prisma.clothingInventoryTransitBuildEntry.findMany({
      where: {
        OR: ids.map((id) => ({
          idempotencyKey: { startsWith: `PRODUCT_TRANSIT_BUILD:${id}:` },
        })),
      },
    });
    const journals = await prisma.clothingAccountingJournalLine.findMany({
      where: { sourceType: 'PRODUCT', sourceId: { in: ids.map(String) } },
    });
    const balances = new Map<string, Prisma.Decimal>();
    const add = (account: string, amount: Prisma.Decimal) =>
      balances.set(
        account,
        (balances.get(account) ?? new Prisma.Decimal(0)).plus(amount)
      );
    for (const entry of builds) {
      add(entry.debitAccount, new Prisma.Decimal(entry.amount));
      add(entry.creditAccount, new Prisma.Decimal(entry.amount).negated());
    }
    for (const line of journals) {
      add(line.account, new Prisma.Decimal(line.debit).minus(line.credit));
    }
    expect(balances.get('Supplier Credits')?.toString()).toBe('18511.37');
    expect(balances.get('Inventory in Transit')?.toString()).toBe('3000');
    expect(balances.get('Credit Card Payable')?.toString()).toBe('-21511.37');
    expect(balances.has('Cash')).toBe(false);
    expect(
      Array.from(balances.values())
        .reduce((sum, amount) => sum.plus(amount), new Prisma.Decimal(0))
        .toString()
    ).toBe('0');
    expect(journals).toHaveLength(2);
    expect(
      await prisma.inventoryMovement.count({
        where: { productId: source.product.id, toBucket: 'supplier_short' },
      })
    ).toBe(1);
    expect(
      await prisma.product.findUniqueOrThrow({
        where: { id: source.product.id },
      })
    ).toMatchObject({
      payment: 'Paid',
      paymentMethod: 'CARD',
      supplierFulfillmentStatus: 'CREDIT_ISSUED',
    });
  });

  it('rolls back a funded creation and reserved credit together, then safely retries', async () => {
    const source = await fixture();
    const credit = await issue(source.product.id);
    const template = await fixture(3000);
    const code = `FUNDED-${randomUUID().slice(0, 8)}`;
    productCodes.add(code);
    const payload = {
      ...mapToDTO(template.product),
      'Product Code': code,
      'Posting Date': '2026-10-26',
      'Supplier Reference': 'Supplier A',
      'Supplier Credit Id': credit.id,
      'Supplier Credit Amount': 1000,
      'Supplier Credit Request Id': randomUUID(),
    };
    failApplication = true;
    await expect(productService.createSingle(payload)).rejects.toThrow(
      'INJECTED_SUPPLIER_APPLICATION_FAILURE'
    );
    failApplication = false;
    expect(await prisma.product.count({ where: { productCode: code } })).toBe(
      0
    );
    expect(
      (
        await prisma.clothingSupplierCredit.findUniqueOrThrow({
          where: { id: credit.id },
        })
      ).availableAmount.toString()
    ).toBe('19511.37');
    expect(
      await prisma.clothingSupplierCreditApplication.count({
        where: { requestId: payload['Supplier Credit Request Id'] },
      })
    ).toBe(0);
    const created = await productService.createSingle(payload);
    const retry = await productService.createSingle(payload);
    expect(retry.id).toBe(created.id);
    expect(await prisma.product.count({ where: { productCode: code } })).toBe(
      1
    );
    expect(
      await prisma.clothingInventoryTransitBuildEntry.count({
        where: {
          idempotencyKey: {
            startsWith: `PRODUCT_TRANSIT_BUILD:${created.id}:`,
          },
        },
      })
    ).toBe(2);
    expect(
      (
        await prisma.clothingSupplierCredit.findUniqueOrThrow({
          where: { id: credit.id },
        })
      ).availableAmount.toString()
    ).toBe('18511.37');
  });

  it('allows only one competing application when both would overspend the credit', async () => {
    const source = await fixture();
    const credit = await issue(source.product.id);
    const first = await fixture(15000);
    const second = await fixture(15000);
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    readBarrier = { creditId: credit.id, reads: 0, ready, release };
    const results = await Promise.allSettled([
      apply(credit.id, first.product.id, 12000),
      apply(credit.id, second.product.id, 12000),
    ]);
    readBarrier = null;
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1);
    expect(
      await prisma.clothingSupplierCreditApplication.count({
        where: { creditId: credit.id },
      })
    ).toBe(1);
    expect(
      (
        await prisma.clothingSupplierCredit.findUniqueOrThrow({
          where: { id: credit.id },
        })
      ).availableAmount.toString()
    ).toBe('7511.37');
    const failedTarget = results[0].status === 'rejected' ? first : second;
    await expect(
      apply(credit.id, failedTarget.product.id, 12000)
    ).rejects.toThrow('Insufficient available');
    expect(
      await prisma.clothingInventoryTransitBuildEntry.count({
        where: {
          idempotencyKey: {
            startsWith: `PRODUCT_TRANSIT_BUILD:${failedTarget.product.id}:`,
          },
        },
      })
    ).toBe(0);
  });

  it('transfers delayed source funding once without another payment or journal', async () => {
    const source = await fixture(100);
    const destination = await prisma.shipment.create({
      data: {
        shipmentCode: `NEXT-${randomUUID().slice(0, 8)}`,
        shipmentStatus: 'In Transit',
      },
    });
    shipmentIds.add(destination.id);
    const build = await prisma.clothingInventoryTransitBuildEntry.create({
      data: {
        shipmentCode: source.shipmentCode,
        postingDate: new Date('2026-10-24'),
        amount: 100,
        debitAccount: 'Inventory in Transit',
        creditAccount: 'Credit Card Payable',
        idempotencyKey: `PRODUCT_TRANSIT_BUILD:${source.product.id}:GRAND_TOTAL`,
      },
    });
    const input = {
      productId: source.product.id,
      shipmentCode: destination.shipmentCode!,
      reason: 'Supplier retained goods for the next shipment',
      requestId: randomUUID(),
    };
    const transfer = await transferSupplierProduct(input);
    expect((await transferSupplierProduct(input)).id).toBe(transfer.id);
    expect(
      await prisma.clothingInventoryTransitBuildEntry.findUniqueOrThrow({
        where: { id: build.id },
      })
    ).toMatchObject({
      shipmentCode: destination.shipmentCode,
      amount: build.amount,
      postingDate: build.postingDate,
      creditAccount: build.creditAccount,
      idempotencyKey: build.idempotencyKey,
    });
    expect(
      await prisma.clothingProductShipmentTransfer.count({
        where: { productId: source.product.id },
      })
    ).toBe(1);
    expect(
      await prisma.clothingAccountingJournalLine.count({
        where: { sourceType: 'PRODUCT', sourceId: String(source.product.id) },
      })
    ).toBe(0);
  });

  it('blocks source nonfulfillment and partial funding reclass but reclasses the complete replacement once', async () => {
    const source = await fixture();
    const credit = await issue(source.product.id);
    const target = await fixture(3000);
    await apply(credit.id, target.product.id);
    const post = (shipmentId: number, keys: string[]) =>
      reclass(
        new NextRequest(
          `http://localhost/api/shipments/${shipmentId}/transit-reclass`,
          {
            method: 'POST',
            body: JSON.stringify({
              postingDate: '2026-10-26',
              selectedIdempotencyKeys: keys,
            }),
          }
        ),
        { params: { id: String(shipmentId) } }
      );
    expect(
      (
        await post(source.shipment.id, [
          `PRODUCT_TRANSIT_BUILD:${source.product.id}:GRAND_TOTAL`,
        ])
      ).status
    ).toBe(409);
    expect(
      (
        await post(target.shipment.id, [
          `PRODUCT_TRANSIT_BUILD:${target.product.id}:GRAND_TOTAL`,
        ])
      ).status
    ).toBe(409);
    const allKeys = [
      `PRODUCT_TRANSIT_BUILD:${target.product.id}:GRAND_TOTAL`,
      `PRODUCT_TRANSIT_BUILD:${target.product.id}:SUPPLIER_CREDIT`,
    ];
    expect((await post(target.shipment.id, allKeys)).status).toBe(200);
    expect((await post(target.shipment.id, allKeys)).status).toBe(200);
    const entries = await prisma.clothingInventoryReclassEntry.findMany({
      where: { productId: target.product.id },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].amount).toBe(3000);
  });
});
