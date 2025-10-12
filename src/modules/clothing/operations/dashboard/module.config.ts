/**
 * Dashboard Module Configuration
 *
 * ==============================================================================
 * Module: Dashboard (Clothing → Operations)
 * ==============================================================================
 *
 * This module handles the operations dashboard displaying:
 * - Real-time business metrics and KPIs
 * - Statistics cards (Revenue, Orders, Customers, Products)
 * - Monthly goal tracking
 * - Today's activity summary
 * - Recent activities feed
 */

import { IconDashboard } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const dashboardModule: ModuleConfig = {
  id: 'clothing-dashboard',
  name: 'Dashboard',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Dashboard',
      path: '/clothing/operations/dashboard',
      icon: IconDashboard as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 0, // First item in navigation
      business: ['clothing'],
      workspace: ['operations'],
    },
  ],

  routes: [
    {
      path: '/clothing/operations/dashboard',
      component: async () => {
        const { DashboardPage } = await import('./components/DashboardPage');
        return { default: DashboardPage };
      },
      protected: true,
    },
  ],

  permissions: ['admin', 'manager', 'operations'],

  metadata: {
    description:
      'Operations dashboard with real-time metrics and business intelligence',
    tags: ['dashboard', 'metrics', 'kpis', 'operations', 'analytics'],
  },
};
