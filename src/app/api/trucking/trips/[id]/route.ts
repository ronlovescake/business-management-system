import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const coerceNumber = (min = 0) =>
  z.preprocess((val) => {
    if (typeof val === 'string' && val.trim() === '') {
      return 0;
    }
    const num = Number(val ?? 0);
    return Number.isFinite(num) ? num : NaN;
  }, z.number().min(min));

const TripUpdateSchema = z.object({
  date: z.string().min(1),
  truckId: z.string().min(1),
  destination: z.string().trim().min(1),
  driver: z.string().min(1),
  helper: z.string().trim().optional().nullable(),
  grossRevenue: coerceNumber(0),
  fuelLiters: coerceNumber(0),
  fuelCost: coerceNumber(0),
  maintenance: coerceNumber(0),
  tollFees: coerceNumber(0),
  miscExpenses: coerceNumber(0),
  remarks: z.string().trim().optional().nullable(),
});

type TripUpdateInput = z.infer<typeof TripUpdateSchema>;

const mapTrip = (trip: Record<string, unknown>) => ({
  id: String(trip.id),
  date: String(trip.date ?? ''),
  truckId: String(trip.truckId ?? ''),
  destination: String(trip.destination ?? ''),
  driver: String(trip.driver ?? ''),
  helper: trip.helper ? String(trip.helper) : '',
  grossRevenue: Number(trip.grossRevenue ?? 0),
  fuelLiters: Number(trip.fuelLiters ?? 0),
  fuelCost: Number(trip.fuelCost ?? 0),
  maintenance: Number(trip.maintenance ?? 0),
  tollFees: Number(trip.tollFees ?? 0),
  miscExpenses: Number(trip.miscExpenses ?? 0),
  totalExpenses: Number(trip.totalExpenses ?? 0),
  remarks: trip.remarks ? String(trip.remarks) : '',
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await request.json();
    const data = TripUpdateSchema.parse(payload) as TripUpdateInput;

    const existing = await prisma.truckingTrip.findFirst({
      where: { id: params.id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const totalExpenses =
      data.fuelCost + data.maintenance + data.tollFees + data.miscExpenses;

    let updated;
    try {
      updated = await prisma.truckingTrip.update({
        where: { id: params.id },
        data: {
          ...data,
          helper: data.helper ?? null,
          remarks: data.remarks ?? null,
          totalExpenses,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientValidationError) {
        // Fallback raw SQL to avoid client drift issues
        await prisma.$executeRawUnsafe(
          'UPDATE "trucking_trips" SET "updatedAt" = NOW(), "date" = $1, "truckId" = $2, destination = $3, driver = $4, helper = $5, "grossRevenue" = $6, "fuelLiters" = $7, "fuelCost" = $8, maintenance = $9, "tollFees" = $10, "miscExpenses" = $11, "totalExpenses" = $12, remarks = $13 WHERE id = $14 AND "deletedAt" IS NULL',
          data.date,
          data.truckId,
          data.destination,
          data.driver,
          data.helper ?? null,
          data.grossRevenue,
          data.fuelLiters,
          data.fuelCost,
          data.maintenance,
          data.tollFees,
          data.miscExpenses,
          totalExpenses,
          data.remarks ?? null,
          params.id
        );

        const rows = await prisma.$queryRawUnsafe<
          Array<Record<string, unknown>>
        >(
          'SELECT id, "date", "truckId", destination, driver, helper, "grossRevenue", "fuelLiters", "fuelCost", maintenance, "tollFees", "miscExpenses", "totalExpenses", remarks FROM "trucking_trips" WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1',
          params.id
        );
        updated = rows?.[0];
      } else {
        throw err;
      }
    }

    return NextResponse.json(mapTrip(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.flatten() },
        { status: 400 }
      );
    }

    logger.error('Failed to update trucking trip', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tripId: params.id,
    });

    return NextResponse.json(
      { error: 'Failed to update trucking trip' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.truckingTrip.findFirst({
      where: { id: params.id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const deleted = await prisma.truckingTrip.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(mapTrip(deleted));
  } catch (error) {
    logger.error('Failed to delete trucking trip', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tripId: params.id,
    });

    return NextResponse.json(
      { error: 'Failed to delete trucking trip' },
      { status: 500 }
    );
  }
}
