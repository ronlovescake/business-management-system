/**
 * GM Dashboard Module Configuration
 */

import { IconDashboard } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandiseDashboardModule: ModuleConfig = {
  id: 'general-merchandise-dashboard',
  name: 'Dashboard',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Dashboard',
      path: '/general-merchandise/operations/dashboard',
      icon: IconDashboard as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 0,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],

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
};
