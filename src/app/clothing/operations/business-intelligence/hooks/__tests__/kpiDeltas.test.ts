/**
 * @group unit
 * @group business-intelligence
 */

import { describe, it, expect } from 'vitest';
import {
  computeDeltas,
  computeExtendedMetrics,
  getComparisonRange,
  percentChange,
} from '../useBusinessIntelligence';
import type { PeriodTotals, TransactionData } from '../../types';

const tx = (
  orderDate: Date,
  lineTotal: number,
  overrides: Partial<TransactionData> = {}
): TransactionData => ({
  'Order Date': orderDate.toISOString(),
  Customers: 'Customer',
  'Product Code': 'P-1',
  Quantity: 1,
  'Unit Price': lineTotal,
  Discount: null,
  Adjustment: null,
  'Line Total': lineTotal,
  'Order Status': 'Prepared',
  ...overrides,
});

const totals = (overrides: Partial<PeriodTotals>): PeriodTotals => ({
  revenue: 0,
  mtd: 0,
  count: 0,
  customers: 0,
  quantity: 0,
  ...overrides,
});

describe('getComparisonRange', () => {
  const now = new Date(2024, 5, 15, 12, 0, 0);

  it('compares YTD with the same span last year', () => {
    const range = getComparisonRange('ytd', now);
    expect(range?.currentStart).toEqual(new Date('2024-01-01T00:00:00+08:00'));
    expect(range?.previousStart).toEqual(new Date('2023-01-01T00:00:00+08:00'));
    expect(range?.previousEnd).toEqual(new Date(2023, 5, 15, 12, 0, 0));
  });

  it('compares MTD with the same days last month', () => {
    const range = getComparisonRange('mtd', now);
    expect(range?.currentStart).toEqual(new Date('2024-06-01T00:00:00+08:00'));
    expect(range?.previousStart).toEqual(new Date('2024-05-01T00:00:00+08:00'));
    expect(range?.previousEnd).toEqual(new Date(2024, 4, 15, 12, 0, 0));
  });

  it('clamps MTD on the 31st to the end of a shorter previous month', () => {
    const range = getComparisonRange('mtd', new Date(2024, 2, 31, 9));
    expect(range?.previousStart).toEqual(new Date('2024-02-01T00:00:00+08:00'));
    expect(range?.previousEnd).toEqual(new Date(2024, 1, 29, 9));
  });

  it('clamps YTD on a leap day to Feb 28 of the previous year', () => {
    const range = getComparisonRange('ytd', new Date(2024, 1, 29, 8));
    expect(range?.previousEnd).toEqual(new Date(2023, 1, 28, 8));
  });

  it('handles MTD in January by comparing with December', () => {
    const range = getComparisonRange('mtd', new Date(2024, 0, 10));
    expect(range?.previousStart).toEqual(new Date('2023-12-01T00:00:00+08:00'));
    expect(range?.previousEnd).toEqual(new Date(2023, 11, 10));
  });

  it('compares rolling day windows with the window before them', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const week = getComparisonRange('last7days', now);
    expect(week?.currentStart).toEqual(new Date(now.getTime() - 7 * DAY));
    expect(week?.previousStart).toEqual(new Date(now.getTime() - 14 * DAY));
    expect(week?.previousEnd).toEqual(new Date(now.getTime() - 7 * DAY));

    const month = getComparisonRange('last30days', now);
    expect(month?.previousStart).toEqual(new Date(now.getTime() - 60 * DAY));
    expect(month?.previousEnd).toEqual(new Date(now.getTime() - 30 * DAY));
  });

  it('shifts month windows back by their own length', () => {
    const three = getComparisonRange('last3months', now);
    expect(three?.currentStart).toEqual(new Date('2024-03-01T00:00:00+08:00'));
    expect(three?.previousStart).toEqual(new Date('2023-12-01T00:00:00+08:00'));
    expect(three?.previousEnd).toEqual(new Date(2024, 2, 15, 12, 0, 0));

    const six = getComparisonRange('last6months', now);
    expect(six?.currentStart).toEqual(new Date('2023-12-01T00:00:00+08:00'));
    expect(six?.previousStart).toEqual(new Date('2023-06-01T00:00:00+08:00'));
    expect(six?.previousEnd).toEqual(new Date(2023, 11, 15, 12, 0, 0));
  });

  it('returns null for all time', () => {
    expect(getComparisonRange('all', now)).toBeNull();
  });
});

describe('percentChange', () => {
  it('returns the relative change in percent', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it('returns null when there is no previous value', () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(Number.NaN, 10)).toBeNull();
  });

  it('uses the magnitude of a negative baseline', () => {
    expect(percentChange(-50, -100)).toBe(50);
  });
});

describe('computeDeltas', () => {
  const now = new Date(2024, 5, 15, 12);

  it('compares revenue, MTD and transactions with the previous period', () => {
    const transactions = [
      tx(new Date(2024, 5, 10), 300, { Quantity: 4 }),
      tx(new Date(2024, 4, 10), 200, { Quantity: 2 }),
      tx(new Date(2024, 4, 20), 999),
    ];
    const deltas = computeDeltas(
      transactions,
      'mtd',
      totals({ revenue: 300, mtd: 300, count: 1, customers: 1, quantity: 4 }),
      now
    );
    expect(deltas.revenue).toBe(50);
    expect(deltas.mtd).toBe(50);
    expect(deltas.transactions).toBe(0);
    expect(deltas.customers).toBe(0);
    expect(deltas.quantity).toBe(100);
    expect(deltas.averageOrderValue).toBe(50);
  });

  it('hides all comparisons for all time except MTD', () => {
    const transactions = [
      tx(new Date(2024, 5, 10), 300),
      tx(new Date(2024, 4, 10), 100),
    ];
    const deltas = computeDeltas(
      transactions,
      'all',
      totals({ revenue: 400, mtd: 300, count: 2 }),
      now
    );
    expect(deltas.revenue).toBeNull();
    expect(deltas.transactions).toBeNull();
    expect(deltas.customers).toBeNull();
    expect(deltas.mtd).toBe(200);
  });

  it('hides MTD when the filter does not cover the whole current month', () => {
    const deltas = computeDeltas([], 'last7days', totals({}), now);
    expect(deltas.mtd).toBeNull();
  });

  it('returns null when the previous period has no sales', () => {
    const transactions = [tx(new Date(2024, 5, 10), 300)];
    const deltas = computeDeltas(
      transactions,
      'mtd',
      totals({ revenue: 300, mtd: 300, count: 1, customers: 1, quantity: 1 }),
      now
    );
    expect(deltas.revenue).toBeNull();
    expect(deltas.transactions).toBeNull();
    expect(deltas.averageOrderValue).toBeNull();
  });
});

describe('computeExtendedMetrics', () => {
  // 2024-06-10 is a Monday, 2024-06-16 a Sunday.
  const period = [
    tx(new Date(2024, 5, 10), 100, {
      Customers: 'Ana',
      Quantity: 2,
      Adjustment: 5,
      'Order Status': 'in transit',
      'Invoice Date': '2024-06-11',
    }),
    tx(new Date(2024, 5, 16), 300, {
      Customers: ' ana ',
      Quantity: 3,
      'Order Status': 'Prepared',
    }),
    tx(new Date(2024, 5, 12), 50, {
      Customers: 'Ben',
      'Order Status': 'Cancelled',
    }),
    tx(new Date(2024, 5, 12), 70, {
      Customers: 'Cy',
      'Order Status': 'Voided',
    }),
    tx(new Date(2024, 5, 13), 200, {
      Customers: 'Dee',
      'Order Status': 'On Hold',
    }),
  ];
  const history = [
    tx(new Date(2024, 2, 1), 10, { Customers: 'Dee' }),
    ...period.filter((t) => !/cancel|void/i.test(t['Order Status'] ?? '')),
  ];

  const result = computeExtendedMetrics(period, history, [
    '2024-05',
    '2024-06',
  ]);

  it('excludes cancelled and voided rows from sales totals', () => {
    expect(result.uniqueCustomers).toBe(2);
    expect(result.quantitySold).toBe(6);
    expect(result.adjustmentsTotal).toBe(5);
    expect(result.averageOrderValue).toBe(200);
  });

  it('reports cancelled, forfeited and voided rows as lost revenue', () => {
    expect(result.lostRevenue).toEqual({ value: 120, count: 2 });
  });

  it('counts non-cancelled rows without an invoice date as not invoiced', () => {
    expect(result.notYetInvoiced).toEqual({ value: 500, count: 2 });
  });

  it('groups the pipeline by canonical status', () => {
    const byStatus = Object.fromEntries(
      result.pipeline.map((stage) => [stage.status, stage])
    );
    expect(byStatus['In Transit']).toMatchObject({ count: 1, value: 100 });
    expect(byStatus['Prepared']).toMatchObject({ count: 1, value: 300 });
    expect(byStatus['On-Hold']).toMatchObject({ count: 1, value: 200 });
    expect(byStatus['Shipped']).toMatchObject({ count: 0, value: 0 });
  });

  it('splits customers into new and returning by first-ever order month', () => {
    expect(result.customerMix).toEqual([
      { month: 'May', newCustomers: 0, returningCustomers: 0 },
      { month: 'Jun', newCustomers: 1, returningCustomers: 1 },
    ]);
  });

  it('computes the repeat rate from distinct order days', () => {
    expect(result.repeatRate).toBe(100);
  });

  it('buckets sales by weekday starting Monday', () => {
    expect(result.weekdaySales[0]).toEqual({
      day: 'Mon',
      revenue: 100,
      orders: 1,
    });
    expect(result.weekdaySales[6]).toEqual({
      day: 'Sun',
      revenue: 300,
      orders: 1,
    });
    expect(result.weekdaySales[2].revenue).toBe(0);
  });

  it('handles empty input', () => {
    const empty = computeExtendedMetrics([], [], ['2024-06']);
    expect(empty.averageOrderValue).toBeNull();
    expect(empty.repeatRate).toBeNull();
    expect(empty.lostRevenue).toEqual({ value: 0, count: 0 });
  });
});
