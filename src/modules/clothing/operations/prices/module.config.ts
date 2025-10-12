import { IconCurrencyDollar } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

/**
 * Prices Module Configuration
 * Registers the prices module in the application's module registry
 */
export const pricesModule: ModuleConfig = {
  id: 'clothing-prices',
  name: 'Prices',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Prices',
      path: '/clothing/operations/prices',
      icon: IconCurrencyDollar as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 3, // After customers (2)
      business: ['clothing'],
      workspace: ['operations'],
    },
  ],

  routes: [
    {
      path: '/clothing/operations/prices',
      component: async () => {
        const { PricesPage } = await import('./components/PricesPage');
        return { default: PricesPage };
      },
      protected: true,
    },
  ],

  permissions: ['admin', 'manager', 'operations'],

  metadata: {
    description:
      'Manage product pricing with tier support, bulk adjustments, and CSV import/export',
    tags: ['prices', 'pricing', 'tiers', 'adjustments', 'operations'],
  },
};
