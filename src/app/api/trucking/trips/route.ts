import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const TripCreateSchema = z.object({
  date: z.string().min(1),
  truckId: z.string().min(1),
  destination: z.string().trim().min(1),
  driver: z.string().min(1),
  helper: z.string().trim().optional().nullable(),
  grossRevenue: z.number().nonnegative(),
  fuelLiters: z.number().nonnegative(),
  fuelCost: z.number().nonnegative(),
  maintenance: z.number().nonnegative(),
  tollFees: z.number().nonnegative(),
  miscExpenses: z.number().nonnegative(),
  remarks: z.string().trim().optional().nullable(),
  customerId: z.number().int().positive().optional().nullable(),
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
    destination: toStringValue(record.destination),
    driver: toStringValue(record.driver),
    helper: toStringValue(record.helper) || '',
    grossRevenue: toNumber(record.grossRevenue),
    fuelLiters: toNumber(record.fuelLiters),
    fuelCost: toNumber(record.fuelCost),
    maintenance: toNumber(record.maintenance),
    tollFees: toNumber(record.tollFees),
    miscExpenses: toNumber(record.miscExpenses),
    totalExpenses: toNumber(record.totalExpenses),
    remarks: toStringValue(record.remarks) || '',
    status: toStringValue(record.status) || 'draft',
    completedAt: record.completedAt ? toStringValue(record.completedAt) : null,
    customerId: record.customerId ? Number(record.customerId) : null,
    invoiceId: record.invoiceId ? toStringValue(record.invoiceId) : null,
  };
};

type TripDelegate = {
  findMany?: (args: unknown) => Promise<unknown[]>;
  create?: (args: unknown) => Promise<unknown>;
};

const tripDelegate = (): TripDelegate | null => {
  const delegate = Reflect.get(prisma, 'truckingTrip');
  if (!delegate || typeof delegate !== 'object') {
    return null;
  }

  const findMany = Reflect.get(delegate, 'findMany');
  const create = Reflect.get(delegate, 'create');

  return {
    findMany:
      typeof findMany === 'function'
        ? (args: unknown) =>
            (findMany as (args: unknown) => Promise<unknown[]>).call(
              delegate,
              args
            )
        : undefined,
    create:
      typeof create === 'function'
        ? (args: unknown) =>
            (create as (args: unknown) => Promise<unknown>).call(delegate, args)
        : undefined,
  };
};

export async function GET() {
  try {
    const columnRows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'trucking_trips'
    `;

    const columnNames = new Set(columnRows.map((row) => row.column_name));
    const selectOrNull = (column: string) =>
      columnNames.has(column) ? `"${column}"` : `NULL as "${column}"`;

    const isDrifted = !columnNames.has('customerId');

    const delegate = tripDelegate();

    if (delegate?.findMany && !isDrifted) {
      try {
        const trips = await delegate.findMany({
          where: { deletedAt: null },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        });

        return NextResponse.json(trips.map(mapTrip));
      } catch (err) {
        // P2022 (missing column) or schema drift falls back to raw query
        const isPrismaSchemaMismatch =
          err instanceof Prisma.PrismaClientValidationError ||
          err instanceof Prisma.PrismaClientKnownRequestError;

        if (!isPrismaSchemaMismatch) {
          throw err;
        }
        // fall through to raw query
      }
    }

    // Fallback: raw SQL in case the delegate is unavailable or client drifted
    const selectClause = [
      selectOrNull('id'),
      selectOrNull('date'),
      selectOrNull('truckId'),
      selectOrNull('destination'),
      selectOrNull('driver'),
      selectOrNull('helper'),
      selectOrNull('grossRevenue'),
      selectOrNull('fuelLiters'),
      selectOrNull('fuelCost'),
      selectOrNull('maintenance'),
      selectOrNull('tollFees'),
      selectOrNull('miscExpenses'),
      selectOrNull('totalExpenses'),
      selectOrNull('remarks'),
      selectOrNull('status'),
      selectOrNull('completedAt'),
      selectOrNull('customerId'),
      selectOrNull('invoiceId'),
    ].join(', ');

    const orderByClause: string[] = [];
    if (columnNames.has('date')) {
      orderByClause.push('"date" DESC');
    }
    if (columnNames.has('createdAt')) {
      orderByClause.push('"createdAt" DESC');
    }

    const whereClause = columnNames.has('deletedAt')
      ? 'WHERE "deletedAt" IS NULL'
      : '';

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ${selectClause} FROM "trucking_trips" ${whereClause} ${
        orderByClause.length ? `ORDER BY ${orderByClause.join(', ')}` : ''
      }`
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
          customerId: data.customerId ?? null,
          status: 'draft',
          totalExpenses,
        },
      });

      return NextResponse.json(mapTrip(created), { status: 201 });
    }

    // Fallback insert via raw SQL
    await prisma.$executeRawUnsafe(
      'INSERT INTO "trucking_trips" (id, "createdAt", "updatedAt", "date", "truckId", destination, driver, helper, "grossRevenue", "fuelLiters", "fuelCost", maintenance, "tollFees", "miscExpenses", "totalExpenses", remarks, status, "customerId") VALUES ($1, NOW(), NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)',
      id,
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
      'draft',
      data.customerId ?? null
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
