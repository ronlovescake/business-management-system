import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const SOURCE_TYPE = 'TRIP';

const toDescription = (
  trip: { truckId: string; destination?: string | null; date: string },
  label: string
) =>
  `${trip.truckId} • ${trip.destination || 'Trip'} • ${trip.date} • ${label}`;

const expenseLines = (trip: {
  id: string;
  date: string;
  truckId: string;
  destination?: string | null;
  fuelCost?: number | null;
  maintenance?: number | null;
  tollFees?: number | null;
  miscExpenses?: number | null;
}) =>
  [
    {
      key: 'fuel',
      amount: trip.fuelCost ?? 0,
      category: 'Fuel',
      description: toDescription(trip, 'Fuel'),
    },
    {
      key: 'maintenance',
      amount: trip.maintenance ?? 0,
      category: 'Maintenance & Repairs',
      description: toDescription(trip, 'Maintenance'),
    },
    {
      key: 'tollFees',
      amount: trip.tollFees ?? 0,
      category: 'Toll Fees',
      description: toDescription(trip, 'Toll Fees'),
    },
    {
      key: 'misc',
      amount: trip.miscExpenses ?? 0,
      category: 'Misc',
      description: toDescription(trip, 'Misc'),
    },
  ].filter((line) => Number(line.amount) > 0);

const normalizeTrip = (trip: Record<string, unknown> | null) => {
  if (!trip) {
    return null;
  }

  const num = (val: unknown) => Number(val ?? 0);
  const str = (val: unknown) =>
    val === undefined || val === null ? '' : String(val);

  return {
    id: str(trip.id),
    date: str(trip.date),
    truckId: str(trip.truckId),
    destination: str(trip.destination),
    fuelCost: num(trip.fuelCost),
    maintenance: num(trip.maintenance),
    tollFees: num(trip.tollFees),
    miscExpenses: num(trip.miscExpenses),
    status: str(trip.status || 'draft'),
  };
};

const getTripColumns = async () => {
  const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trucking_trips'
  `;

  return new Set(columns.map((c) => c.column_name));
};

const selectTripFallback = async (tripId: string, columnNames: Set<string>) => {
  const selectOrNull = (column: string) =>
    columnNames.has(column) ? `"${column}"` : `NULL as "${column}"`;

  const selectClause = [
    selectOrNull('id'),
    selectOrNull('date'),
    selectOrNull('truckId'),
    selectOrNull('destination'),
    selectOrNull('fuelCost'),
    selectOrNull('maintenance'),
    selectOrNull('tollFees'),
    selectOrNull('miscExpenses'),
    selectOrNull('status'),
    selectOrNull('completedAt'),
    selectOrNull('grossRevenue'),
    selectOrNull('fuelLiters'),
    selectOrNull('totalExpenses'),
    selectOrNull('remarks'),
    selectOrNull('driver'),
    selectOrNull('helper'),
  ].join(', ');

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ${selectClause} FROM "trucking_trips" WHERE id = $1 LIMIT 1`,
    tripId
  );

  return rows[0];
};

const loadTrip = async (tripId: string, columns?: Set<string>) => {
  const columnSet = columns ?? (await getTripColumns());

  // If the schema is drifted (e.g., missing customerId), avoid Prisma findUnique to skip validation errors.
  const isSchemaDrift = !columnSet.has('customerId');

  if (isSchemaDrift) {
    const fallback = await selectTripFallback(tripId, columnSet);
    return fallback ?? null;
  }

  try {
    return await prisma.truckingTrip.findUnique({ where: { id: tripId } });
  } catch (error) {
    const knownSchemaError =
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientValidationError;

    if (!knownSchemaError) {
      throw error;
    }

    const fallback = await selectTripFallback(tripId, columnSet);
    return fallback ?? null;
  }
};

const updateTripStatus = async (
  tx: Prisma.TransactionClient,
  tripId: string,
  totals: {
    fuelCost: number;
    maintenance: number;
    tollFees: number;
    miscExpenses: number;
  },
  columns: Set<string>
) => {
  const totalExpenses =
    (totals.fuelCost ?? 0) +
    (totals.maintenance ?? 0) +
    (totals.tollFees ?? 0) +
    (totals.miscExpenses ?? 0);

  // If status column is missing, skip the update to avoid P2022.
  if (
    !columns.has('status') &&
    !columns.has('completedAt') &&
    !columns.has('totalExpenses')
  ) {
    return;
  }

  const setters: string[] = [];
  const params: Array<string | number | Date> = [];

  if (columns.has('status')) {
    setters.push(`"status" = $${setters.length + 1}`);
    params.push('completed');
  }

  if (columns.has('completedAt')) {
    setters.push(`"completedAt" = $${setters.length + 1}`);
    params.push(new Date());
  }

  if (columns.has('totalExpenses')) {
    setters.push(`"totalExpenses" = $${setters.length + 1}`);
    params.push(totalExpenses);
  }

  if (!setters.length) {
    return;
  }

  const sql = `UPDATE "trucking_trips" SET ${setters.join(', ')} WHERE id = $${setters.length + 1}`;
  params.push(tripId);

  await tx.$executeRawUnsafe(sql, ...params);
};

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tripId = params.id;

  try {
    const columns = await getTripColumns();
    const trip = normalizeTrip(await loadTrip(tripId, columns));

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const lines = expenseLines(trip);

    await prisma.$transaction(
      async (tx) => {
        for (const line of lines) {
          const payload = {
            sourceType: SOURCE_TYPE,
            sourceId: trip.id,
            sourceLineKey: line.key,
            status: 'approved',
            vehicleId: trip.truckId,
            date: trip.date,
            systemGenerated: true,
            amount: line.amount,
            category: line.category,
            description: line.description,
          };

          const existing = await tx.truckingExpense.findFirst({
            where: {
              sourceType: SOURCE_TYPE,
              sourceId: trip.id,
              sourceLineKey: line.key,
            },
          });

          if (existing) {
            await tx.truckingExpense.update({
              where: { id: existing.id },
              data: payload,
            });
          } else {
            await tx.truckingExpense.create({ data: payload });
          }
        }

        await updateTripStatus(tx, tripId, trip, columns);
      },
      { isolationLevel: 'ReadCommitted' }
    );

    const refreshed = normalizeTrip(await loadTrip(tripId));

    return NextResponse.json(refreshed ?? trip);
  } catch (error) {
    logger.error('Failed to finalize trip', { error, tripId });
    return NextResponse.json(
      { error: 'Failed to finalize trip' },
      { status: 500 }
    );
  }
}
