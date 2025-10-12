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
}
