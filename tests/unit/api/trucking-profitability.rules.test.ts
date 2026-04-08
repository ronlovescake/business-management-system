/**
 * Trucking — Profitability Analytics API (Business Rule Tests)
 *
 * Rules from docs/business-logic/trucking/analytics-profitability.md:
 *   A1  — Only completed trips are included
 *   A2  — Filterable by date range and customerId
 *   A3  — Expenses aggregated only from sourceType='TRIP' rows
 *   A4  — Revenue from trip grossRevenue
 *   B5  — Trip-level expense total = sum of trip-linked expense rows
 *   B6  — Trip net = grossRevenue - expenseTotal
 *   B7  — Summary revenue = sum of trips' grossRevenue
 *   B8  — Summary expenses = sum of grouped trip-linked expenses
 *   B9  — Summary net = summaryRevenue − summaryExpenses
 *   D13 — Only TRIP-sourced expense rows
 *   D14 — Trips without customerId can appear
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---- hoisted mocks ----

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    truckingTrip: { findMany: vi.fn() },
    truckingExpense: { groupBy: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Trucking — Profitability Analytics API (Business Rules)', () => {
  const trips = [
    {
      id: 'trip-1',
      date: '2026-04-01',
      destination: 'Cebu',
      customerId: 10,
      grossRevenue: 50000,
      status: 'completed',
    },
    {
      id: 'trip-2',
      date: '2026-04-02',
      destination: 'Davao',
      customerId: null,
      grossRevenue: 30000,
      status: 'completed',
    },
  ];

  const expenseGroups = [
    { sourceId: 'trip-1', _sum: { amount: 15000 } },
    { sourceId: 'trip-2', _sum: { amount: 8000 } },
  ];

  // -----------------------------------------------------------------------
  // Rule A1: Only completed trips
  // -----------------------------------------------------------------------

  describe('Rule A1: Only completed trips', () => {
    it('passes status=completed in where clause', async () => {
      mockPrisma.truckingTrip.findMany.mockResolvedValue([]);
      mockPrisma.truckingExpense.groupBy.mockResolvedValue([]);

      const { GET } = await import(
        '@/app/api/trucking/analytics/profitability/route'
      );
      const req = new Request('http://localhost/api/trucking/analytics/profitability');
      await GET(req);

      const where = mockPrisma.truckingTrip.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('completed');
    });
  });

  // -----------------------------------------------------------------------
  // Rule A2: Filterable by date range and customerId
  // -----------------------------------------------------------------------

  describe('Rule A2: Date range and customer filtering', () => {
    it('applies startDate and endDate to trip query', async () => {
      mockPrisma.truckingTrip.findMany.mockResolvedValue([]);
      mockPrisma.truckingExpense.groupBy.mockResolvedValue([]);

      const { GET } = await import(
        '@/app/api/trucking/analytics/profitability/route'
      );
      const req = new Request(
        'http://localhost/api/trucking/analytics/profitability?startDate=2026-04-01&endDate=2026-04-30'
      );
      await GET(req);

      const where = mockPrisma.truckingTrip.findMany.mock.calls[0][0].where;
      expect(where.date.gte).toBeDefined();
      expect(where.date.lte).toBeDefined();
    });

    it('applies customerId filter', async () => {
      mockPrisma.truckingTrip.findMany.mockResolvedValue([]);
      mockPrisma.truckingExpense.groupBy.mockResolvedValue([]);

      const { GET } = await import(
        '@/app/api/trucking/analytics/profitability/route'
      );
      const req = new Request(
        'http://localhost/api/trucking/analytics/profitability?customerId=10'
      );
      await GET(req);

      const where = mockPrisma.truckingTrip.findMany.mock.calls[0][0].where;
      expect(where.customerId).toBe(10);
    });
  });

  // -----------------------------------------------------------------------
  // Rules A3, D13: Expenses from sourceType='TRIP' only
  // -----------------------------------------------------------------------

  describe('Rule A3/D13: Expense grouping uses sourceType=TRIP', () => {
    it('passes sourceType TRIP in expense query', async () => {
      mockPrisma.truckingTrip.findMany.mockResolvedValue(trips);
      mockPrisma.truckingExpense.groupBy.mockResolvedValue(expenseGroups);

      const { GET } = await import(
        '@/app/api/trucking/analytics/profitability/route'
      );
      const req = new Request('http://localhost/api/trucking/analytics/profitability');
      await GET(req);

      const groupByCall = mockPrisma.truckingExpense.groupBy.mock.calls[0][0];
      expect(groupByCall.where.sourceType).toBe('TRIP');
    });
  });

  // -----------------------------------------------------------------------
  // Rules B6, B7, B8, B9: Summary computation
  // -----------------------------------------------------------------------

  describe('Rules B6-B9: Summary and trip-level computation', () => {
    it('computes trip-level and summary correctly', async () => {
      mockPrisma.truckingTrip.findMany.mockResolvedValue(trips);
      mockPrisma.truckingExpense.groupBy.mockResolvedValue(expenseGroups);

      const { GET } = await import(
        '@/app/api/trucking/analytics/profitability/route'
      );
      const req = new Request('http://localhost/api/trucking/analytics/profitability');
      const res = await GET(req);
      const json = await res.json();

      // Rule B6: trip net = grossRevenue - expenseTotal
      expect(json.trips[0].grossRevenue).toBe(50000);
      expect(json.trips[0].expenseTotal).toBe(15000);

      // Rule D14: trips without customerId are included
      expect(json.trips[1].customerId).toBeNull();
      expect(json.trips[1].grossRevenue).toBe(30000);

      // Rule B7: summary revenue = sum of grossRevenue
      expect(json.summary.revenue).toBe(80000);

      // Rule B8: summary expenses = sum of expenseTotals
      expect(json.summary.expenses).toBe(23000);

      // Rule B9: summary net = revenue - expenses
      expect(json.summary.net).toBe(57000);
    });
  });

  // -----------------------------------------------------------------------
  // Rule D14: Trips without customerId can appear
  // -----------------------------------------------------------------------

  describe('Rule D14: Trips without customerId still appear', () => {
    it('includes trips with null customerId', async () => {
      const tripsWithNull = [
        {
          id: 'trip-solo',
          date: '2026-04-03',
          destination: 'Manila',
          customerId: null,
          grossRevenue: 20000,
          status: 'completed',
        },
      ];
      mockPrisma.truckingTrip.findMany.mockResolvedValue(tripsWithNull);
      mockPrisma.truckingExpense.groupBy.mockResolvedValue([]);

      const { GET } = await import(
        '@/app/api/trucking/analytics/profitability/route'
      );
      const req = new Request('http://localhost/api/trucking/analytics/profitability');
      const res = await GET(req);
      const json = await res.json();

      expect(json.trips).toHaveLength(1);
      expect(json.trips[0].customerId).toBeNull();
    });
  });
});
