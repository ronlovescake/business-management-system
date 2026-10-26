import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { POST as replaceInvoices } from '@/app/api/invoices/route';
import { POST as createRefund } from '@/app/api/customers/[id]/refunds/route';
import { DELETE as deleteRefund } from '@/app/api/customers/[id]/refunds/[refundId]/route';
import { GET as getConversationMessages } from '@/app/api/conversations/[id]/messages/route';
import { clothingRecurringPaymentService } from '@/modules/clothing/ledger/recurringPayments/api/service';
import { getTestApiUrl } from '@/core/testing/test-helpers';
import { getServerSession } from 'next-auth/next';
import { getServerSession as getMessageSession } from 'next-auth';
import type * as NextAuth from 'next-auth';
import { createClothingAccountingFixture } from './clothing-accounting-fixture';

const returnFixtures: Array<{
  productId: number;
  shipmentId: number;
  productCode: string;
  customerId?: number;
  transactionId?: number;
}> = [];

afterEach(async () => {
  if (!returnFixtures.length) {
    return;
  }
  const cleanup = new PrismaClient();
  try {
    for (const fixture of returnFixtures) {
      await cleanup.inventoryMovement.deleteMany({
        where: { productCode: fixture.productCode },
      });
      if (fixture.transactionId !== undefined) {
        await cleanup.transactionRefund.deleteMany({
          where: { transactionId: fixture.transactionId },
        });
        await cleanup.transactionStatusChange.deleteMany({
          where: { transactionId: fixture.transactionId },
        });
        await cleanup.transaction.deleteMany({
          where: { id: fixture.transactionId },
        });
      }
      await cleanup.productCodeAlias.deleteMany({
        where: { productId: fixture.productId },
      });
      await cleanup.product.deleteMany({ where: { id: fixture.productId } });
      await cleanup.shipment.deleteMany({ where: { id: fixture.shipmentId } });
      if (fixture.customerId !== undefined) {
        await cleanup.generalMerchandiseCustomer.deleteMany({
          where: { clothingCustomerId: fixture.customerId },
        });
        await cleanup.customer.deleteMany({
          where: { id: fixture.customerId },
        });
      }
    }
  } finally {
    returnFixtures.length = 0;
    await cleanup.$disconnect();
  }
});

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));
vi.mock('next-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof NextAuth>()),
  getServerSession: vi.fn(),
}));
beforeEach(() => {
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
  vi.mocked(getMessageSession).mockResolvedValue(session);
});

let failInvoiceReplacement = false;
let failRecurringCredit: string | null = null;
let recurringReadBarrier: {
  draftId: string;
  reads: number;
  ready: Promise<void>;
  release: () => void;
} | null = null;
prisma.$use(async (parameters, next) => {
  if (
    failInvoiceReplacement &&
    parameters.model === 'Invoice' &&
    parameters.action === 'createMany'
  ) {
    throw new Error('INJECTED_INVOICE_INSERT_FAILURE');
  }
  if (
    failRecurringCredit &&
    parameters.model === 'ClothingAccountingJournalLine' &&
    parameters.action === 'create' &&
    parameters.args.data.sourceId === failRecurringCredit &&
    parameters.args.data.sourceLineKey === 'credit'
  ) {
    throw new Error('INJECTED_RECURRING_CREDIT_FAILURE');
  }
  const result = await next(parameters);
  const barrier = recurringReadBarrier;
  if (
    barrier &&
    parameters.model === 'ClothingRecurringPaymentDraft' &&
    ['findUnique', 'findFirst'].includes(parameters.action) &&
    parameters.args.where.id === barrier.draftId
  ) {
    barrier.reads++;
    if (barrier.reads === 2) {
      barrier.release();
    }
    await barrier.ready;
  }
  return result;
});

async function createRecurringFixture() {
  const template = await prisma.clothingRecurringPaymentTemplate.create({
    data: {
      name: `Audit rent ${randomUUID()}`,
      kind: 'EXPENSE',
      amount: 100,
      dayOfMonth: 1,
      nextDueDate: new Date('2026-10-01T00:00:00Z'),
      debitAccount: 'Rent Expense',
      creditAccount: 'Cash',
      isActive: false,
    },
  });
  const draft = await prisma.clothingRecurringPaymentDraft.create({
    data: {
      templateId: template.id,
      dueDate: template.nextDueDate,
      amount: template.amount,
      debitAccount: template.debitAccount,
      creditAccount: template.creditAccount,
      ref: `AUDIT:${template.id}`,
    },
  });
  return { template, draft };
}

describe('Integration • Follow-up clothing persistence', () => {
  it('paginates equal-timestamp messages without omissions and rejects a foreign cursor', async () => {
    const userId = 'integration-admin';
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${randomUUID()}@example.test`,
        name: 'Audit operator',
        password: 'test-fixture-only',
        role: 'ADMIN',
      },
    });
    const conversation = await prisma.conversation.create({
      data: {
        participants: { create: { userId } },
      },
    });
    const prefix = randomUUID();
    const ids = Array.from({ length: 5 }, (_, index) => `${prefix}-${index}`);
    await prisma.message.createMany({
      data: ids.map((id) => ({
        id,
        conversationId: conversation.id,
        senderId: userId,
        body: id,
        createdAt: new Date('2026-10-24T08:00:00Z'),
      })),
    });
    const seen: string[] = [];
    let before = '';
    for (let page = 0; page < 3; page++) {
      const response = await getConversationMessages(
        new NextRequest(
          getTestApiUrl(
            `/api/conversations/${conversation.id}/messages?limit=2${before ? `&before=${before}` : ''}`
          )
        ),
        { params: { id: conversation.id } }
      );
      expect(response.status).toBe(200);
      const messages = (await response.json()) as Array<{ id: string }>;
      expect(messages.length).toBeGreaterThan(0);
      seen.unshift(...messages.map((message) => message.id));
      before = messages[0].id;
    }
    expect(seen).toEqual(ids);
    const foreignConversation = await prisma.conversation.create({ data: {} });
    const foreign = await prisma.message.create({
      data: {
        conversationId: foreignConversation.id,
        senderId: userId,
        body: 'Foreign cursor',
      },
    });
    expect(
      (
        await getConversationMessages(
          new NextRequest(
            getTestApiUrl(
              `/api/conversations/${conversation.id}/messages?before=${foreign.id}`
            )
          ),
          { params: { id: conversation.id } }
        )
      ).status
    ).toBe(404);
  });

  it.each(['sellable', 'damaged_hold', 'scrap'] as const)(
    'preserves a completed physical %s return and the original sale when deletion is attempted',
    async (restockBucket) => {
      const fixture = await createClothingAccountingFixture();
      const tracked: (typeof returnFixtures)[number] = {
        productId: fixture.product.id,
        shipmentId: fixture.shipment.id,
        productCode: fixture.shipmentCode,
      };
      returnFixtures.push(tracked);
      const customer = await prisma.customer.create({
        data: {
          customerName: `Return ${randomUUID()}`,
          date: '2026-10-24',
          phoneNumber: '09170000000',
          address: 'Audit fixture',
          facebook: '',
          emailAddress: '',
          businessName: '',
          taxNumber: '',
          businessAddress: '',
          businessContactNumber: '',
          customerStatus: 'active',
        },
      });
      tracked.customerId = customer.id;
      const sale = await prisma.transaction.create({
        data: {
          customerId: customer.id,
          customers: customer.customerName,
          productCode: fixture.shipmentCode,
          orderDate: '2026-10-24',
          quantity: 4,
          unitPrice: 25,
          adjustment: 100,
          lineTotal: 0,
          orderStatus: 'Shipped',
          shipmentCode: fixture.shipmentCode,
        },
      });
      tracked.transactionId = sale.id;
      const movement = await prisma.inventoryMovement.create({
        data: {
          productId: fixture.product.id,
          productCode: fixture.shipmentCode,
          quantity: 4,
          unitCost: 10,
          fromBucket: 'sellable',
          toBucket: 'sold',
          movementSource: 'transaction',
          movementType: 'sale',
          sourceTransactionId: sale.id,
        },
      });
      const response = await createRefund(
        new NextRequest(
          getTestApiUrl(`/api/customers/${customer.id}/refunds`),
          {
            method: 'POST',
            body: JSON.stringify({
              transactionId: sale.id,
              refundDate: '2026-10-24',
              amount: 50,
              returnedQuantity: 2,
              restockBucket,
            }),
          }
        ),
        { params: { id: String(customer.id) } }
      );
      expect(response.status).toBe(201);
      const { data: refund } = (await response.json()) as {
        data: { id: number };
      };
      const where = { notes: `auto-return refund ${refund.id}` };
      expect(await prisma.inventoryMovement.findMany({ where })).toEqual([
        expect.objectContaining({
          quantity: 2,
          unitCost: 10,
          fromBucket: 'sold',
          toBucket: restockBucket,
        }),
      ]);
      const deleted = await deleteRefund(
        new NextRequest(
          getTestApiUrl(`/api/customers/${customer.id}/refunds/${refund.id}`),
          { method: 'DELETE' }
        ),
        {
          params: { id: String(customer.id), refundId: String(refund.id) },
        }
      );
      expect(deleted.status).toBe(409);
      expect(
        await prisma.transactionRefund.findFirst({ where: { id: refund.id } })
      ).toMatchObject({ id: refund.id, deletedAt: null, amount: 50 });
      expect(await prisma.inventoryMovement.findMany({ where })).toEqual([
        expect.objectContaining({
          quantity: 2,
          unitCost: 10,
          fromBucket: 'sold',
          toBucket: restockBucket,
          deletedAt: null,
        }),
      ]);
      expect(
        await prisma.inventoryMovement.findFirst({ where: { id: movement.id } })
      ).toEqual(movement);
      expect(
        await prisma.transaction.findFirst({ where: { id: sale.id } })
      ).toEqual(sale);
    }
  );

  it('rolls back invoice replacement when insertion fails after retiring the old list', async () => {
    const previous = await prisma.invoice.create({
      data: { customerName: `Audit ${randomUUID()}` },
    });
    failInvoiceReplacement = true;
    try {
      const response = await replaceInvoices(
        new NextRequest(getTestApiUrl('/api/invoices'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoices: [{ customerName: 'Replacement' }] }),
        })
      );
      expect(response.status).toBe(500);
    } finally {
      failInvoiceReplacement = false;
    }
    expect(
      await prisma.invoice.findUnique({ where: { id: previous.id } })
    ).toMatchObject({
      id: previous.id,
      deletedAt: null,
    });
  });

  it('skips a preexisting recurring draft and commits the next schedule date', async () => {
    const { template } = await createRecurringFixture();
    await prisma.clothingRecurringPaymentTemplate.update({
      where: { id: template.id },
      data: { isActive: true },
    });
    expect(
      await clothingRecurringPaymentService.generateDueDrafts({
        upToDate: template.nextDueDate,
      })
    ).toMatchObject({
      created: 0,
      skipped: 1,
    });
    expect(
      await prisma.clothingRecurringPaymentDraft.count({
        where: { templateId: template.id },
      })
    ).toBe(1);
    expect(
      await prisma.clothingRecurringPaymentTemplate.findUnique({
        where: { id: template.id },
      })
    ).toMatchObject({
      nextDueDate: new Date('2026-11-01T00:00:00Z'),
    });
  });

  it('rolls back draft approval and the debit when the recurring credit write fails', async () => {
    const { draft } = await createRecurringFixture();
    failRecurringCredit = draft.id;
    try {
      await expect(
        clothingRecurringPaymentService.approveDraft({ draftId: draft.id })
      ).rejects.toThrow('INJECTED_RECURRING_CREDIT_FAILURE');
    } finally {
      failRecurringCredit = null;
    }
    expect(
      await prisma.clothingRecurringPaymentDraft.findUnique({
        where: { id: draft.id },
      })
    ).toMatchObject({ status: 'DRAFT', approvedAt: null });
    expect(
      await prisma.clothingAccountingJournalLine.count({
        where: { sourceType: 'RECURRING_PAYMENT', sourceId: draft.id },
      })
    ).toBe(0);
  });

  it('allows exactly one of simultaneous approval and skip after both read DRAFT', async () => {
    const { draft } = await createRecurringFixture();
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    recurringReadBarrier = { draftId: draft.id, reads: 0, ready, release };
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled([
        clothingRecurringPaymentService.approveDraft({ draftId: draft.id }),
        clothingRecurringPaymentService.skipDraft({ draftId: draft.id }),
      ]);
    } finally {
      recurringReadBarrier = null;
      release();
    }
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    const saved = await prisma.clothingRecurringPaymentDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    const lines = await prisma.clothingAccountingJournalLine.findMany({
      where: { sourceType: 'RECURRING_PAYMENT', sourceId: draft.id },
    });
    expect(lines).toHaveLength(saved.status === 'APPROVED' ? 2 : 0);
    expect(
      lines.reduce((total, line) => total + line.debit - line.credit, 0)
    ).toBe(0);
  });
});
