/**
 * Dashboard Types
 *
 * Core type definitions for Operations Dashboard module
 */

import type { ComponentType } from 'react';

// ============================================================================
// ICON TYPE
// ============================================================================

export type IconComponent = ComponentType<{ size?: number; stroke?: number }>;

// ============================================================================
// STATISTICS & METRICS
// ============================================================================

export interface DashboardStatistic {
  title: string;
  value: string;
  change: string;
  color: 'green' | 'blue' | 'violet' | 'orange' | 'pink' | 'red' | 'yellow';
  icon: IconComponent;
}

export interface DashboardMetrics {
  totalRevenue: number;
  activeOrders: number;
  totalCustomers: number;
  totalProducts: number;
  revenueChange: number;
  ordersChange: number;
  customersChange: number;
  productsChange: number;
}

// ============================================================================
// TREND DATA
// ============================================================================

export type TrendRange = '7d' | '30d' | '90d';

export interface SalesTrendPoint {
  dateLabel: string;
  revenue: number;
  orders: number;
  fulfillmentRate: number;
}

export interface SalesTrendDataset {
  range: TrendRange;
  points: SalesTrendPoint[];
}

// ============================================================================
// ORDER PIPELINE & INVENTORY
// ============================================================================

export interface OrderFunnelStage {
  label: string;
  value: number;
  delta: number;
  status: 'positive' | 'neutral' | 'negative';
}

export interface InventoryAlert {
  productCode: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  stockLevel: number;
  reorderPoint: number;
  etaDays?: number;
}

// ============================================================================
// SHIPMENT TRACKING
// ============================================================================

export interface ShipmentUpdate {
  shipmentCode: string;
  status: 'Pending' | 'In Transit' | 'Delivered';
  location: string;
  timestamp: string;
  progress: number;
}

// ============================================================================
// ACTIVITY & GOALS
// ============================================================================

export interface TodayActivity {
  newOrders: number;
  pendingShipments: number;
  lowStockItems: number;
}

export interface MonthlyGoal {
  current: number;
  target: number;
  percentage: number;
}

export interface RecentActivity {
  action: string;
  time: string;
  color: 'green' | 'blue' | 'violet' | 'orange' | 'pink' | 'red' | 'yellow';
  icon?: IconComponent;
}

// ============================================================================
// DASHBOARD DATA
// ============================================================================

export interface DashboardData {
  metrics: DashboardMetrics;
  todayActivity: TodayActivity;
  monthlyGoal: MonthlyGoal;
  recentActivities: RecentActivity[];
  salesTrends: SalesTrendDataset[];
  orderFunnel: OrderFunnelStage[];
  inventoryAlerts: InventoryAlert[];
  shipmentUpdates: ShipmentUpdate[];
}
