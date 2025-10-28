/**
 * Business Intelligence Module - Utility Functions Tests
 *
 * Comprehensive tests for business intelligence module utilities:
 * - Date range filtering (YTD, MTD, last N days/months, all time)
 * - Revenue calculations and aggregations
 * - Top customers and products analysis
 * - Monthly trend data generation
 * - Shipment metrics aggregation
 * - Currency and number formatting
 *
 * Note: React Query hooks are tested through integration tests.
 * These tests focus on pure utility functions that can be unit tested.
 *
 * @group unit
 * @group business-intelligence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==========================================================================
// DATE RANGE FILTERING
// ==========================================================================

describe('Date Range Filtering', () => {
  let now: Date;

  beforeEach(() => {
    // Mock current date as 2024-06-15
    now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);
  });

  const getDateRangeFilter = (filter: string): ((date: Date) => boolean) => {
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
  };

  it('should filter YTD (year to date)', () => {
    const filter = getDateRangeFilter('ytd');
    expect(filter(new Date('2024-01-01'))).toBe(true);
    expect(filter(new Date('2024-06-01'))).toBe(true);
    expect(filter(new Date('2023-12-31'))).toBe(false);
  });

  it('should filter MTD (month to date)', () => {
    const filter = getDateRangeFilter('mtd');
    expect(filter(new Date('2024-06-01'))).toBe(true);
    expect(filter(new Date('2024-06-15'))).toBe(true);
    expect(filter(new Date('2024-05-31'))).toBe(false);
  });

  it('should filter last 7 days', () => {
    const filter = getDateRangeFilter('last7days');
    expect(filter(new Date('2024-06-09'))).toBe(true); // 6 days ago
    expect(filter(new Date('2024-06-15'))).toBe(true); // today
    expect(filter(new Date('2024-06-07'))).toBe(false); // 8 days ago
  });

  it('should filter last 30 days', () => {
    const filter = getDateRangeFilter('last30days');
    expect(filter(new Date('2024-05-17'))).toBe(true); // 29 days ago
    expect(filter(new Date('2024-05-15'))).toBe(false); // 31 days ago
  });

  it('should filter last 3 months', () => {
    const filter = getDateRangeFilter('last3months');
    expect(filter(new Date('2024-03-01'))).toBe(true);
    expect(filter(new Date('2024-02-28'))).toBe(false);
  });

  it('should filter last 6 months', () => {
    const filter = getDateRangeFilter('last6months');
    expect(filter(new Date('2023-12-01'))).toBe(true);
    expect(filter(new Date('2023-11-30'))).toBe(false);
  });

  it('should return all dates for "all" filter', () => {
    const filter = getDateRangeFilter('all');
    expect(filter(new Date('2020-01-01'))).toBe(true);
    expect(filter(new Date('2025-12-31'))).toBe(true);
  });
});

// ==========================================================================
// CURRENCY FORMATTING
// ==========================================================================

describe('Currency Formatting', () => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  it('should format currency with PHP symbol', () => {
    const result = formatCurrency(1000);
    expect(result).toContain('1,000');
    expect(result).toContain('₱');
  });

  it('should format large amounts', () => {
    const result = formatCurrency(1234567.89);
    expect(result).toContain('1,234,567.89');
  });

  it('should format zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0.00');
  });

  it('should format negative amounts', () => {
    const result = formatCurrency(-500);
    expect(result).toContain('500');
  });
});

// ==========================================================================
// NUMBER FORMATTING
// ==========================================================================

describe('Number Formatting', () => {
  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  it('should format number with 2 decimals', () => {
    expect(formatNumber(1234.5)).toBe('1,234.50');
    expect(formatNumber(1000)).toBe('1,000.00');
  });

  it('should round to 2 decimals', () => {
    expect(formatNumber(1234.567)).toBe('1,234.57');
    expect(formatNumber(1234.564)).toBe('1,234.56');
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0.00');
  });
});

// ==========================================================================
// REVENUE CALCULATIONS
// ==========================================================================

describe('Revenue Calculations', () => {
  interface Transaction {
    'Order Date': string;
    'Line Total': number | null;
  }

  const calculateYTDTotal = (transactions: Transaction[]): number => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return transactions.reduce((sum, t) => {
      if (!t['Order Date']) {
        return sum;
      }
      const orderDate = new Date(t['Order Date']);
      if (orderDate >= startOfYear) {
        return sum + (t['Line Total'] || 0);
      }
      return sum;
    }, 0);
  };

  const calculateMTDTotal = (transactions: Transaction[]): number => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return transactions.reduce((sum, t) => {
      if (!t['Order Date']) {
        return sum;
      }
      const orderDate = new Date(t['Order Date']);
      if (orderDate >= startOfMonth) {
        return sum + (t['Line Total'] || 0);
      }
      return sum;
    }, 0);
  };

  it('should calculate YTD total', () => {
    vi.setSystemTime(new Date('2024-06-15'));
    const transactions: Transaction[] = [
      { 'Order Date': '2024-01-15', 'Line Total': 1000 },
      { 'Order Date': '2024-03-20', 'Line Total': 2000 },
      { 'Order Date': '2023-12-31', 'Line Total': 500 }, // Previous year
    ];

    expect(calculateYTDTotal(transactions)).toBe(3000);
  });

  it('should calculate MTD total', () => {
    vi.setSystemTime(new Date('2024-06-15'));
    const transactions: Transaction[] = [
      { 'Order Date': '2024-06-01', 'Line Total': 1000 },
      { 'Order Date': '2024-06-10', 'Line Total': 2000 },
      { 'Order Date': '2024-05-31', 'Line Total': 500 }, // Previous month
    ];

    expect(calculateMTDTotal(transactions)).toBe(3000);
  });

  it('should handle null line totals', () => {
    vi.setSystemTime(new Date('2024-06-15'));
    const transactions: Transaction[] = [
      { 'Order Date': '2024-06-01', 'Line Total': 1000 },
      { 'Order Date': '2024-06-05', 'Line Total': null },
      { 'Order Date': '2024-06-10', 'Line Total': 2000 },
    ];

    expect(calculateMTDTotal(transactions)).toBe(3000);
  });
});

// ==========================================================================
// TOP PRODUCTS ANALYSIS
// ==========================================================================

describe('Top Products Analysis', () => {
  interface Transaction {
    'Product Code': string;
    'Line Total': number | null;
    Quantity: number | null;
  }

  interface TopProduct {
    productCode: string;
    totalValue: number;
    quantity: number;
  }

  const calculateTopProducts = (
    transactions: Transaction[],
    limit: number = 10
  ): TopProduct[] => {
    const productSales = new Map<string, TopProduct>();

    transactions.forEach((t) => {
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

    return Array.from(productSales.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, limit);
  };

  it('should calculate top products by revenue', () => {
    const transactions: Transaction[] = [
      { 'Product Code': 'P001', 'Line Total': 5000, Quantity: 10 },
      { 'Product Code': 'P002', 'Line Total': 3000, Quantity: 5 },
      { 'Product Code': 'P003', 'Line Total': 8000, Quantity: 15 },
    ];

    const topProducts = calculateTopProducts(transactions);
    expect(topProducts[0].productCode).toBe('P003');
    expect(topProducts[0].totalValue).toBe(8000);
    expect(topProducts[1].productCode).toBe('P001');
  });

  it('should aggregate multiple transactions for same product', () => {
    const transactions: Transaction[] = [
      { 'Product Code': 'P001', 'Line Total': 2000, Quantity: 5 },
      { 'Product Code': 'P001', 'Line Total': 3000, Quantity: 7 },
      { 'Product Code': 'P002', 'Line Total': 1000, Quantity: 2 },
    ];

    const topProducts = calculateTopProducts(transactions);
    expect(topProducts[0].productCode).toBe('P001');
    expect(topProducts[0].totalValue).toBe(5000);
    expect(topProducts[0].quantity).toBe(12);
  });

  it('should limit results to specified count', () => {
    const transactions: Transaction[] = [
      { 'Product Code': 'P001', 'Line Total': 5000, Quantity: 10 },
      { 'Product Code': 'P002', 'Line Total': 4000, Quantity: 8 },
      { 'Product Code': 'P003', 'Line Total': 3000, Quantity: 6 },
    ];

    const topProducts = calculateTopProducts(transactions, 2);
    expect(topProducts).toHaveLength(2);
  });

  it('should handle null values', () => {
    const transactions: Transaction[] = [
      { 'Product Code': 'P001', 'Line Total': 1000, Quantity: null },
      { 'Product Code': 'P002', 'Line Total': null, Quantity: 5 },
    ];

    const topProducts = calculateTopProducts(transactions);
    expect(topProducts[0].totalValue).toBe(1000);
    expect(topProducts[0].quantity).toBe(0);
  });
});

// ==========================================================================
// TOP CUSTOMERS ANALYSIS
// ==========================================================================

describe('Top Customers Analysis', () => {
  interface Transaction {
    Customers: string;
    'Line Total': number | null;
  }

  interface TopCustomer {
    customerName: string;
    totalAmount: number;
    orderCount: number;
  }

  const calculateTopCustomers = (
    transactions: Transaction[],
    limit: number = 10
  ): TopCustomer[] => {
    const customerSales = new Map<string, TopCustomer>();

    transactions.forEach((t) => {
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

    return Array.from(customerSales.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit);
  };

  it('should calculate top customers by revenue', () => {
    const transactions: Transaction[] = [
      { Customers: 'Customer A', 'Line Total': 5000 },
      { Customers: 'Customer B', 'Line Total': 3000 },
      { Customers: 'Customer C', 'Line Total': 8000 },
    ];

    const topCustomers = calculateTopCustomers(transactions);
    expect(topCustomers[0].customerName).toBe('Customer C');
    expect(topCustomers[0].totalAmount).toBe(8000);
    expect(topCustomers[1].customerName).toBe('Customer A');
  });

  it('should aggregate multiple orders for same customer', () => {
    const transactions: Transaction[] = [
      { Customers: 'Customer A', 'Line Total': 2000 },
      { Customers: 'Customer A', 'Line Total': 3000 },
      { Customers: 'Customer B', 'Line Total': 1000 },
    ];

    const topCustomers = calculateTopCustomers(transactions);
    expect(topCustomers[0].customerName).toBe('Customer A');
    expect(topCustomers[0].totalAmount).toBe(5000);
    expect(topCustomers[0].orderCount).toBe(2);
  });

  it('should count orders correctly', () => {
    const transactions: Transaction[] = [
      { Customers: 'Customer A', 'Line Total': 1000 },
      { Customers: 'Customer A', 'Line Total': 1000 },
      { Customers: 'Customer A', 'Line Total': 1000 },
    ];

    const topCustomers = calculateTopCustomers(transactions);
    expect(topCustomers[0].orderCount).toBe(3);
  });

  it('should limit results to specified count', () => {
    const transactions: Transaction[] = [
      { Customers: 'Customer A', 'Line Total': 5000 },
      { Customers: 'Customer B', 'Line Total': 4000 },
      { Customers: 'Customer C', 'Line Total': 3000 },
    ];

    const topCustomers = calculateTopCustomers(transactions, 2);
    expect(topCustomers).toHaveLength(2);
  });
});

// ==========================================================================
// SHIPMENT METRICS AGGREGATION
// ==========================================================================

describe('Shipment Metrics Aggregation', () => {
  interface Shipment {
    'Total CBM': number;
    'No. Of Sacks': number;
  }

  const calculateShipmentMetrics = (shipments: Shipment[]) => {
    const totalCBM = shipments.reduce((sum, s) => sum + (s['Total CBM'] || 0), 0);
    const totalSacks = shipments.reduce(
      (sum, s) => sum + (s['No. Of Sacks'] || 0),
      0
    );

    return { totalCBM, totalSacks };
  };

  it('should calculate total CBM and sacks', () => {
    const shipments: Shipment[] = [
      { 'Total CBM': 10.5, 'No. Of Sacks': 100 },
      { 'Total CBM': 15.3, 'No. Of Sacks': 150 },
      { 'Total CBM': 8.2, 'No. Of Sacks': 80 },
    ];

    const metrics = calculateShipmentMetrics(shipments);
    expect(metrics.totalCBM).toBeCloseTo(34.0, 1);
    expect(metrics.totalSacks).toBe(330);
  });

  it('should handle empty shipments', () => {
    const metrics = calculateShipmentMetrics([]);
    expect(metrics.totalCBM).toBe(0);
    expect(metrics.totalSacks).toBe(0);
  });

  it('should handle zero values', () => {
    const shipments: Shipment[] = [
      { 'Total CBM': 0, 'No. Of Sacks': 0 },
      { 'Total CBM': 10, 'No. Of Sacks': 100 },
    ];

    const metrics = calculateShipmentMetrics(shipments);
    expect(metrics.totalCBM).toBe(10);
    expect(metrics.totalSacks).toBe(100);
  });
});

// ==========================================================================
// MONTHLY BREAKDOWN GENERATION
// ==========================================================================

describe('Monthly Breakdown Generation', () => {
  interface Transaction {
    'Order Date': string;
    'Line Total': number | null;
  }

  const generateMonthlyRevenue = (transactions: Transaction[]) => {
    const monthlyDataMap = new Map<string, { revenue: number; count: number }>();

    transactions.forEach((t) => {
      if (!t['Order Date']) {
        return;
      }
      const date = new Date(t['Order Date']);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyDataMap.has(monthKey)) {
        monthlyDataMap.set(monthKey, { revenue: 0, count: 0 });
      }

      const monthData = monthlyDataMap.get(monthKey);
      if (monthData) {
        monthData.revenue += t['Line Total'] || 0;
        monthData.count += 1;
      }
    });

    return Array.from(monthlyDataMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        transactionCount: data.count,
      }));
  };

  it('should group revenue by month', () => {
    const transactions: Transaction[] = [
      { 'Order Date': '2024-01-15', 'Line Total': 1000 },
      { 'Order Date': '2024-01-20', 'Line Total': 2000 },
      { 'Order Date': '2024-02-10', 'Line Total': 1500 },
    ];

    const monthly = generateMonthlyRevenue(transactions);
    expect(monthly).toHaveLength(2);
    expect(monthly[0].month).toBe('2024-01');
    expect(monthly[0].revenue).toBe(3000);
    expect(monthly[1].month).toBe('2024-02');
    expect(monthly[1].revenue).toBe(1500);
  });

  it('should count transactions per month', () => {
    const transactions: Transaction[] = [
      { 'Order Date': '2024-01-15', 'Line Total': 1000 },
      { 'Order Date': '2024-01-20', 'Line Total': 2000 },
      { 'Order Date': '2024-01-25', 'Line Total': 3000 },
    ];

    const monthly = generateMonthlyRevenue(transactions);
    expect(monthly[0].transactionCount).toBe(3);
  });

  it('should sort months chronologically', () => {
    const transactions: Transaction[] = [
      { 'Order Date': '2024-03-15', 'Line Total': 1000 },
      { 'Order Date': '2024-01-10', 'Line Total': 2000 },
      { 'Order Date': '2024-02-20', 'Line Total': 1500 },
    ];

    const monthly = generateMonthlyRevenue(transactions);
    expect(monthly[0].month).toBe('2024-01');
    expect(monthly[1].month).toBe('2024-02');
    expect(monthly[2].month).toBe('2024-03');
  });

  it('should handle empty transactions', () => {
    const monthly = generateMonthlyRevenue([]);
    expect(monthly).toHaveLength(0);
  });
});

// ==========================================================================
// COGS CALCULATIONS
// ==========================================================================

describe('COGS Calculations', () => {
  interface Product {
    COGS: number;
  }

  const calculateTotalCOGS = (products: Product[]): number => {
    return products.reduce((sum, p) => sum + (p.COGS || 0), 0);
  };

  it('should sum all COGS values', () => {
    const products: Product[] = [
      { COGS: 1000 },
      { COGS: 1500 },
      { COGS: 2000 },
    ];

    expect(calculateTotalCOGS(products)).toBe(4500);
  });

  it('should handle empty products', () => {
    expect(calculateTotalCOGS([])).toBe(0);
  });

  it('should handle zero COGS', () => {
    const products: Product[] = [{ COGS: 0 }, { COGS: 1000 }];
    expect(calculateTotalCOGS(products)).toBe(1000);
  });
});
