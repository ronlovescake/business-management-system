import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

    const tripWhere: Parameters<
      typeof prisma.truckingTrip.findMany
    >[0]['where'] = {
      status: 'completed',
    };

    if (startDate || endDate) {
      tripWhere.date = {};
      if (startDate) {
        tripWhere.date.gte = startDate.toISOString().split('T')[0];
      }
      if (endDate) {
        tripWhere.date.lte = endDate.toISOString().split('T')[0];
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

    const expenseWhere: Parameters<
      typeof prisma.truckingExpense.findMany
    >[0]['where'] = {
      sourceType: 'TRIP',
    };

    if (tripIds.length > 0) {
      expenseWhere.sourceId = { in: tripIds } as any;
    }

    const expenses = tripIds.length
      ? await prisma.truckingExpense.findMany({ where: expenseWhere })
      : [];

    const expenseTotalsByTrip = expenses.reduce<Record<string, number>>(
      (acc, expense) => {
        const key = String(expense.sourceId ?? '');
        const amount = Number(expense.amount ?? 0);
        acc[key] = (acc[key] ?? 0) + amount;
        return acc;
      },
      {}
    );

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
    return NextResponse.json(
      {
        error: 'Failed to load profitability data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
