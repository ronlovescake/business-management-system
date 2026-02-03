import { IconCurrencyDollar } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

/**
 * Prices Module Configuration
 * Registers the prices module in the application's module registry
 */
export const pricesModule = createOperationsModuleConfig({
  id: 'clothing-prices',
  name: 'Prices',
  path: '/clothing/operations/prices',
  icon: IconCurrencyDollar,
  order: 3,
  business: ['clothing'],
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
});
