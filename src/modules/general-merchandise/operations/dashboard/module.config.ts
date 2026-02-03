/**
 * GM Dashboard Module Configuration
 */

import { IconDashboard } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandiseDashboardModule = createOperationsModuleConfig({
  id: 'general-merchandise-dashboard',
  name: 'Dashboard',
  path: '/general-merchandise/operations/dashboard',
  icon: IconDashboard,
  order: 0,
  business: ['general-merchandise'],
  routes: [
    {
      path: '/general-merchandise/operations/dashboard',
      component: async () => {
        const { default: Page } = await import(
          '@/app/general-merchandise/operations/dashboard/page'
        );
        return { default: Page };
      },
      protected: true,
    },
  ],
  permissions: ['admin', 'manager', 'operations'],
  metadata: {
    description:
      'Operations dashboard with GM metrics and business intelligence',
    tags: ['dashboard', 'metrics', 'kpis', 'operations', 'analytics'],
  },
});
