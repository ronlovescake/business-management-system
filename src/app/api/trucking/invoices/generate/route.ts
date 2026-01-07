import { NextResponse, type NextRequest } from 'next/server';
import { TruckingInvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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

const toStatus = (value: unknown): TruckingInvoiceStatus => {
  if (typeof value === 'string') {
    const upper = value.trim().toUpperCase();
    if (upper in TruckingInvoiceStatus) {
      return upper as TruckingInvoiceStatus;
    }
  }
  return TruckingInvoiceStatus.DRAFT;
};

const toCustomerId = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('customerId is required');
  }
  return parsed;
};

const parseBody = (body: Record<string, unknown>) => {
  const customerId = toCustomerId(body.customerId);
  const cutoffStart = toDateOnly(String(body.cutoffStart ?? ''));
  const cutoffEnd = toDateOnly(String(body.cutoffEnd ?? ''));
  const invoiceDate = toDateOnly(String(body.invoiceDate ?? ''));
  const dueDate = toDateOnly(
    (body.dueDate as string | null | undefined) ?? null
  );

  if (!cutoffStart || !cutoffEnd) {
    throw new Error('cutoffStart and cutoffEnd are required');
  }
  if (!invoiceDate) {
    throw new Error('invoiceDate is required');
  }

  return {
    customerId,
    cutoffStart,
    cutoffEnd,
    invoiceDate,
    dueDate,
    status: toStatus(body.status),
  } as const;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseBody(body);

    const trips = await prisma.truckingTrip.findMany({
      where: {
        customerId: { equals: parsed.customerId },
        status: 'completed',
        invoiceId: null,
        date: {
          gte: parsed.cutoffStart.toISOString().slice(0, 10),
          lte: parsed.cutoffEnd.toISOString().slice(0, 10),
        },
      },
      select: { id: true, grossRevenue: true },
    });

    if (trips.length === 0) {
      return NextResponse.json(
        {
          error: 'No completed, unbilled trips found for cutoff',
          customerId: parsed.customerId,
          cutoffStart: parsed.cutoffStart,
          cutoffEnd: parsed.cutoffEnd,
        },
        { status: 404 }
      );
    }

    const totalAmount = trips.reduce(
      (sum, trip) => sum + Number(trip.grossRevenue ?? 0),
      0
    );

    const invoice = await prisma.truckingInvoice.create({
      data: {
        customer: { connect: { id: parsed.customerId } },
        cutoffStart: parsed.cutoffStart,
        cutoffEnd: parsed.cutoffEnd,
        invoiceDate: parsed.invoiceDate,
        dueDate: parsed.dueDate,
        status: parsed.status,
        totalAmount,
      },
    });

    await prisma.truckingTrip.updateMany({
      where: { id: { in: trips.map((t) => t.id) } },
      data: { invoiceId: invoice.id },
    });

    const refreshed = await prisma.truckingInvoice.findUnique({
      where: { id: invoice.id },
      include: { allocations: true },
    });

    return NextResponse.json({
      invoice: refreshed ?? invoice,
      tripCount: trips.length,
      totalAmount,
    });
  } catch (error) {
    logger.error('Failed to generate trucking invoice', { error });
    return NextResponse.json(
      {
        error: 'Failed to generate invoice',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
