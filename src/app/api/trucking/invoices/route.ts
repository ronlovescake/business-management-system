import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { TruckingInvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import { ApiResponseUtil } from '@/core/api/response';

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
  const sanitized = sanitizers.number(value, { decimals: 0 });
  return sanitized ?? 0;
};

const toStatus = (value: unknown): TruckingInvoiceStatus => {
  if (typeof value === 'string') {
    const upper = value.trim().toUpperCase();
    if (upper in TruckingInvoiceStatus) {
      return upper as TruckingInvoiceStatus;
    }
  }
  return TruckingInvoiceStatus.DRAFT;
};

const toTrimmed = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const buildInvoiceData = (body: Record<string, unknown>) => {
  const customerId = toCustomerId(body.customerId);
  const cutoffStart = toDateOnly(String(body.cutoffStart ?? ''));
  const cutoffEnd = toDateOnly(String(body.cutoffEnd ?? ''));
  const invoiceDate = toDateOnly(String(body.invoiceDate ?? ''));

  if (!customerId || Number.isNaN(customerId)) {
    throw new Error('customerId is required');
  }
  if (!cutoffStart || !cutoffEnd) {
    throw new Error('cutoffStart and cutoffEnd are required');
  }
  if (!invoiceDate) {
    throw new Error('invoiceDate is required');
  }

  const dueDate = toDateOnly(
    (body.dueDate as string | null | undefined) ?? null
  );

  return {
    customer: { connect: { id: customerId } },
    cutoffStart,
    cutoffEnd,
    invoiceDate,
    dueDate,
    status: toStatus(body.status),
    totalAmount: toAmount(body.totalAmount),
  } satisfies Prisma.TruckingInvoiceCreateInput;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerIdParam = searchParams.get('customerId');
    const statusParam = searchParams.get('status');

    const customerId = customerIdParam ? Number(customerIdParam) : undefined;
    const status = statusParam ? toStatus(statusParam) : undefined;

    const where: Prisma.TruckingInvoiceWhereInput = {
      ...(Number.isFinite(customerId)
        ? { customerId: customerId as number }
        : {}),
      ...(status ? { status } : {}),
    };

    const invoices = await prisma.truckingInvoice.findMany({
      where,
      include: { allocations: true },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(invoices);
  } catch (error) {
    logger.error('Failed to fetch trucking invoices', { error });
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
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
          const data = buildInvoiceData(item as Record<string, unknown>);
          const invoice = await prisma.truckingInvoice.create({ data });
          created.push(invoice);
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

      return NextResponse.json({ count: created.length, invoices: created });
    }

    // Single create
    const data = buildInvoiceData(body as Record<string, unknown>);
    const invoice = await prisma.truckingInvoice.create({ data });

    return NextResponse.json(invoice);
  } catch (error) {
    logger.error('Failed to create trucking invoice', { error });
    return NextResponse.json(
      {
        error: 'Failed to create invoice',
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

    const updateData: Prisma.TruckingInvoiceUpdateInput = {};
    const toOptional = (key: string) => {
      if (Object.prototype.hasOwnProperty.call(rest, key)) {
        const value = rest[key];
        if (key === 'totalAmount') {
          updateData.totalAmount = toAmount(value);
          return;
        }
        if (key === 'customerId') {
          const parsed = toCustomerId(value);
          if (!Number.isFinite(parsed)) {
            throw new Error('customerId is invalid');
          }
          updateData.customer = { connect: { id: parsed } };
          return;
        }
        if (key === 'status') {
          updateData.status = toStatus(value);
          return;
        }
        if (
          key === 'dueDate' ||
          key === 'invoiceDate' ||
          key === 'cutoffStart' ||
          key === 'cutoffEnd'
        ) {
          const dateValue = toDateOnly(value as string);
          if (!dateValue) {
            throw new Error(`${key} is invalid`);
          }
          (updateData as Record<string, unknown>)[key] = dateValue;
          return;
        }
        (updateData as Record<string, unknown>)[key] =
          toTrimmed(value) ?? value;
      }
    };

    toOptional('customerId');
    toOptional('cutoffStart');
    toOptional('cutoffEnd');
    toOptional('invoiceDate');
    toOptional('dueDate');
    toOptional('status');
    toOptional('totalAmount');

    const invoice = await prisma.truckingInvoice.update({
      where: { id: String(id) },
      data: updateData,
      include: { allocations: true },
    });

    // Optional allocation replace on PATCH
    if (Array.isArray(allocations)) {
      await prisma.truckingPaymentAllocation.deleteMany({
        where: { invoiceId: invoice.id },
      });

      const validAllocations = allocations
        .map((alloc) => alloc as Record<string, unknown>)
        .map((alloc) => ({
          paymentId: toTrimmed(alloc.paymentId),
          amount: toAmount(alloc.amount),
        }))
        .filter((alloc) => alloc.paymentId && alloc.amount > 0) as Array<{
        paymentId: string;
        amount: number;
      }>;

      for (const alloc of validAllocations) {
        await prisma.truckingPaymentAllocation.create({
          data: {
            paymentId: alloc.paymentId,
            invoiceId: invoice.id,
            amount: alloc.amount,
          },
        });
      }
    }

    const refreshed = await prisma.truckingInvoice.findUnique({
      where: { id: invoice.id },
      include: { allocations: true },
    });

    return NextResponse.json(refreshed ?? invoice);
  } catch (error) {
    logger.error('Failed to update trucking invoice', { error });
    return NextResponse.json(
      {
        error: 'Failed to update invoice',
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
      where: { invoiceId: id },
    });
    await prisma.truckingInvoice.delete({ where: { id } });

    return ApiResponseUtil.ok();
  } catch (error) {
    logger.error('Failed to delete trucking invoice', { error });
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    );
  }
}
