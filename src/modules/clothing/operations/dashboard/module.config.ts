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
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const dashboardModule = createOperationsModuleConfig({
  id: 'clothing-dashboard',
  name: 'Dashboard',
  path: '/clothing/operations/dashboard',
  icon: IconDashboard,
  order: 0,
  business: ['clothing'],
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
});
