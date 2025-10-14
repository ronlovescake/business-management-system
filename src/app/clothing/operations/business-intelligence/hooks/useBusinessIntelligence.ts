import { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type {
  TransactionData,
  ProductData,
  ShipmentData,
  TopCustomer,
  TopProduct,
  MonthlyData,
  DateFilterType,
} from '../types';

// ============================================================================
// DATE FILTER OPTIONS
// ============================================================================

export const filterOptions = [
  { value: 'ytd', label: 'Year to Date' },
  { value: 'mtd', label: 'Month to Date' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'last3months', label: 'Last 3 Months' },
  { value: 'last6months', label: 'Last 6 Months' },
  { value: 'all', label: 'All Time' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDateRangeFilter(filter: string): (date: Date) => boolean {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  switch (filter) {
    case 'ytd':
      return (date) => date >= startOfYear;
    case 'mtd':
      return (date) => date >= startOfMonth;
    case 'last7days': {
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return (date) => date >= last7Days;
    }
    case 'last30days': {
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return (date) => date >= last30Days;
    }
    case 'last3months': {
      const last3Months = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return (date) => date >= last3Months;
    }
    case 'last6months': {
      const last6Months = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      return (date) => date >= last6Months;
    }
    case 'all':
    default:
      return () => true;
  }
}

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

export function useBusinessIntelligence() {
  const [dateFilter, setDateFilter] = useState<DateFilterType>('ytd');

  // ============================================================================
  // DATA FETCHING WITH REACT QUERY
  // ============================================================================

  const [transactionsQuery, productsQuery, shipmentsQuery] = useQueries({
    queries: [
      {
        queryKey: queryKeys.transactions.all,
        queryFn: async (): Promise<TransactionData[]> => {
          const response = await fetch('/api/transactions');
          if (!response.ok) {
            throw new Error('Failed to fetch transactions');
          }
          return response.json();
        },
        staleTime: 30 * 1000, // 30 seconds
      },
      {
        queryKey: queryKeys.products.all,
        queryFn: async (): Promise<ProductData[]> => {
          const response = await fetch('/api/products');
          if (!response.ok) {
            throw new Error('Failed to fetch products');
          }
          return response.json();
        },
        staleTime: 30 * 1000,
      },
      {
        queryKey: queryKeys.shipments.all,
        queryFn: async (): Promise<ShipmentData[]> => {
          const response = await fetch('/api/shipments');
          if (!response.ok) {
            throw new Error('Failed to fetch shipments');
          }
          return response.json();
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
  const products = useMemo(() => productsQuery.data || [], [productsQuery.data]);
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

    // Filter transactions by date
    const filteredTransactions = transactions.filter((t) => {
      if (!t['Order Date']) {
        return false;
      }
      const orderDate = new Date(t['Order Date']);
      return dateFilterFn(orderDate);
    });

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
    };
  }, [transactions, products, shipments, dateFilter]);

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

    // Utilities
    formatCurrency,
    formatNumber,
  };
}
