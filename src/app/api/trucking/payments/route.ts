import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { TruckingPaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';

const toDateOnly = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const toAmount = (value: unknown): number => {
  const sanitized = sanitizers.number(value, { decimals: 2 });
  return sanitized ?? 0;
};

const toCustomerId = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('customerId is required');
  }
  return parsed;
};

const toMethod = (value: unknown): TruckingPaymentMethod => {
  if (typeof value === 'string') {
    const upper = value.trim().toUpperCase();
    if (upper in TruckingPaymentMethod) {
      return upper as TruckingPaymentMethod;
    }
  }
  return TruckingPaymentMethod.OTHER;
};

const toTrimmed = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const buildPaymentData = (body: Record<string, unknown>) => {
  const customerId = toCustomerId(body.customerId);
  const paymentDate = toDateOnly(String(body.paymentDate ?? ''));
  const method = toMethod(body.method);

  if (!customerId) {
    throw new Error('customerId is required');
  }
  if (!paymentDate) {
    throw new Error('paymentDate is required');
  }
  if (!method) {
    throw new Error('method is required');
  }

  return {
    customer: { connect: { id: customerId } },
    paymentDate,
    amount: toAmount(body.amount),
    method,
    referenceNo: toTrimmed(body.referenceNo),
    notes: toTrimmed(body.notes),
  } satisfies Prisma.TruckingPaymentCreateInput;
};

const replaceAllocations = async (
  paymentId: string,
  allocations: Array<{ invoiceId: string; amount: number }>
) => {
  // Validate totals against payment amount and invoice balances
  const payment = await prisma.truckingPayment.findUnique({
    where: { id: paymentId },
    include: { allocations: true },
  });

  const paymentAmount = Number(payment?.amount ?? 0);
  const allocationTotal = allocations.reduce((sum, a) => sum + a.amount, 0);

  if (allocationTotal > paymentAmount + 0.0001) {
    throw new Error('Allocations exceed payment amount');
  }

  // Compute current allocations per invoice (excluding this payment)
  const invoiceIds = allocations.map((a) => a.invoiceId);
  const existing = await prisma.truckingPaymentAllocation.groupBy({
    by: ['invoiceId'],
    where: {
      invoiceId: { in: invoiceIds },
      paymentId: { not: paymentId },
    },
    _sum: { amount: true },
  });

  const invoiceTotals = await prisma.truckingInvoice.findMany({
    where: { id: { in: invoiceIds } },
    select: { id: true, totalAmount: true },
  });

  const totalMap = new Map(
    invoiceTotals.map((i) => [i.id, Number(i.totalAmount ?? 0)])
  );
  const existingMap = new Map(
    existing.map((e) => [e.invoiceId, Number(e._sum.amount ?? 0)])
  );

  for (const alloc of allocations) {
    const invoiceTotal = totalMap.get(alloc.invoiceId) ?? 0;
    const existingAlloc = existingMap.get(alloc.invoiceId) ?? 0;
    if (alloc.amount + existingAlloc > invoiceTotal + 0.0001) {
      throw new Error(
        `Allocation for invoice ${alloc.invoiceId} exceeds remaining balance`
      );
    }
  }

  await prisma.truckingPaymentAllocation.deleteMany({ where: { paymentId } });

  const valid = allocations.filter(
    (alloc) => alloc.invoiceId && alloc.amount > 0
  );

  if (!valid.length) {
    return;
  }

  await prisma.truckingPaymentAllocation.createMany({
    data: valid.map((alloc) => ({
      paymentId,
      invoiceId: alloc.invoiceId,
      amount: alloc.amount,
    })),
  });
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerIdParam = searchParams.get('customerId');
    const customerId = customerIdParam ? Number(customerIdParam) : undefined;

    const payments = await prisma.truckingPayment.findMany({
      where: Number.isFinite(customerId)
        ? { customerId: customerId as number }
        : {},
      include: { allocations: true },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(payments);
  } catch (error) {
    logger.error('Failed to fetch trucking payments', { error });
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Bulk create
    if (Array.isArray(body)) {
      const created: unknown[] = [];

      for (const item of body) {
        try {
          const data = buildPaymentData(item as Record<string, unknown>);
          const allocations = (item as Record<string, unknown>).allocations as
            | Array<Record<string, unknown>>
            | undefined;

          const payment = await prisma.truckingPayment.create({ data });

          if (Array.isArray(allocations)) {
            const normalized = allocations
              .map((alloc) => ({
                invoiceId: toTrimmed(alloc.invoiceId),
                amount: toAmount(alloc.amount),
              }))
              .filter((alloc) => alloc.invoiceId && alloc.amount > 0) as Array<{
              invoiceId: string;
              amount: number;
            }>;

            await replaceAllocations(payment.id, normalized);
          }

          created.push(payment);
        } catch (error) {
          return NextResponse.json(
            {
              error:
                error instanceof Error ? error.message : 'Validation failed',
            },
            { status: 400 }
          );
        }
      }

      return NextResponse.json({ count: created.length, payments: created });
    }

    // Single create
    const data = buildPaymentData(body as Record<string, unknown>);
    const allocations = (body as Record<string, unknown>).allocations as
      | Array<Record<string, unknown>>
      | undefined;

    const payment = await prisma.truckingPayment.create({ data });

    if (Array.isArray(allocations)) {
      const normalized = allocations
        .map((alloc) => ({
          invoiceId: toTrimmed(alloc.invoiceId),
          amount: toAmount(alloc.amount),
        }))
        .filter((alloc) => alloc.invoiceId && alloc.amount > 0) as Array<{
        invoiceId: string;
        amount: number;
      }>;

      await replaceAllocations(payment.id, normalized);
    }

    const refreshed = await prisma.truckingPayment.findUnique({
      where: { id: payment.id },
      include: { allocations: true },
    });

    return NextResponse.json(refreshed ?? payment);
  } catch (error) {
    logger.error('Failed to create trucking payment', { error });
    return NextResponse.json(
      {
        error: 'Failed to create payment',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, allocations, ...rest } = body as Record<string, unknown>;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updateData: Prisma.TruckingPaymentUpdateInput = {};

    const toOptional = (key: string) => {
      if (Object.prototype.hasOwnProperty.call(rest, key)) {
        const value = rest[key];
        if (key === 'paymentDate') {
          const dateValue = toDateOnly(value as string);
          if (!dateValue) {
            throw new Error('paymentDate is invalid');
          }
          updateData.paymentDate = dateValue;
          return;
        }
        if (key === 'amount') {
          updateData.amount = toAmount(value);
          return;
        }
        if (key === 'customerId') {
          const parsed = toCustomerId(value);
          updateData.customer = { connect: { id: parsed } };
          return;
        }
        if (key === 'method') {
          updateData.method = toMethod(value);
          return;
        }
        (updateData as Record<string, unknown>)[key] =
          toTrimmed(value) ?? value;
      }
    };

    toOptional('customerId');
    toOptional('paymentDate');
    toOptional('amount');
    toOptional('method');
    toOptional('referenceNo');
    toOptional('notes');

    const payment = await prisma.truckingPayment.update({
      where: { id: String(id) },
      data: updateData,
    });

    if (Array.isArray(allocations)) {
      const normalized = allocations
        .map((alloc) => ({
          invoiceId: toTrimmed(alloc.invoiceId),
          amount: toAmount(alloc.amount),
        }))
        .filter((alloc) => alloc.invoiceId && alloc.amount > 0) as Array<{
        invoiceId: string;
        amount: number;
      }>;

      await replaceAllocations(payment.id, normalized);
    }

    const refreshed = await prisma.truckingPayment.findUnique({
      where: { id: payment.id },
      include: { allocations: true },
    });

    return NextResponse.json(refreshed ?? payment);
  } catch (error) {
    logger.error('Failed to update trucking payment', { error });
    return NextResponse.json(
      {
        error: 'Failed to update payment',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await prisma.truckingPaymentAllocation.deleteMany({
      where: { paymentId: id },
    });
    await prisma.truckingPayment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete trucking payment', { error });
    return NextResponse.json(
      { error: 'Failed to delete payment' },
      { status: 500 }
    );
  }
}
