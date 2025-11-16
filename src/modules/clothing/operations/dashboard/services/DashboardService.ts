/**
 * Dashboard Service
 *
 * Business logic for Operations Dashboard module
 *
 * This service handles:
 * - Dashboard data fetching and aggregation
 * - Statistics calculations
 * - Activity tracking
 * - Goal calculations
 */

import { FormatterService } from '@/services/FormatterService';
import type {
  DashboardData,
  DashboardMetrics,
  DashboardStatistic,
  TodayActivity,
  MonthlyGoal,
  RecentActivity,
  IconComponent,
  SalesTrendDataset,
  OrderFunnelStage,
  InventoryAlert,
  ShipmentUpdate,
  TrendRange,
} from '../types/dashboard.types';
import {
  IconCurrencyDollar,
  IconReceipt,
  IconUsers,
  IconPackage,
} from '@tabler/icons-react';

export class DashboardService {
  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  private salesTrendSamples: Record<TrendRange, SalesTrendDataset['points']> = {
    '7d': [
      { dateLabel: 'Mon', revenue: 6100, orders: 48, fulfillmentRate: 94 },
      { dateLabel: 'Tue', revenue: 7200, orders: 51, fulfillmentRate: 92 },
      { dateLabel: 'Wed', revenue: 6800, orders: 47, fulfillmentRate: 90 },
      { dateLabel: 'Thu', revenue: 7500, orders: 55, fulfillmentRate: 95 },
      { dateLabel: 'Fri', revenue: 8100, orders: 59, fulfillmentRate: 96 },
      { dateLabel: 'Sat', revenue: 5400, orders: 39, fulfillmentRate: 88 },
      { dateLabel: 'Sun', revenue: 4300, orders: 33, fulfillmentRate: 85 },
    ],
    '30d': [
      { dateLabel: 'Week 1', revenue: 21500, orders: 205, fulfillmentRate: 90 },
      { dateLabel: 'Week 2', revenue: 24800, orders: 223, fulfillmentRate: 91 },
      { dateLabel: 'Week 3', revenue: 23100, orders: 214, fulfillmentRate: 93 },
      { dateLabel: 'Week 4', revenue: 26200, orders: 238, fulfillmentRate: 95 },
    ],
    '90d': [
      { dateLabel: 'Jan', revenue: 70500, orders: 640, fulfillmentRate: 89 },
      { dateLabel: 'Feb', revenue: 74200, orders: 665, fulfillmentRate: 91 },
      { dateLabel: 'Mar', revenue: 80300, orders: 702, fulfillmentRate: 93 },
    ],
  };

  private orderFunnelStages: OrderFunnelStage[] = [
    { label: 'Prepared', value: 312, delta: 6.2, status: 'positive' },
    { label: 'Packed', value: 268, delta: 2.3, status: 'neutral' },
    { label: 'Shipped', value: 221, delta: -1.2, status: 'negative' },
    { label: 'Delivered', value: 198, delta: 4.5, status: 'positive' },
  ];

  private inventoryAlertsData: InventoryAlert[] = [
    {
      productCode: 'BL-ATH-210',
      description: 'Athleisure set almost depleted in Cebu warehouse',
      severity: 'high',
      stockLevel: 34,
      reorderPoint: 80,
      etaDays: 5,
    },
    {
      productCode: 'TSH-CLASSIC-04',
      description: 'Classic tees seeing unusual sales spike',
      severity: 'medium',
      stockLevel: 140,
      reorderPoint: 120,
      etaDays: 9,
    },
    {
      productCode: 'DRS-EVENING-12',
      description: 'Evening gowns reserved for trunk show',
      severity: 'medium',
      stockLevel: 62,
      reorderPoint: 60,
    },
    {
      productCode: 'ACC-BELT-09',
      description: 'Belts delayed at customs, monitor shipments',
      severity: 'low',
      stockLevel: 220,
      reorderPoint: 150,
      etaDays: 14,
    },
  ];

  private shipmentUpdatesData: ShipmentUpdate[] = [
    {
      shipmentCode: 'SHIP-9381',
      status: 'In Transit',
      location: 'Manila Port',
      timestamp: 'Today • 09:45 AM',
      progress: 68,
    },
    {
      shipmentCode: 'SHIP-9364',
      status: 'Pending',
      location: 'Awaiting pickup • Laguna',
      timestamp: 'Today • 07:20 AM',
      progress: 25,
    },
    {
      shipmentCode: 'SHIP-9348',
      status: 'Delivered',
      location: 'Cebu Fulfillment Center',
      timestamp: 'Yesterday • 05:10 PM',
      progress: 100,
    },
    {
      shipmentCode: 'SHIP-9329',
      status: 'In Transit',
      location: 'Subic Hub',
      timestamp: 'Yesterday • 11:30 AM',
      progress: 82,
    },
  ];

  constructor() {}

  // =========================================================================
  // STATISTICS GENERATION
  // =========================================================================

  /**
   * Generate statistics cards for dashboard
   */
  generateStatistics(metrics: DashboardMetrics): DashboardStatistic[] {
    return [
      {
        title: 'Total Revenue',
        value: FormatterService.formatCurrency(metrics.totalRevenue),
        change: this.formatChange(metrics.revenueChange),
        color: metrics.revenueChange >= 0 ? 'green' : 'red',
        icon: IconCurrencyDollar as unknown as IconComponent,
      },
      {
        title: 'Active Orders',
        value: FormatterService.formatNumber(metrics.activeOrders, 0),
        change: this.formatChange(metrics.ordersChange),
        color: metrics.ordersChange >= 0 ? 'blue' : 'red',
        icon: IconReceipt as unknown as IconComponent,
      },
      {
        title: 'Customers',
        value: FormatterService.formatNumber(metrics.totalCustomers, 0),
        change: this.formatChange(metrics.customersChange),
        color: metrics.customersChange >= 0 ? 'violet' : 'red',
        icon: IconUsers as unknown as IconComponent,
      },
      {
        title: 'Products',
        value: FormatterService.formatNumber(metrics.totalProducts, 0),
        change: this.formatChange(metrics.productsChange),
        color: metrics.productsChange >= 0 ? 'orange' : 'red',
        icon: IconPackage as unknown as IconComponent,
      },
    ];
  }

  // =========================================================================
  // GOAL CALCULATIONS
  // =========================================================================

  /**
   * Calculate monthly goal progress
   */
  calculateMonthlyGoal(current: number, target: number): MonthlyGoal {
    const percentage = target > 0 ? Math.round((current / target) * 100) : 0;

    return {
      current,
      target,
      percentage: Math.min(percentage, 100), // Cap at 100%
    };
  }

  // =========================================================================
  // UTILITY FUNCTIONS
  // =========================================================================

  /**
   * Format percentage change with + or - sign
   */
  formatChange(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }

  /**
   * Format time ago string
   */
  formatTimeAgo(date: Date): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) {
      return 'Just now';
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  // =========================================================================
  // DATA AGGREGATION
  // =========================================================================

  /**
   * Aggregate dashboard data from multiple sources
   * In real implementation, this would fetch from APIs/database
   */
  async aggregateDashboardData(): Promise<DashboardData> {
    // FUTURE: Replace with actual API calls
    // Currently using mock data for dashboard demonstration
    // Backend endpoints to be implemented: /api/dashboard/metrics, /api/dashboard/activity

    const metrics: DashboardMetrics = {
      totalRevenue: 45231,
      activeOrders: 234,
      totalCustomers: 1432,
      totalProducts: 856,
      revenueChange: 12.5,
      ordersChange: 8.2,
      customersChange: 3.1,
      productsChange: 5.4,
    };

    const todayActivity: TodayActivity = {
      newOrders: 23,
      pendingShipments: 12,
      lowStockItems: 5,
    };

    const monthlyGoal = this.calculateMonthlyGoal(45231, 75000);

    const recentActivities: RecentActivity[] = [
      {
        action: 'New summer collection order received',
        time: '2 minutes ago',
        color: 'green',
      },
      {
        action: 'T-shirt inventory updated',
        time: '15 minutes ago',
        color: 'blue',
      },
      {
        action: 'Customer size inquiry',
        time: '1 hour ago',
        color: 'orange',
      },
      {
        action: 'Bulk order shipped to retailer',
        time: '2 hours ago',
        color: 'violet',
      },
    ];

    return {
      metrics,
      todayActivity,
      monthlyGoal,
      recentActivities,
      salesTrends: (['7d', '30d', '90d'] as TrendRange[]).map((range) => ({
        range,
        points: this.salesTrendSamples[range],
      })),
      orderFunnel: this.orderFunnelStages,
      inventoryAlerts: this.inventoryAlertsData,
      shipmentUpdates: this.shipmentUpdatesData,
    };
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();
