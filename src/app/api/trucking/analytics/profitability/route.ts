import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type Summary = {
  revenue: number;
  expenses: number;
  net: number;
};

type TripRow = {
  id: string;
  date: string;
  destination: string;
  customerId: number | null;
  grossRevenue: number;
  expenseTotal: number;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const customerIdParam = searchParams.get('customerId');

    const startDate = startDateParam ? new Date(startDateParam) : null;
    const endDate = endDateParam ? new Date(endDateParam) : null;
    const customerId = customerIdParam ? Number(customerIdParam) : null;

    // Normalize invalid or reversed dates
    const startIsValid = startDate && !Number.isNaN(startDate.getTime());
    const endIsValid = endDate && !Number.isNaN(endDate.getTime());
    const start = startIsValid ? startDate : null;
    const end = endIsValid ? endDate : null;
    const useStart = start && end && start > end ? end : start;
    const useEnd = start && end && start > end ? start : end;

    const tripWhere: Prisma.TruckingTripWhereInput = {
      status: 'completed',
    };

    if (useStart || useEnd) {
      tripWhere.date = {};
      if (useStart) {
        tripWhere.date.gte = useStart.toISOString().split('T')[0];
      }
      if (useEnd) {
        tripWhere.date.lte = useEnd.toISOString().split('T')[0];
      }
    }

    if (Number.isFinite(customerId)) {
      tripWhere.customerId = customerId as number;
    }

    const trips = await prisma.truckingTrip.findMany({
      where: tripWhere,
      orderBy: { date: 'desc' },
    });

    const tripIds = trips.map((trip) => trip.id).filter(Boolean);

    const expenseWhere: Prisma.TruckingExpenseWhereInput = {
      sourceType: 'TRIP',
    };

    if (tripIds.length > 0) {
      expenseWhere.sourceId = { in: tripIds };
    }

    const expenseTotalsByTrip: Record<string, number> = {};

    if (tripIds.length) {
      const grouped = await prisma.truckingExpense.groupBy({
        by: ['sourceId'],
        where: expenseWhere,
        _sum: { amount: true },
      });

      grouped.forEach((row) => {
        const key = String(row.sourceId ?? '');
        const total = Number(row._sum?.amount ?? 0);
        expenseTotalsByTrip[key] = total;
      });
    }

    const tripRows: TripRow[] = trips.map((trip) => {
      const id = String(trip.id ?? '');
      return {
        id,
        date: String(trip.date ?? ''),
        destination: String(trip.destination ?? ''),
        customerId: trip.customerId ? Number(trip.customerId) : null,
        grossRevenue: Number(trip.grossRevenue ?? 0),
        expenseTotal: expenseTotalsByTrip[id] ?? 0,
      };
    });

    const summary: Summary = tripRows.reduce(
      (acc, row) => {
        acc.revenue += row.grossRevenue;
        acc.expenses += row.expenseTotal;
        return acc;
      },
      { revenue: 0, expenses: 0, net: 0 }
    );
    summary.net = summary.revenue - summary.expenses;

    return NextResponse.json({ summary, trips: tripRows });
  } catch (error) {
    logger.error('Failed to load trucking profitability', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: 'Failed to load profitability data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
