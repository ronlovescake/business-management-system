import { useState, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import {
  canonicalizeOrderStatus,
  isCancelledOrderStatus,
} from '@/lib/transactions/order-status';
import {
  DATE_FILTER_OPTIONS,
  getComparisonRange,
  getDateRangeFilter,
  percentChange,
} from '@/lib/analytics/periodComparison';
import type {
  TransactionData,
  ProductData,
  ShipmentData,
  TopCustomer,
  TopProduct,
  MonthlyData,
  DateFilterType,
  KpiDeltas,
  PeriodTotals,
  ExtendedMetrics,
  ProfitSnapshot,
} from '../types';

// ============================================================================
// DATE FILTER OPTIONS
// ============================================================================

export const filterOptions = DATE_FILTER_OPTIONS;

export {
  getComparisonRange,
  percentChange,
  type ComparisonRange,
} from '@/lib/analytics/periodComparison';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Filters whose window always contains the whole current month, so MTD is comparable.
const FILTERS_COVERING_CURRENT_MONTH = new Set([
  'ytd',
  'mtd',
  'last3months',
  'last6months',
  'all',
]);

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ============================================================================
// CUSTOM HOOK
// ============================================================================

const customerKey = (name: string | null | undefined) =>
  (name ?? '').trim().toLowerCase();

const monthKeyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** Expects transactions that already exclude cancelled/forfeited/voided rows. */
export function computeDeltas(
  activeTransactions: TransactionData[],
  filter: string,
  current: PeriodTotals,
  now: Date = new Date()
): KpiDeltas {
  const sumWithin = (start: Date, end: Date) => {
    let revenue = 0;
    let count = 0;
    let quantity = 0;
    const customers = new Set<string>();
    for (const t of activeTransactions) {
      if (!t['Order Date']) {
        continue;
      }
      const orderDate = new Date(t['Order Date']);
      if (orderDate >= start && orderDate < end) {
        revenue += t['Line Total'] || 0;
        quantity += t.Quantity || 0;
        count += 1;
        const key = customerKey(t.Customers);
        if (key) {
          customers.add(key);
        }
      }
    }
    return { revenue, count, quantity, customers: customers.size };
  };

  const range = getComparisonRange(filter, now);
  const previous = range
    ? sumWithin(range.previousStart, range.previousEnd)
    : null;

  let mtd: number | null = null;
  if (FILTERS_COVERING_CURRENT_MONTH.has(filter)) {
    const mtdRange = getComparisonRange('mtd', now);
    if (mtdRange) {
      mtd = percentChange(
        current.mtd,
        sumWithin(mtdRange.previousStart, mtdRange.previousEnd).revenue
      );
    }
  }

  if (!previous) {
    return {
      revenue: null,
      mtd,
      transactions: null,
      customers: null,
      quantity: null,
      averageOrderValue: null,
    };
  }

  const currentAov = current.count > 0 ? current.revenue / current.count : 0;
  const previousAov =
    previous.count > 0 ? previous.revenue / previous.count : 0;

  return {
    revenue: percentChange(current.revenue, previous.revenue),
    mtd,
    transactions: percentChange(current.count, previous.count),
    customers: percentChange(current.customers, previous.customers),
    quantity: percentChange(current.quantity, previous.quantity),
    averageOrderValue:
      current.count > 0 ? percentChange(currentAov, previousAov) : null,
  };
}

const PIPELINE_STATUSES = [
  'In Transit',
  'Warehouse',
  'Prepared',
  'Ready For Dispatch',
  'Checked Out',
  'On-Hold',
  'Accounts Receivable',
  'Shipped',
] as const;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * @param periodTransactions rows in the selected period, cancelled included
 * @param allActiveTransactions every non-cancelled row (any date), for first-order lookups
 * @param monthKeys months (YYYY-MM) to bucket the new-vs-returning series into
 */
export function computeExtendedMetrics(
  periodTransactions: TransactionData[],
  allActiveTransactions: TransactionData[],
  monthKeys: string[]
): ExtendedMetrics {
  const active = periodTransactions.filter(
    (t) => !isCancelledOrderStatus(t['Order Status'])
  );

  let revenue = 0;
  let quantitySold = 0;
  let adjustmentsTotal = 0;
  const customers = new Set<string>();
  const lostRevenue = { value: 0, count: 0 };
  const notYetInvoiced = { value: 0, count: 0 };
  const pipelineMap = new Map<string, { count: number; value: number }>();
  const weekday = WEEKDAYS.map((day) => ({ day, revenue: 0, orders: 0 }));

  for (const t of periodTransactions) {
    if (isCancelledOrderStatus(t['Order Status'])) {
      lostRevenue.value += t['Line Total'] || 0;
      lostRevenue.count += 1;
    }
  }

  for (const t of active) {
    const lineTotal = t['Line Total'] || 0;
    revenue += lineTotal;
    quantitySold += t.Quantity || 0;
    adjustmentsTotal += t.Adjustment || 0;

    const key = customerKey(t.Customers);
    if (key) {
      customers.add(key);
    }

    if (!t['Invoice Date']) {
      notYetInvoiced.value += lineTotal;
      notYetInvoiced.count += 1;
    }

    const status = canonicalizeOrderStatus(t['Order Status']);
    if (status) {
      const stage = pipelineMap.get(status) ?? { count: 0, value: 0 };
      stage.count += 1;
      stage.value += lineTotal;
      pipelineMap.set(status, stage);
    }

    if (t['Order Date']) {
      const date = new Date(t['Order Date']);
      if (!Number.isNaN(date.getTime())) {
        // getDay() is Sunday-first; shift so Monday is index 0.
        const bucket = weekday[(date.getDay() + 6) % 7];
        bucket.revenue += lineTotal;
        bucket.orders += 1;
      }
    }
  }

  const firstOrderMonth = new Map<string, string>();
  const orderDays = new Map<string, Set<string>>();
  for (const t of allActiveTransactions) {
    const key = customerKey(t.Customers);
    if (!key || !t['Order Date']) {
      continue;
    }
    const date = new Date(t['Order Date']);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const month = monthKeyOf(date);
    const existing = firstOrderMonth.get(key);
    if (!existing || month < existing) {
      firstOrderMonth.set(key, month);
    }
    const days = orderDays.get(key) ?? new Set<string>();
    days.add(date.toDateString());
    orderDays.set(key, days);
  }

  const customersByMonth = new Map<string, Set<string>>();
  for (const t of active) {
    const key = customerKey(t.Customers);
    if (!key || !t['Order Date']) {
      continue;
    }
    const date = new Date(t['Order Date']);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const month = monthKeyOf(date);
    const set = customersByMonth.get(month) ?? new Set<string>();
    set.add(key);
    customersByMonth.set(month, set);
  }

  const customerMix = monthKeys.map((monthKey) => {
    const [year, month] = monthKey.split('-');
    const label = new Date(Number(year), Number(month) - 1).toLocaleString(
      'en-US',
      { month: 'short' }
    );
    let newCustomers = 0;
    let returningCustomers = 0;
    customersByMonth.get(monthKey)?.forEach((key) => {
      if (firstOrderMonth.get(key) === monthKey) {
        newCustomers += 1;
      } else {
        returningCustomers += 1;
      }
    });
    return { month: label, newCustomers, returningCustomers };
  });

  let repeatCustomers = 0;
  customers.forEach((key) => {
    if ((orderDays.get(key)?.size ?? 0) >= 2) {
      repeatCustomers += 1;
    }
  });

  return {
    uniqueCustomers: customers.size,
    quantitySold,
    averageOrderValue: active.length > 0 ? revenue / active.length : null,
    adjustmentsTotal,
    lostRevenue,
    notYetInvoiced,
    pipeline: PIPELINE_STATUSES.map((status) => ({
      status,
      count: pipelineMap.get(status)?.count ?? 0,
      value: pipelineMap.get(status)?.value ?? 0,
    })),
    customerMix,
    repeatRate:
      customers.size > 0 ? (repeatCustomers / customers.size) * 100 : null,
    weekdaySales: weekday,
  };
}

export function useBusinessIntelligence(apiBasePath?: string) {
  const [dateFilter, setDateFilter] = useState<DateFilterType>('ytd');
  const cacheSuffix = apiBasePath ?? 'default';
  const { data: session } = useSession();
  const canViewProfit = ['ADMIN', 'SUPER_ADMIN'].includes(
    session?.user?.role ?? ''
  );

  // ============================================================================
  // DATA FETCHING WITH REACT QUERY
  // ============================================================================

  const [transactionsQuery, productsQuery, shipmentsQuery] = useQueries({
    queries: [
      {
        queryKey: [...queryKeys.transactions.all, cacheSuffix],
        queryFn: async (): Promise<TransactionData[]> => {
          return api.get<TransactionData[]>(
            buildApiPath(apiBasePath, '/transactions')
          );
        },
        staleTime: 30 * 1000, // 30 seconds
      },
      {
        queryKey: [...queryKeys.products.all, cacheSuffix],
        queryFn: async (): Promise<ProductData[]> => {
          return api.get<ProductData[]>(buildApiPath(apiBasePath, '/products'));
        },
        staleTime: 30 * 1000,
      },
      {
        queryKey: [...queryKeys.shipments.all, cacheSuffix],
        queryFn: async (): Promise<ShipmentData[]> => {
          return api.get<ShipmentData[]>(
            buildApiPath(apiBasePath, '/shipments')
          );
        },
        staleTime: 30 * 1000,
      },
    ],
  });

  // Extract data and loading states
  const transactions = useMemo(
    () => transactionsQuery.data || [],
    [transactionsQuery.data]
  );
  const products = useMemo(
    () => productsQuery.data || [],
    [productsQuery.data]
  );
  const shipments = useMemo(
    () => shipmentsQuery.data || [],
    [shipmentsQuery.data]
  );
  const isLoading =
    transactionsQuery.isLoading ||
    productsQuery.isLoading ||
    shipmentsQuery.isLoading;

  // Log errors if any
  if (transactionsQuery.error) {
    logger.error('Error fetching transactions:', transactionsQuery.error);
  }
  if (productsQuery.error) {
    logger.error('Error fetching products:', productsQuery.error);
  }
  if (shipmentsQuery.error) {
    logger.error('Error fetching shipments:', shipmentsQuery.error);
  }

  // ============================================================================
  // COMPUTED METRICS
  // ============================================================================

  const metrics = useMemo(() => {
    const dateFilterFn = getDateRangeFilter(dateFilter);

    const activeTransactions = transactions.filter(
      (t) => !isCancelledOrderStatus(t['Order Status'])
    );

    const periodTransactions = transactions.filter((t) => {
      if (!t['Order Date']) {
        return false;
      }
      const orderDate = new Date(t['Order Date']);
      return dateFilterFn(orderDate);
    });

    // Cancelled/forfeited/voided rows are reported separately as lost revenue.
    const filteredTransactions = periodTransactions.filter(
      (t) => !isCancelledOrderStatus(t['Order Status'])
    );

    // YTD and MTD calculations
    const ytdTotal = filteredTransactions.reduce(
      (sum, t) => sum + (t['Line Total'] || 0),
      0
    );

    const mtdTotal = filteredTransactions.reduce((sum, t) => {
      if (!t['Order Date']) {
        return sum;
      }
      const orderDate = new Date(t['Order Date']);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      if (orderDate >= startOfMonth) {
        return sum + (t['Line Total'] || 0);
      }
      return sum;
    }, 0);

    // Most sold items by monetary value
    const productSales = new Map<string, TopProduct>();
    filteredTransactions.forEach((t) => {
      const code = t['Product Code'];
      if (!code) {
        return;
      }

      const existing = productSales.get(code);
      const lineTotal = t['Line Total'] || 0;
      const quantity = t['Quantity'] || 0;

      if (existing) {
        existing.totalValue += lineTotal;
        existing.quantity += quantity;
      } else {
        productSales.set(code, {
          productCode: code,
          totalValue: lineTotal,
          quantity: quantity,
        });
      }
    });

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    // Total COGS
    const totalCOGS = products.reduce((sum, p) => sum + (p.COGS || 0), 0);

    // Top 10 customers by total order amount
    const customerSales = new Map<string, TopCustomer>();
    filteredTransactions.forEach((t) => {
      const customer = t.Customers;
      if (!customer) {
        return;
      }

      const existing = customerSales.get(customer);
      const lineTotal = t['Line Total'] || 0;

      if (existing) {
        existing.totalAmount += lineTotal;
        existing.orderCount += 1;
      } else {
        customerSales.set(customer, {
          customerName: customer,
          totalAmount: lineTotal,
          orderCount: 1,
        });
      }
    });

    const topCustomers = Array.from(customerSales.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    // Shipment metrics: running CBM, number of sacks
    const totalCBM = shipments.reduce(
      (sum, s) => sum + (s['Total CBM'] || 0),
      0
    );
    const totalSacks = shipments.reduce(
      (sum, s) => sum + (s['No. Of Sacks'] || 0),
      0
    );

    // ========================================================================
    // MONTHLY TREND DATA - Group data by month for time-series charts
    // ========================================================================
    const monthlyDataMap = new Map<
      string,
      {
        revenue: number;
        transactions: number;
        customerRevenue: Map<string, number>;
        productRevenue: Map<string, number>;
        shipmentCount: number;
        cbm: number;
        sacks: number;
      }
    >();

    // Process transactions by month
    filteredTransactions.forEach((t) => {
      if (!t['Order Date']) {
        return;
      }
      const date = new Date(t['Order Date']);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyDataMap.has(monthKey)) {
        monthlyDataMap.set(monthKey, {
          revenue: 0,
          transactions: 0,
          customerRevenue: new Map(),
          productRevenue: new Map(),
          shipmentCount: 0,
          cbm: 0,
          sacks: 0,
        });
      }

      const monthData = monthlyDataMap.get(monthKey);
      if (!monthData) {
        return;
      }
      monthData.revenue += t['Line Total'] || 0;
      monthData.transactions += 1;

      // Track customer revenue per month
      if (t.Customers) {
        const custRev = monthData.customerRevenue.get(t.Customers) || 0;
        monthData.customerRevenue.set(
          t.Customers,
          custRev + (t['Line Total'] || 0)
        );
      }

      // Track product revenue per month
      if (t['Product Code']) {
        const prodRev = monthData.productRevenue.get(t['Product Code']) || 0;
        monthData.productRevenue.set(
          t['Product Code'],
          prodRev + (t['Line Total'] || 0)
        );
      }
    });

    // Process shipments by month using Date Created
    shipments.forEach((s) => {
      const dateStr = s['Date Created'];
      if (!dateStr) {
        return;
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return; // Invalid date
      }

      // Check if date is within filtered range
      if (!dateFilterFn(date)) {
        return;
      }

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyDataMap.has(monthKey)) {
        monthlyDataMap.set(monthKey, {
          revenue: 0,
          transactions: 0,
          customerRevenue: new Map(),
          productRevenue: new Map(),
          shipmentCount: 0,
          cbm: 0,
          sacks: 0,
        });
      }

      const monthData = monthlyDataMap.get(monthKey);
      if (!monthData) {
        return;
      }

      // Count shipments and aggregate metrics per month
      monthData.shipmentCount += 1;
      monthData.cbm += s['Total CBM'] || 0;
      monthData.sacks += s['No. Of Sacks'] || 0;
    });

    // Generate all 12 months for the current year (January to December)
    const currentYear = new Date().getFullYear();
    const allMonths = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return `${currentYear}-${String(month).padStart(2, '0')}`;
    });

    // Convert to array and format for charts - ensure all 12 months are included
    const monthlyTrends: MonthlyData[] = allMonths.map((monthKey) => {
      const data = monthlyDataMap.get(monthKey);

      if (!data) {
        // No data for this month - show empty values
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        const monthName = date.toLocaleString('en-US', {
          month: 'short',
        });

        return {
          month: monthName,
          revenue: 0,
          transactions: 0,
          topCustomer: 'N/A',
          topCustomerRevenue: 0,
          topProduct: 'N/A',
          topProductRevenue: 0,
          shipments: 0,
          cbm: 0,
          sacks: 0,
        };
      }

      // Get top customer for the month
      const topCust = Array.from(data.customerRevenue.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0] || ['N/A', 0];

      // Get top product for the month
      const topProd = Array.from(data.productRevenue.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0] || ['N/A', 0];

      // Format month for display (e.g., "Jan")
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      const monthName = date.toLocaleString('en-US', {
        month: 'short',
      });

      return {
        month: monthName,
        revenue: data.revenue,
        transactions: data.transactions,
        topCustomer: topCust[0],
        topCustomerRevenue: topCust[1],
        topProduct: topProd[0],
        topProductRevenue: topProd[1],
        shipments: Math.round(data.shipmentCount),
        cbm: data.cbm,
        sacks: Math.round(data.sacks),
      };
    });

    const extended = computeExtendedMetrics(
      periodTransactions,
      activeTransactions,
      allMonths.filter((monthKey) => {
        const [year, month] = monthKey.split('-').map(Number);
        return (
          dateFilterFn(new Date(year, month - 1, 1)) ||
          dateFilterFn(new Date(year, month, 0, 23, 59, 59))
        );
      })
    );

    return {
      ytdTotal,
      mtdTotal,
      topProducts,
      totalCOGS,
      topCustomers,
      totalCBM,
      totalSacks,
      transactionCount: filteredTransactions.length,
      monthlyTrends,
      extended,
      deltas: computeDeltas(activeTransactions, dateFilter, {
        revenue: ytdTotal,
        mtd: mtdTotal,
        count: filteredTransactions.length,
        customers: extended.uniqueCustomers,
        quantity: extended.quantitySold,
      }),
    };
  }, [transactions, products, shipments, dateFilter]);

  const profitQuery = useQuery({
    queryKey: [
      ...queryKeys.analytics.businessIntelligence(),
      'profit-loss',
      cacheSuffix,
      dateFilter,
    ],
    queryFn: async (): Promise<ProfitSnapshot> => {
      const range = getComparisonRange(dateFilter);
      const params = new URLSearchParams();
      if (range) {
        params.set('from', range.currentStart.toISOString());
        params.set('to', new Date().toISOString());
      }
      const endpoint = buildApiPath(apiBasePath, '/accounting/profit-loss');
      const query = params.toString();
      const data = await api.get<{ stats: ProfitSnapshot }>(
        query ? `${endpoint}?${query}` : endpoint
      );
      return data.stats;
    },
    enabled: canViewProfit,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    // State
    dateFilter,
    setDateFilter,
    isLoading,

    // Data
    products,
    shipments,

    // Metrics
    metrics,
    profit: {
      enabled: canViewProfit,
      data: profitQuery.data,
      isLoading: profitQuery.isLoading,
      isError: profitQuery.isError,
    },

    // Utilities
    formatCurrency,
    formatNumber,
  };
}
