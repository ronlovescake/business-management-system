import { randomUUID } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const TripCreateSchema = z.object({
  date: z.string().min(1),
  truckId: z.string().min(1),
  driver: z.string().min(1),
  helper: z.string().trim().optional().nullable(),
  grossRevenue: z.number().nonnegative(),
  fuelCost: z.number().nonnegative(),
  maintenance: z.number().nonnegative(),
  tollFees: z.number().nonnegative(),
  miscExpenses: z.number().nonnegative(),
  remarks: z.string().trim().optional().nullable(),
});

type TripCreateInput = z.infer<typeof TripCreateSchema>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toStringValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

const mapTrip = (trip: unknown) => {
  const record = isRecord(trip) ? trip : {};

  return {
    id: toStringValue(record.id),
    date: toStringValue(record.date),
    truckId: toStringValue(record.truckId),
    driver: toStringValue(record.driver),
    helper: toStringValue(record.helper) || '',
    grossRevenue: toNumber(record.grossRevenue),
    fuelCost: toNumber(record.fuelCost),
    maintenance: toNumber(record.maintenance),
    tollFees: toNumber(record.tollFees),
    miscExpenses: toNumber(record.miscExpenses),
    totalExpenses: toNumber(record.totalExpenses),
    remarks: toStringValue(record.remarks) || '',
  };
};

type TripFindManyArgs = {
  where: { deletedAt: null };
  orderBy: Array<{ date: 'asc' | 'desc' } | { createdAt: 'asc' | 'desc' }>;
};

type TripCreateArgs = {
  data: Record<string, unknown>;
};

type TripDelegate = {
  findMany?: (args: TripFindManyArgs) => Promise<unknown[]>;
  create?: (args: TripCreateArgs) => Promise<unknown>;
};

const tripDelegate = (): TripDelegate | null => {
  const client = prisma as unknown as Record<string, unknown>;
  const delegate = client.truckingTrip;
  if (!isRecord(delegate)) {
    return null;
  }
  return delegate as TripDelegate;
};

export async function GET() {
  try {
    const delegate = tripDelegate();

    if (delegate?.findMany) {
      const trips = await delegate.findMany({
        where: { deletedAt: null },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      });

      return NextResponse.json(trips.map(mapTrip));
    }

    // Fallback: raw SQL in case the delegate is unavailable (drifted client)
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'SELECT id, "date", "truckId", driver, helper, "grossRevenue", "fuelCost", "maintenance", "tollFees", "miscExpenses", "totalExpenses", remarks FROM "trucking_trips" WHERE "deletedAt" IS NULL ORDER BY "date" DESC, "createdAt" DESC'
    );

    return NextResponse.json(rows.map(mapTrip));
  } catch (error) {
    logger.error('Failed to fetch trucking trips', { error });
    return NextResponse.json(
      { error: 'Failed to fetch trucking trips' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const data = TripCreateSchema.parse(payload) as TripCreateInput;

    const totalExpenses =
      data.fuelCost + data.maintenance + data.tollFees + data.miscExpenses;

    const id = randomUUID();

    const delegate = tripDelegate();

    if (delegate?.create) {
      const created = await delegate.create({
        data: {
          id,
          ...data,
          totalExpenses,
        },
      });

      return NextResponse.json(mapTrip(created), { status: 201 });
    }

    // Fallback insert via raw SQL
    await prisma.$executeRawUnsafe(
      'INSERT INTO "trucking_trips" (id, "createdAt", "updatedAt", "date", "truckId", driver, helper, "grossRevenue", "fuelCost", "maintenance", "tollFees", "miscExpenses", "totalExpenses", remarks) VALUES ($1, NOW(), NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      id,
      data.date,
      data.truckId,
      data.driver,
      data.helper ?? null,
      data.grossRevenue,
      data.fuelCost,
      data.maintenance,
      data.tollFees,
      data.miscExpenses,
      totalExpenses,
      data.remarks ?? null
    );

    return NextResponse.json(mapTrip({ id, ...data, totalExpenses }), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.flatten() },
        { status: 400 }
      );
    }

    logger.error('Failed to create trucking trip', { error });
    return NextResponse.json(
      { error: 'Failed to create trucking trip' },
      { status: 500 }
    );
  }
}
